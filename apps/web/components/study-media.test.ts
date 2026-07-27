import { describe, expect, it, vi } from "vitest";

import {
  selectStudyMedia,
  toggleStudyMedia,
  type StudyMediaController,
} from "./study-media";

const media = (
  state: Pick<StudyMediaController, "paused" | "ended">,
): StudyMediaController => ({
  ...state,
  currentTime: state.ended ? 12 : 4,
  play: vi.fn(async () => {}),
  pause: vi.fn(),
});

describe("study media keyboard control", () => {
  it("prefers the currently playing medium", () => {
    const first = media({ paused: true, ended: false });
    const playing = media({ paused: false, ended: false });
    expect(selectStudyMedia([first, playing])).toBe(playing);
  });

  it("plays a paused medium and restarts an ended medium", async () => {
    const ended = media({ paused: true, ended: true });
    await expect(toggleStudyMedia(ended)).resolves.toBe("played");
    expect(ended.currentTime).toBe(0);
    expect(ended.play).toHaveBeenCalledOnce();
  });

  it("pauses a playing medium", async () => {
    const playing = media({ paused: false, ended: false });
    await expect(toggleStudyMedia(playing)).resolves.toBe("paused");
    expect(playing.pause).toHaveBeenCalledOnce();
    expect(playing.play).not.toHaveBeenCalled();
  });
});
