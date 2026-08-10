import { afterEach, describe, expect, it, vi } from "vitest";

import {
  directConnectionIsConnected,
  directConnectionStateEvent,
  publishDirectConnectionState,
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

    publishDirectConnectionState("connected");
    expect(directConnectionIsConnected()).toBe(true);
    expect(listener).toHaveBeenCalledOnce();

    publishDirectConnectionState("disconnected");
    expect(directConnectionIsConnected()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
