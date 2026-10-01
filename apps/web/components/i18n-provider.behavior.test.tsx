// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock("../lib/local-product-repository", () => ({
  getLocalProductSettings: repository.load,
  patchLocalProductSettings: repository.save,
}));

import { I18nProvider, useI18n } from "./i18n-provider";
import { uiMessageKey } from "./i18n-test-helpers";

function Preferences() {
  const { locale, setLocale, text } = useI18n();
  return (
    <>
      <output>{locale}</output>
      <p>{text(uiMessageKey("Settings", "Einstellungen"))}</p>
      <button onClick={() => setLocale("fr")}>French</button>
    </>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("language preferences in the mounted application", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "localStorage",
      (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window
        .localStorage,
    );
    localStorage.clear();
    repository.load.mockReset().mockResolvedValue(null);
    repository.save.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads persisted preferences and updates visible labels and document language", async () => {
    localStorage.setItem("flash-n-flip.locale.v1", "es");
    const load = deferred<{ locale: string }>();
    repository.load.mockReturnValue(load.promise);
    render(
      <I18nProvider>
        <Preferences />
      </I18nProvider>,
    );
    expect(screen.getByRole("status").textContent).toBe("es");
    await act(async () => {
      load.resolve({ locale: "de" });
    });
    expect(screen.getByText("Einstellungen")).toBeTruthy();
    expect(document.documentElement.lang).toBe("de");
    expect(localStorage.getItem("flash-n-flip.locale.v1")).toBe("de");
  });

  it("keeps a user selection when the initial database read completes late", async () => {
    const load = deferred<{ locale: string }>();
    repository.load.mockReturnValue(load.promise);
    render(
      <I18nProvider>
        <Preferences />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "French" }));
    await act(async () => {
      load.resolve({ locale: "de" });
    });
    expect(screen.getByRole("status").textContent).toBe("fr");
    expect(document.documentElement.lang).toBe("fr");
    expect(localStorage.getItem("flash-n-flip.locale.v1")).toBe("fr");
    expect(repository.save).toHaveBeenCalledWith({ locale: "fr" });
  });

  it("stays usable when browser storage is denied and the database read fails", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    repository.load.mockRejectedValue(new Error("database unavailable"));
    render(
      <I18nProvider>
        <Preferences />
      </I18nProvider>,
    );
    await act(async () => {});
    expect(screen.getByText("Settings")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "French" }));
    await act(async () => {});
    expect(screen.getByRole("status").textContent).toBe("fr");
    expect(repository.save).toHaveBeenCalledWith({ locale: "fr" });
  });

  it("does not overwrite storage after unmounting a pending initialization", async () => {
    const load = deferred<{ locale: string }>();
    repository.load.mockReturnValue(load.promise);
    const view = render(
      <I18nProvider>
        <Preferences />
      </I18nProvider>,
    );
    view.unmount();
    localStorage.setItem("flash-n-flip.locale.v1", "fr");
    await act(async () => {
      load.resolve({ locale: "de" });
    });
    expect(localStorage.getItem("flash-n-flip.locale.v1")).toBe("fr");
  });

  it("retains the browser preference if the database write rejects", async () => {
    repository.save.mockRejectedValue(new Error("disk full"));
    render(
      <I18nProvider>
        <Preferences />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "French" }));
    await act(async () => {});
    expect(screen.getByRole("status").textContent).toBe("fr");
    expect(localStorage.getItem("flash-n-flip.locale.v1")).toBe("fr");
  });
});
