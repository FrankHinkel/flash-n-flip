"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { useI18n } from "./i18n-provider";

const lowestPianoMidi = 21;
const highestPianoMidi = 108;
const blackPitchClasses = new Set([1, 3, 6, 8, 10]);
const noteNames = [
  "C",
  "Cis/Des",
  "D",
  "Dis/Es",
  "E",
  "F",
  "Fis/Ges",
  "G",
  "Gis/As",
  "A",
  "Ais/B",
  "H",
] as const;

export const pianoMidiKeys = Array.from(
  { length: highestPianoMidi - lowestPianoMidi + 1 },
  (_, index) => lowestPianoMidi + index,
);

export function pianoNoteName(midi: number): string {
  return `${noteNames[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function pianoPracticeRange(pitches: number[]): [number, number] {
  if (!pitches.length) return [lowestPianoMidi, highestPianoMidi];
  const bounded = pitches.filter(
    (pitch) => pitch >= lowestPianoMidi && pitch <= highestPianoMidi,
  );
  if (!bounded.length) return [lowestPianoMidi, highestPianoMidi];
  const lowest = Math.min(...bounded);
  const highest = Math.max(...bounded);
  let start = Math.max(lowestPianoMidi, Math.floor((lowest - 5) / 12) * 12);
  let end = Math.min(highestPianoMidi, Math.ceil((highest + 5) / 12) * 12);
  if (end - start < 24) {
    const missing = 24 - (end - start);
    start = Math.max(lowestPianoMidi, start - Math.ceil(missing / 2));
    end = Math.min(highestPianoMidi, start + 24);
    start = Math.max(lowestPianoMidi, end - 24);
  }
  return [start, end];
}

export function PianoKeyboard({
  leftPitches,
  rightPitches,
  heldLeftPitches,
  heldRightPitches,
  practicePitches,
  showNoteNames,
}: {
  leftPitches: number[];
  rightPitches: number[];
  heldLeftPitches: number[];
  heldRightPitches: number[];
  practicePitches: number[];
  showNoteNames: boolean;
}) {
  const { text } = useI18n();
  const keyboardRef = useRef<HTMLDivElement | null>(null);
  const [usePracticeRange, setUsePracticeRange] = useState(false);
  const left = useMemo(() => new Set(leftPitches), [leftPitches]);
  const right = useMemo(() => new Set(rightPitches), [rightPitches]);
  const heldLeft = useMemo(() => new Set(heldLeftPitches), [heldLeftPitches]);
  const heldRight = useMemo(
    () => new Set(heldRightPitches),
    [heldRightPitches],
  );
  const leftNames = leftPitches.map(pianoNoteName).join(", ");
  const rightNames = rightPitches.map(pianoNoteName).join(", ");
  const heldLeftNames = heldLeftPitches.map(pianoNoteName).join(", ");
  const heldRightNames = heldRightPitches.map(pianoNoteName).join(", ");

  const [practiceStart, practiceEnd] = useMemo(
    () => pianoPracticeRange(practicePitches),
    [practicePitches],
  );
  const displayedKeys = usePracticeRange
    ? pianoMidiKeys.filter(
        (midi) => midi >= practiceStart && midi <= practiceEnd,
      )
    : pianoMidiKeys;
  const whiteKeyCount = displayedKeys.filter(
    (midi) => !blackPitchClasses.has(midi % 12),
  ).length;

  useEffect(() => {
    const keyboard = keyboardRef.current;
    if (!keyboard || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setUsePracticeRange((entry?.contentRect.width ?? 0) < 280);
    });
    observer.observe(keyboard);
    return () => observer.disconnect();
  }, []);

  let whiteKeysBefore = 0;
  const keys = displayedKeys.map((midi) => {
    const black = blackPitchClasses.has(midi % 12);
    const leftPercent = black
      ? (whiteKeysBefore / whiteKeyCount) * 100
      : undefined;
    if (!black) whiteKeysBefore += 1;
    return { midi, black, leftPercent };
  });

  return (
    <div className="piano-keyboard-region">
      <div
        aria-label={
          usePracticeRange
            ? text("legacy.9403e9a66450", [
                pianoNoteName(practiceStart),
                pianoNoteName(practiceEnd),
              ])
            : text("legacy.abbe0e11b3e7")
        }
        className="piano-keyboard-scroll"
        ref={keyboardRef}
        role="img"
        tabIndex={0}
      >
        <div
          aria-hidden="true"
          className="piano-keyboard"
          style={
            {
              "--piano-white-key-count": whiteKeyCount,
              "--piano-black-key-width": `${60 / whiteKeyCount}%`,
            } as CSSProperties
          }
        >
          {keys.map(({ midi, black, leftPercent }) => {
            const leftActive = left.has(midi);
            const rightActive = right.has(midi);
            const leftHeld = heldLeft.has(midi);
            const rightHeld = heldRight.has(midi);
            const noteName = pianoNoteName(midi);
            return (
              <span
                className={`piano-key piano-key-${black ? "black" : "white"}${leftHeld ? " piano-key-held-left" : ""}${rightHeld ? " piano-key-held-right" : ""}${leftActive ? " piano-key-active-left" : ""}${rightActive ? " piano-key-active-right" : ""}`}
                data-midi={midi}
                key={midi}
                style={black ? { left: `${leftPercent}%` } : undefined}
              >
                {showNoteNames &&
                (!black ||
                  leftActive ||
                  rightActive ||
                  leftHeld ||
                  rightHeld) ? (
                  <span
                    className={`piano-key-label${midi % 12 === 0 ? " piano-key-label-c" : ""}`}
                  >
                    {noteName}
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
      </div>
      <p
        className="piano-keyboard-status sr-only"
        role="status"
        aria-live="polite"
      >
        {leftNames || rightNames || heldLeftNames || heldRightNames
          ? [
              leftNames ? text("legacy.d4d78fc77ba3", [leftNames]) : "",
              rightNames ? text("legacy.b6d9f7c276a4", [rightNames]) : "",
              heldLeftNames ? text("legacy.f5e0089bc4d9", [heldLeftNames]) : "",
              heldRightNames
                ? text("legacy.b7b28d8a94fc", [heldRightNames])
                : "",
            ]
              .filter(Boolean)
              .join(" · ")
          : text("legacy.f6a6d75809bb")}
      </p>
    </div>
  );
}
