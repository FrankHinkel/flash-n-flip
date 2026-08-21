import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import initSqlJs from "sql.js/dist/sql-asm.js";

import {
  detectAnkiPreviewLanguageDirection,
  parseLocalAnkiPackage,
  parseLocalFlashNFlipPackage,
} from "./local-file-import";
import { automaticAnkiTemplateProfileId } from "@flashcards/domain/anki-import-profile";
import type { AnkiImportPreview } from "@flashcards/domain/anki-import-plan";

const ankiPackage = async (
  extra?: (zip: JSZip) => void,
  back = "Hello",
  audio = "[sound:voice.mp3]",
) => {
  const SQL = await initSqlJs();
  const database = new SQL.Database();
  database.run(`
    CREATE TABLE col (ver INTEGER, models TEXT, decks TEXT);
    CREATE TABLE notes (id INTEGER, guid TEXT, mid INTEGER, tags TEXT, flds TEXT, flags INTEGER);
    CREATE TABLE cards (id INTEGER, nid INTEGER, did INTEGER, odid INTEGER, ord INTEGER, type INTEGER, queue INTEGER, flags INTEGER);
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
          { name: "Audio", ord: 2 },
        ],
        tmpls: [
          {
            ord: 0,
            qfmt: "{{Front}}",
            afmt: "{{FrontSide}}<hr id=answer>{{Back}} {{Audio}}",
          },
        ],
      },
    }),
    JSON.stringify({ 5: { id: 5, name: "Languages::Icelandic" } }),
  ]);
  database.run("INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?)", [
    10,
    "stable-guid",
    7,
    "safe-tag",
    `<b>Halló</b>\u001f${back}\u001f${audio}`,
    0,
  ]);
  database.run(
    "INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [20, 10, 5, 0, 0, 0, 0, 0],
  );
  const zip = new JSZip();
  zip.file("collection.anki2", database.export());
  zip.file("media", JSON.stringify({ 0: "voice.mp3" }));
  zip.file("0", Uint8Array.from([0x49, 0x44, 0x33, 1, 2, 3]));
  extra?.(zip);
  database.close();
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return new File([bytes.slice().buffer as ArrayBuffer], "icelandic.apkg");
};

describe("local Anki language detection", () => {
  it("uses a bounded primary-field sample and keeps monolingual pairs valid", () => {
    const preview = {
      xefjordPreset: {
        detected: false,
        directImportAvailable: false,
        suggestedSourceLocale: null,
        suggestedTargetLocale: null,
      },
      noteTypes: [
        {
          fields: [
            {
              suggestedRole: "PRIMARY_A",
              sample: "Was ist das und wie ist die richtige Antwort?",
              sampleValues: ["Das ist eine deutsche Frage mit einer Antwort."],
            },
            {
              suggestedRole: "PRIMARY_B",
              sample: "Das ist die Antwort und sie ist nicht übersetzt.",
              sampleValues: ["Wie ist das mit einer weiteren Antwort?"],
            },
          ],
        },
      ],
    } as AnkiImportPreview;

    expect(detectAnkiPreviewLanguageDirection(preview)).toMatchObject({
      sourceLocale: "de",
      targetLocale: "de",
    });
  });
});

const templateDrivenAnkiPackage = async () => {
  const SQL = await initSqlJs();
  const database = new SQL.Database();
  database.run(`
    CREATE TABLE col (ver INTEGER, models TEXT, decks TEXT);
    CREATE TABLE notes (id INTEGER, guid TEXT, mid INTEGER, tags TEXT, flds TEXT, flags INTEGER);
    CREATE TABLE cards (id INTEGER, nid INTEGER, did INTEGER, odid INTEGER, ord INTEGER, type INTEGER, queue INTEGER, flags INTEGER);
  `);
  database.run("INSERT INTO col VALUES (?, ?, ?)", [
    11,
    JSON.stringify({
      8: {
        id: 8,
        name: "Unknown community note type",
        type: 0,
        flds: [
          { name: "Front", ord: 0 },
          { name: "Back", ord: 1 },
          { name: "Hint", ord: 2 },
          { name: "Stored only", ord: 3 },
        ],
        tmpls: [
          {
            name: "Recognition",
            ord: 0,
            qfmt: `{{#Tags}}<div>TAGS: {{Tags}}</div>{{/Tags}}{{#Front}}<img src="author's_logo.png"><b>{{Front}}</b>{{/Front}}{{#Hint}} ({{Hint}}){{/Hint}}`,
            afmt: "{{FrontSide}}<section>{{Front}}{{#Hint}} ({{Hint}}){{/Hint}}</section><br><br><section>{{Back}}</section>",
          },
          {
            name: "Production",
            ord: 1,
            qfmt: "{{Back}}",
            afmt: "{{FrontSide}}<hr id=answer>{{Front}}",
          },
        ],
      },
    }),
    JSON.stringify({ 6: { id: 6, name: "Community::Unseen" } }),
  ]);
  database.run("INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?)", [
    11,
    "generic-guid",
    8,
    "community-tag",
    "Halló\u001fHello\u001fgreeting\u001fretained metadata",
    0,
  ]);
  database.run(
    "INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)",
    [21, 11, 6, 0, 0, 0, 0, 0, 22, 11, 6, 0, 1, 0, 0, 0],
  );
  const zip = new JSZip();
  zip.file("collection.anki2", database.export());
  zip.file("media", JSON.stringify({ 0: "author's_logo.png" }));
  zip.file(
    "0",
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  );
  database.close();
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return new File([bytes.slice().buffer as ArrayBuffer], "community.apkg");
};

