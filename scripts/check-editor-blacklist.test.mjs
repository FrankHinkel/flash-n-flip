import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("blacklist check covers TipTap and ProseMirror", async () => {
  const source = await readFile(
    new URL("./check-editor-blacklist.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /@tiptap\//);
  assert.match(source, /prosemirror-/);
});
