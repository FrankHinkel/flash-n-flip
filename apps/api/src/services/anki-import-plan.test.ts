import { describe, expect, it } from "vitest";

import {
  applyAnkiFieldMappings,
  createAnkiImportPreview,
  detectXefjordPreset,
  prepareAnkiFieldMappedPackage,
  selectAnkiSourceDecks,
  selectedAnkiMediaNames,
  suggestedAnkiFieldMappings,
  xefjordAnkiFieldMappings,
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

const xefjordPackageFixture = (): ParsedAnkiPackage => {
  const parsed = packageFixture();
  parsed.collectionTitle = "Xefjord's Complete Icelandic";
  parsed.noteTypes = [
    {
      sourceNoteTypeId: "100",
      name: "Xefjord Vocabulary",
      isCloze: false,
      fields: ["Phrase", "Phrase Translation", "Audio", "Image"],
      templates: [
        {
          ord: 0,
          name: "Recognition",
          questionFields: ["Phrase"],
          answerFields: ["Image", "Audio", "Phrase Translation"],
        },
        {
          ord: 1,
          name: "Recall",
          questionFields: ["Phrase Translation"],
          answerFields: ["Phrase", "Image", "Audio"],
        },
      ],
    },
  ];
  parsed.decks[0]!.cards = [0, 1].map((templateOrd) => ({
    ...card(templateOrd),
    sourceFields: {
      Phrase: text("Nótt"),
      "Phrase Translation": text("Night"),
      Audio: audio("pronunciation_is_nótt.mp3"),
      Image: text(""),
    },
    sourceFieldText: {
      Phrase: "Nótt",
      "Phrase Translation": "Night",
      Audio: "",
      Image: "",
    },
    front: text(templateOrd === 0 ? "Nótt\nIcelandic" : "Night\nTo Icelandic"),
    back: text(templateOrd === 0 ? "Night" : "Nótt"),
  }));
  parsed.media = [
    {
      sourceName: "pronunciation_is_nótt.mp3",
      kind: "audio",
      mimeType: "audio/mpeg",
      extension: "mp3",
      data: Buffer.alloc(10),
    },
  ];
  return parsed;
};

const xefjordMandarinPackageFixture = (): ParsedAnkiPackage => {
  const sourceFields = {
    Hanzi: text("这"),
    Traditional: text("這"),
    Diagram: image("36825.gif"),
    HSK: text("1"),
    FrequencyRank: text("11"),
    StrokeNumber: text("7画"),
    Radical: text("辵辶 + 4"),
    Pinyin: text("zhè"),
    "Pinyin 2": text("zhèi"),
    Meaning: text("this, the, here"),
    Notes: text(""),
    "Notes URL": text(""),
    Audio: audio("mandarin-zhe.mp3"),
    Ruby: text(""),
    Color: text(""),
  };
  const sourceFieldText = Object.fromEntries(
    Object.entries(sourceFields).map(([name, content]) => [
      name,
      name === "Audio"
        ? "[sound:mandarin-zhe.mp3]"
        : content.blocks
            .flatMap((block) =>
              block.type === "text" || block.type === "heading"
                ? [block.text]
                : [],
            )
            .join(" "),
    ]),
  );
  const hanziCards = [
    {
      ...card(0),
      sourceCardId: "hanzi-recall",
      sourceNoteId: "hanzi-note",
      sourceNoteTypeId: "hanzi",
      sourceNoteTypeName: "Mandarin (Chinese) Hanzi",
      sourceTemplateName: "Recall",
      sourceFields,
      sourceFieldText,
    },
    {
      ...card(1),
      sourceCardId: "hanzi-recognition",
      sourceNoteId: "hanzi-note",
      sourceNoteTypeId: "hanzi",
      sourceNoteTypeName: "Mandarin (Chinese) Hanzi",
      sourceTemplateName: "Recognition",
      sourceFields,
      sourceFieldText,
    },
  ];
  const vocabFields = {
    Sentence: text("奶奶，您坐。"),
    "Sentence Pinyin": text("Nǎinai，nín zuò."),
    "Sentence Cloze": text("奶奶，_坐。"),
    Word: text("您"),
    "Word Pinyin": text("Nín"),
    "Sentence Translation": text("Granny, please sit."),
    "Word Translation": text("You (polite)"),
    "Part-of-Speech": text("Pronoun"),
    Audio: audio("mandarin-nin.mp3"),
    Image: text(""),
  };
  const vocabText = Object.fromEntries(
    Object.entries(vocabFields).map(([name, content]) => [
      name,
      name === "Audio"
        ? "[sound:mandarin-nin.mp3]"
        : content.blocks
            .flatMap((block) =>
              block.type === "text" || block.type === "heading"
                ? [block.text]
                : [],
            )
            .join(" "),
    ]),
  );
  const vocabCards = ["Recognition", "Recall"].map(
    (sourceTemplateName, sourceTemplateOrd) => ({
      ...card(sourceTemplateOrd),
      sourceCardId: `vocab-${sourceTemplateOrd}`,
      sourceNoteId: "vocab-note",
      sourceNoteTypeId: "vocab",
      sourceNoteTypeName: "Mandarin (Chinese) Vocab",
      sourceTemplateName,
      sourceTemplateOrd,
      sourceFields: vocabFields,
      sourceFieldText: vocabText,
    }),
  );
  const basicFields = {
    Phrase: text("欢迎"),
    "Phrase Translation": text("Welcome"),
    "Phrase Pinyin": text("Huānyíng"),
    Audio: audio("mandarin-welcome.mp3"),
    Image: text(""),
  };
  const basicText = Object.fromEntries(
    Object.entries(basicFields).map(([name, content]) => [
      name,
      name === "Audio"
        ? "[sound:mandarin-welcome.mp3]"
        : content.blocks
            .flatMap((block) =>
              block.type === "text" || block.type === "heading"
                ? [block.text]
                : [],
            )
            .join(" "),
    ]),
  );
  const basicCards = ["Recognition", "Recall"].map(
    (sourceTemplateName, sourceTemplateOrd) => ({
      ...card(sourceTemplateOrd),
      sourceCardId: `basic-${sourceTemplateOrd}`,
      sourceNoteId: "basic-note",
      sourceNoteTypeId: "basic",
      sourceNoteTypeName: "Mandarin (Chinese) Basic",
      sourceTemplateName,
      sourceTemplateOrd,
      sourceFields: basicFields,
      sourceFieldText: basicText,
    }),
  );
  return {
    collectionTitle: "Xefjord's Complete Mandarin (Chinese)",
    decks: [
      {
        sourceDeckId: "hanzi-deck",
        title: "Hanzi (Common 3k)",
        path: ["Core Mandarin Vocabulary", "Hanzi (Common 3k)"],
        cards: hanziCards,
      },
      {
        sourceDeckId: "vocab-deck",
        title: "Vocab",
        path: ["Core Mandarin Vocabulary", "Vocab"],
        cards: vocabCards,
      },
      {
        sourceDeckId: "basic-deck",
        title: "Basic Mandarin Words and Phrases",
        path: ["Basic Mandarin Words and Phrases"],
        cards: basicCards,
      },
    ],
    media: [
      {
        sourceName: "36825.gif",
        kind: "image",
        mimeType: "image/gif",
        extension: "gif",
        data: Buffer.from("GIF89a"),
      },
      ...["mandarin-zhe.mp3", "mandarin-nin.mp3", "mandarin-welcome.mp3"].map(
        (sourceName) => ({
          sourceName,
          kind: "audio" as const,
          mimeType: "audio/mpeg",
          extension: "mp3",
          data: Buffer.alloc(10),
        }),
      ),
    ],
    warnings: [],
    packageVersion: "latest",
    noteTypes: [
      {
        sourceNoteTypeId: "hanzi",
        name: "Mandarin (Chinese) Hanzi",
        isCloze: false,
        fields: Object.keys(sourceFields),
        templates: [
          {
            ord: 0,
            name: "Recall",
            questionFields: ["Audio", "Pinyin", "Meaning", "StrokeNumber"],
            answerFields: [
              "HSK",
              "FrequencyRank",
              "StrokeNumber",
              "Hanzi",
              "Radical",
              "Traditional",
              "Diagram",
            ],
          },
          {
            ord: 1,
            name: "Recognition",
            questionFields: [
              "HSK",
              "FrequencyRank",
              "StrokeNumber",
              "Hanzi",
              "Radical",
              "Traditional",
            ],
            answerFields: ["Audio", "Pinyin", "Meaning"],
          },
        ],
      },
      {
        sourceNoteTypeId: "vocab",
        name: "Mandarin (Chinese) Vocab",
        isCloze: false,
        fields: Object.keys(vocabFields),
        templates: [
          {
            ord: 0,
            name: "Recognition",
            questionFields: ["Sentence Pinyin", "Sentence"],
            answerFields: [
              "Image",
              "Audio",
              "Word Translation",
              "Word",
              "Word Pinyin",
              "Part-of-Speech",
              "Sentence Translation",
            ],
          },
          {
            ord: 1,
            name: "Recall",
            questionFields: [
              "Sentence Cloze",
              "Word Translation",
              "Part-of-Speech",
              "Word",
            ],
            answerFields: ["Sentence Pinyin", "Sentence", "Image", "Audio"],
          },
        ],
      },
      {
        sourceNoteTypeId: "basic",
        name: "Mandarin (Chinese) Basic",
        isCloze: false,
        fields: Object.keys(basicFields),
        templates: [
          {
            ord: 0,
            name: "Recognition",
            questionFields: ["Phrase Pinyin", "Phrase"],
            answerFields: ["Image", "Audio", "Phrase Translation"],
          },
          {
            ord: 1,
            name: "Recall",
            questionFields: ["Phrase Translation"],
            answerFields: ["Phrase Pinyin", "Phrase", "Image", "Audio"],
          },
        ],
      },
    ],
  };
};

const sourceFieldText = (
  fields: Record<string, AnkiCardContent>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(fields).map(([name, content]) => [
      name,
      content.blocks
        .flatMap((block) =>
          block.type === "text" || block.type === "heading" ? [block.text] : [],
        )
        .join(" "),
    ]),
  );

const mirroredCards = (
  noteTypeId: string,
  noteTypeName: string,
  fields: Record<string, AnkiCardContent>,
): ParsedAnkiCard[] =>
  ["Recognition", "Recall"].map((sourceTemplateName, sourceTemplateOrd) => ({
    ...card(sourceTemplateOrd),
    sourceCardId: `${noteTypeId}-${sourceTemplateOrd}`,
    sourceNoteId: `${noteTypeId}-note`,
    sourceNoteTypeId: noteTypeId,
    sourceNoteTypeName: noteTypeName,
    sourceTemplateName,
    sourceTemplateOrd,
    sourceFields: fields,
    sourceFieldText: sourceFieldText(fields),
  }));

const xefjordJapanesePackageFixture = (): ParsedAnkiPackage => {
  const basicFields = {
    Phrase: text("お元気ですか？"),
    "Phrase Translation": text("How are you?"),
    "Phrase Furigana": text("おげんきですか？"),
    Audio: audio("japanese-basic.mp3"),
    Image: text(""),
  };
  const vocabFields = {
    Sentence: text("私は初めて日本に来た。"),
    "Sentence Furigana": text("わたしははじめてにほんにきた。"),
    "Sentence Cloze": text("私は初めて＿に来た。"),
    Word: text("日本"),
    "Word Furigana": text("にほん"),
    "Sentence Translation": text("I came to Japan for the first time."),
    "Word Translation": text("Japan"),
    "Part-of-Speech": text("Noun"),
    Audio: audio("japanese-vocab.mp3"),
    Image: text(""),
  };
  const kanjiFields = {
    id: text("1"),
    Kanji: text("日"),
    keyword: text("SUN ・ DAY ・ JAPAN"),
    "ON reading": text("ニチ ・ ジツ"),
    "KUN reading": text("ひ ・ -び ・ -か"),
    "main ON reading": text("ニチ"),
    "key vocab 1 kanji": text("日にち"),
    "key vocab 1 reading": text("ひにち"),
    "key vocab 1 english": text("date; number of days"),
    "vocab 1 kanji": text("日"),
    "vocab 1 reading": text("ひ"),
    "vocab 1 english": text("sun, sunshine; day, date"),
    Diagram: image("065e5.svg"),
    "keyword old": text("SUN DAY JAPAN"),
    level: text("Level 01: 1 - 100"),
  };
  return {
    collectionTitle: "Xefjord's Complete Japanese",
    decks: [
      {
        sourceDeckId: "japanese-basic-deck",
        title: "Basic Japanese Words and Phrases",
        path: ["Basic Japanese Words and Phrases"],
        cards: mirroredCards("japanese-basic", "Japanese Basic", basicFields),
      },
      {
        sourceDeckId: "japanese-vocab-deck",
        title: "Vocab",
        path: ["Core Japanese Vocabulary", "Vocab"],
        cards: mirroredCards("japanese-vocab", "Japanese Vocab", vocabFields),
      },
      {
        sourceDeckId: "japanese-kanji-deck",
        title: "Kanji (KKLC)",
        path: ["Core Japanese Vocabulary", "Kanji (KKLC)"],
        cards: mirroredCards("japanese-kanji", "Japanese Kanji", kanjiFields),
      },
    ],
    media: [
      ...["japanese-basic.mp3", "japanese-vocab.mp3"].map((sourceName) => ({
        sourceName,
        kind: "audio" as const,
        mimeType: "audio/mpeg",
        extension: "mp3",
        data: Buffer.alloc(10),
      })),
      {
        sourceName: "065e5.svg",
        kind: "image" as const,
        mimeType: "image/svg+xml",
        extension: "svg",
        data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      },
    ],
    warnings: [],
    packageVersion: "legacy",
    noteTypes: [
      {
        sourceNoteTypeId: "japanese-basic",
        name: "Japanese Basic",
        isCloze: false,
        fields: Object.keys(basicFields),
        templates: [
          {
            ord: 0,
            name: "Recognition",
            questionFields: ["Phrase Furigana", "Phrase"],
            answerFields: ["Image", "Audio", "Phrase Translation"],
          },
          {
            ord: 1,
            name: "Recall",
            questionFields: ["Phrase Translation"],
            answerFields: ["Phrase Furigana", "Phrase", "Image", "Audio"],
          },
        ],
      },
      {
        sourceNoteTypeId: "japanese-vocab",
        name: "Japanese Vocab",
        isCloze: false,
        fields: Object.keys(vocabFields),
        templates: [
          {
            ord: 0,
            name: "Recognition",
            questionFields: ["Sentence Furigana", "Sentence"],
            answerFields: ["Audio", "Word Translation", "Word"],
          },
          {
            ord: 1,
            name: "Recall",
            questionFields: ["Sentence Cloze", "Word Translation"],
            answerFields: ["Sentence Furigana", "Sentence", "Audio"],
          },
        ],
      },
      {
        sourceNoteTypeId: "japanese-kanji",
        name: "Japanese Kanji",
        isCloze: false,
        fields: Object.keys(kanjiFields),
        templates: [
          {
            ord: 0,
            name: "Recognition",
            questionFields: ["Kanji"],
            answerFields: ["keyword", "Diagram"],
          },
          {
            ord: 1,
            name: "Recall",
            questionFields: ["keyword"],
            answerFields: ["Kanji", "Diagram"],
          },
        ],
      },
    ],
  };
};

const xefjordKoreanPackageFixture = (): ParsedAnkiPackage => {
  const basicFields = {
    Phrase: text("안녕하세요"),
    "Phrase Translation": text("Hello"),
    Audio: audio("korean-basic.mp3"),
    Image: text(""),
  };
  const vocabFields = {
    Sentence: text("저는 한국에서 살고 있어요."),
    "Sentence Cloze": text("저는 _에서 살고 있어요."),
    Word: text("한국"),
    "Sentence Translation": text("I live in Korea."),
    "Word Translation": text("Korea"),
    "Part-of-Speech": text("Noun"),
    Hanja: text("韓國"),
    Audio: audio("korean-vocab.mp3"),
    Image: text(""),
  };
  return {
    collectionTitle: "Xefjord's Complete Korean",
    decks: [
      {
        sourceDeckId: "korean-basic-deck",
        title: "Basic Korean Words and Phrases",
        path: ["Basic Korean Words and Phrases"],
        cards: mirroredCards("korean-basic", "Korean Basic", basicFields),
      },
      {
        sourceDeckId: "korean-vocab-deck",
        title: "Core Korean Vocabulary",
        path: ["Core Korean Vocabulary"],
        cards: mirroredCards("korean-vocab", "Korean Vocab", vocabFields),
      },
    ],
    media: ["korean-basic.mp3", "korean-vocab.mp3"].map((sourceName) => ({
      sourceName,
      kind: "audio" as const,
      mimeType: "audio/mpeg",
      extension: "mp3",
      data: Buffer.alloc(10),
    })),
    warnings: [],
    packageVersion: "legacy",
    noteTypes: [
      {
        sourceNoteTypeId: "korean-basic",
        name: "Korean Basic",
        isCloze: false,
        fields: Object.keys(basicFields),
        templates: [
          {
            ord: 0,
            name: "Recognition",
            questionFields: ["Phrase"],
            answerFields: ["Audio", "Phrase Translation"],
          },
          {
            ord: 1,
            name: "Recall",
            questionFields: ["Phrase Translation"],
            answerFields: ["Phrase", "Audio"],
          },
        ],
      },
      {
        sourceNoteTypeId: "korean-vocab",
        name: "Korean Vocab",
        isCloze: false,
        fields: Object.keys(vocabFields),
        templates: [
          {
            ord: 0,
            name: "Recognition",
            questionFields: ["Sentence"],
            answerFields: ["Audio", "Word Translation", "Word", "Hanja"],
          },
          {
            ord: 1,
            name: "Recall",
            questionFields: ["Sentence Cloze", "Word Translation"],
            answerFields: ["Sentence", "Audio", "Hanja"],
          },
        ],
      },
    ],
  };
};

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

  it("keeps Xefjord target-language audio on the target-language side", () => {
    const parsed = xefjordPackageFixture();
    const preview = createAnkiImportPreview(parsed, {
      sha256: "a".repeat(64),
      fileName: "xefjord-icelandic.apkg",
      cached: false,
    });
    const mappings = xefjordAnkiFieldMappings(preview);

    expect(mappings["100"]).toMatchObject({
      Phrase: "PRIMARY_B",
      "Phrase Translation": "PRIMARY_A",
      Audio: "MEDIA_B",
      Image: "MEDIA_B",
    });

    const detection = prepareAnkiFieldMappedPackage(parsed, mappings, {
      sourceLocale: "en",
      targetLocale: "is",
    });
    const [recognition, recall] = detection.package.decks[0]!.cards;

    expect(recognition).toMatchObject({
      questionLocale: "is",
      answerLocale: "en",
      front: {
        blocks: [
          { type: "text", text: "Nótt" },
          expect.objectContaining({
            type: "audio",
            sourceName: "pronunciation_is_nótt.mp3",
          }),
        ],
      },
      back: { blocks: [{ type: "text", text: "Night" }] },
    });
    expect(recall).toMatchObject({
      questionLocale: "en",
      answerLocale: "is",
      front: { blocks: [{ type: "text", text: "Night" }] },
      back: {
        blocks: [
          { type: "text", text: "Nótt" },
          expect.objectContaining({
            type: "audio",
            sourceName: "pronunciation_is_nótt.mp3",
          }),
        ],
      },
    });
  });

  it("uses the translated sentence instead of the target-language cloze as English", () => {
    const parsed = xefjordPackageFixture();
    parsed.noteTypes[0] = {
      sourceNoteTypeId: "100",
      name: "Xefjord Sentence",
      isCloze: false,
      fields: [
        "Sentence",
        "Sentence Cloze",
        "Word",
        "Sentence Translation",
        "Word Translation",
        "Part-of-Speech",
        "Audio",
        "Image",
      ],
      templates: [
        {
          ord: 0,
          name: "Recognition",
          questionFields: ["Sentence"],
          answerFields: ["Sentence Translation", "Audio", "Image"],
        },
        {
          ord: 1,
          name: "Recall",
          questionFields: ["Sentence Cloze"],
          answerFields: ["Sentence", "Audio", "Image"],
        },
      ],
    };
    for (const card of parsed.decks[0]!.cards) {
      card.sourceFields = {
        Sentence: text("Jack talar íslensku."),
        "Sentence Cloze": text("Jack talar ___."),
        Word: text("íslensku"),
        "Sentence Translation": text("Jack speaks Icelandic."),
        "Word Translation": text("Icelandic"),
        "Part-of-Speech": text("noun"),
        Audio: audio("pronunciation_is_nótt.mp3"),
        Image: text(""),
      };
      card.sourceFieldText = Object.fromEntries(
        Object.entries(card.sourceFields).map(([field, content]) => [
          field,
          content.blocks
            .flatMap((block) =>
              block.type === "text" || block.type === "heading"
                ? [block.text]
                : [],
            )
            .join(" "),
        ]),
      );
    }
    const preview = createAnkiImportPreview(parsed, {
      sha256: "b".repeat(64),
      fileName: "xefjord-icelandic-sentence.apkg",
      cached: false,
    });

    expect(xefjordAnkiFieldMappings(preview)["100"]).toMatchObject({
      Sentence: "PRIMARY_B",
      "Sentence Translation": "PRIMARY_A",
      "Sentence Cloze": "IGNORE",
      Audio: "MEDIA_B",
      Image: "MEDIA_B",
    });
  });

  it("maps all three Mandarin schemas without treating HSK or audio as English", () => {
    const parsed = xefjordMandarinPackageFixture();
    const preview = createAnkiImportPreview(parsed, {
      sha256: "c".repeat(64),
      fileName: "Mandarin (Chinese).apkg",
      cached: false,
    });
    const mappings = xefjordAnkiFieldMappings(preview);

    expect(mappings.hanzi).toMatchObject({
      Meaning: "PRIMARY_A",
      Hanzi: "PRIMARY_B",
      HSK: "CATEGORY",
      FrequencyRank: "ORDER",
      Audio: "MEDIA_B",
      Diagram: "HINT_MEDIA",
    });
    expect(mappings.vocab).toMatchObject({
      Sentence: "PRIMARY_B",
      "Sentence Translation": "PRIMARY_A",
      Word: "HINT",
      "Word Translation": "HINT",
      Audio: "MEDIA_B",
    });
    expect(mappings.basic).toMatchObject({
      Phrase: "PRIMARY_B",
      "Phrase Translation": "PRIMARY_A",
      "Phrase Pinyin": "HINT",
      Audio: "MEDIA_B",
    });
  });

  it("builds safe rich Mandarin cards with context tables and correct locales", () => {
    const parsed = xefjordMandarinPackageFixture();
    const preview = createAnkiImportPreview(parsed, {
      sha256: "d".repeat(64),
      fileName: "Mandarin (Chinese).apkg",
      cached: false,
    });

    const detection = prepareAnkiFieldMappedPackage(
      parsed,
      xefjordAnkiFieldMappings(preview),
      { sourceLocale: "en", targetLocale: "zh" },
    );
    const [hanziRecall, hanziRecognition] = detection.package.decks[0]!.cards;
    const [vocabRecognition, vocabRecall] = detection.package.decks[1]!.cards;
    const [basicRecognition, basicRecall] = detection.package.decks[2]!.cards;

    expect(hanziRecognition).toMatchObject({
      questionLocale: "zh",
      answerLocale: "en",
    });
    expect(hanziRecognition?.front.blocks[0]).toMatchObject({
      type: "text",
      text: "这",
      marks: { bold: true },
    });
    expect(JSON.stringify(hanziRecognition?.front)).toContain(
      "mandarin-zhe.mp3",
    );
    expect(JSON.stringify(hanziRecognition?.back)).not.toContain(
      "mandarin-zhe.mp3",
    );
    expect(JSON.stringify(hanziRecognition?.front)).not.toContain("HSK");
    expect(JSON.stringify(hanziRecognition?.back)).toContain("this, the, here");
    expect(JSON.stringify(hanziRecognition?.back)).toContain('"HSK"');
    expect(hanziRecognition?.back.blocks).toContainEqual(
      expect.objectContaining({
        type: "image",
        sourceName: "36825.gif",
        alt: "Stroke order for 这",
        decorative: false,
      }),
    );
    expect(hanziRecall).toMatchObject({
      questionLocale: "en",
      answerLocale: "zh",
    });
    expect(JSON.stringify(hanziRecall?.front)).not.toContain(
      "mandarin-zhe.mp3",
    );
    expect(JSON.stringify(hanziRecall?.back)).toContain("mandarin-zhe.mp3");
    expect(JSON.stringify(hanziRecall?.front)).not.toContain('"HSK"');

    expect(vocabRecognition).toMatchObject({
      questionLocale: "zh",
      answerLocale: "en",
    });
    expect(JSON.stringify(vocabRecognition?.front)).toContain(
      "mandarin-nin.mp3",
    );
    expect(JSON.stringify(vocabRecognition?.back)).not.toContain(
      "mandarin-nin.mp3",
    );
    expect(JSON.stringify(vocabRecognition?.back)).toContain("Word");
    expect(JSON.stringify(vocabRecognition?.back)).toContain("您");
    expect(vocabRecall).toMatchObject({
      questionLocale: "en",
      answerLocale: "zh",
    });
    expect(JSON.stringify(vocabRecall?.front)).not.toContain(
      "mandarin-nin.mp3",
    );
    expect(JSON.stringify(vocabRecall?.back)).toContain("mandarin-nin.mp3");
    expect(JSON.stringify(vocabRecall?.front)).toContain("奶奶，[…]坐。");
    expect(JSON.stringify(vocabRecall?.front)).not.toContain('"text":"您"');
    expect(JSON.stringify(vocabRecall?.back)).toContain("Sentence pinyin");
    expect(vocabRecall?.sourceFields?.Word).toEqual(text("您"));
    expect(vocabRecall?.sourceFields?.["Sentence Translation"]).toEqual(
      text("Granny, please sit."),
    );

    expect(basicRecognition).toMatchObject({
      questionLocale: "zh",
      answerLocale: "en",
    });
    expect(JSON.stringify(basicRecognition?.front)).toContain("Huānyíng");
    expect(JSON.stringify(basicRecognition?.front)).toContain(
      "mandarin-welcome.mp3",
    );
    expect(basicRecall).toMatchObject({
      questionLocale: "en",
      answerLocale: "zh",
    });
    expect(JSON.stringify(basicRecall?.back)).toContain("Huānyíng");
  });

  it("maps and renders Japanese phrases, vocabulary, and Kanji without losing readings", () => {
    const parsed = xefjordJapanesePackageFixture();
    const preview = createAnkiImportPreview(parsed, {
      sha256: "e".repeat(64),
      fileName: "Japanese.apkg",
      cached: false,
    });
    const mappings = xefjordAnkiFieldMappings(preview);

    expect(mappings["japanese-basic"]).toMatchObject({
      Phrase: "PRIMARY_B",
      "Phrase Translation": "PRIMARY_A",
      "Phrase Furigana": "HINT",
      Audio: "MEDIA_B",
    });
    expect(mappings["japanese-kanji"]).toMatchObject({
      Kanji: "PRIMARY_B",
      keyword: "PRIMARY_A",
      "ON reading": "HINT",
      "KUN reading": "HINT",
      Diagram: "HINT_MEDIA",
      id: "SOURCE_ID",
      level: "CATEGORY",
    });

    const detection = prepareAnkiFieldMappedPackage(parsed, mappings, {
      sourceLocale: "en",
      targetLocale: "ja",
    });
    const [basicRecognition, basicRecall] = detection.package.decks[0]!.cards;
    const [vocabRecognition, vocabRecall] = detection.package.decks[1]!.cards;
    const [kanjiRecognition, kanjiRecall] = detection.package.decks[2]!.cards;

    expect(basicRecognition).toMatchObject({
      questionLocale: "ja",
      answerLocale: "en",
    });
    expect(JSON.stringify(basicRecognition?.front)).toContain("おげんきですか");
    expect(JSON.stringify(basicRecognition?.front)).toContain(
      "japanese-basic.mp3",
    );
    expect(JSON.stringify(basicRecognition?.back)).not.toContain(
      "japanese-basic.mp3",
    );
    expect(basicRecall).toMatchObject({
      questionLocale: "en",
      answerLocale: "ja",
    });
    expect(JSON.stringify(basicRecall?.back)).toContain("おげんきですか");
    expect(JSON.stringify(basicRecall?.back)).toContain("japanese-basic.mp3");

    expect(vocabRecognition).toMatchObject({
      questionLocale: "ja",
      answerLocale: "en",
    });
    expect(JSON.stringify(vocabRecognition?.front)).toContain(
      "わたしははじめてにほんにきた",
    );
    expect(JSON.stringify(vocabRecognition?.front)).toContain(
      "japanese-vocab.mp3",
    );
    expect(JSON.stringify(vocabRecognition?.back)).toContain(
      "Sentence translation",
    );
    expect(vocabRecall).toMatchObject({
      questionLocale: "en",
      answerLocale: "ja",
    });
    expect(JSON.stringify(vocabRecall?.front)).toContain("私は初めて[…]に来た");
    expect(JSON.stringify(vocabRecall?.back)).toContain("にほん");
    expect(JSON.stringify(vocabRecall?.back)).toContain("japanese-vocab.mp3");

    expect(kanjiRecognition).toMatchObject({
      questionLocale: "ja",
      answerLocale: "en",
      front: { blocks: [{ type: "text", text: "日", marks: { bold: true } }] },
    });
    expect(JSON.stringify(kanjiRecognition?.back)).toContain(
      "SUN ・ DAY ・ JAPAN",
    );
    expect(JSON.stringify(kanjiRecognition?.back)).toContain("ON reading");
    expect(JSON.stringify(kanjiRecognition?.back)).toContain("日にち");
    expect(kanjiRecognition?.back.blocks).toContainEqual(
      expect.objectContaining({
        type: "image",
        sourceName: "065e5.svg",
        alt: "Stroke order for 日",
        decorative: false,
      }),
    );
    expect(kanjiRecall).toMatchObject({
      questionLocale: "en",
      answerLocale: "ja",
      front: {
        blocks: [
          {
            type: "text",
            text: "SUN ・ DAY ・ JAPAN",
            marks: { bold: true },
          },
        ],
      },
    });
    expect(JSON.stringify(kanjiRecall?.back)).toContain('"text":"日"');
  });

  it("maps Korean audio to the Korean side and preserves Hanja context", () => {
    const parsed = xefjordKoreanPackageFixture();
    const preview = createAnkiImportPreview(parsed, {
      sha256: "f".repeat(64),
      fileName: "Korean.apkg",
      cached: false,
    });
    const mappings = xefjordAnkiFieldMappings(preview);

    expect(mappings["korean-basic"]).toMatchObject({
      Phrase: "PRIMARY_B",
      "Phrase Translation": "PRIMARY_A",
      Audio: "MEDIA_B",
    });
    expect(mappings["korean-vocab"]).toMatchObject({
      Sentence: "PRIMARY_B",
      "Word Translation": "PRIMARY_A",
      Hanja: "HINT",
      Audio: "MEDIA_B",
    });

    const detection = prepareAnkiFieldMappedPackage(parsed, mappings, {
      sourceLocale: "en",
      targetLocale: "ko",
    });
    const [basicRecognition, basicRecall] = detection.package.decks[0]!.cards;
    const [vocabRecognition, vocabRecall] = detection.package.decks[1]!.cards;

    expect(basicRecognition).toMatchObject({
      questionLocale: "ko",
      answerLocale: "en",
    });
    expect(JSON.stringify(basicRecognition?.front)).toContain(
      "korean-basic.mp3",
    );
    expect(JSON.stringify(basicRecognition?.back)).not.toContain(
      "korean-basic.mp3",
    );
    expect(basicRecall).toMatchObject({
      questionLocale: "en",
      answerLocale: "ko",
    });
    expect(JSON.stringify(basicRecall?.back)).toContain("korean-basic.mp3");

    expect(vocabRecognition).toMatchObject({
      questionLocale: "ko",
      answerLocale: "en",
    });
    expect(JSON.stringify(vocabRecognition?.front)).toContain(
      "korean-vocab.mp3",
    );
    expect(JSON.stringify(vocabRecognition?.back)).toContain("韓國");
    expect(vocabRecall).toMatchObject({
      questionLocale: "en",
      answerLocale: "ko",
    });
    expect(JSON.stringify(vocabRecall?.front)).toContain(
      "저는 […]에서 살고 있어요",
    );
    expect(JSON.stringify(vocabRecall?.back)).toContain("韓國");
    expect(JSON.stringify(vocabRecall?.back)).toContain("korean-vocab.mp3");
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
