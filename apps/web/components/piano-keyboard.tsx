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
  practicePitches,
  showNoteNames,
}: {
  leftPitches: number[];
  rightPitches: number[];
  practicePitches: number[];
  showNoteNames: boolean;
}) {
  const { text } = useI18n();
  const keyboardRef = useRef<HTMLDivElement | null>(null);
  const [usePracticeRange, setUsePracticeRange] = useState(false);
  const left = useMemo(() => new Set(leftPitches), [leftPitches]);
  const right = useMemo(() => new Set(rightPitches), [rightPitches]);
  const leftNames = leftPitches.map(pianoNoteName).join(", ");
  const rightNames = rightPitches.map(pianoNoteName).join(", ");

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
            ? text(
                `Piano keyboard, stable range ${pianoNoteName(practiceStart)} to ${pianoNoteName(practiceEnd)}`,
                `Klaviatur, stabiler Tonumfang ${pianoNoteName(practiceStart)} bis ${pianoNoteName(practiceEnd)}`,
              )
            : text("88-key piano keyboard", "88-Tasten-Klaviatur")
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
            const noteName = pianoNoteName(midi);
            return (
              <span
                className={`piano-key piano-key-${black ? "black" : "white"}${leftActive ? " piano-key-active-left" : ""}${rightActive ? " piano-key-active-right" : ""}`}
                data-midi={midi}
                key={midi}
                style={black ? { left: `${leftPercent}%` } : undefined}
              >
                {leftActive || rightActive ? (
                  <span className="piano-key-hand">
                    {leftActive ? "L" : "R"}
                  </span>
                ) : null}
                {showNoteNames && (!black || leftActive || rightActive) ? (
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
      <p className="piano-keyboard-status" role="status">
        {leftNames || rightNames
          ? [
              leftNames
                ? text(`Left hand: ${leftNames}`, `Linke Hand: ${leftNames}`)
                : "",
              rightNames
                ? text(
                    `Right hand: ${rightNames}`,
                    `Rechte Hand: ${rightNames}`,
                  )
                : "",
            ]
              .filter(Boolean)
              .join(" · ")
          : text("No key selected yet.", "Noch keine Taste ausgewählt.")}
      </p>
    </div>
  );
}
