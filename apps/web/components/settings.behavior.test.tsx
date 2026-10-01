// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translateUiMessage } from "@flashcards/i18n";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  patch: vi.fn(),
  save: vi.fn(),
  export: vi.fn(),
  restore: vi.fn(),
  share: vi.fn(),
}));
vi.mock("../lib/local-product-repository", () => ({
  getLocalProductSettings: mocks.load,
  patchLocalProductSettings: mocks.patch,
  saveLocalProductSettings: mocks.save,
  exportLocalProductData: mocks.export,
  restoreLocalProductData: mocks.restore,
}));
vi.mock("../lib/local-file-export", async (load) => ({
  ...(await load<object>()),
  exportLocalFile: mocks.share,
}));
vi.mock("./i18n-provider", () => ({
  useI18n: () => ({
    locale: "en",
    setLocale: vi.fn(),
    text: (
      key: Parameters<typeof translateUiMessage>[1],
      values: Parameters<typeof translateUiMessage>[2],
    ) => translateUiMessage("en", key, values),
  }),
}));
vi.mock("@flashcards/direct-connect-webstack/apple-cloud-backup", () => ({
  isAppleCloudRuntime: () => false,
}));
vi.mock("./native-study-badge-setting", () => ({
  NativeStudyBadgeSetting: () => null,
}));
vi.mock("./audio-player-gain-setting", () => ({
  AudioPlayerGainSetting: () => null,
}));
vi.mock("../lib/audio-optimization", () => ({
  audioOptimizationChangedEvent: "test:audio",
  pauseLocalAudioOptimization: vi.fn(),
  retryFailedLocalAudioOptimization: vi.fn(),
  audioOptimizationSummary: () => ({
    total: 0,
    complete: 0,
    pending: 0,
    failed: 0,
    processed: 0,
    paused: false,
    running: false,
    engineAvailable: true,
  }),
}));
import { SettingsPanel } from "./settings";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const exportButton = () =>
  screen.getByRole("button", { name: /Download data/i }) as HTMLButtonElement;
const restoreButton = () =>
  screen.getByRole("button", { name: /Restore backup/i }) as HTMLButtonElement;

describe("actual settings edits and local recovery controls", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "localStorage",
      (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window
        .localStorage,
    );
    localStorage.clear();
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.load.mockResolvedValue(null);
    mocks.patch.mockResolvedValue(undefined);
    mocks.save.mockResolvedValue(undefined);
    mocks.export.mockResolvedValue(
      new Blob(["backup"], { type: "application/json" }),
    );
    mocks.share.mockResolvedValue("DOWNLOADED");
    mocks.restore.mockResolvedValue(undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it("patches only the changed preference instead of resetting stored theme and other settings", async () => {
    render(<SettingsPanel />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Website pinch zoom/i }),
    );
    await act(async () => {});
    expect(mocks.patch).toHaveBeenCalledWith({ pagePinchZoom: true });
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("does not overwrite an edited goal with a late settings read", async () => {
    const initial = deferred<unknown>();
    mocks.load.mockReturnValue(initial.promise);
    render(<SettingsPanel />);
    const goal = screen.getByRole("spinbutton", {
      name: "New cards per day",
    }) as HTMLInputElement;
    fireEvent.change(goal, { target: { value: "42" } });
    await act(async () => {
      initial.resolve({
        locale: "de",
        dailyGoal: 3,
        pagePinchZoom: false,
        textToSpeechMode: "off",
        showQuestionWithAnswer: false,
      });
    });
    expect(goal.value).toBe("42");
    fireEvent.blur(goal);
    await act(async () => {});
    expect(mocks.patch).toHaveBeenCalledWith({ dailyGoal: 42 });
  });
  it("prevents concurrent backup creation and restoration until sharing finishes", async () => {
    const pending = deferred<Blob>();
    mocks.export.mockReturnValue(pending.promise);
    render(<SettingsPanel />);
    fireEvent.click(exportButton());
    fireEvent.click(exportButton());
    expect(mocks.export).toHaveBeenCalledOnce();
    expect(exportButton().disabled).toBe(true);
    expect(restoreButton().disabled).toBe(true);
    await act(async () => {
      pending.resolve(new Blob(["backup"]));
    });
    expect(mocks.share).toHaveBeenCalledOnce();
    expect(exportButton().disabled).toBe(false);
  });
  it("shows no success notification when the native share sheet is dismissed", async () => {
    mocks.share.mockResolvedValue("CANCELLED");
    render(<SettingsPanel />);
    fireEvent.click(exportButton());
    await act(async () => {});
    expect(screen.queryByRole("status")).toBeNull();
    expect(exportButton().disabled).toBe(false);
  });
  it("shows a write failure accessibly and allows a subsequent backup attempt", async () => {
    mocks.export.mockRejectedValueOnce(new Error("storage read failed"));
    render(<SettingsPanel />);
    fireEvent.click(exportButton());
    await act(async () => {});
    expect(screen.getByRole("alert").textContent).toBe("storage read failed");
    expect(exportButton().disabled).toBe(false);
    fireEvent.click(exportButton());
    await act(async () => {});
    expect(mocks.export).toHaveBeenCalledTimes(2);
    expect(mocks.share).toHaveBeenCalledOnce();
  });
  it("reports a failed settings write instead of leaving a saved notification", async () => {
    mocks.patch.mockRejectedValue(new Error("disk full"));
    render(<SettingsPanel />);
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Website pinch zoom/i }),
    );
    await act(async () => {});
    expect(screen.getByRole("alert").textContent).toMatch(
      /could not be saved/i,
    );
  });
});