const clozeAnkiPackage = async (
  text = "The diagonal elements of a {{c1::skew-symmetrical}} matrix are always {{c2::zero}}.",
  backExtra = "<b>Matrix note</b>",
) => {
  const SQL = await initSqlJs();
  const database = new SQL.Database();
  database.run(`
    CREATE TABLE col (ver INTEGER, models TEXT, decks TEXT);
    CREATE TABLE notes (id INTEGER, guid TEXT, mid INTEGER, tags TEXT, flds TEXT, flags INTEGER);
    CREATE TABLE cards (id INTEGER, nid INTEGER, did INTEGER, odid INTEGER, ord INTEGER, type INTEGER, queue INTEGER, flags INTEGER);
  `);
  database.run("INSERT INTO col VALUES (?, ?, ?)", [
    11,
    JSON.stringify({
      9: {
        id: 9,
        name: "Cloze",
        type: 1,
        flds: [
          { name: "Text", ord: 0 },
          { name: "Back Extra", ord: 1 },
        ],
        tmpls: [
          {
            name: "Cloze",
            ord: 0,
            qfmt: "{{cloze:Text}}",
            afmt: "{{FrontSide}}<hr id=answer>{{cloze:Text}}<br>{{Back Extra}}",
          },
        ],
      },
    }),
    JSON.stringify({ 7: { id: 7, name: "Knowledge::Math" } }),
  ]);
  database.run("INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?)", [
    12,
    "cloze-guid",
    9,
    "matrix",
    `${text}\u001f${backExtra}`,
    0,
  ]);
  database.run(
    "INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)",
    [23, 12, 7, 0, 0, 0, 0, 0, 24, 12, 7, 0, 1, 0, 0, 0],
  );
  const zip = new JSZip();
  zip.file("collection.anki2", database.export());
  zip.file("media", "{}");
  database.close();
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return new File([bytes.slice().buffer as ArrayBuffer], "cloze.apkg");
};

