import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  isPluginAvailable: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: mocks.isNativePlatform,
    isPluginAvailable: mocks.isPluginAvailable,
  },
  registerPlugin: () => ({ writeText: mocks.writeText }),
}));

import { copyText } from "./clipboard";

describe("copy card text", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("copies Unicode and line breaks through the native bridge without a browser clipboard", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.isPluginAvailable.mockReturnValue(true);
    mocks.writeText.mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {});
    const text = "Grüße 👋\n<script>plain text</script>";
    await copyText(text);
    expect(mocks.writeText).toHaveBeenCalledWith({ text });
  });

  it("uses the browser API on the Web", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await copyText("Web text");
    expect(writeText).toHaveBeenCalledWith("Web text");
    expect(mocks.writeText).not.toHaveBeenCalled();
  });

  it("supports an older installed shell that only has the browser clipboard", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.isPluginAvailable.mockReturnValue(false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await copyText("Older shell");
    expect(writeText).toHaveBeenCalledWith("Older shell");
  });

  it("reports an unavailable or rejected clipboard instead of succeeding silently", async () => {
    vi.stubGlobal("navigator", {});
    await expect(copyText("text")).rejects.toThrow("unavailable");
    const error = new Error("Permission denied");
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(error) },
    });
    await expect(copyText("text")).rejects.toBe(error);
  });

  it("waits for the native write and propagates failures", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.isPluginAvailable.mockReturnValue(true);
    const error = new Error("Native write failed");
    mocks.writeText.mockRejectedValue(error);
    await expect(copyText("text")).rejects.toBe(error);
  });
});
