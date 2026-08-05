import { describe, expect, it } from "vitest";

import {
  applyAnkiFieldMappings,
  createAnkiImportPreview,
  detectXefjordPreset,
  prepareAnkiFieldMappedPackage,
  selectAnkiSourceDecks,
  selectedAnkiMediaNames,
  suggestedAnkiFieldMappings,
} from "./anki-import-plan.js";
import type {
  AnkiCardContent,
  ParsedAnkiCard,
  ParsedAnkiPackage,
} from "./anki-package.js";

const text = (value: string): AnkiCardContent => ({
  blocks: value ? [{ type: "text", text: value }] : [],
});

const audio = (sourceName: string): AnkiCardContent => ({
  blocks: [{ type: "audio", sourceName, label: sourceName }],
});

const image = (sourceName: string): AnkiCardContent => ({
  blocks: [{ type: "image", sourceName, alt: "", decorative: true }],
});

const card = (templateOrd: number): ParsedAnkiCard => ({
  sourceCardId: `card-${templateOrd}`,
  sourceNoteId: "note-1",
  sourceNoteTypeId: "100",
  sourceNoteTypeName: "B+R+hint on side 2",
  sourceTemplateOrd: templateOrd,
  sourceTemplateName: `Card ${templateOrd + 1}`,
  sourceFields: {
    ID: text("ser"),
    Deutsch: text("sein"),
    Spanisch: text("ser"),
    Beispiel: text("Ser o no ser.\nSein oder nicht sein."),
    AudioS: audio("ser_spanisch.mp3"),
    Einheit: text("E01"),
    "Thematische Einheit": text("Verben"),
    BildD: image("deutsch.jpg"),
    BildS: image("spanisch.jpg"),
    Bild3: audio("ser_seite3.mp3"),
    Bild4: image("ser_hint.jpg"),
    "Frequency Dictionary Ranking": text("5"),
    Nummer: text("0007"),
  },
  sourceFieldText: {
    ID: "ser",
    Deutsch: "sein",
    Spanisch: "ser",
    Beispiel: "Ser o no ser. Sein oder nicht sein.",
    AudioS: "",
    Einheit: "E01",
    "Thematische Einheit": "Verben",
    BildD: "",
    BildS: "",
    Bild3: "",
    Bild4: "",
    "Frequency Dictionary Ranking": "5",
    Nummer: "0007",
  },
  sourceState: { cardType: 0, queue: 0, cardFlag: 0, noteFlag: 0 },
  front: text(templateOrd === 0 ? "sein" : "ser"),
  back: text(templateOrd === 0 ? "ser" : "sein"),
  tags: [],
});

const packageFixture = (): ParsedAnkiPackage => ({
  collectionTitle: "Spanisch 5000",
  decks: [
    {
      sourceDeckId: "200",
      title: "Spanisch 5000",
      path: ["Spanisch 5000"],
      cards: [card(0), card(1)],
    },
  ],
  media: [
    ["ser_spanisch.mp3", "audio", "audio/mpeg", "mp3", 10],
    ["ser_seite3.mp3", "audio", "audio/mpeg", "mp3", 20],
    ["deutsch.jpg", "image", "image/jpeg", "jpg", 30],
    ["spanisch.jpg", "image", "image/jpeg", "jpg", 40],
    ["ser_hint.jpg", "image", "image/jpeg", "jpg", 50],
    ["Spanisch5000-logo.jpg", "image", "image/jpeg", "jpg", 60],
  ].map(([sourceName, kind, mimeType, extension, size]) => ({
    sourceName: String(sourceName),
    kind: kind as "image" | "audio",
    mimeType: String(mimeType),
    extension: String(extension),
    data: Buffer.alloc(Number(size)),
  })),
  warnings: [],
  packageVersion: "legacy",
  noteTypes: [
    {
      sourceNoteTypeId: "100",
      name: "B+R+hint on side 2",
      isCloze: false,
      fields: [
        "ID",
        "Deutsch",
        "Spanisch",
        "Beispiel",
        "AudioS",
        "Einheit",
        "Thematische Einheit",
        "BildD",
        "BildS",
        "Bild3",
        "Bild4",
        "Frequency Dictionary Ranking",
        "Nummer",
      ],
      templates: [
        {
          ord: 0,
          name: "Card 1",
          questionFields: ["Deutsch", "BildD"],
          answerFields: ["Spanisch", "AudioS", "Beispiel", "Bild3", "Bild4"],
        },
        {
          ord: 1,
          name: "Card 2",
          questionFields: ["Spanisch", "AudioS", "BildS"],
          answerFields: ["Deutsch", "Beispiel", "Bild3", "Bild4"],
        },
      ],
    },
  ],
});

