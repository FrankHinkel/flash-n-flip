import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

type AbcElement = {
  el_type: string;
  startChar?: number;
  endChar?: number;
};

type SequencedElement = AbcElement & {
  elem?: AbcElement;
};

const require = createRequire(import.meta.url);
const abcjs = require("abcjs") as {
  parseOnly(source: string): unknown[];
  synth: {
    sequence(tune: unknown): SequencedElement[][];
  };
};
const createKeySignature = require(
  "abcjs/src/write/creation/create-key-signature.js",
) as (element: AbcElement & { accidentals: unknown[] }, tune: number) => unknown;

describe("abcjs music compatibility patches", () => {
  it("keeps a key change reusable across multiple rendered staves", () => {
    const key = {
      el_type: "key",
      accidentals: [{ acc: "sharp", verticalPos: 10 }],
    };

    expect(createKeySignature(key, 0)).toBeTruthy();
    expect(key.el_type).toBe("key");
    expect(createKeySignature(key, 0)).toBeTruthy();
    expect(key.el_type).toBe("key");
  });

  it("does not duplicate a note at a folded repeat-ending seam", () => {
    const source = readFileSync(
      new URL(
        "../../../examples/music/musicxml/generated/mozart-rondo-alla-turca.abc",
        import.meta.url,
      ),
      "utf8",
    );
    const tune = abcjs.parseOnly(source)[0];
    const tracks = abcjs.synth.sequence(tune);
    const duplicateSeams = tracks.flatMap((track, trackIndex) =>
      track.flatMap((element, index) => {
        if (element.el_type !== "note" || index === 0) return [];
        const previous = track[index - 1]!;
        if (previous.el_type !== "note") return [];
        const sourceElement = element.elem ?? element;
        const previousSource = previous.elem ?? previous;
        return sourceElement.startChar !== undefined &&
          sourceElement.startChar === previousSource.startChar &&
          sourceElement.endChar === previousSource.endChar
          ? [{ trackIndex, index, startChar: sourceElement.startChar }]
          : [];
      }),
    );

    expect(tracks).toHaveLength(3);
    expect(duplicateSeams).toEqual([]);
  });
});
