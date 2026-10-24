// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceTypographyProvider } from "./device-typography-provider";
import { DeviceTextSizeSetting } from "./device-text-size-setting";
import { textSizePreferenceKey } from "../lib/device-typography";
const storage = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock(
  "@flashcards/direct-connect-webstack/device-preferences-storage",
  () => ({ devicePreferencesStorage: () => storage }),
);
vi.mock("./i18n-provider", () => ({
  useI18n: () => ({ text: (key: string) => key }),
}));
const view = () =>
  render(
    <DeviceTypographyProvider>
      <DeviceTextSizeSetting />
    </DeviceTypographyProvider>,
  );
beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      clear: () => values.clear(),
    },
  });
  storage.get.mockReset().mockResolvedValue("normal");
  storage.set.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);
describe("device text size control", () => {
  it("uses durable preference over the startup cache and survives remount", async () => {
    window.localStorage.setItem(textSizePreferenceKey, "small");
    storage.get.mockResolvedValue("large");
    const first = view();
    await waitFor(() =>
      expect(screen.getByRole("combobox")).toHaveProperty("value", "large"),
    );
    expect(
      document.documentElement.style.getPropertyValue("--device-font-factor"),
    ).toBe("1.3");
    first.unmount();
    view();
    await waitFor(() =>
      expect(screen.getByRole("combobox")).toHaveProperty("value", "large"),
    );
  });
  it("confirms and applies a level only after durable storage succeeds", async () => {
    let complete!: () => void;
    storage.set.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    view();
    await waitFor(() =>
      expect(screen.getByRole("combobox")).toHaveProperty("disabled", false),
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "large" },
    });
    expect(document.documentElement.dataset.textSize).toBe("normal");
    expect(storage.set).toHaveBeenCalledWith(textSizePreferenceKey, "large");
    await act(async () => complete());
    expect(document.documentElement.dataset.textSize).toBe("large");
  });
  it("retains the previous level and reports failed writes", async () => {
    storage.set.mockRejectedValue(new Error("disk full"));
    view();
    await waitFor(() =>
      expect(screen.getByRole("combobox")).toHaveProperty("disabled", false),
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "small" },
    });
    await screen.findByRole("alert");
    expect(document.documentElement.dataset.textSize).toBe("normal");
    expect(window.localStorage.getItem(textSizePreferenceKey)).toBe("normal");
  });
});
