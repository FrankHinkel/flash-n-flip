import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import yazl from "yazl";
import { afterEach, describe, expect, it } from "vitest";

import { parseAnkiPackage } from "./anki-package.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const zip = async (
  entries: Array<{ name: string; data: Buffer }>,
): Promise<Buffer> => {
  const archive = new yazl.ZipFile();
  for (const entry of entries) archive.addBuffer(entry.data, entry.name);
  archive.end();
  const chunks: Buffer[] = [];
  for await (const chunk of archive.outputStream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const legacyCollection = async (): Promise<Buffer> => {
  const directory = await mkdtemp(join(tmpdir(), "flashcards-anki-test-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "collection.anki2");
  const sqlite = new DatabaseSync(path);
  sqlite.exec(`
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
    "100": {
      id: 100,
      name: "Basic and reversed",
      type: 0,
      flds: [
        { name: "Front", ord: 0 },
        { name: "Back", ord: 1 },
      ],
      tmpls: [
        {
          name: "Card 1",
          ord: 0,
          qfmt: "{{Front}}",
          afmt: "{{FrontSide}}<hr id=answer>{{Back}}",
        },
        {
          name: "Card 2",
          ord: 1,
          qfmt: "{{Back}}",
          afmt: "{{FrontSide}}<hr id=answer>{{Front}}",
        },
      ],
    },
  };
  const decks = {
    "200": { id: 200, name: "Geografie::Hauptstädte" },
  };
  sqlite
    .prepare("INSERT INTO col VALUES (1,0,0,0,11,0,0,0,'?',?,?, '{}','{}')")
    .run(JSON.stringify(models), JSON.stringify(decks));
  sqlite
    .prepare(
      "INSERT INTO notes VALUES (300,'guid',100,0,0,' geography capital ',?,0,0,0,'')",
    )
    .run(
      '<b>Berlin</b><img src="pixel.png" alt="Deutschlandkarte" onerror="alert(1)">\u001f[sound:answer.mp3]Deutschland<script>alert(1)</script>',
    );
  const insertCard = sqlite.prepare(
    "INSERT INTO cards VALUES (?,300,200,?,0,0,0,0,0,0,0,0,0,0,0,0,0,'')",
  );
  insertCard.run(400, 0);
  insertCard.run(401, 1);
  sqlite.close();
  return readFile(path);
};

describe("parseAnkiPackage", () => {
  it("imports a legacy package with templates, subdecks, images and audio", async () => {
    const collection = await legacyCollection();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    const mp3 = Buffer.from([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0]);
    const archive = await zip([
      { name: "collection.anki2", data: collection },
      {
        name: "media",
        data: Buffer.from(
          JSON.stringify({ "0": "pixel.png", "1": "answer.mp3" }),
        ),
      },
      { name: "0", data: png },
      { name: "1", data: mp3 },
    ]);

    const result = await parseAnkiPackage(archive, {
      maximumMediaBytes: 1024 * 1024,
    });

    expect(result.packageVersion).toBe("legacy");
    expect(result.decks).toHaveLength(1);
    expect(result.decks[0]?.title).toBe("Geografie › Hauptstädte");
    expect(result.decks[0]?.cards).toHaveLength(2);
    expect(result.media.map((item) => item.mimeType).sort()).toEqual([
      "audio/mpeg",
      "image/png",
    ]);
    expect(JSON.stringify(result.decks)).not.toMatch(/script|onerror|alert/i);
    expect(result.decks[0]?.cards[0]?.front.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text", text: "Berlin" }),
        expect.objectContaining({
          type: "image",
          sourceName: "pixel.png",
          alt: "Deutschlandkarte",
        }),
      ]),
    );
    expect(result.decks[0]?.cards[0]?.back.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "audio",
          sourceName: "answer.mp3",
        }),
        expect.objectContaining({ type: "text", text: "Deutschland" }),
      ]),
    );
    expect(result.decks[0]?.cards[1]?.front.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "text", text: "Deutschland" }),
      ]),
    );
  });

  it("imports the current zstd and protobuf package format", async () => {
    const archive = await zip([
      { name: "meta", data: Buffer.from([0x08, 0x03]) },
      {
        name: "collection.anki21b",
        data: Buffer.from(
          "KLUv/QRYRRoABqaDQiDLpg2ABR9AEoB7uYKsAQwIQDCxeeW0Zo+eVrtoZadLRCSy1p1AFCPr8v75gZPShIYrV6C3R/DTIyWG3eIoxWkyBXAAcABtABXbjvuE2mPFMkfs3i7HrnMc1S2OtsR2c3FXrfZsI7UbMYZMSEZQYghlJNSgBPJtVlqvSHYHp3ddF0WBmB4GVpBQ4QyY2DBxocLgeRhI/X+lwQLHe/49xP9TD//f8/8xIvj3nuI9Ypd46yzWbk0YnAQ9q5Vz8nJ1b92nzK6KpV3tJFRu1DWmEYPgdMtpKTyEWEAbXrlRr13nAycIAxGc3mqzjtPDwLioTQETtSt6x97plG5XIghEt46YZrO8dc8bkeK1y8vh2jNYnobGRUVoJhDNdhPpK4pZY6xn5h2flUcIGj3rncWe695dSYyU2k6rIIQ1A8J38R3sFHKx3qVEsqiqqqqAED4I4XteBQfrOVjv/yvQrVTjiGVZzzvqtKrgyfe8emqunldP2fI+n4t6Ibjj82ac3oxrEkeM2k574F3nT4smwAkku6SavJnWAdusCT4+qAUmAP8vU9qmJCGRRHZd4VmGUBt3CkipVKk9EWBRKpFIEpyOSLcsoRdCDPgokRfrXzg9662Adi74NhPblCS0cyHxNhwZq4P1Mpbm/znT8g6EBD6Cfmasn8nw2KugRvMfCpYrxvqYbUoRBA8Oc3zQ3Gn+IHaoMZWD1IzIyCQpSJIOUAIxjkwVJR0SQPBRBsIwikExAmSItMoJJx6JoUhGGT0DUAoEoMzifgCQLfIAlAut0OQ+dbQHNwxAoVAYrA8OFQBy17JfVgzALhLOP2z1TjUAe4ZxkB5nOsZovHpH9wFY6cdvCSdEng5jBww24qOkbUN8sVFvBtbggyARwoJ1BwbjnkeNxk7hGBBPgTzqGzFn3SvPRHB2dp5j5CSP2nXL1Pq5dLIcBe/oEhRll5FBDivr4uTQrX65bKKSnA02OO7ly2njHBNlJMfJzKrU3dWzPMkOA/3qiL6pjyF8A7pMembO1PO3O5w6VTYHS7EngPx3lDwXnIzydl1ThqbQMalpwWToTr2gu5S3ymLOHYWVusiGKx8HrFiAg+e9ytoehj5PsOPbE14ZAVADpzfH/w==",
          "base64",
        ),
      },
      {
        name: "media",
        data: Buffer.from("KLUv/QRYgQAACg4KCmxhdGVzdC5tcDMQCnKRUZo=", "base64"),
      },
      {
        name: "0",
        data: Buffer.from("KLUv/QRYUQAASUQzBAAAAAAAALEmKwA=", "base64"),
      },
    ]);

    const result = await parseAnkiPackage(archive, {
      maximumMediaBytes: 1024 * 1024,
    });

    expect(result.packageVersion).toBe("latest");
    expect(result.decks[0]?.title).toBe("Current › Deck");
    expect(result.decks[0]?.cards[0]?.front.blocks).toContainEqual({
      type: "text",
      text: "Current front",
    });
    expect(result.decks[0]?.cards[0]?.back.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "audio",
          sourceName: "latest.mp3",
        }),
        expect.objectContaining({ type: "text", text: "Current back" }),
      ]),
    );
    expect(result.media).toEqual([
      expect.objectContaining({
        sourceName: "latest.mp3",
        mimeType: "audio/mpeg",
      }),
    ]);
  });

  it("rejects archive paths instead of extracting them", async () => {
    const archive = await zip([
      { name: "nested/collection.anki2", data: Buffer.from("not sqlite") },
    ]);
    await expect(
      parseAnkiPackage(archive, { maximumMediaBytes: 1024 }),
    ).rejects.toThrow(/unsicheren Dateipfad/);
  });
});
