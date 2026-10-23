// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultMediaPresentation } from "../lib/media-presentation";
import { parsePeriodicTableSource } from "../lib/periodic-table";
import { PeriodicTable } from "./periodic-table";

vi.mock("./i18n-provider", () => ({
  useI18n: () => ({ text: (key: string) => key }),
}));

afterEach(cleanup);

const table = (source = "mode explore") => (
  <PeriodicTable
    program={parsePeriodicTableSource(source)}
    presentation={defaultMediaPresentation}
  />
);

describe("periodic table selection and study-card changes", () => {
  it("keeps every element selectable through the accessible picker", () => {
    const { container } = render(table());
    const picker = screen.getByRole("combobox");
    expect(screen.getAllByRole("option")).toHaveLength(118);
    fireEvent.change(picker, { target: { value: "104" } });
    expect(picker).toHaveProperty("value", "104");
    expect(
      container.querySelector(".periodic-table-identity span")?.textContent,
    ).toBe("Rutherfordium");
    expect(
      screen
        .getByRole("button", { name: /104, Rf,/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("keeps atomic number and symbol available in all 118 cells", () => {
    const { container } = render(table("mode quiz\nfocus Rf"));
    const cells = [...container.querySelectorAll(".periodic-table-element")];
    expect(cells).toHaveLength(118);
    expect(
      cells.every(
        (cell) =>
          cell.querySelector("small")?.textContent &&
          cell.querySelector("strong")?.textContent,
      ),
    ).toBe(true);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(container.querySelector(".periodic-table-details")).toBeNull();
  });

  it("bounds navigation and updates the element details", () => {
    const { container } = render(table());
    expect(
      screen.getByRole("button", { name: "rich.periodicTable.previous" }),
    ).toHaveProperty("disabled", true);
    fireEvent.click(
      screen.getByRole("button", { name: "rich.periodicTable.next" }),
    );
    expect(
      container.querySelector(".periodic-table-identity strong")?.textContent,
    ).toBe("He");
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "118" },
    });
    expect(
      screen.getByRole("button", { name: "rich.periodicTable.next" }),
    ).toHaveProperty("disabled", true);
  });

  it("resets selection when the study card changes its focused element", () => {
    const { rerender, container } = render(table("mode explore\nfocus Fe"));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "104" },
    });
    rerender(table("mode explore\nfocus O"));
    expect(screen.getByRole("combobox")).toHaveProperty("value", "8");
    expect(
      container.querySelector(".periodic-table-identity strong")?.textContent,
    ).toBe("O");
  });
});
