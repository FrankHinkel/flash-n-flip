import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const requireFromApi = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
const yazl = requireFromApi("yazl");
const fixedModifiedAt = new Date("2026-08-11T00:00:00.000Z");
const outputPath = fileURLToPath(
  new URL("./fixtures/xefjord-german-parity.apkg", import.meta.url),
);

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "flash-n-flip-xefjord-parity-"),
);

try {
  const collectionPath = join(temporaryDirectory, "collection.anki2");
  const database = new DatabaseSync(collectionPath);
  database.exec(`
    CREATE TABLE col (
      id integer PRIMARY KEY, crt integer NOT NULL, mod integer NOT NULL,
      scm integer NOT NULL, ver integer NOT NULL, dty integer NOT NULL,
      usn integer NOT NULL, ls integer NOT NULL, conf text NOT NULL,
      models text NOT NULL, decks text NOT NULL, dconf text NOT NULL,
      tags text NOT NULL
    );
    CREATE TABLE notes (
      id integer PRIMARY KEY, guid text NOT NULL, mid integer NOT NULL,
      mod integer NOT NULL, usn integer NOT NULL, tags text NOT NULL,
      flds text NOT NULL, sfld integer NOT NULL, csum integer NOT NULL,
      flags integer NOT NULL, data text NOT NULL
    );
    CREATE TABLE cards (
      id integer PRIMARY KEY, nid integer NOT NULL, did integer NOT NULL,
      ord integer NOT NULL, mod integer NOT NULL, usn integer NOT NULL,
      type integer NOT NULL, queue integer NOT NULL, due integer NOT NULL,
      ivl integer NOT NULL, factor integer NOT NULL, reps integer NOT NULL,
      lapses integer NOT NULL, left integer NOT NULL, odue integer NOT NULL,
      odid integer NOT NULL, flags integer NOT NULL, data text NOT NULL
    );
  `);
  const models = {
    100: {
      id: 100,
      name: "Xefjord German Phrase",
      type: 0,
      flds: [
        { name: "Phrase", ord: 0 },
        { name: "Phrase Translation", ord: 1 },
        { name: "Audio", ord: 2 },
      ],
      tmpls: [
        {
          name: "Recognition",
          ord: 0,
          qfmt: "{{Phrase}}<br>German",
          afmt: "{{FrontSide}}<hr id=answer>{{Phrase Translation}}",
        },
        {
          name: "Production",
          ord: 1,
          qfmt: "{{Phrase Translation}}<br>To German",
          afmt: "{{FrontSide}}<hr id=answer>{{Phrase}}{{Audio}}",
        },
      ],
    },
  };
  const decks = {
    200: {
      id: 200,
      name: "Xefjord's Complete German::Basic German Words and Phrases",
    },
  };
  database
    .prepare("INSERT INTO col VALUES (1,0,0,0,11,0,0,0,'?',?,?, '{}','{}')")
    .run(JSON.stringify(models), JSON.stringify(decks));
  database
    .prepare(
      "INSERT INTO notes VALUES (300,'synthetic-xefjord-german',100,0,0,' parity ',?,0,0,0,'')",
    )
    .run("Willkommen\u001fWelcome\u001f[sound:german-willkommen.mp3]");
  for (const [id, ordinal] of [
    [400, 0],
    [401, 1],
  ]) {
    database
      .prepare(
        "INSERT INTO cards VALUES (?,300,200,?,0,0,0,0,0,0,0,0,0,0,0,0,0,'')",
      )
      .run(id, ordinal);
  }
  database.close();

  const archive = new yazl.ZipFile();
  archive.addFile(collectionPath, "collection.anki2", {
    mtime: fixedModifiedAt,
    mode: 0o100644,
  });
  archive.addBuffer(
    Buffer.from(JSON.stringify({ 0: "german-willkommen.mp3" })),
    "media",
    { mtime: fixedModifiedAt, mode: 0o100644 },
  );
  archive.addBuffer(
    Buffer.from([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0]),
    "0",
    { mtime: fixedModifiedAt, mode: 0o100644 },
  );
  archive.end();
  const chunks = [];
  for await (const chunk of archive.outputStream) {
    chunks.push(Buffer.from(chunk));
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.concat(chunks));

  const fixture = await readFile(outputPath);
  process.stdout.write(
    `Generated ${outputPath} (${String(fixture.byteLength)} bytes)\n`,
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
