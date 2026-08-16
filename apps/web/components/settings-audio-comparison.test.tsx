import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AudioOptimizationControl } from "./settings";

const summary = {
  complete: 10,
  engineAvailable: true,
  failed: 0,
  lastError: undefined,
  paused: false,
  pending: 343,
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
    expect(html).toContain("12/355 geprüft · 10 optimiert");
    expect(html).toContain('data-state="stopped"');
    expect(html).toContain('aria-label="Audiooptimierung starten"');
    expect(html).not.toContain("<audio");
    expect(html).not.toContain("Ersparnis");
    expect(html).not.toContain("Fehleranalyse");
  });

  it("shows a finished status instead of an ineffective play button", () => {
    const html = renderToStaticMarkup(
      <AudioOptimizationControl
        locale="de"
        onToggle={vi.fn()}
        summary={{
          ...summary,
          complete: 307,
          pending: 0,
          processed: 355,
        }}
      />,
    );

    expect(html).toContain('data-state="finished"');
    expect(html).toContain('aria-label="Audioprüfung abgeschlossen"');
    expect(html).not.toContain('data-state="stopped"');
  });

  it("explains when actionable jobs cannot run on this device", () => {
    const html = renderToStaticMarkup(
      <AudioOptimizationControl
        locale="de"
        onToggle={vi.fn()}
        summary={{ ...summary, engineAvailable: false }}
      />,
    );

    expect(html).toContain('data-state="unavailable"');
    expect(html).toContain(
      "Audiooptimierung ist auf diesem Gerät nicht verfügbar",
    );
    expect(html).toContain("disabled");
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
