import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  isPluginAvailable: vi.fn(),
  beginExport: vi.fn(),
  appendChunk: vi.fn(),
  shareExport: vi.fn(),
  discardExport: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: mocks.isNativePlatform,
    isPluginAvailable: mocks.isPluginAvailable,
  },
  registerPlugin: () => ({
    beginExport: mocks.beginExport,
    appendChunk: mocks.appendChunk,
    shareExport: mocks.shareExport,
    discardExport: mocks.discardExport,
  }),
}));

import { exportLocalFile, LocalFileExportError } from "./local-file-export";

describe("local file export", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("streams the FNF file into the native system share sheet", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.isPluginAvailable.mockReturnValue(true);
    mocks.beginExport.mockResolvedValue({ exportId: "export-1" });
    mocks.appendChunk.mockResolvedValue(undefined);
    mocks.shareExport.mockResolvedValue({ completed: true });

    await expect(
      exportLocalFile(
        new Blob(["package"], {
          type: "application/vnd.flash-n-flip.package+zip",
        }),
        "Deutsch.fnf",
      ),
    ).resolves.toBe("SHARED");
    expect(mocks.beginExport).toHaveBeenCalledWith({
      fileName: "Deutsch.fnf",
      mimeType: "application/vnd.flash-n-flip.package+zip",
      byteSize: 7,
    });
    expect(mocks.appendChunk).toHaveBeenCalledWith({
      exportId: "export-1",
      dataBase64: btoa("package"),
    });
    expect(mocks.shareExport).toHaveBeenCalledWith({ exportId: "export-1" });
  });

  it("reports a dismissed native share sheet as cancelled", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.isPluginAvailable.mockReturnValue(true);
    mocks.beginExport.mockResolvedValue({ exportId: "export-2" });
    mocks.appendChunk.mockResolvedValue(undefined);
    mocks.shareExport.mockResolvedValue({ completed: false });

    await expect(
      exportLocalFile(new Blob(["package"]), "Deutsch.fnf"),
    ).resolves.toBe("CANCELLED");
  });

  it("discards an incomplete native export after a bridge error", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.isPluginAvailable.mockReturnValue(true);
    mocks.beginExport.mockResolvedValue({ exportId: "export-3" });
    mocks.appendChunk.mockRejectedValue(new Error("write failed"));
    mocks.discardExport.mockResolvedValue(undefined);

    await expect(
      exportLocalFile(new Blob(["package"]), "Deutsch.fnf"),
    ).rejects.toThrow("write failed");
    expect(mocks.discardExport).toHaveBeenCalledWith({ exportId: "export-3" });
  });

  it("uses a delayed browser download outside installed apps", async () => {
    mocks.isNativePlatform.mockReturnValue(false);
    const click = vi.fn();
    const remove = vi.fn();
    const anchor = { click, remove, hidden: false, href: "", download: "" };
    vi.stubGlobal("document", {
      createElement: vi.fn(() => anchor),
      body: { append: vi.fn() },
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:export"),
      revokeObjectURL,
    });
    vi.stubGlobal("window", { setTimeout: vi.fn() });

    await expect(
      exportLocalFile(new Blob(["package"]), "Deutsch.fnf"),
    ).resolves.toBe("DOWNLOADED");
    expect(anchor).toMatchObject({
      href: "blob:export",
      download: "Deutsch.fnf",
    });
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("returns a stable error code when native sharing is unavailable", async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.isPluginAvailable.mockReturnValue(false);
    vi.stubGlobal("navigator", {});

    const promise = exportLocalFile(new Blob(["package"]), "Deck.fnf");
    await expect(promise).rejects.toBeInstanceOf(LocalFileExportError);
    await expect(promise).rejects.toMatchObject({
      code: "NATIVE_SHARE_UNAVAILABLE",
    });
  });
});
