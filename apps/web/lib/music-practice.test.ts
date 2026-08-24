import { describe, expect, it } from "vitest";

import type { MusicTimelineEvent } from "./music-renderer";
import {
  musicPracticeBounds,
  musicPracticeEndSeconds,
  pianoKeyHighlightsAt,
} from "./music-practice";

const event = (
  index: number,
  seconds: number,
  notes: MusicTimelineEvent["notes"],
): MusicTimelineEvent => ({
  index,
  seconds,
  measure: index + 1,
  cursorClass: `event-${index}`,
  notes,
  pitches: notes.map(({ pitch }) => pitch),
  leftPitches: notes
    .filter(({ hand }) => hand === "left")
    .map(({ pitch }) => pitch),
  rightPitches: notes
    .filter(({ hand }) => hand === "right")
    .map(({ pitch }) => pitch),
});

describe("music practice playback", () => {
  const timeline = [
    event(0, 0, [{ pitch: 48, hand: "left", endSeconds: 2 }]),
    event(1, 1, [{ pitch: 72, hand: "right", endSeconds: 1.5 }]),
    event(2, 2, [{ pitch: 74, hand: "right", endSeconds: 3 }]),
  ];

  it("keeps long notes held while a newer note is attacked", () => {
    expect(pianoKeyHighlightsAt(timeline, 1.05)).toEqual({
      attackedLeft: [],
      attackedRight: [72],
      heldLeft: [48],
      heldRight: [],
    });
    expect(pianoKeyHighlightsAt(timeline, 1.2)).toEqual({
      attackedLeft: [],
      attackedRight: [],
      heldLeft: [48],
      heldRight: [72],
    });
  });

  it("releases each pitch at its own notated end", () => {
    expect(pianoKeyHighlightsAt(timeline, 1.5).heldRight).toEqual([]);
    expect(pianoKeyHighlightsAt(timeline, 2).attackedRight).toEqual([74]);
    expect(pianoKeyHighlightsAt(timeline, 2).heldLeft).toEqual([]);
  });

  it("does not resurrect an older note after the same key is struck again", () => {
    const repeated = [
      event(0, 0, [{ pitch: 60, hand: "left", endSeconds: 3 }]),
      event(1, 1, [{ pitch: 60, hand: "right", endSeconds: 2 }]),
    ];
    expect(pianoKeyHighlightsAt(repeated, 2.1)).toEqual({
      attackedLeft: [],
      attackedRight: [],
      heldLeft: [],
      heldRight: [],
    });
  });

  it("uses A and B as inclusive event boundaries", () => {
    expect(musicPracticeBounds(timeline.length, 1, 2)).toEqual({
      startIndex: 1,
      endIndex: 2,
    });
    expect(musicPracticeEndSeconds(timeline, 1, 4)).toBe(2);
    expect(musicPracticeEndSeconds(timeline, 2, 4)).toBe(4);
  });
});
