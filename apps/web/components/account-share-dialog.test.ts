import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./account-share-dialog.tsx", import.meta.url),
  "utf8",
);

describe("account share dialog flow", () => {
  it("confirms a cryptographically verified QR recipient automatically", () => {
    expect(source).toContain('sender && next.state === "CLAIMED"');
    expect(source).toContain("expected !== next.recipientFingerprintProof");
    expect(source).toContain("await api.confirmAccountShare(");
    expect(source).not.toContain("Confirm and send");
    expect(source).not.toContain("Bestätigen und senden");
  });

  it("accepts a validated incoming deck automatically and closes on completion", () => {
    expect(source).toContain("void manager.acceptIncoming().catch");
    expect(source).toContain(
      'next?.state === "COMPLETED" && !completedRef.current',
    );
    expect(source).toContain(
      "window.setTimeout(() => onCloseRef.current(), 0)",
    );
    expect(source).not.toContain("manager.rejectIncoming()");
    expect(source).not.toContain('{text("Decline", "Ablehnen")}');
  });
});
