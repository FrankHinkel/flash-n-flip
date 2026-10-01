import { describe, expect, it } from "vitest";
import { localMediaBackupEntrySchema } from "./local-app-data.js";

const media = (dataBase64: string, byteSize: number) => ({
  mediaId: "00000000-0000-4000-8000-000000000101",
  mimeType: "audio/wav",
  sha256: "a".repeat(64),
  dataBase64,
  byteSize,
});
describe("backup media encoding", () => {
  it.each([
    ["", 0],
    ["AQ==", 1],
    ["AQI=", 2],
    ["AQID", 3],
    ["AQIDBA==", 4],
  ] as const)("accepts canonical base64 %s for %s bytes", (encoded, bytes) => {
    expect(
      localMediaBackupEntrySchema.parse(media(encoded, bytes)).byteSize,
    ).toBe(bytes);
  });
  it.each([
    ["AR==", 1],
    ["AQJ=", 2],
    ["AQ==\n", 1],
    ["AQ", 1],
    ["AQI=", 1],
    ["====", 1],
    ["AQ-_", 3],
    ["AQ=I", 3],
  ] as const)(
    "rejects ambiguous, invalid or mismatched encoding %s",
    (encoded, bytes) => {
      expect(
        localMediaBackupEntrySchema.safeParse(media(encoded, bytes)).success,
      ).toBe(false);
    },
  );
  it("validates a large canonical value without recursive regular-expression matching", () => {
    expect(
      localMediaBackupEntrySchema.safeParse(
        media("AAAA".repeat(500_000), 1_500_000),
      ).success,
    ).toBe(true);
  });
});
