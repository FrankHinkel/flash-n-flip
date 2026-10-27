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
const mocks = vi.hoisted(() => ({ save: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("../lib/local-product-repository", () => ({
  importLocalTextDeck: mocks.save,
  importLocalFilePackage: vi.fn(),
  localAnkiImportStatus: vi.fn(),
}));
vi.mock("./i18n-provider", () => ({
  useI18n: () => ({
    locale: "en",
    text: (
      key: Parameters<typeof translateUiMessage>[1],
      values: Parameters<typeof translateUiMessage>[2],
    ) => translateUiMessage("en", key, values),
  }),
}));
import { ImportCards } from "./import-cards";
const flush = () => act(async () => {});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue({ id: "imported-deck" });
});
afterEach(cleanup);
describe("simple text import", () => {
  it("shows a validated count before importing and commits the parsed cards", async () => {
    render(<ImportCards />);
    fireEvent.click(
      screen.getByRole("button", { name: "Paste question and answer text" }),
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Title of the new deck" }),
      {
        target: { value: "My questions" },
      },
    );
    fireEvent.change(screen.getByPlaceholderText("Or paste: question,answer"), {
      target: { value: "front,back\nQuestion,Answer" },
    });
    await flush();
    expect(screen.getByRole("status").textContent).toBe(
      "Cards ready to import: 1",
    );
    fireEvent.click(screen.getByRole("button", { name: "Import locally" }));
    await flush();
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "My questions",
        cards: [{ front: "Question", back: "Answer", tags: [] }],
      }),
    );
    expect(mocks.push).toHaveBeenCalledWith(
      "/app/decks/imported-deck?finished=1",
    );
  });
  it("blocks malformed text and keeps it available for correction", async () => {
    render(<ImportCards />);
    fireEvent.click(
      screen.getByRole("button", { name: "Paste question and answer text" }),
    );
    const field = screen.getByPlaceholderText("Or paste: question,answer");
    fireEvent.change(field, { target: { value: "Question without answer" } });
    await flush();
    expect(screen.getByRole("alert").textContent).toContain(
      "Check that each row",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Import locally",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect((field as HTMLTextAreaElement).value).toBe(
      "Question without answer",
    );
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
