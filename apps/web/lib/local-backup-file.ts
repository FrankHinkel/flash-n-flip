import {
  maximumLocalBackupBytes,
  type LocalAppBackupPart,
} from "@flashcards/domain/local-app-data";

/** A bounded JSON reader for the existing v1-v3 backup format. */
class BackupJsonReader {
  private readonly decoder = new TextDecoder("utf-8", { fatal: true });
  private offset = 0;
  private buffer = "";
  private index = 0;
  private finished = false;
  constructor(
    private readonly file: Blob,
    private readonly maximumValueChars: number,
  ) {}

  private async available(): Promise<boolean> {
    while (this.index === this.buffer.length && !this.finished) {
      if (this.offset < this.file.size) {
        const end = Math.min(this.file.size, this.offset + 64 * 1024);
        const bytes = await this.file.slice(this.offset, end).arrayBuffer();
        this.offset = end;
        this.buffer = this.decoder.decode(bytes, { stream: true });
      } else {
        this.buffer = this.decoder.decode();
        this.finished = true;
      }
      this.index = 0;
    }
    return this.index < this.buffer.length;
  }

  async peek(): Promise<string | null> {
    while (await this.available()) {
      const character = this.buffer[this.index]!;
      if (!/[\t\n\r ]/.test(character)) return character;
      this.index += 1;
    }
    return null;
  }

  async expect(character: string): Promise<void> {
    if ((await this.peek()) !== character)
      throw new Error("Invalid backup JSON delimiter");
    this.index += 1;
  }

  async value(limit = this.maximumValueChars): Promise<unknown> {
    const first = await this.peek();
    if (first === null) throw new Error("Incomplete backup JSON");
    const container = first === "{" || first === "[";
    const string = first === '"';
    const stack: string[] = [];
    let quoted = false;
    let escaped = false;
    let length = 0;
    const pieces: string[] = [];
    while (await this.available()) {
      const start = this.index;
      let complete = false;
      while (this.index < this.buffer.length) {
        const character = this.buffer[this.index]!;
        if (!container && !string && /[\t\n\r ,}\]]/.test(character)) {
          complete = true;
          break;
        }
        this.index += 1;
        if (quoted) {
          if (escaped) escaped = false;
          else if (character === "\\") escaped = true;
          else if (character === '"') {
            quoted = false;
            if (string) {
              complete = true;
              break;
            }
          }
        } else if (character === '"') quoted = true;
        else if (container) {
          if (character === "{" || character === "[") {
            stack.push(character);
            if (stack.length > 128)
              throw new Error("Backup JSON nesting limit exceeded");
          } else if (character === "}" || character === "]") {
            if (stack.pop() !== (character === "}" ? "{" : "["))
              throw new Error("Invalid backup JSON nesting");
            if (!stack.length) {
              complete = true;
              break;
            }
          }
        }
      }
      length += this.index - start;
      if (length > limit) throw new Error("Backup JSON value limit exceeded");
      pieces.push(this.buffer.slice(start, this.index));
      if (complete) return JSON.parse(pieces.join("")) as unknown;
    }
    if (quoted || stack.length) throw new Error("Incomplete backup JSON");
    return JSON.parse(pieces.join("")) as unknown;
  }
}

export async function* readLocalBackupFile(
  file: Blob,
  limits: { maximumBytes?: number; maximumValueChars?: number } = {},
): AsyncGenerator<LocalAppBackupPart> {
  const maximumBytes = limits.maximumBytes ?? maximumLocalBackupBytes;
  if (file.size > maximumBytes)
    throw new Error("Die Sicherungsdatei ist zu groß.");
  const reader = new BackupJsonReader(
    file,
    limits.maximumValueChars ?? maximumBytes,
  );
  const fields = new Set<string>();
  await reader.expect("{");
  if ((await reader.peek()) !== "}") {
    while (true) {
      const key = await reader.value(32);
      if (
        typeof key !== "string" ||
        !["format", "version", "exportedAt", "authority", "media"].includes(
          key,
        ) ||
        fields.has(key)
      )
        throw new Error("Invalid or duplicate backup field");
      fields.add(key);
      await reader.expect(":");
      if (key === "media") {
        await reader.expect("[");
        if ((await reader.peek()) !== "]") {
          while (true) {
            yield { kind: "media", value: await reader.value() };
            if ((await reader.peek()) === "]") break;
            await reader.expect(",");
            if ((await reader.peek()) === "]")
              throw new Error("Invalid backup JSON trailing comma");
          }
        }
        await reader.expect("]");
      } else yield { kind: "field", key, value: await reader.value() };
      if ((await reader.peek()) === "}") break;
      await reader.expect(",");
      if ((await reader.peek()) === "}")
        throw new Error("Invalid backup JSON trailing comma");
    }
  }
  await reader.expect("}");
  if ((await reader.peek()) !== null || fields.size !== 5)
    throw new Error("Incomplete backup or trailing JSON content");
}

export async function localBackupBlob(
  segments: AsyncIterable<string>,
): Promise<Blob> {
  const parts: Blob[] = [];
  let size = 0;
  for await (const segment of segments) {
    const part = new Blob([segment]);
    size += part.size;
    if (size > maximumLocalBackupBytes)
      throw new Error("Die Sicherungsdatei ist zu groß.");
    parts.push(part);
  }
  return new Blob(parts, { type: "application/json" });
}
