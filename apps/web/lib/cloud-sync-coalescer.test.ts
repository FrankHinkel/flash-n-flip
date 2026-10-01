import { describe, expect, it, vi } from "vitest";
import { createCloudSyncCoalescer } from "./cloud-sync-coalescer";

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("automatic cloud sync coordination", () => {
  it("coalesces a burst and retains the strongest explicit intent", async () => {
    const run = vi.fn(async (_explicit: boolean) => undefined);
    const coalescer = createCloudSyncCoalescer(run);
    coalescer.request();
    coalescer.request(true);
    coalescer.request();
    await flushMicrotasks();
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0]?.[0]).toBe(true);
  });
  it("runs exactly one follow-up for mutations received during an active transfer", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const run = vi
      .fn()
      .mockReturnValueOnce(pending)
      .mockResolvedValue(undefined);
    const coalescer = createCloudSyncCoalescer(run);
    coalescer.request();
    await flushMicrotasks();
    coalescer.request();
    coalescer.request();
    coalescer.request();
    finish();
    await flushMicrotasks();
    await flushMicrotasks();
    expect(run).toHaveBeenCalledTimes(2);
  });
  it("invalidates a deferred transfer when a user suspends automatic work", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const transfer = vi.fn();
    const coalescer = createCloudSyncCoalescer(async (_explicit, mayRun) => {
      await pending;
      if (mayRun()) transfer();
    });
    coalescer.request();
    await flushMicrotasks();
    const resume = coalescer.suspend();
    resume();
    finish();
    await flushMicrotasks();
    expect(transfer).not.toHaveBeenCalled();
  });
  it("reports background failures and remains usable without a retry loop", async () => {
    const error = new Error("offline");
    const run = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue(undefined);
    const report = vi.fn();
    const coalescer = createCloudSyncCoalescer(run, report);
    coalescer.request();
    await flushMicrotasks();
    expect(report).toHaveBeenCalledWith(error);
    expect(run).toHaveBeenCalledOnce();
    coalescer.request();
    await flushMicrotasks();
    expect(run).toHaveBeenCalledTimes(2);
  });
  it("keeps nested suspensions active when a resume callback is called twice", async () => {
    const run = vi.fn(async () => undefined);
    const coalescer = createCloudSyncCoalescer(run);
    const first = coalescer.suspend();
    const second = coalescer.suspend();
    first();
    first();
    coalescer.request();
    await flushMicrotasks();
    expect(run).not.toHaveBeenCalled();
    second();
    coalescer.request();
    await flushMicrotasks();
    expect(run).toHaveBeenCalledOnce();
  });
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
