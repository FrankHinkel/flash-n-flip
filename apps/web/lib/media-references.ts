import type { CardContent, ContentBlock } from "@flashcards/domain/content";
import {
  markdownToRichTextDocument,
  type MarkdownRichDocument,
  type MarkdownRichNode,
} from "@flashcards/domain/markdown";

export type ReferenceableMediaBlock = Extract<
  ContentBlock,
  { type: "image" | "audio" }
>;

const mediaReferencePattern = /^media([1-9]\d*)$/i;

const referenceNodes = (document: MarkdownRichDocument): string[] => {
  const names: string[] = [];
  const visit = (node: MarkdownRichNode) => {
    if (
      node.type === "contentReference" &&
      typeof node.attrs?.name === "string"
    )
      names.push(node.attrs.name);
    node.content?.forEach(visit);
  };
  document.content.forEach(visit);
  return names;
};

export const mediaBlocks = (content: CardContent): ReferenceableMediaBlock[] =>
  content.blocks.filter(
    (block): block is ReferenceableMediaBlock =>
      block.type === "image" || block.type === "audio",
  );

export const mediaReferenceAliases = (
  block: ReferenceableMediaBlock,
): string[] => {
  const name = block.referenceName;
  if (!name) return [];
  const number = mediaReferencePattern.exec(name)?.[1];
  return number ? [name, number] : [name];
};

export const normalizeMediaReferenceNames = (
  content: CardContent,
): { content: CardContent; changed: boolean } => {
  const used = new Set<string>();
  let nextNumber = Math.max(
    0,
    ...mediaBlocks(content).map((block) =>
      Number(mediaReferencePattern.exec(block.referenceName ?? "")?.[1] ?? 0),
    ),
  );
  let changed = false;
  const next = content.blocks.map((block) => {
    if (block.type !== "image" && block.type !== "audio") return block;
    const requested = block.referenceName;
    if (requested && !used.has(requested)) {
      used.add(requested);
      return block;
    }
    do nextNumber += 1;
    while (used.has(`media${nextNumber}`));
    const referenceName = `media${nextNumber}`;
    used.add(referenceName);
    changed = true;
    return { ...block, referenceName };
  });
  return { content: changed ? { blocks: next } : content, changed };
};

export const mediaReferenceMap = (
  content: CardContent,
): ReadonlyMap<string, ReferenceableMediaBlock> => {
  const references = new Map<string, ReferenceableMediaBlock>();
  mediaBlocks(content).forEach((block) => {
    mediaReferenceAliases(block).forEach((name) => {
      if (!references.has(name)) references.set(name, block);
    });
  });
  return references;
};

export const contentReferenceNames = (content: CardContent): string[] => {
  const names: string[] = [];
  for (const block of content.blocks) {
    if (block.type !== "markdown") continue;
    try {
      names.push(...referenceNodes(markdownToRichTextDocument(block.source)));
    } catch {
      // Syntax diagnostics are rendered by the Markdown component.
    }
  }
  return names;
};

export const referencedMediaIds = (
  content: CardContent,
): ReadonlySet<string> => {
  const references = mediaReferenceMap(content);
  return new Set(
    contentReferenceNames(content)
      .map((name) => references.get(name)?.mediaId)
      .filter((mediaId): mediaId is string => Boolean(mediaId)),
  );
};
