import { describe, expect, it } from "vitest";
import {
  cloudDeckControlSchema,
  cloudDeckRevisionSchema,
} from "./cloud-library";

const id = "00000000-0000-4000-8000-000000000001";
const scope = {
  libraryId: id,
  libraryGeneration: id,
  deckId: id,
  deckGeneration: id,
  progressGeneration: id,
};

describe("cloud library wire contracts", () => {
  it("requires explicit generations and rejects unsupported control fields", () => {
    expect(
      cloudDeckControlSchema.safeParse({
        ...scope,
        protocolVersion: 1,
        deleted: false,
      }).success,
    ).toBe(true);
    expect(
      cloudDeckControlSchema.safeParse({
        ...scope,
        progressGeneration: undefined,
        protocolVersion: 1,
        deleted: false,
      }).success,
    ).toBe(false);
    expect(
      cloudDeckControlSchema.safeParse({
        ...scope,
        protocolVersion: 1,
        deleted: false,
        force: true,
      }).success,
    ).toBe(false);
  });

  it("does not permit scheduler state or progress fields in a content revision", () => {
    const content = {
      sha256: "a".repeat(64),
      byteSize: 1,
      chunks: [{ index: 0, sha256: "b".repeat(64), byteSize: 1 }],
    };
    const revision = {
      libraryId: id,
      libraryGeneration: id,
      deckId: id,
      deckGeneration: id,
      protocolVersion: 1,
      revisionId: id,
      parentRevisionIds: [],
      content,
    };
    expect(cloudDeckRevisionSchema.safeParse(revision).success).toBe(true);
    expect(
      cloudDeckRevisionSchema.safeParse({ ...revision, state: {} }).success,
    ).toBe(false);
    expect(
      cloudDeckRevisionSchema.safeParse({
        ...revision,
        parentRevisionIds: [id],
      }).success,
    ).toBe(false);
  });
});