describe("local file import", () => {
  it("preserves real Anki cloze ordinals and back extra through the APKG path", async () => {
    const result = await parseLocalAnkiPackage(await clozeAnkiPackage(), {
      sourceLocale: "en",
      targetLocale: "en",
    });
    const cards = result.decks[0]?.cards ?? [];

    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.front.blocks[0])).toEqual([
      expect.objectContaining({
        type: "cloze",
        presentation: "ANKI",
        activeDeletionId: 1,
      }),
      expect.objectContaining({
        type: "cloze",
        presentation: "ANKI",
        activeDeletionId: 2,
      }),
    ]);
    expect(cards[0]?.back.blocks).toEqual([
      expect.objectContaining({ type: "cloze", activeDeletionId: 1 }),
      expect.objectContaining({ type: "markdown", source: "Matrix note" }),
    ]);
    expect(cards.every((card) => card.sourceNoteId === "12")).toBe(true);
  });

  it("imports Anki math delimiters structurally across clozes and Back Extra", async () => {
    const result = await parseLocalAnkiPackage(
      await clozeAnkiPackage(
        "{{c1::\\(\\cos (x+y)\\)}} \\(=\\) {{c2::\\(\\cos x \\cdot \\cos y-\\sin x \\sin y\\)}}",
        "\\[\\Gamma\\] [$]\\alpha[/$] [latex]\\beta[/latex]",
      ),
      { sourceLocale: "en", targetLocale: "en" },
    );
    const cards = result.decks[0]?.cards ?? [];
    const first = cards[0]?.front.blocks[0];

    expect(cards).toHaveLength(2);
    expect(first).toMatchObject({
      type: "cloze",
      activeDeletionId: 1,
      text: "\\cos (x+y) = \\cos x \\cdot \\cos y-\\sin x \\sin y",
      mathRanges: [
        expect.objectContaining({ latex: "\\cos (x+y)", display: false }),
        expect.objectContaining({ latex: "=", display: false }),
        expect.objectContaining({
          latex: "\\cos x \\cdot \\cos y-\\sin x \\sin y",
          display: false,
        }),
      ],
    });
    expect(cards[0]?.back.blocks[1]).toMatchObject({
      type: "markdown",
      source: "$$\\Gamma$$ $\\alpha$ $$\\beta$$",
    });
    expect(
      JSON.stringify(
        cards.map((card) => ({ front: card.front, back: card.back })),
      ),
    ).not.toMatch(/\\\\\(|\\\\\)|\[\/?\$\$?\]|\[\/?latex\]/i);
  });

  it("does not turn an empty Back Extra field into unsupported content", async () => {
    const result = await parseLocalAnkiPackage(
      await clozeAnkiPackage(undefined, ""),
      { sourceLocale: "en", targetLocale: "en" },
    );

    expect(result.decks[0]?.cards[0]?.back.blocks).toHaveLength(1);
    expect(JSON.stringify(result.decks[0]?.cards)).not.toContain(
      "Nicht unterstützter Anki-Inhalt",
    );
  });

  it("keeps unsafe LaTeX visible without treating it as executable math", async () => {
    const result = await parseLocalAnkiPackage(
      await clozeAnkiPackage("{{c1::value}}", "[latex]\\input{secret}[/latex]"),
      { sourceLocale: "en", targetLocale: "en" },
    );

    expect(result.decks[0]?.cards[0]?.back.blocks[1]).toMatchObject({
      type: "markdown",
      source: "\\input{secret}",
    });
    expect(result.warnings).toContainEqual(
      expect.stringContaining("Cloze / Back Extra"),
    );
    expect(result.warnings).toContainEqual(
      expect.stringContaining("unsichere Anki-Formel"),
    );
  });

  it("parses a classic APKG with hierarchy and original audio locally", async () => {
    const result = await parseLocalAnkiPackage(await ankiPackage());

    expect(result.title).toBe("Languages");
    expect(result.decks[0]?.path).toEqual(["Languages", "Icelandic"]);
    expect(result.decks[0]?.cards).toHaveLength(1);
    expect(result.decks[0]?.cards[0]?.sourceFieldText?.Front).toBe("Halló");
    expect(result.decks[0]?.cards[0]?.sourceFieldRaw).toEqual({
      Front: "<b>Halló</b>",
      Back: "Hello",
      Audio: "[sound:voice.mp3]",
    });
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
    expect(result.ankiPreview).toMatchObject({
      deckCount: 1,
      cardCount: 1,
      noteCount: 1,
      sourceHierarchy: {
        decks: [
          {
            sourceDeckId: "5",
            path: ["Icelandic"],
            cardCount: 1,
          },
        ],
      },
    });
  });

  it("imports a one-sided Anki note as an explanation instead of unsupported content", async () => {
    const result = await parseLocalAnkiPackage(
      await ankiPackage(undefined, "", ""),
    );
    const card = result.decks[0]?.cards[0];

    expect(card?.kind).toBe("EXPLANATION");
    expect(card?.back).toEqual(card?.front);
    expect(JSON.stringify(card)).not.toContain(
      "Nicht unterstützter Anki-Inhalt",
    );
  });

  it("applies local deck selection and field-based subdecks", async () => {
    const result = await parseLocalAnkiPackage(
      await ankiPackage(),
      { sourceLocale: "is", targetLocale: "en" },
      {
        includedSourceDeckIds: ["5"],
        subdeckFields: { "7": ["Front"] },
      },
    );

    expect(result.decks).toHaveLength(1);
    expect(result.decks[0]?.path).toEqual(["Languages", "Icelandic", "Halló"]);
    expect(result.decks[0]?.cards[0]).toMatchObject({
      questionLocale: "is",
      answerLocale: "en",
    });
  });

  it("compiles [[AUDIO]] into playable structured media for a custom Wiki profile", async () => {
    const file = await ankiPackage();
    const inspection = await parseLocalAnkiPackage(file);
    const noteType = inspection.ankiPreview?.noteTypes.find(
      (candidate) => candidate.name === "Basic",
    );
    expect(noteType).toBeDefined();

    const parsed = await parseLocalAnkiPackage(file, undefined, {
      profileSelection: {
        kind: "CUSTOM",
        profile: {
          schemaVersion: 2,
          id: "019ffb67-ff04-7591-a849-a234c0ff9c7d",
          name: "Audio profile",
          description: "",
          createdAt: "2026-08-14T08:00:00.000Z",
          updatedAt: "2026-08-14T08:00:00.000Z",
          rules: [
            {
              id: "basic-audio",
              noteTypeName: "Basic",
              requiredFields: ["Front", "Audio"],
              noteTypeSignature: noteType!.signature,
              sourceDeckPath: null,
              sourceTemplate: { ord: 0 },
              outputs: [
                {
                  id: "audio-card",
                  name: "Audio card",
                  frontTemplate: "[[Front]]",
                  backTemplate: "Audio:\n\n[[AUDIO]]",
                  frontSections: [],
                  backSections: [],
                  requiredNonEmptyFields: ["Front"],
                  direction: "SOURCE_TO_TARGET",
                  linkedToPrevious: false,
                  targetDeckPath: null,
                },
              ],
            },
          ],
        },
      },
    });
    const importedCard = parsed.decks[0]?.cards[0];

    expect(importedCard?.back.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "importAudio",
          sourceName: "voice.mp3",
        }),
      ]),
    );
    expect(JSON.stringify(importedCard?.back)).not.toContain("[[AUDIO]]");
    expect(importedCard?.sourceFields?.Audio?.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "importAudio" }),
      ]),
    );
  });

  it("uses unfamiliar Anki templates automatically and retains fields, card multiplicity and template media", async () => {
    const file = await templateDrivenAnkiPackage();
    const preview = await parseLocalAnkiPackage(file);
    const templateMedia = preview.ankiPreview?.mediaGroups.find(
      (group) => group.fieldName === "__anki_template__",
    );

    expect(preview.profileId).toBe(automaticAnkiTemplateProfileId);
    expect(preview.decks[0]?.cards).toHaveLength(2);
    expect(
      preview.decks[0]?.cards.map((card) => card.sourceTemplateName),
    ).toEqual(["Recognition", "Production"]);
    expect(preview.decks[0]?.cards[0]?.front.blocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "importImage",
          sourceName: "author's_logo.png",
        }),
        expect.objectContaining({
          type: "markdown",
          source: "Halló (greeting)",
        }),
      ]),
    );
    expect(preview.decks[0]?.cards[0]?.sourceFieldText).toMatchObject({
      "Stored only": "retained metadata",
    });
    expect(preview.decks[0]?.cards[0]?.sourceDisplayedFields).toEqual([
      "Front",
      "Hint",
      "Back",
    ]);
    expect(preview.decks[0]?.cards[0]?.tags).toEqual(["community-tag"]);
    expect(JSON.stringify(preview.decks[0]?.cards[0]?.front)).not.toContain(
      "TAGS:",
    );
    expect(preview.decks[0]?.cards[0]?.back.blocks).toEqual([
      expect.objectContaining({ type: "markdown", source: "Hello" }),
    ]);
    expect(JSON.stringify(preview.decks[0]?.cards[0]?.back)).not.toContain(
      "Halló",
    );
    expect(templateMedia).toMatchObject({ kind: "image", fileCount: 1 });

    const selected = await parseLocalAnkiPackage(file, undefined, {
      includedSourceDeckIds: ["6"],
      includedMediaGroupIds: templateMedia ? [templateMedia.id] : [],
    });
    expect(selected.media.map((medium) => medium.sourceName)).toEqual([
      "author's_logo.png",
    ]);
  });

  it("reports bounded local progress, supports cancellation and reuses the unpacked archive", async () => {
    const file = await ankiPackage();
    const originalArrayBuffer = file.arrayBuffer.bind(file);
    let reads = 0;
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => {
        reads += 1;
        return originalArrayBuffer();
      },
    });
    const phases: string[] = [];
    await parseLocalAnkiPackage(file, undefined, {
      onProgress: (progress) => phases.push(progress.phase),
    });
    await parseLocalAnkiPackage(file);

    expect(reads).toBe(1);
    expect(new Set(phases)).toEqual(
      new Set([
        "READING_ARCHIVE",
        "UNPACKING",
        "READING_DATABASE",
        "READING_MEDIA",
        "READING_CARDS",
        "BUILDING_PREVIEW",
        "APPLYING_PROFILE",
      ]),
    );

    const controller = new AbortController();
    controller.abort();
    await expect(
      parseLocalAnkiPackage(await ankiPackage(), undefined, {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
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

  it("accepts uppercase .APKG and .FNF file extensions", async () => {
    const ankiFile = await ankiPackage();
    const ankiBytes = await ankiFile.arrayBuffer();
    const uppercaseApkg = new File([ankiBytes], "Portable.UPPER.APKG");
    const uppercaseFnf = new File(
      [JSON.stringify({
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
                  blocks: [{ type: "markdown", revealMode: "ALL", source: "Q" }],
                },
                back: {
                  blocks: [{ type: "markdown", revealMode: "ALL", source: "A" }],
                },
                tags: [],
              },
            ],
          },
        ],
        media: [],
      })],
      "Portable.UPPER.FNF",
    );

    const parsedApkg = await parseLocalAnkiPackage(uppercaseApkg);
    expect(parsedApkg.format).toBe("APKG");
    const parsedFnf = await parseLocalFlashNFlipPackage(uppercaseFnf);
    expect(parsedFnf.format).toBe("FNF");
  });
});
