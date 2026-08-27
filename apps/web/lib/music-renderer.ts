import { sanitizeSvgBytes } from "@flashcards/domain/svg-sanitizer";
import {
  validateMusicScoreAbc,
  type MusicScoreBlock,
} from "@flashcards/domain/music-score";
import type { NoteTimingEvent, TuneObject } from "abcjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const maximumGeneratedMusicSvgLength = 32 * 1024 * 1024;
const abcjsScaleStyle =
  /^transform:\s*scale\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\);\s*transform-origin:\s*(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px;?$/u;
const maximumAbcjsScale = 100;
const maximumAbcjsTransformOrigin = 100_000;

export const abcjsScaleTransform = (style: string): string | null => {
  const match = style.match(abcjsScaleStyle);
  if (!match) return null;
  const values = match.slice(1).map(Number);
  if (values.some((value) => !Number.isFinite(value))) return null;
  const scaleX = values[0]!;
  const scaleY = values[1]!;
  const originX = values[2]!;
  const originY = values[3]!;
  if (
    Math.abs(scaleX) > maximumAbcjsScale ||
    Math.abs(scaleY) > maximumAbcjsScale ||
    Math.abs(originX) > maximumAbcjsTransformOrigin ||
    Math.abs(originY) > maximumAbcjsTransformOrigin
  ) {
    return null;
  }
  return `translate(${originX} ${originY}) scale(${scaleX} ${scaleY}) translate(${-originX} ${-originY})`;
};

const normalizeAbcjsScaleStyle = (element: Element): boolean => {
  const style = element.getAttribute("style");
  if (style === null) return true;
  const transform = abcjsScaleTransform(style);
  if (!transform || element.hasAttribute("transform")) return false;
  element.setAttribute("transform", transform);
  element.removeAttribute("style");
  return true;
};

export const normalizeAbcjsAriaLabel = (value: string): string =>
  value.replaceAll('"', "'");

export const isDiscardedAbcjsSvgAttribute = (name: string): boolean =>
  name.startsWith("data-") ||
  name === "selectable" ||
  name === "highlight" ||
  name === "text-decoration";

export function sanitizeMusicSvg(svg: string): string | null {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (parsed.querySelector("parsererror")) return null;
  parsed
    .querySelectorAll("style, title")
    .forEach((element) => element.remove());
  parsed.documentElement.removeAttribute("style");
  for (const element of parsed.querySelectorAll("*")) {
    if (!normalizeAbcjsScaleStyle(element)) return null;
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel?.includes('"')) {
      element.setAttribute("aria-label", normalizeAbcjsAriaLabel(ariaLabel));
    }
    for (const attribute of [...element.attributes]) {
      if (isDiscardedAbcjsSvgAttribute(attribute.name)) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  const normalized = new XMLSerializer().serializeToString(
    parsed.documentElement,
  );
  const sanitized = sanitizeSvgBytes(
    encoder.encode(normalized),
    maximumGeneratedMusicSvgLength,
  );
  return sanitized ? decoder.decode(sanitized) : null;
}

export type MusicTimelineEvent = {
  index: number;
  seconds: number;
  measure: number;
  cursorClass: string;
  notes: MusicTimelineNote[];
  pitches: number[];
  leftPitches: number[];
  rightPitches: number[];
};

export type MusicTimelineNote = {
  pitch: number;
  hand: PianoHand;
  endSeconds: number;
};

export type MusicMeasureDiagnostic = {
  index: number;
  markerClass: string;
  voice: string;
  measure: number;
  actualUnits: number;
  expectedUnits: number;
  unitDenominator: number;
  sourceRange: { start: number; end: number };
};

export type RenderedMusicScore = {
  markup: string[];
  timeline: MusicTimelineEvent[];
  diagnostics: MusicMeasureDiagnostic[];
  visual: TuneObject;
};

export type PianoHand = "left" | "right";

export function onsetElementGroupCount(
  elementGroupCount: number,
  sourceStartCount: number | undefined,
): number {
  if (!sourceStartCount) return elementGroupCount;
  return Math.min(elementGroupCount, sourceStartCount);
}

const voiceAtSourcePosition = (source: string, position: number): string => {
  let voice = "default";
  const prefix = source.slice(0, Math.max(0, position) + 1);
  for (const match of prefix.matchAll(
    /(?:^|\n)V:\s*([A-Za-z0-9_-]+)|\[V:\s*([A-Za-z0-9_-]+)\]/gu,
  )) {
    voice = match[1] ?? match[2] ?? voice;
  }
  return voice;
};

type AbcVisualElement = {
  el_type?: string;
  type?: string;
  duration?: number;
  startChar?: number;
  endChar?: number;
  startTriplet?: number;
  tripletMultiplier?: number;
  endTriplet?: boolean;
  gracenotes?: unknown[];
};

type MeasuredVoiceBar = {
  voice: string;
  measure: number;
  duration: number;
  sourceRange: { start: number; end: number };
};

const defaultNoteDenominator = (source: string): number => {
  const match = source.match(/(?:^|\n)L:\s*1\/(1|2|4|8|16|32|64)\s*$/mu);
  return match ? Number(match[1]) : 8;
};

const isStandaloneGraceElement = (
  element: AbcVisualElement,
  next: AbcVisualElement | undefined,
): boolean =>
  Boolean(
    element.gracenotes?.length &&
    next?.el_type === "bar" &&
    element.startChar !== undefined &&
    next.startChar !== undefined &&
    element.startChar > next.startChar,
  );

export function findMusicMeasureDiagnostics(
  visual: Pick<TuneObject, "lines" | "getBarLength">,
  source: string,
): MusicMeasureDiagnostic[] {
  const states = new Map<
    string,
    {
      measure: number;
      duration: number;
      multiplier: number;
      start: number;
      end: number;
    }
  >();
  const bars: MeasuredVoiceBar[] = [];
  const stateFor = (voice: string) => {
    const current = states.get(voice);
    if (current) return current;
    const created = {
      measure: 1,
      duration: 0,
      multiplier: 1,
      start: Number.POSITIVE_INFINITY,
      end: 0,
    };
    states.set(voice, created);
    return created;
  };
  const finishBar = (voice: string) => {
    const state = stateFor(voice);
    if (Number.isFinite(state.start) && state.end > state.start) {
      bars.push({
        voice,
        measure: state.measure,
        duration: state.duration,
        sourceRange: { start: state.start, end: state.end },
      });
    }
    state.measure += 1;
    state.duration = 0;
    state.multiplier = 1;
    state.start = Number.POSITIVE_INFINITY;
    state.end = 0;
  };

  for (const line of visual.lines ?? []) {
    for (const staff of line.staff ?? []) {
      for (const elements of staff.voices ?? []) {
        if (!elements) continue;
        for (const [elementIndex, elementValue] of elements.entries()) {
          const element = elementValue as unknown as AbcVisualElement;
          const next = elements[elementIndex + 1] as
            (typeof elementValue & AbcVisualElement) | undefined;
          const sourcePosition = element.startChar ?? element.endChar ?? 0;
          const voice = voiceAtSourcePosition(source, sourcePosition);
          if (
            element.el_type === "note" &&
            element.duration !== undefined &&
            !isStandaloneGraceElement(element, next)
          ) {
            const state = stateFor(voice);
            if (element.startTriplet) {
              state.multiplier = element.tripletMultiplier ?? 1;
            }
            state.duration += element.duration * state.multiplier;
            state.start = Math.min(
              state.start,
              element.startChar ?? state.start,
            );
            state.end = Math.max(state.end, element.endChar ?? state.end);
            if (element.endTriplet) state.multiplier = 1;
          } else if (
            element.el_type === "bar" &&
            element.type !== "bar_invisible"
          ) {
            finishBar(voice);
          }
        }
      }
    }
  }
  for (const [voice, state] of states) {
    if (Number.isFinite(state.start) && state.end > state.start)
      finishBar(voice);
  }

  const expectedDuration = visual.getBarLength();
  if (!Number.isFinite(expectedDuration) || expectedDuration <= 0) return [];
  const voices = [...new Set(bars.map(({ voice }) => voice))];
  const boundaries = new Map(
    voices.map((voice) => {
      const measures = bars
        .filter((bar) => bar.voice === voice)
        .map(({ measure }) => measure);
      return [
        voice,
        { first: Math.min(...measures), last: Math.max(...measures) },
      ];
    }),
  );
  const epsilon = 1e-8;
  const isComplementarySplitBar = (bar: MeasuredVoiceBar): boolean => {
    if (bar.duration >= expectedDuration - epsilon) return false;
    const sameVoice = bars.filter((candidate) => candidate.voice === bar.voice);
    const index = sameVoice.findIndex(
      (candidate) => candidate.measure === bar.measure,
    );
    return [sameVoice[index - 1], sameVoice[index + 1]].some(
      (neighbor) =>
        neighbor !== undefined &&
        neighbor.duration < expectedDuration - epsilon &&
        Math.abs(neighbor.duration + bar.duration - expectedDuration) <=
          epsilon,
    );
  };
  const anomalous = bars.filter((bar) => {
    const boundary = boundaries.get(bar.voice);
    if (
      !boundary ||
      bar.measure === boundary.first ||
      bar.measure === boundary.last
    ) {
      return false;
    }
    if (Math.abs(bar.duration - expectedDuration) <= epsilon) return false;
    // xml2abc writes non-printing MusicXML chord pitches as x inside the
    // visible chord. abcjs preserves playback but exposes an inflated visual
    // duration for that construct, so it is not a real staff-timing mismatch.
    if (
      /\[(?=[^\]\n]*x)(?=[^\]\n]*[A-Ga-g])[^\]\n]+\]/u.test(
        source.slice(Math.max(0, bar.sourceRange.start - 2), bar.sourceRange.end),
      )
    ) {
      return false;
    }
    // Unfolded repeats can place a cadence fragment directly beside its
    // complementary pickup. Together they form one complete bar and must not
    // be reported as two timing errors.
    if (isComplementarySplitBar(bar)) return false;
    if (voices.length === 1) return true;
    const peers = bars.filter(
      (candidate) =>
        candidate.voice !== bar.voice && candidate.measure === bar.measure,
    );
    return peers.some(
      (candidate) => Math.abs(candidate.duration - bar.duration) > epsilon,
    );
  });
  const unitDenominator = defaultNoteDenominator(source);
  const unitDuration = 1 / unitDenominator;
  return anomalous.map((bar, index) => ({
    index,
    markerClass: `fnf-music-diagnostic-${index}`,
    voice: bar.voice,
    measure: bar.measure,
    actualUnits: Number((bar.duration / unitDuration).toFixed(6)),
    expectedUnits: Number((expectedDuration / unitDuration).toFixed(6)),
    unitDenominator,
    sourceRange: bar.sourceRange,
  }));
}

