export type AnkiClozeDeletion = {
  id: number;
  start: number;
  end: number;
  hint?: string;
};

export type ParsedAnkiCloze = {
  text: string;
  deletions: AnkiClozeDeletion[];
};

export type AnkiClozePart = {
  kind: "text" | "blank" | "answer";
  text: string;
};

const clozeStart = /^\{\{c(\d+)::/i;

export function parseAnkiCloze(source: string): ParsedAnkiCloze | null {
  let cursor = 0;
  let text = "";
  let failed = false;
  const deletions: AnkiClozeDeletion[] = [];

  const parseDeletion = (depth: number): boolean => {
    if (depth > 8 || deletions.length >= 500) return false;
    const opening = clozeStart.exec(source.slice(cursor));
    if (!opening) return false;
    const id = Number(opening[1]);
    if (!Number.isSafeInteger(id) || id <= 0 || id > 500) return false;
    cursor += opening[0].length;
    const start = text.length;
    let braceDepth = 0;
    let hint: string | undefined;

    while (cursor < source.length) {
      if (braceDepth === 0 && clozeStart.test(source.slice(cursor))) {
        if (!parseDeletion(depth + 1)) return false;
        continue;
      }
      if (braceDepth === 0 && source.startsWith("::", cursor)) {
        cursor += 2;
        const hintStart = cursor;
        let hintBraceDepth = 0;
        while (cursor < source.length) {
          if (source[cursor] === "{") {
            hintBraceDepth += 1;
            cursor += 1;
            continue;
          }
          if (source[cursor] === "}" && hintBraceDepth > 0) {
            hintBraceDepth -= 1;
            cursor += 1;
            continue;
          }
          if (hintBraceDepth === 0 && source.startsWith("}}", cursor)) {
            hint = source.slice(hintStart, cursor).trim().slice(0, 300);
            cursor += 2;
            deletions.push({
              id,
              start,
              end: text.length,
              ...(hint ? { hint } : {}),
            });
            return text.length > start;
          }
          cursor += 1;
        }
        return false;
      }
      if (braceDepth === 0 && source.startsWith("}}", cursor)) {
        cursor += 2;
        deletions.push({ id, start, end: text.length });
        return text.length > start;
      }
      const character = source[cursor]!;
      if (character === "{") braceDepth += 1;
      else if (character === "}" && braceDepth > 0) braceDepth -= 1;
      text += character;
      cursor += 1;
    }
    return false;
  };

  while (cursor < source.length) {
    if (clozeStart.test(source.slice(cursor))) {
      if (!parseDeletion(1)) {
        failed = true;
        break;
      }
      continue;
    }
    text += source[cursor]!;
    cursor += 1;
  }

  if (failed || !deletions.length) return null;
  return { text, deletions };
}

const activeRanges = (
  parsed: ParsedAnkiCloze,
  activeId: number,
): AnkiClozeDeletion[] => {
  const candidates = parsed.deletions
    .filter(
      (deletion) =>
        deletion.id === activeId &&
        deletion.start >= 0 &&
        deletion.end > deletion.start &&
        deletion.end <= parsed.text.length,
    )
    .sort((left, right) => left.start - right.start || right.end - left.end);
  const visible: AnkiClozeDeletion[] = [];
  for (const candidate of candidates) {
    const previous = visible.at(-1);
    if (previous && candidate.start < previous.end) {
      if (candidate.end > previous.end) previous.end = candidate.end;
      continue;
    }
    visible.push({ ...candidate });
  }
  return visible;
};

export function ankiClozeParts(
  parsed: ParsedAnkiCloze,
  activeId: number,
  answer: boolean,
): AnkiClozePart[] {
  const ranges = activeRanges(parsed, activeId);
  if (!ranges.length) return [{ kind: "text", text: parsed.text }];
  const parts: AnkiClozePart[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      parts.push({
        kind: "text",
        text: parsed.text.slice(cursor, range.start),
      });
    }
    parts.push(
      answer
        ? { kind: "answer", text: parsed.text.slice(range.start, range.end) }
        : { kind: "blank", text: range.hint || "…" },
    );
    cursor = range.end;
  }
  if (cursor < parsed.text.length) {
    parts.push({ kind: "text", text: parsed.text.slice(cursor) });
  }
  return parts;
}

export function ankiClozePlainText(
  parsed: ParsedAnkiCloze,
  activeId: number,
  answer: boolean,
): string {
  return ankiClozeParts(parsed, activeId, answer)
    .map((part) => (part.kind === "blank" ? `[${part.text}]` : part.text))
    .join("");
}
