"use client";

import { useEffect, useMemo, useRef } from "react";

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

export function PianoKeyboard({
  activePitches,
  showNoteNames,
}: {
  activePitches: number[];
  showNoteNames: boolean;
}) {
  const { text } = useI18n();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const active = useMemo(() => new Set(activePitches), [activePitches]);
  const activeNames = activePitches.map(pianoNoteName).join(", ");

  useEffect(() => {
    const scroll = scrollRef.current;
    const first = scroll?.querySelector<HTMLElement>(".piano-key-active");
    if (!scroll || !first) return;
    scroll.scrollLeft = Math.max(
      0,
      first.offsetLeft - (scroll.clientWidth - first.offsetWidth) / 2,
    );
  }, [activePitches]);

  let whiteKeysBefore = 0;
  const keys = pianoMidiKeys.map((midi) => {
    const black = blackPitchClasses.has(midi % 12);
    const left = black ? whiteKeysBefore * 22 - 7 : undefined;
    if (!black) whiteKeysBefore += 1;
    return { midi, black, left };
  });

  return (
    <div className="piano-keyboard-region">
      <div
        aria-label={text("88-key piano keyboard", "88-Tasten-Klaviatur")}
        className="piano-keyboard-scroll"
        ref={scrollRef}
        role="img"
        tabIndex={0}
      >
        <div aria-hidden="true" className="piano-keyboard">
          {keys.map(({ midi, black, left }) => (
            <span
              className={`piano-key piano-key-${black ? "black" : "white"}${active.has(midi) ? " piano-key-active" : ""}`}
              key={midi}
              style={black ? { left } : undefined}
            >
              {showNoteNames && (!black || active.has(midi)) ? (
                <span>{pianoNoteName(midi)}</span>
              ) : null}
            </span>
          ))}
        </div>
      </div>
      <p className="piano-keyboard-status" role="status">
        {activeNames
          ? text(
              `Keys to play: ${activeNames}`,
              `Zu spielende Tasten: ${activeNames}`,
            )
          : text("No key selected yet.", "Noch keine Taste ausgewählt.")}
      </p>
    </div>
  );
}
