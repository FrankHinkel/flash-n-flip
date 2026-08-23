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
  6: "39971cb791a5792f8d8641bda0c7b268e6e31dfc67f65b24946b20c9e38722fa",
  7: "6faf6f134d0a0aa05a1ed428f190595f94ee8f33ad731a0701c7d21fdcec55ad",
  8: "0f3ce19b9f03bb6aae11db222b431ac55756be434f608f1ba04d5d9a3d50c49f",
  9: "e90184182164996d9fe515f771fc0e7acf102e13b4f817857a2a208cd6c6499a",
  10: "10b3fc56a365093588d900fa29a9274634df10d8f33ab2980c7b96a3e51e956d",
  11: "a9e65cbd361a2904849af21592182b666fec28d4cbb0133f5cccfb5796546803",
  12: "1dba4b9039007894f2989b9d864bd5198f8023c34b7c18b1bdb58cc03ad7b646",
  13: "c8daec9678949e259a64a34088209ea8624d24e1f97568638921645b71c94587",
};

describe("local peer wire contract", () => {
  it("requires a new protocol generation whenever the wire schema changes", async () => {
    expect(reviewedWireContractFingerprints[localPeerProtocolVersion]).toBe(
      await wireContractFingerprint(),
    );
  });
});
