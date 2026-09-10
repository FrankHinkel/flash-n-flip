import { describe, expect, it, vi } from "vitest";
import { createCloudSyncCoalescer } from "./cloud-sync-coalescer";

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("automatic cloud sync coordination", () => {
  it("discards a queued automatic sync when a user action suspends it", async () => {
    const run = vi.fn(async () => undefined);
    const coalescer = createCloudSyncCoalescer(run);

    coalescer.request(true);
    const resume = coalescer.suspend();
    await flushMicrotasks();
    resume();
    await flushMicrotasks();

    expect(run).not.toHaveBeenCalled();
  });

  it("ignores automatic requests raised during a user action", async () => {
    const run = vi.fn(async () => undefined);
    const coalescer = createCloudSyncCoalescer(run);
    const resume = coalescer.suspend();

    coalescer.request();
    coalescer.request(true);
    resume();
    await flushMicrotasks();

    expect(run).not.toHaveBeenCalled();
    coalescer.request();
    await flushMicrotasks();
    expect(run).toHaveBeenCalledTimes(1);
  });
});
