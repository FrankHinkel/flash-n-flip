import fs from "node:fs";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  new URL("./music-score.tsx", import.meta.url),
  "utf8",
);

describe("music score information boundary", () => {
  it("keeps explanatory score text behind one accessible information control", () => {
    expect(source).toContain('className="music-score-info"');
    expect(source).toContain('aria-label={text("Music information"');
    expect(source).toContain('className="music-score-info-panel"');
    expect(source).toContain('className="sr-only"');
    expect(source).not.toContain('className="music-score-heading"');
    expect(source).not.toContain('className="music-score-text-view"');
    expect(source).not.toContain('"Accessible event list"');
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
    expect(source).toContain(
      "`Takt ${activeTimelineEvent?.measure ?? 1} · Note ${activeEventIndex + 1} von ${Math.max(1, timeline.length)}`",
    );
  });
});
