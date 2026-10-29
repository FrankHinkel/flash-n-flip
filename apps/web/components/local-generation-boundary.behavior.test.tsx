// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  retire: vi.fn(),
  restore: vi.fn(),
  updateHelp: vi.fn(),
}));
vi.mock("../lib/local-generation", () => ({
  retireLegacyLocalProductData: mocks.retire,
  bootstrapAppleCloudBackupIfFresh: mocks.restore,
}));
vi.mock("../lib/local-curated-catalog", () => ({
  updateInstalledLocalFnfHelp: mocks.updateHelp,
}));
vi.mock("./i18n-provider", () => ({
  useI18n: () => ({ text: () => "Preparing" }),
}));

import { LocalGenerationBoundary } from "./local-generation-boundary";

describe("installed Help startup", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.retire.mockResolvedValue(undefined);
    mocks.restore.mockResolvedValue(false);
    mocks.updateHelp.mockResolvedValue(false);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("waits for restored data and the Help update before mounting learning views", async () => {
    let restore!: () => void;
    let update!: () => void;
    mocks.restore.mockReturnValue(
      new Promise<void>((resolve) => {
        restore = resolve;
      }),
    );
    mocks.updateHelp.mockReturnValue(
      new Promise<void>((resolve) => {
        update = resolve;
      }),
    );
    render(
      <LocalGenerationBoundary>
        <p>Learning view</p>
      </LocalGenerationBoundary>,
    );
    await waitFor(() => expect(mocks.restore).toHaveBeenCalledOnce());
    expect(mocks.updateHelp).not.toHaveBeenCalled();
    expect(screen.queryByText("Learning view")).toBeNull();
    await act(async () => restore());
    expect(mocks.updateHelp).toHaveBeenCalledOnce();
    expect(screen.queryByText("Learning view")).toBeNull();
    await act(async () => update());
    await screen.findByText("Learning view");
  });

  it("keeps the app usable on failure and retries on a later mount", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.updateHelp.mockRejectedValueOnce(new Error("Offline"));
    const view = render(
      <LocalGenerationBoundary>
        <p>Existing library</p>
      </LocalGenerationBoundary>,
    );
    await screen.findByText("Existing library");
    expect(warning).toHaveBeenCalledOnce();
    expect(mocks.updateHelp).toHaveBeenCalledOnce();
    view.unmount();
    render(
      <LocalGenerationBoundary>
        <p>Existing library</p>
      </LocalGenerationBoundary>,
    );
    await screen.findByText("Existing library");
    expect(mocks.updateHelp).toHaveBeenCalledTimes(2);
  });
});
