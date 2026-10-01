import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createWriteStream, openAsBlob } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

import { LocalAppRepository } from "../../packages/direct-connect-webstack/src/local-app.ts";
import {
  localBackupBlob,
  readLocalBackupFile,
} from "../../apps/web/lib/local-backup-file.ts";

const requireWeb = createRequire(
  new URL("../../apps/web/package.json", import.meta.url),
);
Object.assign(globalThis, requireWeb("fake-indexeddb"));

const mediaCount = 26;
const mediaBytes = 8 * 1024 * 1024;
const sourceDevice = "00000000-0000-4000-8000-000000000301";
const targetDevice = "00000000-0000-4000-8000-000000000302";
const script = fileURLToPath(import.meta.url);

async function summary(repository: LocalAppRepository) {
  return {
    decks: await repository.listDecks(),
    cards: await repository.listCards(),
    reviews: await repository.listReviews(),
    settings: await repository.settings(),
    plans: await repository.listNamedStudyPlans(),
    references: await repository.listMedia(),
    journal: await repository.authority.listMutationJournal(),
    outbox: await repository.authority.listOutbox(),
  };
}

async function exportFixture(directory: string) {
  const repository = new LocalAppRepository(sourceDevice);
  const deckId = await repository.saveDeck({
    title: "Synthetic recovery over 256 MiB 🌻",
  });
  const cardIds: string[] = [];
  for (let index = 0; index < mediaCount; index++) {
    const bytes = new Uint8Array(mediaBytes);
    for (let position = 0; position < bytes.length; position++)
      bytes[position] = (position + index) % 251;
    const mediaId = await repository.addMedia({
      deckId,
      fileName: `synthetic-${index}.png`,
      mimeType: "image/png",
      bytes,
    });
    cardIds.push(
      await repository.saveCard({
        deckId,
        front: {
          blocks: [
            {
              type: "image",
              mediaId,
              alt: `Synthetic bytes ${index}`,
              decorative: false,
            },
          ],
        },
        back: `Answer ${index}`,
        position: index,
      }),
    );
  }
  for (const [index, cardId] of cardIds.slice(0, 3).entries())
    await repository.reviewCard(
      cardId,
      "GOOD",
      new Date(`2026-10-02T08:0${index}:00Z`),
    );
  await repository.saveSettings({ locale: "fr", theme: "DARK", dailyGoal: 20 });
  await repository.saveNamedStudyPlan({
    id: crypto.randomUUID(),
    title: "Synthetic plan",
    deckIds: [deckId],
  });
  await writeFile(
    join(directory, "expected.json"),
    JSON.stringify(await summary(repository)),
  );
  const blob = await localBackupBlob(repository.exportAllSegments());
  assert(
    blob.size > 256 * 1024 * 1024,
    "Must exercise the former native size failure",
  );
  await pipeline(
    Readable.fromWeb(
      blob.stream() as import("node:stream/web").ReadableStream<Uint8Array>,
    ),
    createWriteStream(join(directory, "backup.json")),
  );
  console.log(
    JSON.stringify({
      phase: "export",
      bytes: blob.size,
      mediaCount,
      maximumRssKiB: process.resourceUsage().maxRSS,
    }),
  );
}

async function restoreFixture(directory: string) {
  const repository = new LocalAppRepository(targetDevice);
  const file = await openAsBlob(join(directory, "backup.json"));
  await repository.restoreAllFromStream(readLocalBackupFile(file));
  const expected = JSON.parse(
    await readFile(join(directory, "expected.json"), "utf8"),
  );
  // Restarted process and fresh IndexedDB contain the same content, progress,
  // original review IDs, scheduler state, settings, journal and pending outbox.
  assert.deepEqual(await summary(repository), expected);
  for (const reference of await repository.listMedia()) {
    const media = await repository.getMedia(reference.id);
    assert(media);
    assert.equal(media.bytes.byteLength, mediaBytes);
    const hash = Buffer.from(
      await crypto.subtle.digest("SHA-256", media.bytes.slice().buffer),
    ).toString("hex");
    assert.equal(hash, reference.payload.sha256);
  }
  console.log(
    JSON.stringify({
      phase: "restore",
      verifiedMedia: mediaCount,
      reviews: expected.reviews.length,
      maximumRssKiB: process.resourceUsage().maxRSS,
    }),
  );
}

const [phase, directory] = process.argv.slice(2);
if (phase === "export") await exportFixture(directory!);
else if (phase === "restore") await restoreFixture(directory!);
else {
  const temporary = await mkdtemp(join(tmpdir(), "fnf-large-backup-"));
  const started = performance.now();
  try {
    for (const childPhase of ["export", "restore"]) {
      const result = spawnSync(
        process.execPath,
        [...process.execArgv, script, childPhase, temporary],
        { encoding: "utf8", maxBuffer: 1024 * 1024 },
      );
      process.stdout.write(result.stdout);
      process.stderr.write(result.stderr);
      assert.equal(result.status, 0, `Separate ${childPhase} process failed`);
    }
    console.log(
      JSON.stringify({
        result: "passed",
        bytes: (await stat(join(temporary, "backup.json"))).size,
        seconds: Number(((performance.now() - started) / 1000).toFixed(2)),
        boundary:
          "Synthetic Node/IndexedDB backup roundtrip; no native device claim",
      }),
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
