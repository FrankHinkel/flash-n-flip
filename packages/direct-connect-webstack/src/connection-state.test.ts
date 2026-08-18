import { afterEach, describe, expect, it, vi } from "vitest";

import {
  directConnectionIsConnected,
  directConnectionStateEvent,
  directPeerDeviceChangedEvent,
  directPeerDeviceId,
  publishDirectConnectionState,
  publishDirectPeerDeviceId,
} from "./connection-state";

afterEach(() => vi.unstubAllGlobals());

describe("direct connection state bridge", () => {
  it("keeps the product document informed when the pairing controller connects", () => {
    const dataset: DOMStringMap = {};
    const events = new EventTarget();
    const listener = vi.fn();
    events.addEventListener(directConnectionStateEvent, listener);
    vi.stubGlobal("document", { documentElement: { dataset } });
    vi.stubGlobal("window", events);

    publishDirectConnectionState("transport-connected");
    expect(directConnectionIsConnected()).toBe(false);
    publishDirectConnectionState("syncing");
    expect(directConnectionIsConnected()).toBe(false);
    publishDirectConnectionState("synced");
    expect(directConnectionIsConnected()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(3);

    publishDirectConnectionState("disconnected");
    expect(directConnectionIsConnected()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("bridges the current peer identity across the connect and product bundles", () => {
    const dataset: DOMStringMap = {};
    const events = new EventTarget();
    const listener = vi.fn();
    events.addEventListener(directPeerDeviceChangedEvent, listener);
    vi.stubGlobal("document", { documentElement: { dataset } });
    vi.stubGlobal("window", events);

    publishDirectPeerDeviceId("00000000-0000-4000-8000-000000000123");
    expect(directPeerDeviceId()).toBe("00000000-0000-4000-8000-000000000123");
    publishDirectPeerDeviceId(null);
    expect(directPeerDeviceId()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
