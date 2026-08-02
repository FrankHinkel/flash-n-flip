import { describe, expect, it } from "vitest";

import { fileSha256 } from "./file-sha256";

describe("fileSha256", () => {
  it("hashes an empty file without loading it as one large ArrayBuffer", async () => {
    await expect(fileSha256(new Blob([]))).resolves.toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("hashes streamed file chunks and reports progress", async () => {
    const progress: number[] = [];
    const input = new Blob(["abc".repeat(100_000)]);
    await expect(
      fileSha256(input, (value) => progress.push(value)),
    ).resolves.toBe(
      "a77aedfe2e4a7232ea628a71745a966224c4521d93134b993cde5b65ea2f6e3c",
    );
    expect(progress.at(-1)).toBe(100);
  });
});
