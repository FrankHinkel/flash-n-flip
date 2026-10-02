import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cloud = vi.hoisted(() => ({
  policy: null as {
    enabled: boolean;
    account: string;
    environment: string;
    blocked: boolean;
    command: null;
  } | null,
  account: vi.fn(),
  bootstrap: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({}),
}));
vi.mock("@flashcards/direct-connect-webstack/cloud-library-native", () => ({
  nativeCloudLibraryAccount: cloud.account,
  nativeCloudLibraryEnvironment: async () => "development",
  createNativeCloudLibraryStore: () => ({}),
}));
vi.mock(
  "@flashcards/direct-connect-webstack/cloud-library-atomic-native",
  () => ({ createNativeAtomicCloudStore: () => ({}) }),
);
vi.mock("@flashcards/direct-connect-webstack/cloud-library-storage", () => ({
  createNativeCloudLibraryBindings: () => ({}),
}));
vi.mock("@flashcards/direct-connect-webstack/cloud-library-policy", () => ({
  readCloudPolicy: async () => cloud.policy,
  updateCloudPolicy: cloud.update,
  cloudValues: () => ({}),
}));
vi.mock("@flashcards/sync/cloud-library-bootstrap", async (load) => ({
  ...(await load<object>()),
  connectCloudLibrary: cloud.bootstrap,
}));
vi.mock("./local-product-repository", () => ({
  localProductRepository: vi.fn(),
}));
vi.mock("./local-curated-catalog", () => ({
  ensureLocalCuratedActivation: vi.fn(),
}));
vi.mock("./native-development-cloud-recovery", () => ({
  recoverNativeDevelopmentCloudBinding: async () => null,
}));

const policy = (enabled: boolean) => ({
  enabled,
  account: "account-a",
  environment: "development",
  blocked: false,
  command: null,
});
const settle = async () => {
  for (let index = 0; index < 80; index++) await Promise.resolve();
};

describe("actual iCloud startup and consent boundary", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("navigator", {});
    cloud.policy = null;
    cloud.account.mockReset().mockResolvedValue("account-a");
    cloud.bootstrap
      .mockReset()
      .mockRejectedValue(new Error("stop before transport writes"));
    cloud.update.mockReset();
    // Cold transitive module loading is fixture setup, not transport behavior.
    await import("./cloud-library-runtime");
  }, 30_000);
  afterEach(() => vi.unstubAllGlobals());

  it("does not create or enable a cloud library just because an Apple account is available", async () => {
    const runtime = await import("./cloud-library-runtime");
    const uninstall = runtime.installCloudSyncAutomation();
    await settle();
    expect(cloud.account).toHaveBeenCalledOnce();
    expect(cloud.bootstrap).not.toHaveBeenCalled();
    expect(cloud.update).not.toHaveBeenCalled();
    uninstall();
  });
  it("does not re-enable disabled replication after an account observation or local mutation", async () => {
    cloud.policy = policy(false);
    const runtime = await import("./cloud-library-runtime");
    const uninstall = runtime.installCloudSyncAutomation();
    await settle();
    window.dispatchEvent(
      new CustomEvent("flash-n-flip:decks-changed", {
        detail: { source: "local-mutation" },
      }),
    );
    await settle();
    expect(cloud.bootstrap).not.toHaveBeenCalled();
    expect(cloud.update).not.toHaveBeenCalled();
    expect(cloud.policy.enabled).toBe(false);
    uninstall();
  });
  it("performs a linked-library sync after the startup account request has completed", async () => {
    cloud.policy = policy(true);
    const runtime = await import("./cloud-library-runtime");
    const uninstall = runtime.installCloudSyncAutomation();
    await settle();
    expect(cloud.bootstrap).toHaveBeenCalledOnce();
    expect(runtime.cloudSyncView().status).toBe("error");
    expect(cloud.policy.enabled).toBe(true);
    uninstall();
  });
  it("starts bootstrap through an explicit user sync action", async () => {
    const runtime = await import("./cloud-library-runtime");
    await runtime.runCloudUserAction({ kind: "sync", explicit: true });
    expect(cloud.bootstrap).toHaveBeenCalledOnce();
  });
  it("ignores its own cloud-change events and removes the listener after the last owner leaves", async () => {
    const runtime = await import("./cloud-library-runtime");
    const first = runtime.installCloudSyncAutomation();
    const last = runtime.installCloudSyncAutomation();
    await settle();
    cloud.policy = policy(true);
    window.dispatchEvent(
      new CustomEvent("flash-n-flip:decks-changed", {
        detail: { source: "cloud-sync" },
      }),
    );
    await settle();
    expect(cloud.bootstrap).not.toHaveBeenCalled();
    first();
    last();
    window.dispatchEvent(
      new CustomEvent("flash-n-flip:decks-changed", {
        detail: { source: "local-mutation" },
      }),
    );
    await settle();
    expect(cloud.bootstrap).not.toHaveBeenCalled();
  });
});
