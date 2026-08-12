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

describe("trusted-device reconnect settings", () => {
  it("keeps automatic and on-request sync in the existing settings screen", () => {
    expect(settings).toContain('value="automatic"');
    expect(settings).toContain('value="manual"');
    expect(settings).toContain("getDirectSyncRuntime().setMode(mode)");
    expect(settings).toContain("getDirectSyncRuntime().syncNow()");
    expect(settings).toContain('text("Sync now", "Jetzt synchronisieren")');
    expect(settings).toContain("directSync.pendingCount");
    expect(settings).toContain("directSync.lastSyncedAt");
  });

  it("starts the singleton reconnect manager with the established product shell", () => {
    expect(shell).toContain("getDirectSyncRuntime().initialize()");
    expect(shell).toContain("directConnectionStateEvent");
    expect(shell).toContain("connection-cog-connected");
  });

  it("uses one watermark handshake instead of resending the bootstrap journal", () => {
    expect(reconnectRuntime).toContain(
      "await this.synchronizer!.waitForPeerHello(connection)",
    );
    expect(reconnectRuntime).not.toContain("sendPending(connection)");
    expect(reconnectRuntime).toContain("this.scheduleReconnect();");
  });
});
