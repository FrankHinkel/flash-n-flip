import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const settings = readFileSync(
  new URL("./settings.tsx", import.meta.url),
  "utf8",
);
const shell = readFileSync(new URL("./app-shell.tsx", import.meta.url), "utf8");
const reconnectRuntime = readFileSync(
  new URL(
    "../../../packages/direct-connect-webstack/src/reconnect-runtime.ts",
    import.meta.url,
  ),
  "utf8",
);

describe("parked trusted-device reconnect implementation", () => {
  it("keeps server-assisted synchronization out of the Apple-facing product UI", () => {
    expect(settings).not.toContain("getDirectSyncRuntime");
    expect(settings).not.toContain('href="/connect?source=app"');
    expect(settings).not.toContain('text("Sync now", "Jetzt synchronisieren")');
  });

  it("does not start the reconnect manager with the product shell", () => {
    expect(shell).not.toContain("getDirectSyncRuntime");
    expect(shell).not.toContain("directConnectionStateEvent");
    expect(shell).not.toContain("connection-cog-connected");
  });

  it("uses one watermark handshake instead of resending the bootstrap journal", () => {
    expect(reconnectRuntime).toContain(
      "await this.synchronizer!.waitForPeerHandshake(connection, handshakeId)",
    );
    expect(reconnectRuntime).not.toContain("sendPending(connection)");
    expect(reconnectRuntime).toContain("this.scheduleReconnect();");
  });
});
