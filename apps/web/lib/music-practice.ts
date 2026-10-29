import type { MusicTimelineEvent, PianoHand } from "./music-renderer";

export const pianoAttackSeconds = 0.1;

export type PianoKeyHighlights = {
  attackedLeft: number[];
  attackedRight: number[];
  heldLeft: number[];
  heldRight: number[];
};

export function pianoKeyHighlightsAt(
  timeline: MusicTimelineEvent[],
  seconds: number,
): PianoKeyHighlights {
  const active = new Map<
    number,
    {
      hand: PianoHand;
      attacked: boolean;
      startedAt: number;
      endSeconds: number;
    }
  >();
  for (const event of timeline) {
    if (event.seconds > seconds) break;
    for (const note of event.notes) {
      const candidate = {
        hand: note.hand,
        attacked: seconds - event.seconds < pianoAttackSeconds,
        startedAt: event.seconds,
        endSeconds: note.endSeconds,
      };
      const previous = active.get(note.pitch);
      if (!previous || candidate.startedAt >= previous.startedAt) {
        active.set(note.pitch, candidate);
      }
    }
  }

  const result: PianoKeyHighlights = {
    attackedLeft: [],
    attackedRight: [],
    heldLeft: [],
    heldRight: [],
  };
  for (const [pitch, state] of active) {
    if (state.endSeconds <= seconds) continue;
    const target = state.attacked
      ? state.hand === "left"
        ? result.attackedLeft
        : result.attackedRight
      : state.hand === "left"
        ? result.heldLeft
        : result.heldRight;
    target.push(pitch);
  }
  return result;
}
