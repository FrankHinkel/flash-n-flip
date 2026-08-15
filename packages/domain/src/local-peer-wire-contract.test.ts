import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  localAnkiImportProfilePayloadSchema,
  localCardPayloadSchema,
  localDeckPayloadSchema,
  localMediaReferencePayloadSchema,
  localReviewPayloadSchema,
  localSettingsPayloadSchema,
} from "./local-app-data.js";
import {
  localPeerMessageSchema,
  localPeerProtocolVersion,
} from "./local-peer-protocol.js";

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(",")}}`;
};

const inputJsonSchema = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });

const wireContractFingerprint = async (): Promise<string> => {
  const contract = canonicalJson({
    messages: inputJsonSchema(localPeerMessageSchema),
    mutationPayloads: {
      ANKI_IMPORT_PROFILE: inputJsonSchema(localAnkiImportProfilePayloadSchema),
      CARD: inputJsonSchema(localCardPayloadSchema),
      DECK: inputJsonSchema(localDeckPayloadSchema),
      MEDIA_REFERENCE: inputJsonSchema(localMediaReferencePayloadSchema),
      REVIEW: inputJsonSchema(localReviewPayloadSchema),
      SETTING: inputJsonSchema(localSettingsPayloadSchema),
    },
  });
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(contract)),
  );
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

// A synchronized payload or message schema may change only together with a
// new protocol generation. Adding the new generation and its reviewed digest
// makes the compatibility decision explicit instead of silently accepting a
// different wire contract under an old version number.
const reviewedWireContractFingerprints: Readonly<Record<number, string>> = {
  5: "d9628ed52e03e08928b8afcb8d535634da943ed94577096a1ecfa91504e1a02f",
};

describe("local peer wire contract", () => {
  it("requires a new protocol generation whenever the wire schema changes", async () => {
    expect(reviewedWireContractFingerprints[localPeerProtocolVersion]).toBe(
      await wireContractFingerprint(),
    );
  });
});