export function pianoHandAtSourcePosition(
  source: string,
  position: number,
  voiceClefs: Record<string, "treble" | "bass">,
): PianoHand {
  return voiceClefs[voiceAtSourcePosition(source, position)] === "bass"
    ? "left"
    : "right";
}

const pitchCountInRange = (source: string, start?: number, end?: number) => {
  if (start === undefined || end === undefined || end <= start) return 0;
  return (
    source
      .slice(start, end)
      .match(/(?:\^\^|__|\^|_|=)?[A-Ga-g][',]*(?:\d+|\/\d*)?\.?/gu) ?? []
  ).length;
};

const fallbackHandForPitch = (pitch: number): PianoHand =>
  pitch < 60 ? "left" : "right";

const selectedVoiceAbc = (source: string, selectedVoice: string): string => {
  let keySeen = false;
  let currentVoice = "default";
  return source
    .split("\n")
    .filter((rawLine) => {
      const line = rawLine.trim();
      const voiceField = line.match(/^V:\s*([A-Za-z0-9_-]+)/u);
      if (voiceField) {
        currentVoice = voiceField[1]!;
        return currentVoice === selectedVoice;
      }
      if (/^K:/u.test(line)) {
        keySeen = true;
        return true;
      }
      if (!keySeen || !line || /^[XTMLQw]:/u.test(line)) return true;
      const inlineVoice = line.match(/\[V:\s*([A-Za-z0-9_-]+)\]/u);
      if (inlineVoice) currentVoice = inlineVoice[1]!;
      return currentVoice === selectedVoice;
    })
    .join("\n");
};

export function musicAbcForDisplay(block: MusicScoreBlock): string {
  const metrics = validateMusicScoreAbc(block.abc);
  if (block.display.selectedVoice) {
    return selectedVoiceAbc(block.abc, block.display.selectedVoice);
  }
  if (metrics.voices.length < 2) return block.abc;
  const groupedByClef = (["treble", "bass"] as const)
    .map((clef) =>
      metrics.voices.filter((voice) => metrics.voiceClefs[voice] === clef),
    )
    .filter((voices) => voices.length > 0)
    .map((voices) =>
      voices.length === 1 ? voices[0]! : `( ${voices.join(" ")} )`,
    );
  const directive = `%%score { ${groupedByClef.join(" | ")} }`;
  const lines = block.abc.split("\n");
  const referenceIndex = lines.findIndex((line) => /^X:/u.test(line.trim()));
  lines.splice(Math.max(0, referenceIndex + 1), 0, directive);
  return lines.join("\n");
}

export async function renderMusicScore(
  block: MusicScoreBlock,
  availableWidth = 740,
): Promise<RenderedMusicScore> {
  const { default: abcjs } = await import("abcjs");
  const target = document.createElement("div");
  const displayAbc = musicAbcForDisplay(block);
  const metrics = validateMusicScoreAbc(block.abc);
  const ratio = block.display.sizePercent / 100;
  const staffWidth = Math.round(
    Math.min(1_600, Math.max(280, availableWidth)) / ratio,
  );
  const visual = abcjs.renderAbc(target, displayAbc, {
    add_classes: false,
    ariaLabel: block.label,
    foregroundColor: "currentColor",
    responsive: "resize",
    scale: ratio,
    staffwidth: staffWidth,
    // abcjs can render bounded input despite non-fatal timing-precision
    // warnings. Stopping on the first warning leaves an invalid partial tune.
    stop_on_warning: false,
    wrap: {
      preferredMeasuresPerLine:
        block.display.barsPerLine === "auto" ? 0 : block.display.barsPerLine,
      minSpacing: 1.4,
      maxSpacing: 2.8,
      lastLineLimit: 1.6,
    },
  })[0];
  if (!visual) throw new Error("abcjs did not produce a visual score");
  // abcjs computes MIDI pitches while building its local audio sequence.
  // This performs no playback or network access and feeds both the keyboard
  // learning view and the timing cursor from the same parsed tune.
  visual.setUpAudio({});
  const diagnostics = findMusicMeasureDiagnostics(visual, displayAbc);
  const timingEvents = visual.setTiming() as unknown as NoteTimingEvent[];
  const timeline = timingEvents
    .filter((event) => event.type === "event" && event.elements?.length)
    .map((event, index) => {
      const cursorClass = `fnf-music-cursor-${index}`;
      const midiNotes = (event.midiPitches ?? []).filter(
        ({ pitch }) => pitch >= 21 && pitch <= 108,
      );
      const midiPitches = midiNotes.map(({ pitch }) => pitch);
      const leftPitches: number[] = [];
      const rightPitches: number[] = [];
      const notes: MusicTimelineNote[] = [];
      let pitchOffset = 0;
      const elementGroups = event.elements ?? [];
      const onsetGroupCount = onsetElementGroupCount(
        elementGroups.length,
        event.startCharArray?.length,
      );
      for (const [groupIndex, group] of elementGroups
        .slice(0, onsetGroupCount)
        .entries()) {
        const sourcePosition =
          event.startCharArray?.[groupIndex] ?? event.startChar ?? 0;
        const hand = pianoHandAtSourcePosition(
          displayAbc,
          sourcePosition,
          metrics.voiceClefs,
        );
        for (const element of group) {
          element.classList.add(cursorClass, `fnf-music-hand-${hand}`);
          const diagnostic = diagnostics.find(
            (candidate) =>
              candidate.voice ===
                voiceAtSourcePosition(displayAbc, sourcePosition) &&
              sourcePosition >= candidate.sourceRange.start &&
              sourcePosition < candidate.sourceRange.end,
          );
          if (diagnostic) element.classList.add(diagnostic.markerClass);
        }
        const pitchCount = pitchCountInRange(
          displayAbc,
          event.startCharArray?.[groupIndex] ?? event.startChar,
          event.endCharArray?.[groupIndex] ?? event.endChar,
        );
        const handNotes = midiNotes.slice(
          pitchOffset,
          pitchOffset + pitchCount,
        );
        (hand === "left" ? leftPitches : rightPitches).push(
          ...handNotes.map(({ pitch }) => pitch),
        );
        notes.push(
          ...handNotes.map(({ pitch, duration }) => ({
            pitch,
            hand,
            endSeconds:
              event.milliseconds / 1_000 +
              (duration * event.millisecondsPerMeasure) / 1_000,
          })),
        );
        pitchOffset += pitchCount;
      }
      for (const note of midiNotes.slice(pitchOffset)) {
        const hand = fallbackHandForPitch(note.pitch);
        (hand === "left" ? leftPitches : rightPitches).push(note.pitch);
        notes.push({
          pitch: note.pitch,
          hand,
          endSeconds:
            event.milliseconds / 1_000 +
            (note.duration * event.millisecondsPerMeasure) / 1_000,
        });
      }
      return {
        index,
        seconds: event.milliseconds / 1_000,
        measure: (event.measureNumber ?? 0) + 1,
        cursorClass,
        notes,
        pitches: [...new Set(midiPitches)],
        leftPitches: [...new Set(leftPitches)],
        rightPitches: [...new Set(rightPitches)],
      };
    });
  const rendered = [...target.querySelectorAll("svg")].map((svg) =>
    sanitizeMusicSvg(new XMLSerializer().serializeToString(svg)),
  );
  if (!rendered.length || rendered.some((svg) => !svg)) {
    throw new Error("abcjs produced unsupported or unsafe SVG output");
  }
  return { markup: rendered as string[], timeline, diagnostics, visual };
}
