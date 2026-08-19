import { File } from "node:buffer";
import { readdir, readFile } from "node:fs/promises";
import { basename, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseLocalAnkiPackage } from "../../apps/web/lib/local-file-import.ts";

type ContentBlock = Record<string, unknown>;
type CardContent = { blocks: ContentBlock[] };

const minimumCoverage = 0.99;
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const defaultInput = resolve(repositoryRoot, "examples");

const contentText = (content: CardContent): string =>
  content.blocks
    .map((block) => {
      if (typeof block.text === "string") return block.text;
      if (typeof block.source === "string") return block.source;
      if (typeof block.latex === "string") return block.latex;
      if (typeof block.label === "string") return block.label;
      if (typeof block.sourceName === "string") return block.sourceName;
      if (Array.isArray(block.items)) return block.items.join(" ");
      if (block.type === "image" || block.type === "imageOverlay") {
        return "[image]";
      }
      return "";
    })
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();

const textualContent = (content: CardContent): string =>
  content.blocks
    .map((block) => {
      if (typeof block.text === "string") return block.text;
      if (typeof block.source === "string") return block.source;
      if (Array.isArray(block.items)) return block.items.join(" ");
      return "";
    })
    .join("\n")
    .replace(/\r\n?/g, "\n")
    .trim();

const htmlAttribute = (tag: string, name: string): string => {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  );
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
};

const localMediaName = (value: string): string | null => {
  const decoded = value
    .replace(/&#(\d+);/g, (_match, number: string) =>
      String.fromCodePoint(Number(number)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, number: string) =>
      String.fromCodePoint(Number.parseInt(number, 16)),
    )
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .trim();
  if (
    !decoded ||
    decoded.length > 255 ||
    /^(?:https?:|data:|javascript:|file:|\/\/)/i.test(decoded) ||
    decoded.includes("/") ||
    decoded.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(decoded)
  ) {
    return null;
  }
  try {
    return decodeURIComponent(decoded).normalize("NFC");
  } catch {
    return decoded.normalize("NFC");
  }
};

const referencedMedia = (
  fields: Record<string, string> | undefined,
): Array<{ name: string; kind: "image" | "audio" }> => {
  const references: Array<{ name: string; kind: "image" | "audio" }> = [];
  for (const html of Object.values(fields ?? {})) {
    for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
      const name = localMediaName(htmlAttribute(tag, "src"));
      if (name) references.push({ name, kind: "image" });
    }
    for (const match of html.matchAll(/\[sound:([^\]\r\n]+)\]/gi)) {
      const name = localMediaName(match[1] ?? "");
      if (name) references.push({ name, kind: "audio" });
    }
  }
  return references;
};

const findPackages = async (input: string): Promise<string[]> => {
  const path = resolve(input);
  if (extname(path).toLowerCase() === ".apkg") return [path];
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? findPackages(resolve(path, entry.name))
        : Promise.resolve(
            entry.name.toLowerCase().endsWith(".apkg")
              ? [resolve(path, entry.name)]
              : [],
          ),
    ),
  );
  return nested.flat().sort();
};