describe("Anki import planning", () => {
  it("recognizes an exact Xefjord collection and infers its preset languages", () => {
    const parsed = packageFixture();
    parsed.collectionTitle = "Xefjord’s Complete Spanish (Castilian)";

    expect(detectXefjordPreset(parsed)).toEqual({
      detected: true,
      directImportAvailable: true,
      suggestedSourceLocale: "en",
      suggestedTargetLocale: "es",
    });
  });

  it("infers Arabic from the current Xefjord MSA collection title", () => {
    const parsed = packageFixture();
    parsed.collectionTitle = "Xefjord's Complete Arabic (MSA)";

    expect(detectXefjordPreset(parsed)).toEqual({
      detected: true,
      directImportAvailable: true,
      suggestedSourceLocale: "en",
      suggestedTargetLocale: "ar",
    });
  });

  it("does not classify ordinary or empty packages as Xefjord presets", () => {
    const parsed = packageFixture();
    expect(detectXefjordPreset(parsed).detected).toBe(false);

    parsed.collectionTitle = "Xefjord's Complete Spanish";
    parsed.decks[0]!.cards = [];
    expect(detectXefjordPreset(parsed).detected).toBe(false);
  });

  it("requires normal Anki configuration for an unknown Xefjord language", () => {
    const parsed = packageFixture();
    parsed.collectionTitle = "Xefjord's Complete Imaginary Language";

    expect(detectXefjordPreset(parsed)).toEqual({
      detected: true,
      directImportAvailable: false,
      suggestedSourceLocale: "en",
      suggestedTargetLocale: null,
    });
  });

  it("separates Spanish vocabulary, hints, categories and media", () => {
    const parsed = packageFixture();
    const preview = createAnkiImportPreview(parsed, {
      sha256: "a".repeat(64),
      fileName: "Spanisch_5000.apkg",
      cached: false,
    });
    const roles = Object.fromEntries(
      preview.noteTypes[0]!.fields.map((field) => [
        field.name,
        field.suggestedRole,
      ]),
    );

    expect(roles).toMatchObject({
      ID: "SOURCE_ID",
      Deutsch: "PRIMARY_A",
      Spanisch: "PRIMARY_B",
      Beispiel: "HINT",
      AudioS: "MEDIA_B",
      Einheit: "CATEGORY",
      "Thematische Einheit": "CATEGORY",
      BildD: "MEDIA_A",
      BildS: "MEDIA_B",
      Bild3: "HINT_MEDIA",
      Bild4: "HINT_MEDIA",
      "Frequency Dictionary Ranking": "ORDER",
      Nummer: "ORDER",
    });
    expect(preview.coverCandidates).toEqual([
      { sourceName: "Spanisch5000-logo.jpg", byteSize: 60 },
    ]);
    expect(preview.sourceHierarchy).toMatchObject({
      detected: false,
      maximumDepth: 1,
      decks: [{ sourceDeckId: "200", path: ["Cards"], cardCount: 2 }],
      paths: [{ path: ["Cards"], cardCount: 2 }],
      hiddenPathCount: 0,
    });
    expect(
      preview.noteTypes[0]!.fields.find((field) => field.name === "Einheit"),
    ).toMatchObject({
      distinctValueCount: 1,
      sampleValues: ["E01"],
    });

    applyAnkiFieldMappings(parsed, { "100": roles });
    const first = parsed.decks[0]!.cards[0]!;
    expect(first.front.blocks).toEqual(
      expect.arrayContaining([
        { type: "text", text: "sein" },
        expect.objectContaining({ type: "image", sourceName: "deutsch.jpg" }),
      ]),
    );
    expect(first.back.blocks).toEqual(
      expect.arrayContaining([
        { type: "text", text: "ser" },
        { type: "heading", level: 3, text: "Hinweis" },
        { type: "text", text: "Ser o no ser.\nSein oder nicht sein." },
      ]),
    );
    expect(JSON.stringify(first.back)).not.toContain("E01");
    expect(JSON.stringify(first.back)).not.toContain("0007");
  });

  it("does not label media-only hints as an empty textual hint", () => {
    const parsed = packageFixture();
    const preview = createAnkiImportPreview(parsed, {
      sha256: "a".repeat(64),
      fileName: "Spanisch_5000.apkg",
      cached: false,
    });
    const roles = suggestedAnkiFieldMappings(preview)["100"]!;
    roles.Beispiel = "IGNORE";
    roles.Bild3 = "HINT_MEDIA";
    roles.Bild4 = "HINT_MEDIA";

    applyAnkiFieldMappings(parsed, { "100": roles });

    const back = parsed.decks[0]!.cards[0]!.back.blocks;
    expect(back).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "image", sourceName: "ser_hint.jpg" }),
      ]),
    );
    expect(back).not.toContainEqual({
      type: "heading",
      level: 3,
      text: "Hinweis",
    });
  });

  it("persists unambiguous template directions for normal Anki imports", () => {
    const parsed = packageFixture();
    const preview = createAnkiImportPreview(parsed, {
      sha256: "a".repeat(64),
      fileName: "Spanisch_5000.apkg",
      cached: false,
    });

    applyAnkiFieldMappings(parsed, suggestedAnkiFieldMappings(preview), {
      sideALocale: "de",
      sideBLocale: "es",
    });

    expect(parsed.decks[0]?.cards).toEqual([
      expect.objectContaining({
        sourceTemplateOrd: 0,
        questionLocale: "de",
        answerLocale: "es",
      }),
      expect.objectContaining({
        sourceTemplateOrd: 1,
        questionLocale: "es",
        answerLocale: "de",
      }),
    ]);
  });

  it("uses explicit Xefjord markers before applying inferred field directions", () => {
    const parsed = packageFixture();
    parsed.collectionTitle = "Xefjord's Complete Spanish";
    parsed.decks[0]!.cards[0]!.front = text("ser\nSpanish");
    parsed.decks[0]!.cards[1]!.front = text("sein\nTo Spanish");
    const preview = createAnkiImportPreview(parsed, {
      sha256: "a".repeat(64),
      fileName: "xefjord-spanish.apkg",
      cached: false,
    });

    const detection = prepareAnkiFieldMappedPackage(
      parsed,
      suggestedAnkiFieldMappings(preview),
      { sourceLocale: "de", targetLocale: "es" },
    );

    expect(detection.directions).toEqual({ "es→de": 1, "de→es": 1 });
    expect(detection.package.decks[0]?.cards).toEqual([
      expect.objectContaining({
        questionLocale: "es",
        answerLocale: "de",
      }),
      expect.objectContaining({
        questionLocale: "de",
        answerLocale: "es",
      }),
    ]);
  });

  it("enforces the selected media groups and optional cover", () => {
    const parsed = packageFixture();
    const preview = createAnkiImportPreview(parsed, {
      sha256: "a".repeat(64),
      fileName: "Spanisch_5000.apkg",
      cached: true,
    });
    const selected = selectedAnkiMediaNames(
      parsed,
      preview,
      ["100:AudioS:audio"],
      "Spanisch5000-logo.jpg",
    );

    expect([...selected].sort()).toEqual([
      "Spanisch5000-logo.jpg",
      "ser_spanisch.mp3",
    ]);
  });

  it("appends a single mapped main field after the original main part B", () => {
    const parsed = packageFixture();

    applyAnkiFieldMappings(parsed, {
      "100": { Deutsch: "PRIMARY_A" },
    });

    expect(parsed.decks[0]!.cards[0]!.back.blocks).toEqual([
      { type: "text", text: "ser" },
      { type: "text", text: "sein" },
    ]);
  });

  it("keeps multiple fields on the same main side as ordered content blocks", () => {
    const parsed = packageFixture();

    applyAnkiFieldMappings(parsed, {
      "100": {
        Deutsch: "PRIMARY_A",
        Spanisch: "PRIMARY_B",
        Beispiel: "PRIMARY_B",
      },
    });

    expect(parsed.decks[0]!.cards[0]!.back.blocks).toEqual([
      { type: "text", text: "ser" },
      { type: "text", text: "Ser o no ser.\nSein oder nicht sein." },
    ]);
    expect(parsed.decks[0]!.cards[1]!.front.blocks).toEqual([
      { type: "text", text: "ser" },
      { type: "text", text: "Ser o no ser.\nSein oder nicht sein." },
    ]);
  });

  it("never restores ignored Anki template content when a mapped field is empty", () => {
    const parsed = packageFixture();
    const importedCard = parsed.decks[0]!.cards[0]!;
    importedCard.sourceFields!.Spanisch = text("");
    importedCard.sourceFieldText!.Spanisch = "";
    importedCard.front = text("Original template content must not return");

    applyAnkiFieldMappings(parsed, {
      "100": {
        Deutsch: "IGNORE",
        Spanisch: "PRIMARY_A",
        Beispiel: "PRIMARY_B",
      },
    });

    expect(importedCard.front).toEqual({
      blocks: [{ type: "text", text: "—" }],
    });
    expect(JSON.stringify(importedCard)).not.toContain(
      "Original template content must not return",
    );
    expect(importedCard.back.blocks).toContainEqual({
      type: "text",
      text: "Ser o no ser.\nSein oder nicht sein.",
    });
  });

  it("keeps only selected source decks and their used note types", () => {
    const parsed = packageFixture();
    parsed.decks.push({
      sourceDeckId: "201",
      title: "Auslassen",
      path: ["Spanisch 5000", "Auslassen"],
      cards: [
        {
          ...card(0),
          sourceCardId: "card-unused",
          sourceNoteId: "note-unused",
          sourceNoteTypeId: "101",
        },
      ],
    });
    parsed.noteTypes.push({
      ...parsed.noteTypes[0]!,
      sourceNoteTypeId: "101",
      name: "Unused",
    });

    selectAnkiSourceDecks(parsed, ["200"]);

    expect(parsed.decks.map((deck) => deck.sourceDeckId)).toEqual(["200"]);
    expect(
      parsed.noteTypes.map((noteType) => noteType.sourceNoteTypeId),
    ).toEqual(["100"]);
  });
});
