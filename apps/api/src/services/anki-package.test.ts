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

const legacyCollection = async (
  fixture: {
    models?: Record<string, unknown>;
    decks?: Record<string, { id: number; name: string }>;
    modelId?: number;
    fields?: string;
    cards?: Array<{ id: number; deckId: number; ord: number }>;
  } = {},
): Promise<Buffer> => {
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
  const models = fixture.models ?? {
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
  const decks = fixture.decks ?? {
    "200": { id: 200, name: "Geografie::Hauptstädte" },
  };
  sqlite
    .prepare("INSERT INTO col VALUES (1,0,0,0,11,0,0,0,'?',?,?, '{}','{}')")
    .run(JSON.stringify(models), JSON.stringify(decks));
  sqlite
    .prepare(
      "INSERT INTO notes VALUES (300,'guid',?,0,0,' geography capital ',?,0,0,0,'')",
    )
    .run(
      fixture.modelId ?? 100,
      fixture.fields ??
        '<b>Berlin</b><img src="pixel.png" alt="Deutschlandkarte" onerror="alert(1)">\u001f[sound:answer.mp3]Deutschland<script>alert(1)</script>',
    );
  for (const card of fixture.cards ?? [
    { id: 400, deckId: 200, ord: 0 },
    { id: 401, deckId: 200, ord: 1 },
  ]) {
    sqlite
      .prepare(
        "INSERT INTO cards VALUES (?,300,?,?,0,0,0,0,0,0,0,0,0,0,0,0,0,'')",
      )
      .run(card.id, card.deckId, card.ord);
  }
  sqlite.close();
  return readFile(path);
};

const currentCollectionWithUnicase = async (): Promise<Buffer> => {
  const directory = await mkdtemp(
    join(tmpdir(), "flashcards-anki-current-test-"),
  );
  temporaryDirectories.push(directory);
  const path = join(directory, "collection.anki2");
  const sqlite = new DatabaseSync(path);
  sqlite.exec(`
    CREATE TABLE col (ver integer NOT NULL, models text, decks text);
    CREATE TABLE notetypes (
      id integer PRIMARY KEY, name text NOT NULL COLLATE binary,
      config blob NOT NULL
    );
    CREATE TABLE fields (
      ntid integer NOT NULL, ord integer NOT NULL,
      name text NOT NULL COLLATE binary,
      PRIMARY KEY (ntid, ord)
    ) WITHOUT ROWID;
    CREATE TABLE templates (
      ntid integer NOT NULL, ord integer NOT NULL,
      name text NOT NULL COLLATE binary, config blob NOT NULL,
      PRIMARY KEY (ntid, ord)
    ) WITHOUT ROWID;
    CREATE TABLE decks (
      id integer PRIMARY KEY, name text NOT NULL COLLATE binary
    );
    CREATE TABLE notes (
      id integer PRIMARY KEY, mid integer NOT NULL, tags text NOT NULL,
      flds text NOT NULL, flags integer NOT NULL
    );
    CREATE TABLE cards (
      id integer PRIMARY KEY, nid integer NOT NULL, did integer NOT NULL,
      odid integer NOT NULL, ord integer NOT NULL, type integer NOT NULL,
      queue integer NOT NULL, flags integer NOT NULL
    );
  `);
  sqlite.prepare("INSERT INTO col VALUES (18, '', '')").run();
  sqlite
    .prepare("INSERT INTO notetypes VALUES (100, 'Arabic Phrase', ?)")
    .run(Buffer.from([0x08, 0x00]));
  sqlite.prepare("INSERT INTO fields VALUES (100, 0, 'Phrase')").run();
  sqlite
    .prepare("INSERT INTO fields VALUES (100, 1, 'Phrase Translation')")
    .run();
  sqlite
    .prepare("INSERT INTO templates VALUES (100, 0, 'Card 1', ?)")
    .run(
      Buffer.concat([
        Buffer.from([0x0a, 0x0a]),
        Buffer.from("{{Phrase}}"),
        Buffer.from([0x12, 0x16]),
        Buffer.from("{{Phrase Translation}}"),
      ]),
    );
  sqlite
    .prepare("INSERT INTO decks VALUES (200, ?)")
    .run("Xefjord's Complete Arabic (MSA)\u001fBasic Arabic Words and Phrases");
  sqlite
    .prepare("INSERT INTO notes VALUES (300, 100, '', ?, 0)")
    .run("مرحبا\u001fHello");
  sqlite
    .prepare("INSERT INTO cards VALUES (400, 300, 200, 0, 0, 0, 0, 0)")
    .run();
  sqlite.enableDefensive?.(false);
  sqlite.exec(`
    PRAGMA writable_schema = ON;
    UPDATE sqlite_schema
    SET sql = replace(sql, 'COLLATE binary', 'COLLATE unicase')
    WHERE name IN ('notetypes', 'fields', 'templates', 'decks');
    PRAGMA writable_schema = OFF;
  `);
  sqlite.enableDefensive?.(true);
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
    expect(result.collectionTitle).toBe("Geografie");
    expect(result.decks).toHaveLength(1);
    expect(result.decks[0]?.title).toBe("Geografie › Hauptstädte");
    expect(result.decks[0]?.path).toEqual(["Geografie", "Hauptstädte"]);
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

  it("recognizes the current Anki hierarchy separator used by Xefjord decks", async () => {
    const collection = await legacyCollection({
      decks: {
        "200": {
          id: 200,
          name: "Xefjord's Complete Arabic (MSA)\u001fBasic Arabic Words and Phrases",
        },
      },
    });
    const archive = await zip([
      { name: "collection.anki2", data: collection },
      { name: "media", data: Buffer.from("{}") },
    ]);

    const result = await parseAnkiPackage(archive, {
      maximumMediaBytes: 1024 * 1024,
      fileName: "Arabic (MSA) (25-1-26).apkg",
    });

    expect(result.collectionTitle).toBe("Xefjord's Complete Arabic (MSA)");
    expect(result.decks[0]?.path).toEqual([
      "Xefjord's Complete Arabic (MSA)",
      "Basic Arabic Words and Phrases",
    ]);
  });

  it("imports current Anki schemas that require the unicase collation", async () => {
    const collection = await currentCollectionWithUnicase();
    const archive = await zip([{ name: "collection.anki2", data: collection }]);

    const result = await parseAnkiPackage(archive, {
      maximumMediaBytes: 1024 * 1024,
      fileName: "Arabic (MSA) (25-1-26).apkg",
    });

    expect(result.collectionTitle).toBe("Xefjord's Complete Arabic (MSA)");
    expect(result.decks[0]?.cards[0]?.front.blocks).toContainEqual({
      type: "text",
      text: "مرحبا",
    });
    expect(result.decks[0]?.cards[0]?.back.blocks).toContainEqual({
      type: "text",
      text: "Hello",
    });
  });

  it("keeps empty optional fields empty instead of labelling them unsupported", async () => {
    const collection = await legacyCollection({
      modelId: 103,
      models: {
        "103": {
          id: 103,
          name: "Optional media",
          type: 0,
          flds: [
            { name: "Front", ord: 0 },
            { name: "Back", ord: 1 },
            { name: "Audio", ord: 2 },
            { name: "Hint", ord: 3 },
          ],
          tmpls: [
            {
              name: "Card 1",
              ord: 0,
              qfmt: "{{Front}}",
              afmt: "{{Back}}{{Audio}}{{Hint}}",
            },
          ],
        },
      },
      fields: ["Frage", "Antwort", "", "   "].join("\u001f"),
      cards: [{ id: 403, deckId: 200, ord: 0 }],
    });
    const archive = await zip([{ name: "collection.anki2", data: collection }]);

    const result = await parseAnkiPackage(archive, {
      maximumMediaBytes: 1024 * 1024,
    });
    const card = result.decks[0]?.cards[0];

    expect(card?.sourceFields?.Audio).toEqual({ blocks: [] });
    expect(card?.sourceFields?.Hint).toEqual({ blocks: [] });
    expect(JSON.stringify(card)).not.toContain(
      "Nicht unterstützter Anki-Inhalt",
    );
  });

  it("still labels a non-empty missing media reference as unsupported", async () => {
    const collection = await legacyCollection({
      fields: ["Frage", "[sound:missing.mp3]"].join("\u001f"),
      cards: [{ id: 404, deckId: 200, ord: 0 }],
    });
    const archive = await zip([{ name: "collection.anki2", data: collection }]);

    const result = await parseAnkiPackage(archive, {
      maximumMediaBytes: 1024 * 1024,
    });

    expect(result.decks[0]?.cards[0]?.sourceFields?.Back).toEqual({
      blocks: [{ type: "text", text: "Nicht unterstützter Anki-Inhalt." }],
    });
    expect(result.warnings).toContainEqual(
      expect.stringContaining("referenziertes Audio fehlt"),
    );
  });

  it("compacts repeated missing image references into one useful warning", async () => {
    const collection = await legacyCollection({
      fields: [
        "Frage",
        "<img src='19968.gif'><img src='30340.gif'><img src='36825.gif'>",
      ].join("\u001f"),
      cards: [{ id: 405, deckId: 200, ord: 0 }],
    });
    const archive = await zip([{ name: "collection.anki2", data: collection }]);

    const result = await parseAnkiPackage(archive, {
      maximumMediaBytes: 1024 * 1024,
    });

    expect(result.warnings).toContain(
      "3 referenzierte Bilder fehlen oder werden nicht unterstützt.",
    );
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings.join("\n")).not.toMatch(/19968|30340|36825/);
  });

  it("imports sanitized SVG masks as declarative image occlusion overlays", async () => {
    const collection = await legacyCollection({
      modelId: 102,
      models: {
        "102": {
          id: 102,
          name: "Image Occlusion Enhanced",
          type: 0,
          flds: [
            { name: "Image", ord: 0 },
            { name: "Question Mask", ord: 1 },
            { name: "Answer Mask", ord: 2 },
            { name: "Header", ord: 3 },
          ],
          tmpls: [
            {
              name: "IO Card",
              ord: 0,
              qfmt: "{{Image}}{{Question Mask}}<script>setup()</script>",
              afmt: "{{Image}}{{Answer Mask}}<script>setup()</script>",
            },
          ],
        },
      },
      fields: [
        '<img src="anatomy.jpg" alt="Anatomy">',
        '<img src="question.svg">',
        '<img src="answer.svg">',
        "Identify the marked structure",
      ].join("\u001f"),
      cards: [{ id: 402, deckId: 200, ord: 0 }],
    });
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const questionSvg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><!-- generated --><rect x="10" y="12" width="30" height="20" fill="#ffeba2"/></svg>',
    );
    const answerSvg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><path d="M 10 12 L 40 12 L 40 32" fill="none" stroke="#2d2d2d"/></svg>',
    );
    const archive = await zip([
      { name: "collection.anki2", data: collection },
      {
        name: "media",
        data: Buffer.from(
          JSON.stringify({
            "0": "anatomy.jpg",
            "1": "question.svg",
            "2": "answer.svg",
          }),
        ),
      },
      { name: "0", data: jpeg },
      { name: "1", data: questionSvg },
      { name: "2", data: answerSvg },
    ]);

    const result = await parseAnkiPackage(archive, {
      maximumMediaBytes: 1024 * 1024,
    });

    expect(result.media.map((item) => item.mimeType).sort()).toEqual([
      "image/jpeg",
      "image/svg+xml",
      "image/svg+xml",
    ]);
    expect(result.decks[0]?.cards[0]?.front.blocks).toEqual([
      { type: "text", text: "Identify the marked structure" },
      {
        type: "imageOverlay",
        baseSourceName: "anatomy.jpg",
        overlaySourceName: "question.svg",
        alt: "Anatomy",
        decorative: false,
      },
    ]);
    expect(result.decks[0]?.cards[0]?.back.blocks).toEqual([
      { type: "text", text: "Identify the marked structure" },
      {
        type: "imageOverlay",
        baseSourceName: "anatomy.jpg",
        overlaySourceName: "answer.svg",
        alt: "Anatomy",
        decorative: false,
      },
    ]);
    expect(result.warnings).toContain(
      "2 SVG-Grafiken wurden geprüft und sicher als Vektorgrafiken importiert.",
    );
    expect(result.warnings.join("\n")).not.toMatch(
      /Nicht unterstütztes Medium.*\.svg/,
    );
  });

  it("resolves scripted cloze cards by ordinal instead of showing metadata", async () => {
    const collection = await legacyCollection({
      modelId: 103,
      models: {
        "103": {
          id: 103,
          name: "Cloze Overlapping",
          type: 1,
          flds: [
            { name: "Deck ID", ord: 0 },
            { name: "Text", ord: 1 },
            { name: "Answer", ord: 2 },
            { name: "Back Extra", ord: 3 },
          ],
          tmpls: [
            {
              name: "Cloze",
              ord: 0,
              qfmt: "{{Deck ID}}<div>{{cloze:Text}}</div><script>render()</script>",
              afmt: "{{Deck ID}}<div>{{cloze:Text}}</div>{{Answer}}{{Back Extra}}<script>render()</script>",
            },
          ],
        },
      },
      fields: [
        "2099309714",
        'The {{c1::heart::organ}} pumps {{c2::blood::fluid}}.<br><img src="heart.png" alt="Heart illustration">',
        "Cardiovascular system",
        "Further explanation",
      ].join("\u001f"),
      cards: [
        { id: 402, deckId: 200, ord: 0 },
        { id: 403, deckId: 200, ord: 1 },
      ],
    });
    const png = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
    png.writeUInt32BE(100, 16);
    png.writeUInt32BE(80, 20);
    const archive = await zip([
      { name: "collection.anki2", data: collection },
      { name: "media", data: Buffer.from('{"0":"heart.png"}') },
      { name: "0", data: png },
    ]);

    const result = await parseAnkiPackage(archive, {
      maximumMediaBytes: 1024 * 1024,
    });
    const [heartCard, bloodCard] = result.decks[0]!.cards;

    expect(heartCard?.front.blocks).toEqual([
      { type: "text", text: "The [organ] pumps blood." },
      {
        type: "image",
        sourceName: "heart.png",
        alt: "Heart illustration",
        decorative: false,
      },
    ]);
    expect(bloodCard?.front.blocks).toEqual([
      { type: "text", text: "The heart pumps [fluid]." },
      {
        type: "image",
        sourceName: "heart.png",
        alt: "Heart illustration",
        decorative: false,
      },
    ]);
    expect(heartCard?.back.blocks).toEqual(
      expect.arrayContaining([
        { type: "text", text: "The heart pumps blood." },
        { type: "text", text: "Cardiovascular system" },
        { type: "text", text: "Further explanation" },
      ]),
    );
    expect(
      JSON.stringify({ front: heartCard?.front, back: heartCard?.back }),
    ).not.toContain("2099309714");
    expect(heartCard?.sourceFieldText?.["Deck ID"]).toBe("2099309714");
  });

  it("converts coordinate-based image occlusion into safe SVG overlays", async () => {
    const collection = await legacyCollection({
      modelId: 104,
      models: {
        "104": {
          id: 104,
          name: "Image Occlusion",
          type: 1,
          flds: [
            { name: "Occlusion", ord: 0 },
            { name: "Image", ord: 1 },
            { name: "Header", ord: 2 },
          ],
          tmpls: [
            {
              name: "Image Occlusion",
              ord: 0,
              qfmt: "{{Occlusion}}{{Image}}<script>render()</script>",
              afmt: "{{Occlusion}}{{Image}}<script>render()</script>",
            },
          ],
        },
      },
      fields: [
        "{{c1::image-occlusion:rect:left=.1:top=.2:width=.3:height=.25:oi=1}}",
        '<img src="body.png" alt="Body cavities">',
        "Name the highlighted cavity",
      ].join("\u001f"),
      cards: [{ id: 402, deckId: 200, ord: 0 }],
    });
    const png = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
    png.writeUInt32BE(1000, 16);
    png.writeUInt32BE(800, 20);
    const archive = await zip([
      { name: "collection.anki2", data: collection },
      { name: "media", data: Buffer.from('{"0":"body.png"}') },
      { name: "0", data: png },
    ]);

    const result = await parseAnkiPackage(archive, {
      maximumMediaBytes: 1024 * 1024,
    });
    const card = result.decks[0]!.cards[0]!;
    const generatedSvg = result.media.filter(
      (item) => item.mimeType === "image/svg+xml",
    );

    expect(generatedSvg).toHaveLength(2);
    expect(generatedSvg[0]?.data.toString("utf8")).not.toMatch(
      /script|foreignObject|href/i,
    );
    expect(card.front.blocks).toEqual([
      { type: "text", text: "Name the highlighted cavity" },
      expect.objectContaining({
        type: "imageOverlay",
        baseSourceName: "body.png",
      }),
    ]);
    expect(card.back.blocks).toEqual([
      { type: "text", text: "Name the highlighted cavity" },
      expect.objectContaining({
        type: "imageOverlay",
        baseSourceName: "body.png",
      }),
    ]);
  });

  it("compacts JavaScript-dependent templates without executing their code", async () => {
    const collection = await legacyCollection({
      modelId: 101,
      models: {
        "101": {
          id: 101,
          name: "Dynamic vocabulary",
          type: 0,
          flds: [
            { name: "Wort", ord: 0 },
            { name: "Definition", ord: 1 },
            { name: "Beispielsätze", ord: 2 },
            { name: "Notiz", ord: 3 },
          ],
          tmpls: [
            {
              name: "FR → DE",
              ord: 0,
              qfmt: '<div class="word">{{Wort}}</div><div id="sentences">{{Beispielsätze}}</div><script>document.querySelector("#sentences").innerHTML = "changed";</script>',
              afmt: '{{FrontSide}}<hr id="answer"><div>{{Wort}}</div><div>{{Definition}}</div><div>{{Beispielsätze}}</div><div>{{Notiz}}</div><script>alert("must not run")</script>',
            },
          ],
        },
      },
      decks: {
        "200": { id: 200, name: "Französisch 5000::FR → DE" },
      },
      fields: [
        "programme",
        "Programm",
        "Le *programme* commence.\nDas *Programm* beginnt.\n\nL’ONU = l’Organisation des Nations unies.\nDie UNO ist die Organisation der Vereinten Nationen.",
        "Eine sehr lange Zusatznotiz, die nicht auf die Lernkarte gehört.",
      ].join("\u001f"),
      cards: [{ id: 402, deckId: 200, ord: 0 }],
    });
    const archive = await zip([{ name: "collection.anki2", data: collection }]);

    const result = await parseAnkiPackage(archive, {
      maximumMediaBytes: 1024 * 1024,
    });
    const card = result.decks[0]?.cards[0];

    expect(card?.front.blocks).toEqual([{ type: "text", text: "programme" }]);
    expect(card?.back.blocks).toEqual([
      { type: "text", text: "Programm" },
      {
        type: "text",
        text: "Le programme commence.\nDas Programm beginnt.",
      },
    ]);
    expect(
      JSON.stringify({ front: card?.front, back: card?.back }),
    ).not.toMatch(/zweite Beispiel|Zusatznotiz|script|alert|changed/i);
    expect(card?.sourceFields?.Notiz).toEqual({
      blocks: [
        {
          type: "text",
          text: "Eine sehr lange Zusatznotiz, die nicht auf die Lernkarte gehört.",
        },
      ],
    });
    expect(result.warnings).toContainEqual(
      expect.stringMatching(/sicher und kompakt importiert/),
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
