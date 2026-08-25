import fs from "node:fs";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  new URL("./music-score.tsx", import.meta.url),
  "utf8",
);
const styles = fs.readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("music score information boundary", () => {
  it("keeps explanatory score text behind one accessible information control", () => {
    expect(source).toContain('className="music-score-info"');
    expect(source).toContain('text("legacy.50e60294706f")');
    expect(source).toContain('text("legacy.6f3222e7119a")');
    expect(source).toContain('className="music-score-info-panel"');
    expect(source).toContain('className="sr-only"');
    expect(source).not.toContain('className="music-score-heading"');
    expect(source).not.toContain('className="music-score-text-view"');
    expect(source).not.toContain('"Accessible event list"');
  });

  it("exposes fixed notation diagnostics without relying on red alone", () => {
    expect(source).toContain('marker.className = "music-score-diagnostic-bar"');
    expect(source).toContain('className="music-score-info-warning"');
    expect(source).toContain('className="music-score-diagnostics"');
    expect(source).toContain('text("legacy.88b481041c8f")');
    expect(source).toContain("diagnostic.actualUnits");
    expect(source).toContain("diagnostic.expectedUnits");
  });

  it("shows playback position beside the controls and highlights it in the score", () => {
    expect(source).toContain('className="music-score-player-row"');
    expect(source).toContain('className="music-score-cursor-status"');
    expect(source).toContain('className="music-score-position-bar"');
    expect(source).toContain("positionBar.style.left");
    expect(source).toContain("positionBar.style.top");
    expect(source).toContain("contentLeft < previousPosition.left - 24");
    expect(source).toContain("contentCenter > previousPosition.center + 24");
    expect(source).toContain('"music-score-position-bar-jump"');
    expect(source).toContain("canvas.scrollTop = Math.max(");
    expect(source).toContain('text("legacy.a8926cd160c1"');
  });

  it("offers temporary A and B practice points without a jog shuttle", () => {
    expect(source).not.toContain('className="music-score-jog"');
    expect(source).not.toContain('type="range"');
    expect(source).toContain("aria-pressed={practicePointA !== null}");
    expect(source).toContain("aria-pressed={practicePointB !== null}");
    expect(source).toContain('text("legacy.7ad924628c3b")');
    expect(source).toContain("musicPracticeEndSeconds");
    expect(styles).toContain(".music-score-practice-points");
    expect(styles).toContain("grid-template-columns: repeat(2, 44px)");
  });

  it("shows attacked and held piano keys as separate states", () => {
    expect(source).toContain(
      "pianoKeyHighlightsAt(practiceTimeline, position)",
    );
    expect(source).toContain("heldLeftPitches={keyHighlights.heldLeft}");
    expect(source).toContain("heldRightPitches={keyHighlights.heldRight}");
    expect(styles).toContain(".piano-key-white.piano-key-held-left");
    expect(styles).toContain(".piano-key-white.piano-key-held-right");
  });
});
