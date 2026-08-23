import { describe, expect, it } from "vitest";

import {
  pianoMidiKeys,
  pianoNoteName,
  pianoPracticeRange,
} from "./piano-keyboard";

describe("88-key piano keyboard", () => {
  it("covers the complete acoustic-piano range from A0 to C8", () => {
    expect(pianoMidiKeys).toHaveLength(88);
    expect(pianoMidiKeys[0]).toBe(21);
    expect(pianoMidiKeys.at(-1)).toBe(108);
    expect(pianoNoteName(21)).toBe("A0");
    expect(pianoNoteName(60)).toBe("C4");
    expect(pianoNoteName(108)).toBe("C8");
  });

  it("derives one stable padded practice range without moving with each note", () => {
    expect(pianoPracticeRange([48, 52, 69, 72])).toEqual([36, 84]);
    expect(pianoPracticeRange([])).toEqual([21, 108]);
    expect(pianoPracticeRange([21, 108])).toEqual([21, 108]);
  });
});
