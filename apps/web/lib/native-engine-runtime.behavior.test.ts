import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  enabled: false,
  changed: null as (() => void) | null,
  sequence: [] as string[],
  remove: vi.fn(),
}));
const bridge = vi.hoisted(() => ({
  status: vi.fn(async () => ({
    enabled: fake.enabled,
    linked: fake.enabled,
    account: true,
    progressPending: 0,
    contentPending: 0,
    mediaPending: 0,
    inboxPending: 0,
    suppressed: [],
    problem: null,
    lastSuccess: null,
  })),
  configure: vi.fn(async (input: { enabled?: boolean }) => {
    if (input.enabled !== undefined) fake.enabled = input.enabled;
    return bridge.status();
  }),
  addListener: vi.fn(async (_name: string, callback: () => void) => {
    fake.changed = callback;
    return { remove: fake.remove };
  }),
  synchronize: vi.fn(async () => {}),
}));
vi.mock("@flashcards/direct-connect-webstack/cloud-engine-native", () => ({
  nativeEngine: bridge,
  NativeEngineReplica: class {
    flushReviews = vi.fn(async () => {
      fake.sequence.push("reviews");
    });
    flushContent = vi.fn(async () => {
      fake.sequence.push("content");
    });
    applyInbox = vi.fn(async () => {});
    records = () => [];
  },
}));
vi.mock("@flashcards/direct-connect-webstack/media-storage", () => ({
  createLocalMediaStorage: () => ({}),
}));
vi.mock("./local-product-repository", () => ({
  localProductRepository: async () => ({ cloudAuthority: {} }),
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  fake.enabled = false;
  fake.changed = null;
  fake.sequence = [];
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());
describe("native CKSyncEngine startup and consent", () => {
  it("discovers an account without enabling replication or transferring local content", async () => {
    const runtime = await import("./native-engine-runtime");
    const stop = runtime.installNativeEngineAutomation(vi.fn());
    await vi.waitFor(() => expect(bridge.configure).toHaveBeenCalledWith({}));
    await runtime.refreshNativeEngine();
    expect(fake.enabled).toBe(false);
    expect(fake.sequence).toEqual([]);
    stop();
    await Promise.resolve();
    expect(fake.remove).toHaveBeenCalledOnce();
  });
  it("requires an explicit enable and transfers reviews before deck content", async () => {
    const runtime = await import("./native-engine-runtime");
    await runtime.configureNativeEngine(true);
    expect(bridge.configure).toHaveBeenCalledWith({ enabled: true });
    await vi.waitFor(() => expect(bridge.synchronize).toHaveBeenCalledOnce());
    expect(fake.sequence.slice(0, 2)).toEqual(["reviews", "content"]);
  });
  it("keeps paused replication paused after local edits", async () => {
    const runtime = await import("./native-engine-runtime");
    const stop = runtime.installNativeEngineAutomation(vi.fn());
    await runtime.configureNativeEngine(false);
    window.dispatchEvent(new Event("flash-n-flip:decks-changed"));
    await Promise.resolve();
    expect(fake.sequence).toEqual([]);
    expect(fake.enabled).toBe(false);
    stop();
  });
  it("does not present an expected native cancellation as a sync failure", async () => {
    const runtime = await import("./native-engine-runtime");
    bridge.configure.mockRejectedValueOnce(
      Object.assign(new Error("Task was cancelled"), {
        code: "FNF_SYNC_CANCELLED",
      }),
    );
    const publish = vi.fn();
    const stop = runtime.installNativeEngineAutomation(publish);
    await vi.waitFor(() => expect(bridge.configure).toHaveBeenCalled());
    await Promise.resolve();
    await Promise.resolve();
    expect(runtime.nativeEngineStatus().problem).toBeNull();
    expect(publish.mock.calls.some((call) => call[0]?.status === "error")).toBe(
      false,
    );
    stop();
  });
});
