import { describe, expect, it } from "vitest";

import { cloudDeckOperations } from "./cloud-deck-operation-policy";

describe("My iCloud deck operation matrix", () => {
  it.each([
    ["local", false, ["open", "sync", "delete-local"]],
    ["cloud", false, ["download", "delete-cloud"]],
    ["both", false, ["open", "sync", "remove-local", "delete-everywhere"]],
    ["both", true, ["open", "remove-local", "delete-everywhere"]],
  ] as const)(
    "offers the complete %s/%s operation set",
    (availability, synchronized, expected) => {
      expect(cloudDeckOperations(availability, synchronized)).toEqual(expected);
    },
  );
});
