import { sanitizeSvgBytes } from "@flashcards/domain/svg-sanitizer";
import {
  validateMusicScoreAbc,
  type MusicScoreBlock,
} from "@flashcards/domain/music-score";
import type { NoteTimingEvent, TuneObject } from "abcjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const abcjsScaleStyle =
  /^transform:\s*scale\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\);\s*transform-origin:\s*(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px;?$/u;

const normalizeAbcjsScaleStyle = (element: Element): boolean => {
  const style = element.getAttribute("style");
  if (style === null) return true;
  const match = style.match(abcjsScaleStyle);
  if (!match || element.hasAttribute("transform")) return false;
  const values = match.slice(1).map(Number);
  if (
    values.some((value) => !Number.isFinite(value) || Math.abs(value) > 10_000)
  ) {
    return false;
  }
  const scaleX = values[0]!;
  const scaleY = values[1]!;
  const originX = values[2]!;
  const originY = values[3]!;
  element.setAttribute(
    "transform",
    `translate(${originX} ${originY}) scale(${scaleX} ${scaleY}) translate(${-originX} ${-originY})`,
  );
  element.removeAttribute("style");
  return true;
};

export function sanitizeMusicSvg(svg: string): string | null {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (parsed.querySelector("parsererror")) return null;
  parsed
    .querySelectorAll("style, title")
    .forEach((element) => element.remove());
  parsed.documentElement.removeAttribute("style");
  for (const element of parsed.querySelectorAll("*")) {
    if (!normalizeAbcjsScaleStyle(element)) return null;
    for (const attribute of [...element.attributes]) {
      if (
        attribute.name.startsWith("data-") ||
        attribute.name === "selectable" ||
        attribute.name === "text-decoration"
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  const normalized = new XMLSerializer().serializeToString(
    parsed.documentElement,
  );
  const sanitized = sanitizeSvgBytes(encoder.encode(normalized));
  return sanitized ? decoder.decode(sanitized) : null;
}

export type MusicTimelineEvent = {
  index: number;
  seconds: number;
  measure: number;
  cursorClass: string;
  pitches: number[];
};

export type RenderedMusicScore = {
  markup: string[];
  timeline: MusicTimelineEvent[];
  visual: TuneObject;
};

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
): Promise<RenderedMusicScore> {
  const { default: abcjs } = await import("abcjs");
  const target = document.createElement("div");
  const displayAbc = musicAbcForDisplay(block);
  const ratio = block.display.sizePercent / 100;
  const visual = abcjs.renderAbc(target, displayAbc, {
    add_classes: false,
    ariaLabel: block.label,
    foregroundColor: "currentColor",
    responsive: "resize",
    scale: ratio,
    staffwidth: Math.round(740 / ratio),
    stop_on_warning: true,
  })[0];
  if (!visual) throw new Error("abcjs did not produce a visual score");
  // abcjs computes MIDI pitches while building its local audio sequence.
  // This performs no playback or network access and feeds both the keyboard
  // learning view and the timing cursor from the same parsed tune.
  visual.setUpAudio({});
  const timingEvents = visual.setTiming() as unknown as NoteTimingEvent[];
  const timeline = timingEvents
    .filter((event) => event.type === "event" && event.elements?.length)
    .map((event, index) => {
      const cursorClass = `fnf-music-cursor-${index}`;
      for (const group of event.elements ?? []) {
        for (const element of group) element.classList.add(cursorClass);
      }
      return {
        index,
        seconds: event.milliseconds / 1_000,
        measure: (event.measureNumber ?? 0) + 1,
        cursorClass,
        pitches: [
          ...new Set(
            (event.midiPitches ?? [])
              .map(({ pitch }) => pitch)
              .filter((pitch) => pitch >= 21 && pitch <= 108),
          ),
        ],
      };
    });
  const rendered = [...target.querySelectorAll("svg")].map((svg) =>
    sanitizeMusicSvg(new XMLSerializer().serializeToString(svg)),
  );
  if (!rendered.length || rendered.some((svg) => !svg)) {
    throw new Error("abcjs produced unsupported or unsafe SVG output");
  }
  return { markup: rendered as string[], timeline, visual };
}
