import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import initSqlJs from "sql.js/dist/sql-asm.js";

import {
  parseLocalAnkiPackage,
  parseLocalFlashNFlipPackage,
} from "./local-file-import";

const ankiPackage = async (extra?: (zip: JSZip) => void) => {
  const SQL = await initSqlJs();
  const database = new SQL.Database();
  database.run(`
    CREATE TABLE col (ver INTEGER, models TEXT, decks TEXT);
    CREATE TABLE notes (id INTEGER, mid INTEGER, tags TEXT, flds TEXT);
    CREATE TABLE cards (id INTEGER, nid INTEGER, did INTEGER, odid INTEGER, ord INTEGER);
  `);
  database.run("INSERT INTO col VALUES (?, ?, ?)", [
    11,
    JSON.stringify({
      7: {
        id: 7,
        name: "Basic",
        type: 0,
        flds: [
          { name: "Front", ord: 0 },
          { name: "Back", ord: 1 },
        ],
        tmpls: [
          {
            ord: 0,
            qfmt: "{{Front}}",
            afmt: "{{FrontSide}}<hr id=answer>{{Back}}",
          },
        ],
      },
    }),
    JSON.stringify({ 5: { id: 5, name: "Languages::Icelandic" } }),
  ]);
  database.run("INSERT INTO notes VALUES (?, ?, ?, ?)", [
    10,
    7,
    "safe-tag",
    "Halló\u001fHello [sound:voice.mp3]",
  ]);
  database.run("INSERT INTO cards VALUES (?, ?, ?, ?, ?)", [20, 10, 5, 0, 0]);
  const zip = new JSZip();
  zip.file("collection.anki2", database.export());
  zip.file("media", JSON.stringify({ 0: "voice.mp3" }));
  zip.file("0", Uint8Array.from([0x49, 0x44, 0x33, 1, 2, 3]));
  extra?.(zip);
  database.close();
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return new File([bytes.slice().buffer as ArrayBuffer], "icelandic.apkg");
};

describe("local file import", () => {
  it("parses a classic APKG with hierarchy and original audio locally", async () => {
    const result = await parseLocalAnkiPackage(await ankiPackage());

    expect(result.title).toBe("Languages");
    expect(result.decks[0]?.path).toEqual(["Languages", "Icelandic"]);
    expect(result.decks[0]?.cards).toHaveLength(1);
    expect(result.media).toEqual([
      expect.objectContaining({
        sourceName: "voice.mp3",
        mimeType: "audio/mpeg",
        kind: "audio",
      }),
    ]);
    expect(result.decks[0]?.cards[0]?.back.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "importAudio",
          sourceName: "voice.mp3",
        }),
      ]),
    );
  });

  it("rejects archive traversal paths before reading package content", async () => {
    const file = await ankiPackage((zip) => zip.file("../escape", "unsafe"));
    await expect(parseLocalAnkiPackage(file)).rejects.toThrow(
      "unsicheren Dateipfad",
    );
  });

  it("rejects Unicode-colliding archive names", async () => {
    const file = await ankiPackage((zip) => {
      zip.file("media/e\u0301.txt", "first");
      zip.file("media/é.txt", "second");
    });
    await expect(parseLocalAnkiPackage(file)).rejects.toThrow(
      "doppelte Unicode-Dateinamen",
    );
  });

  it("accepts the portable local FNF generation and rejects executable content", async () => {
    const safe = {
      format: "flash-n-flip.local-package",
      version: 1,
      title: "Portable",
      decks: [
        {
          sourceId: "deck",
          path: ["Portable"],
          cards: [
            {
              sourceId: "card",
              sourceNoteId: "note",
              front: {
                blocks: [
                  { type: "markdown", revealMode: "ALL", source: "Question" },
                ],
              },
              back: {
                blocks: [
                  { type: "markdown", revealMode: "ALL", source: "Answer" },
                ],
              },
              tags: [],
            },
          ],
        },
      ],
      media: [],
    };
    const result = await parseLocalFlashNFlipPackage(
      new File([JSON.stringify(safe)], "portable.fnf"),
    );
    expect(result.title).toBe("Portable");

    const unsafe = structuredClone(safe);
    unsafe.decks[0]!.cards[0]!.front = {
      blocks: [{ type: "script", source: "alert(1)" }],
    } as (typeof safe.decks)[number]["cards"][number]["front"];
    await expect(
      parseLocalFlashNFlipPackage(
        new File([JSON.stringify(unsafe)], "unsafe.fnf"),
      ),
    ).rejects.toThrow();

    const corruptMedia = {
      ...structuredClone(safe),
      media: [
        {
          sourceName: "00000000-0000-4000-8000-000000000099",
          mimeType: "audio/mpeg",
          sha256: "0".repeat(64),
          dataBase64: btoa("ID3audio"),
        },
      ],
    };
    await expect(
      parseLocalFlashNFlipPackage(
        new File([JSON.stringify(corruptMedia)], "corrupt.fnf"),
      ),
    ).rejects.toThrow(/beschädigt/i);
  });
});
