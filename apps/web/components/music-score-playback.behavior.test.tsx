// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicScoreBlock } from "@flashcards/domain/music-score";

const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock("../lib/music-renderer", () => ({ renderMusicScore: mocks.render }));
vi.mock("../lib/music-playback", () => ({
  createMusicPlaybackSession: mocks.createSession,
  exclusiveAudioRequestEvent: "test:exclusive-audio",
}));
vi.mock("./i18n-provider", () => {
  const text = (key: string, values?: unknown[]) => {
    const labels: Record<string, string> = {
      "legacy.0a669220eb5d": "Play",
      "legacy.a78702daa7f8": "Stop",
      "legacy.64e7bf3cf577": "Beginning",
      "legacy.a577e24fedb7": "Previous measure",
      "legacy.8bc16a632f3b": "Previous note",
      "legacy.e97df8a20c14": "Next note",
      "legacy.612bc7a2968c": "Next measure",
      "legacy.7de76f9ddd71": "Playback",
    };
    return labels[key] ?? `${key}:${values?.join(",") ?? ""}`;
  };
  return { useI18n: () => ({ text }) };
});

import { MusicScore } from "./music-score";

const score: MusicScoreBlock = {
  type: "musicScore",
  version: 1,
  label: "Test score",
  description: "Two measures",
  abc: "X:1\nM:2/4\nL:1/4\nK:C\nC D | E F |",
  display: {
    staffScale: "normal",
    sizePercent: 70,
    keyboard: "off",
    barsPerLine: "auto",
    responsive: true,
  },
};

describe("ABC playback without A/B ranges", () => {
  let ended: () => void;
  let session: {
    durationSeconds: number;
    start: ReturnType<typeof vi.fn>;
    seek: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 800, 400),
    );
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    mocks.render.mockResolvedValue({
      visual: {},
      markup: ["<svg></svg>"],
      diagnostics: [],
      timeline: [0, 1, 2, 3].map((index) => ({
        index,
        seconds: index,
        measure: index < 2 ? 1 : 2,
        cursorClass: `event-${index}`,
        pitches: [],
        notes: [],
      })),
    });
    mocks.createSession.mockImplementation(async (_visual, onEnded) => {
      ended = onEnded;
      session = {
        durationSeconds: 4,
        start: vi.fn(),
        seek: vi.fn(),
        destroy: vi.fn().mockResolvedValue(undefined),
      };
      return session;
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const showScore = async () => {
    render(<MusicScore score={score} />);
    await screen.findByRole("button", { name: "Play" });
    // The control is present during loading, so wait for the renderer too.
    await act(async () => {});
  };

  it("retains six playback controls and allows navigation across the whole score", async () => {
    await showScore();
    expect(
      within(screen.getByRole("group", { name: "Playback" })).getAllByRole(
        "button",
      ),
    ).toHaveLength(6);
    expect(
      screen.queryByRole("button", { name: /practice.*[AB]/i }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next measure" }));
    fireEvent.click(screen.getByRole("button", { name: "Next note" }));
    expect(
      document.querySelector(".music-score-cursor-status")?.textContent,
    ).toContain("2,4,4");
    expect(
      (screen.getByRole("button", { name: "Next note" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Beginning" }));
    expect(
      document.querySelector(".music-score-cursor-status")?.textContent,
    ).toContain("1,1,4");
  });

  it("plays from a selected note through the final event and replays from the beginning", async () => {
    await showScore();
    fireEvent.click(screen.getByRole("button", { name: "Next measure" }));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await screen.findByRole("button", { name: "Stop" });
    expect(session.seek).toHaveBeenCalledWith(2);
    expect(session.start).toHaveBeenCalledOnce();
    act(() => ended());
    expect(
      document.querySelector(".music-score-cursor-status")?.textContent,
    ).toContain("2,4,4");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await screen.findByRole("button", { name: "Stop" });
    expect(session.seek).toHaveBeenCalledWith(0);
  });
});
