// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translateUiMessage } from "@flashcards/i18n";
const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  install: vi.fn(),
  load: vi.fn(),
  query: "language=fr",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(mocks.query),
}));
vi.mock("./i18n-provider", () => ({
  useI18n: () => ({
    locale: "de",
    text: (
      key: Parameters<typeof translateUiMessage>[1],
      values: Parameters<typeof translateUiMessage>[2],
    ) => translateUiMessage("de", key, values),
  }),
}));
vi.mock("../lib/local-product-repository", () => ({
  installLocalFixedNumberPractice: mocks.install,
  localFixedNumberPracticeSettings: mocks.load,
}));
import { NumberGenerator } from "./number-generator";

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    clear: () => storage.clear(),
  });
  localStorage.clear();
  mocks.push.mockReset();
  mocks.install
    .mockReset()
    .mockResolvedValue({ deckId: "saved-deck", count: 35 });
  mocks.load.mockReset().mockResolvedValue(null);
  mocks.query = "language=fr";
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const ready = async () => {
  render(<NumberGenerator />);
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Lernen starten",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
};

describe("number practice setup", () => {
  it("omits an ineffective exhaustive toggle when the language needs all small words", async () => {
    await ready();
    fireEvent.change(screen.getByLabelText("Zielsprache"), {
      target: { value: "hi-IN" },
    });
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Lernen starten",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByLabelText("11–100"));
    expect(screen.getByRole("status").textContent).toBe("101 Übungszahlen");
    expect(
      screen.queryByLabelText("Alle 90 Zahlen von 11 bis 100 üben"),
    ).toBeNull();
    expect(screen.getByText(/alle Zahlwörter geübt/)).toBeTruthy();
  });
  it("inherits French, offers only configuration and counts the agreed compact selection", async () => {
    await ready();
    expect(
      (screen.getByLabelText("Zielsprache") as HTMLSelectElement).value,
    ).toBe("fr-FR");
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(
      screen.queryByText(/Vorschau|Antwort zeigen|Zufallszahl/),
    ).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("11 Übungszahlen");
    fireEvent.click(screen.getByLabelText("11–100"));
    expect(screen.getByRole("status").textContent).toBe("35 Übungszahlen");
    fireEvent.click(
      screen.getByLabelText("Alle 90 Zahlen von 11 bis 100 üben"),
    );
    expect(screen.getByRole("status").textContent).toBe("101 Übungszahlen");
    fireEvent.click(screen.getByLabelText("0–10"));
    expect(screen.getByRole("status").textContent).toBe("90 Übungszahlen");
  });
  it("does not navigate or confirm before local persistence succeeds, then remembers the selection", async () => {
    let finish!: (value: { deckId: string }) => void;
    mocks.install.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await ready();
    fireEvent.click(screen.getByLabelText("11–100"));
    fireEvent.click(screen.getByRole("button", { name: "Lernen starten" }));
    expect(mocks.push).not.toHaveBeenCalled();
    expect(
      (screen.getByLabelText("Zielsprache") as HTMLSelectElement).disabled,
    ).toBe(true);
    finish({ deckId: "saved-deck" });
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/app/learn?deckId=saved-deck"),
    );
    expect(mocks.install).toHaveBeenCalledWith(
      {
        targetLocale: "fr-FR",
        bands: ["0-10", "11-100"],
        allBelowHundred: false,
      },
      "de",
    );
    cleanup();
    await ready();
    expect(screen.getByRole("status").textContent).toBe("35 Übungszahlen");
  });
  it("preserves settings after a failed save and permits retry", async () => {
    mocks.install.mockRejectedValueOnce(
      new Error("offline storage unavailable"),
    );
    await ready();
    fireEvent.click(screen.getByLabelText("11–100"));
    fireEvent.click(screen.getByRole("button", { name: "Lernen starten" }));
    await screen.findByRole("alert");
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("35 Übungszahlen");
    fireEvent.click(screen.getByRole("button", { name: "Lernen starten" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
  });
  it("loads authoritative deck settings, rejects an empty scope and retries read errors", async () => {
    mocks.load
      .mockRejectedValueOnce(new Error("read failed"))
      .mockResolvedValue({
        targetLocale: "fr-FR",
        bands: ["11-100"],
        allBelowHundred: false,
      });
    render(<NumberGenerator />);
    await screen.findByRole("alert");
    expect(
      (
        screen.getByRole("button", {
          name: "Lernen starten",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("24 Übungszahlen"),
    );
    fireEvent.click(screen.getByLabelText("11–100"));
    expect(screen.getByRole("status").textContent).toBe(
      "Wähle mindestens einen Zahlenbereich.",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Lernen starten",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.queryByLabelText("Alle 90 Zahlen von 11 bis 100 üben"),
    ).toBeNull();
  });
});
