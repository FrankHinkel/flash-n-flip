import { describe, expect, it } from "vitest";

import {
  applyAnkiFieldMappings,
  createAnkiImportPreview,
  selectedAnkiMediaNames,
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
});
