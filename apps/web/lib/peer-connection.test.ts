import { describe, expect, it } from "vitest";

import { sdpSha256Fingerprint } from "./peer-connection";

describe("peer connection signaling", () => {
  it("extracts and normalizes the SHA-256 DTLS fingerprint", () => {
    expect(
      sdpSha256Fingerprint(
        "v=0\r\na=fingerprint:sha-256 aa:bb:0c\r\na=setup:actpass\r\n",
      ),
    ).toBe("AA:BB:0C");
  });

  it("rejects descriptions without a SHA-256 fingerprint", () => {
    expect(() => sdpSha256Fingerprint("v=0\r\na=setup:actpass\r\n")).toThrow(
      /fingerprint is missing/i,
    );
  });
});
