import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AudioOptimizationControl } from "./settings";

const summary = {
  lastError: undefined,
  paused: false,
  processed: 12,
  running: false,
  suspensionReason: undefined,
  total: 355,
} as const;

describe("compact audio optimization control", () => {
  it("renders only progress, processed count, control and a reserved error line", () => {
    const html = renderToStaticMarkup(
      <AudioOptimizationControl
        locale="de"
        onToggle={vi.fn()}
        summary={summary}
      />,
    );

    expect(html).toContain("Lokale Audiooptimierung");
    expect(html).toContain('value="12"');
    expect(html).toContain('max="355"');
    expect(html).toContain("12/355 verarbeitet");
    expect(html).toContain('data-state="stopped"');
    expect(html).toContain('aria-label="Audiooptimierung starten"');
    expect(html).not.toContain("<audio");
    expect(html).not.toContain("Ersparnis");
    expect(html).not.toContain("Fehleranalyse");
  });

  it("shows pause, thermal and battery states with accessible labels", () => {
    const running = renderToStaticMarkup(
      <AudioOptimizationControl
        locale="de"
        onToggle={vi.fn()}
        summary={{ ...summary, running: true }}
      />,
    );
    const thermal = renderToStaticMarkup(
      <AudioOptimizationControl
        locale="de"
        onToggle={vi.fn()}
        summary={{ ...summary, suspensionReason: "THERMAL" }}
      />,
    );
    const battery = renderToStaticMarkup(
      <AudioOptimizationControl
        locale="de"
        onToggle={vi.fn()}
        summary={{ ...summary, suspensionReason: "BATTERY" }}
      />,
    );

    expect(running).toContain('data-state="running"');
    expect(running).toContain('aria-label="Audiooptimierung pausieren"');
    expect(thermal).toContain('data-state="thermal"');
    expect(thermal).toContain("nach Abkühlung automatisch fortsetzen");
    expect(battery).toContain('data-state="battery"');
    expect(battery).toContain("nach Ende des Batterieschutzes");
  });

  it("shows only the latest error line in red-compatible markup", () => {
    const html = renderToStaticMarkup(
      <AudioOptimizationControl
        locale="de"
        onToggle={vi.fn()}
        summary={{ ...summary, lastError: "Kodierung fehlgeschlagen" }}
      />,
    );

    expect(html).toContain("audio-optimization-last-error");
    expect(html).toContain("Kodierung fehlgeschlagen");
  });
});
