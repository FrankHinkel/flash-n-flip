import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const requireFromApi = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
const yazl = requireFromApi("yazl");
const fixedModifiedAt = new Date("2026-08-11T00:00:00.000Z");
const fixtureDirectory = fileURLToPath(new URL("./fixtures", import.meta.url));
const temporaryDirectories = [];

const zip = async (entries, outputPath) => {
  const archive = new yazl.ZipFile();
  for (const entry of entries) {
    archive.addBuffer(entry.data, entry.name, {
      mtime: fixedModifiedAt,
      mode: 0o100644,
    });
  }
  archive.end();
  const chunks = [];
  for await (const chunk of archive.outputStream) {
    chunks.push(Buffer.from(chunk));
  }
  await writeFile(outputPath, Buffer.concat(chunks));
};

const legacyCollection = async ({ models, decks, notes, cards }) => {
  const directory = await mkdtemp(join(tmpdir(), "fnf-general-import-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "collection.anki2");
  const database = new DatabaseSync(path);
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
  database
    .prepare("INSERT INTO col VALUES (1,0,0,0,11,0,0,0,'?',?,?, '{}','{}')")
    .run(JSON.stringify(models), JSON.stringify(decks));
  for (const note of notes) {
    database
      .prepare("INSERT INTO notes VALUES (?, ?, ?, 0, 0, ?, ?, 0, 0, 0, '')")
      .run(note.id, note.guid, note.modelId, note.tags, note.fields);
  }
  for (const card of cards) {
    database
      .prepare(
        "INSERT INTO cards VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '')",
      )
      .run(card.id, card.noteId, card.deckId, card.ordinal);
  }
  database.close();
  return readFile(path);
};

const protoString = (field, value) => {
  const bytes = Buffer.from(value);
  if (bytes.byteLength >= 128) throw new Error("Fixture protobuf is too large");
  return Buffer.concat([
    Buffer.from([(field << 3) | 2, bytes.byteLength]),
    bytes,
  ]);
};

const currentCollection = async () => {
  const directory = await mkdtemp(join(tmpdir(), "fnf-modern-import-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "collection.anki2");
  const database = new DatabaseSync(path);
  database.exec(`
    CREATE TABLE col (ver integer NOT NULL, models text, decks text);
    CREATE TABLE notetypes (id integer PRIMARY KEY, name text NOT NULL, config blob NOT NULL);
    CREATE TABLE fields (ntid integer NOT NULL, ord integer NOT NULL, name text NOT NULL, PRIMARY KEY (ntid, ord)) WITHOUT ROWID;
    CREATE TABLE templates (ntid integer NOT NULL, ord integer NOT NULL, name text NOT NULL, config blob NOT NULL, PRIMARY KEY (ntid, ord)) WITHOUT ROWID;
    CREATE TABLE decks (id integer PRIMARY KEY, name text NOT NULL);
    CREATE TABLE notes (id integer PRIMARY KEY, mid integer NOT NULL, tags text NOT NULL, flds text NOT NULL, flags integer NOT NULL);
    CREATE TABLE cards (id integer PRIMARY KEY, nid integer NOT NULL, did integer NOT NULL, odid integer NOT NULL, ord integer NOT NULL, type integer NOT NULL, queue integer NOT NULL, flags integer NOT NULL);
  `);
  database.prepare("INSERT INTO col VALUES (18, '', '')").run();
  database
    .prepare("INSERT INTO notetypes VALUES (100, 'Modern Basic', ?)")
    .run(Buffer.from([0x08, 0x00]));
  database.prepare("INSERT INTO fields VALUES (100, 0, 'Front')").run();
  database.prepare("INSERT INTO fields VALUES (100, 1, 'Back')").run();
  database
    .prepare("INSERT INTO templates VALUES (100, 0, 'Card 1', ?)")
    .run(
      Buffer.concat([
        protoString(1, "{{Front}}"),
        protoString(2, "{{FrontSide}}<hr id=answer>{{Back}}"),
      ]),
    );
  database.prepare("INSERT INTO decks VALUES (200, 'Modern::Deck')").run();
  database
    .prepare("INSERT INTO notes VALUES (300, 100, ' modern ', ?, 0)")
    .run("Current front\u001fCurrent back [sound:modern.mp3]");
  database
    .prepare("INSERT INTO cards VALUES (400, 300, 200, 0, 0, 0, 0, 0)")
    .run();
  database.close();
  return readFile(path);
};

const main = async () => {
  await mkdir(fixtureDirectory, { recursive: true });
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const mp3 = Buffer.from([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0]);
  const basicModel = {
    100: {
      id: 100,
      name: "Basic",
      type: 0,
      flds: [
        { name: "Front", ord: 0 },
        { name: "Back", ord: 1 },
      ],
      tmpls: [
        {
          name: "Card 1",
          ord: 0,
          qfmt: '<b>Question:</b> {{Front}}<img src="pixel.png" alt="Map" onerror="alert(1)">',
          afmt: "{{FrontSide}}<hr id=answer>{{Back}}<script>alert(1)</script>",
        },
      ],
    },
  };
  const classic = await legacyCollection({
    models: basicModel,
    decks: { 200: { id: 200, name: "Languages::Icelandic" } },
    notes: [
      {
        id: 300,
        guid: "general-classic",
        modelId: 100,
        tags: " language safe-tag ",
        fields: "Halló\u001fHello [sound:voice.mp3]",
      },
    ],
    cards: [{ id: 400, noteId: 300, deckId: 200, ordinal: 0 }],
  });
  await zip(
    [
      { name: "collection.anki2", data: classic },
      {
        name: "media",
        data: Buffer.from(JSON.stringify({ 0: "voice.mp3", 1: "pixel.png" })),
      },
      { name: "0", data: mp3 },
      { name: "1", data: png },
    ],
    join(fixtureDirectory, "general-classic-subdeck.apkg"),
  );

  const modern = await currentCollection();
  await zip(
    [
      { name: "collection.anki2", data: modern },
      { name: "media", data: Buffer.from(JSON.stringify({ 0: "modern.mp3" })) },
      { name: "0", data: mp3 },
    ],
    join(fixtureDirectory, "general-modern.apkg"),
  );

  const cloze = await legacyCollection({
    models: {
      101: {
        id: 101,
        name: "Cloze",
        type: 1,
        flds: [
          { name: "Text", ord: 0 },
          { name: "Extra", ord: 1 },
        ],
        tmpls: [
          {
            name: "Cloze",
            ord: 0,
            qfmt: "{{cloze:Text}}<script>render()</script>",
            afmt: "{{cloze:Text}}<br>{{Extra}}<script>render()</script>",
          },
        ],
      },
    },
    decks: { 201: { id: 201, name: "Science::Cloze" } },
    notes: [
      {
        id: 301,
        guid: "general-cloze",
        modelId: 101,
        tags: " science cloze ",
        fields:
          "The {{c1::heart::organ}} pumps {{c2::blood::fluid}}.\u001fCirculation",
      },
    ],
    cards: [
      { id: 401, noteId: 301, deckId: 201, ordinal: 0 },
      { id: 402, noteId: 301, deckId: 201, ordinal: 1 },
    ],
  });
  await zip(
    [
      { name: "collection.anki2", data: cloze },
      { name: "media", data: Buffer.from("{}") },
    ],
    join(fixtureDirectory, "general-cloze.apkg"),
  );

  const imageOcclusion = await legacyCollection({
    models: {
      102: {
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
    decks: { 202: { id: 202, name: "Anatomy::Occlusion" } },
    notes: [
      {
        id: 302,
        guid: "general-image-occlusion",
        modelId: 102,
        tags: " anatomy occlusion ",
        fields: [
          '<img src="anatomy.jpg" alt="Anatomy">',
          '<img src="question.svg">',
          '<img src="answer.svg">',
          "Identify the marked structure",
        ].join("\u001f"),
      },
    ],
    cards: [{ id: 403, noteId: 302, deckId: 202, ordinal: 0 }],
  });
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const questionSvg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><rect x="10" y="12" width="30" height="20" fill="#ffeba2"/></svg>',
  );
  const answerSvg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80"><path d="M 10 12 L 40 12 L 40 32" fill="none" stroke="#2d2d2d"/></svg>',
  );
  await zip(
    [
      { name: "collection.anki2", data: imageOcclusion },
      {
        name: "media",
        data: Buffer.from(
          JSON.stringify({
            0: "anatomy.jpg",
            1: "question.svg",
            2: "answer.svg",
          }),
        ),
      },
      { name: "0", data: jpeg },
      { name: "1", data: questionSvg },
      { name: "2", data: answerSvg },
    ],
    join(fixtureDirectory, "general-image-occlusion.apkg"),
  );

  const audioId = "00000000-0000-4000-8000-000000000001";
  const imageId = "00000000-0000-4000-8000-000000000002";
  const fnf = {
    format: "flash-n-flip.local-package",
    version: 1,
    title: "Portable media",
    decks: [
      {
        sourceId: "portable-root",
        path: ["Portable media", "Examples"],
        cards: [
          {
            sourceId: "portable-card",
            sourceNoteId: "portable-note",
            front: {
              blocks: [
                {
                  type: "markdown",
                  revealMode: "ALL",
                  source: [
                    "## Structured reference",
                    "",
                    "^ Language ^ Value ^",
                    "| English | **Hello** |",
                    "| Formula | $E = mc^2$ |",
                  ].join("\n"),
                },
                { type: "image", mediaId: imageId, alt: "One pixel" },
              ],
            },
            back: {
              blocks: [
                {
                  type: "markdown",
                  revealMode: "ALL",
                  source:
                    "The table, formula, image, and audio stay structured.",
                },
                { type: "audio", mediaId: audioId, label: "Synthetic audio" },
              ],
            },
            tags: ["portable", "media"],
          },
        ],
      },
    ],
    media: [
      {
        sourceName: audioId,
        mimeType: "audio/mpeg",
        sha256: createHash("sha256").update(mp3).digest("hex"),
        dataBase64: mp3.toString("base64"),
      },
      {
        sourceName: imageId,
        mimeType: "image/png",
        sha256: createHash("sha256").update(png).digest("hex"),
        dataBase64: png.toString("base64"),
      },
    ],
  };
  await writeFile(
    join(fixtureDirectory, "general-media.fnf"),
    `${JSON.stringify(fnf, null, 2)}\n`,
  );
  await writeFile(
    join(fixtureDirectory, "general-csv.csv"),
    'front,back,tags\n"Question, with comma","Answer with\nreal line break","tag-one tag-two"\n"Quoted ""question""","<b>Safe answer</b>",safe\n',
  );
  await writeFile(
    join(fixtureDirectory, "general-anki.tsv"),
    "Question<br>line two\t<b>Answer</b>\tanki safe\n",
  );
};

try {
  await main();
  process.stdout.write(
    `Generated general import fixtures in ${fixtureDirectory}\n`,
  );
} finally {
  await Promise.all(
    temporaryDirectories.map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
}
