// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { copyText } = vi.hoisted(() => ({ copyText: vi.fn() }));
vi.mock("../lib/clipboard", () => ({ copyText }));
vi.mock("./i18n-provider", () => ({
  useOptionalI18n: () => null,
  useI18n: () => ({
    locale: "de",
    text: (key: string) =>
      ({
        "legacy.a4c01a5953e6": "Code kopieren",
        "legacy.c59698655d4c": "Code kopiert",
        "legacy.5c65a8fe0b9f":
          "Kopieren fehlgeschlagen. Markiere den Code manuell.",
      })[key] ?? key,
  }),
}));

import { ContentView } from "./content-view";

describe("code copy button", () => {
  beforeEach(() => {
    copyText.mockReset();
  });
  afterEach(cleanup);

  const showCode = () =>
    render(
      <ContentView
        content={{
          blocks: [
            {
              type: "markdown",
              revealMode: "AUTO",
              source: '```js\nconst text = "Grüße";\nconsole.log(text);\n```',
            },
          ],
        }}
      />,
    );

  it("copies the complete code and confirms success only after the write", async () => {
    let complete!: () => void;
    copyText.mockReturnValue(
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
    );
    showCode();
    fireEvent.click(screen.getByRole("button", { name: "Code kopieren" }));
    expect(copyText).toHaveBeenCalledWith(
      'const text = "Grüße";\nconsole.log(text);',
    );
    expect(screen.queryByRole("button", { name: "Code kopiert" })).toBeNull();
    complete();
    await screen.findByRole("button", { name: "Code kopiert" });
  });

  it("shows copy failures and permits a successful retry", async () => {
    copyText.mockRejectedValueOnce(new Error("Denied"));
    showCode();
    fireEvent.click(screen.getByRole("button", { name: "Code kopieren" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Kopieren fehlgeschlagen",
    );
    copyText.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Code kopieren" }));
    await screen.findByRole("button", { name: "Code kopiert" });
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it.each([
    ["abc{size=70% bars=auto keyboard=notes}", "X:1\nM:4/4\nK:C\nC D E F |"],
    ["mermaid{w=fill h=50vh}", "flowchart LR\n  A --> B"],
    ["jsxgraph{w=fill h=50vh}", 'describe "A point."\nA = point(0, 0)'],
  ])(
    "displays and copies the complete %s fence as literal text",
    async (info, source) => {
      const fenced = ["```" + info, source, "```"].join("\n");
      copyText.mockResolvedValue(undefined);
      const view = render(
        <ContentView
          content={{
            blocks: [
              {
                type: "markdown",
                revealMode: "ALL",
                source: ["~~~text", fenced, "~~~"].join("\n"),
              },
            ],
          }}
        />,
      );
      const displayed = [
        ...view.container.querySelector("pre code")!.childNodes,
      ]
        .map((node) => (node.nodeName === "BR" ? "\n" : node.textContent))
        .join("");
      expect(displayed).toBe(fenced);
      expect(
        view.container.querySelector(
          "[data-music-score], [data-mermaid-diagram], [data-jsx-graph]",
        ),
      ).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Code kopieren" }));
      await screen.findByRole("button", { name: "Code kopiert" });
      expect(copyText).toHaveBeenCalledWith(fenced);
    },
  );
});
