import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  native: true,
  platform: "ios",
  available: true,
  getPermissionStatus: vi.fn(),
  requestPermission: vi.fn(),
  replacePlan: vi.fn(),
  localStudyBadgePlan: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.native,
    getPlatform: () => mocks.platform,
    isPluginAvailable: () => mocks.available,
  },
  registerPlugin: () => ({
    getPermissionStatus: mocks.getPermissionStatus,
    requestPermission: mocks.requestPermission,
    replacePlan: mocks.replacePlan,
  }),
}));

vi.mock("./local-product-repository", () => ({
  localStudyBadgePlan: mocks.localStudyBadgePlan,
}));

const loadSubject = async () => {
  vi.resetModules();
  return import("./native-study-badge");
};

beforeEach(() => {
  mocks.native = true;
  mocks.platform = "ios";
  mocks.available = true;
  mocks.getPermissionStatus.mockReset();
  mocks.requestPermission.mockReset();
  mocks.replacePlan.mockReset();
  mocks.localStudyBadgePlan.mockReset();
});

describe("native study badge", () => {
  it("does not request permission during an automatic refresh", async () => {
    mocks.getPermissionStatus.mockResolvedValue({ status: "notDetermined" });
    const subject = await loadSubject();

    await expect(subject.refreshNativeStudyBadge()).resolves.toEqual({
      status: "notDetermined",
      plan: null,
      error: null,
    });
    expect(mocks.requestPermission).not.toHaveBeenCalled();
    expect(mocks.localStudyBadgePlan).not.toHaveBeenCalled();
  });

  it("replaces the native plan only after explicit badge authorization", async () => {
    const plan = {
      dueNow: 4,
      transitions: [{ at: "2026-08-18T10:01:00.000Z", dueCount: 5 }],
    };
    mocks.requestPermission.mockResolvedValue({ status: "authorized" });
    mocks.localStudyBadgePlan.mockResolvedValue(plan);
    mocks.replacePlan.mockResolvedValue(undefined);
    const subject = await loadSubject();

    await expect(
      subject.refreshNativeStudyBadge({ requestPermission: true }),
    ).resolves.toEqual({ status: "authorized", plan, error: null });
    expect(mocks.replacePlan).toHaveBeenCalledWith(plan);
  });

  it("contains native failures without affecting the learning mutation", async () => {
    mocks.getPermissionStatus.mockResolvedValue({ status: "authorized" });
    mocks.localStudyBadgePlan.mockResolvedValue({
      dueNow: 1,
      transitions: [],
    });
    mocks.replacePlan.mockRejectedValue(new Error("native failed"));
    const subject = await loadSubject();

    await expect(subject.refreshNativeStudyBadge()).resolves.toEqual({
      status: "authorized",
      plan: null,
      error: "native failed",
    });
  });
});
