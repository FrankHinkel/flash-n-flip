// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  decks: [
    {
      deckId: "root",
      title: "Collection",
      parentDeckId: null,
      cardCount: 0,
      localAvailable: true,
    },
    {
      deckId: "child",
      title: "Child deck",
      parentDeckId: "root",
      cardCount: 2,
      localAvailable: true,
    },
  ],
}));
vi.mock("../lib/cloud-library-runtime", () => ({
  cloudSyncView: () => state,
  subscribeCloudSync: () => () => {},
}));
const status = {
  enabled: true,
  development: false,
  suppressed: [],
  progressPending: 0,
  contentPending: 0,
  mediaPending: 0,
};
vi.mock("../lib/native-engine-runtime", () => ({
  nativeEngineStatus: () => status,
  subscribeNativeEngine: () => () => {},
  configureNativeEngine: vi.fn(),
  runNativeEngineAction: vi.fn(),
  resetLegacyNativeTestData: vi.fn(),
}));
vi.mock("./i18n-provider", () => ({ useI18n: () => ({ locale: "de" }) }));
import { NativeICloudBrowser } from "./native-icloud-browser";
afterEach(cleanup);
it("starts with roots only and exposes expandable, collapsible subdecks", () => {
  render(<NativeICloudBrowser />);
  expect(screen.queryByText("Child deck")).toBeNull();
  const toggle = screen.getByRole("button", { name: "Unterdecks: Collection" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  expect(screen.getByText("Child deck")).toBeTruthy();
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(toggle);
  expect(screen.queryByText("Child deck")).toBeNull();
});
it("offers both deletion scopes and can close the dialog with Escape", () => {
  render(<NativeICloudBrowser />);
  fireEvent.click(screen.getByRole("button", { name: "Löschen: Collection" }));
  expect(
    screen.getByRole("button", { name: "Nur lokal löschen" }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Überall löschen" })).toBeTruthy();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("alertdialog")).toBeNull();
});