const main = async (): Promise<void> => {
  const requestedInput = process.argv[2];
  const input = requestedInput
    ? resolve(repositoryRoot, requestedInput)
    : defaultInput;
  const packagePaths = await findPackages(input);
  if (packagePaths.length === 0) {
    throw new Error(`No APKG packages found below ${resolve(input)}.`);
  }

  let totalCards = 0;
  let cleanCards = 0;
  let totalWarnings = 0;
  const issueCounts = new Map<string, number>();
  const warningCounts = new Map<string, number>();
  const warningPackages = new Map<string, Set<string>>();
  const issueSamples: Array<{
    package: string;
    sourceNoteId: string;
    sourceTemplateName?: string;
    reasons: string[];
    missingMedia: string[];
    front: string;
    back: string;
  }> = [];
  const failedPackages: Array<{ package: string; error: string }> = [];

  for (const packagePath of packagePaths) {
    const displayPath =
      relative(repositoryRoot, packagePath) || basename(packagePath);
    try {
      const bytes = await readFile(packagePath);
      const parsed = await parseLocalAnkiPackage(
        new File([bytes], basename(packagePath)) as unknown as globalThis.File,
      );
      const cards = parsed.decks.flatMap((deck) => deck.cards);
      const mediaKinds = new Map(
        parsed.media.map((media) => [media.sourceName, media.kind]),
      );
      let packageIssues = 0;
      totalWarnings += parsed.warnings.length;
      for (const warning of parsed.warnings) {
        const category = warning.replace(/\d+/g, "#");
        warningCounts.set(category, (warningCounts.get(category) ?? 0) + 1);
        const packages = warningPackages.get(category) ?? new Set<string>();
        packages.add(displayPath);
        warningPackages.set(category, packages);
      }

      for (const card of cards) {
        totalCards += 1;
        const front = contentText(card.front as CardContent);
        const back = contentText(card.back as CardContent);
        const frontText = textualContent(card.front as CardContent);
        const backText = textualContent(card.back as CardContent);
        const combined = `${front}\n${back}`;
        const reasons = new Set<string>();
        const missingMedia: string[] = [];

        if (!front) reasons.add("empty-front");
        if (!back) reasons.add("empty-back");
        if (/Nicht unterstützter Anki-Inhalt/i.test(combined)) {
          reasons.add("unsupported-placeholder");
        }
        if (/\{\{[^{}]+\}\}/u.test(combined)) {
          reasons.add("raw-template-token");
        }
        if (/(?:^|\s)TAGS:\s/iu.test(combined)) {
          reasons.add("template-tags-in-content");
        }
        for (const reference of referencedMedia(card.sourceFieldRaw)) {
          if (mediaKinds.get(reference.name) !== reference.kind) {
            reasons.add(`missing-${reference.kind}`);
            if (missingMedia.length < 10) missingMedia.push(reference.name);
          }
        }
        const hasStructuredCloze = card.front.blocks.some(
          (block) => block.type === "cloze",
        );
        const repeatedSuffix = backText.startsWith(frontText)
          ? backText.slice(frontText.length)
          : "";
        if (
          !hasStructuredCloze &&
          frontText.length >= 3 &&
          /^(?:\u0001[ \t\n]*|\n[ \t]*\n)/u.test(repeatedSuffix)
        ) {
          reasons.add("front-repeated-in-answer");
        }

        if (reasons.size === 0) {
          cleanCards += 1;
          continue;
        }
        packageIssues += 1;
        if (issueSamples.length < 20) {
          issueSamples.push({
            package: displayPath,
            sourceNoteId: card.sourceNoteId,
            sourceTemplateName: card.sourceTemplateName,
            reasons: [...reasons],
            missingMedia,
            front: front.slice(0, 240),
            back: back.slice(0, 240),
          });
        }
        for (const reason of reasons) {
          issueCounts.set(reason, (issueCounts.get(reason) ?? 0) + 1);
        }
      }

      console.log(
        `${displayPath}: ${cards.length} cards, ${parsed.media.length} media, ${packageIssues} structural issues, ${parsed.warnings.length} warnings`,
      );
    } catch (error) {
      failedPackages.push({
        package: displayPath,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(`${displayPath}: import failed`);
    }
  }

  const coverage = totalCards === 0 ? 0 : cleanCards / totalCards;
  const issues = Object.fromEntries(
    [...issueCounts.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
  const warningSummary = [...warningCounts.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, 30)
    .map(([warning, occurrences]) => ({
      warning,
      occurrences,
      packages: [...(warningPackages.get(warning) ?? [])].slice(0, 8),
    }));
  console.log(
    JSON.stringify(
      {
        packages: packagePaths.length,
        failedPackages,
        cards: totalCards,
        cleanCards,
        structuralCoverage: Number((coverage * 100).toFixed(4)),
        minimumCoverage: minimumCoverage * 100,
        issues,
        issueSamples,
        importWarnings: totalWarnings,
        warningSummary,
      },
      null,
      2,
    ),
  );

  if (failedPackages.length > 0 || coverage < minimumCoverage) {
    process.exitCode = 1;
  }
};

void main();
