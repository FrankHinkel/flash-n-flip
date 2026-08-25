import {
  musicScoreBlockSchema,
  prepareMusicScoreAbcBook,
  validateMusicScoreAbc,
  type MusicScoreBlock,
} from "@flashcards/domain/music-score";
import { translateUiMessage, type Locale } from "@flashcards/i18n";

import {
  parseMediaPresentationDetailed,
  type MediaPresentation,
} from "./media-presentation";

export type MusicScoreSource = MusicScoreBlock & {
  locale: Locale;
  presentation: MediaPresentation;
};

export type MusicScorePresentation = MediaPresentation & {
  selectedVoice?: string;
  keyboard: "off" | "keys" | "notes";
  barsPerLine: "auto" | number;
};

export type MusicScorePresentationParseResult =
  | {
      success: true;
      presentation: MusicScorePresentation;
      diagnostics: readonly string[];
    }
  | { success: false; error: string };

const musicPresentationKeys = new Set(["select", "keyboard", "bars"]);

export function parseMusicScorePresentationDetailed(
  value: unknown,
): MusicScorePresentationParseResult {
  const parsed = parseMediaPresentationDetailed(value, musicPresentationKeys);
  if (!parsed.success) return parsed;
  const presentation: MusicScorePresentation = {
    ...parsed.presentation,
    keyboard: "notes",
    barsPerLine: "auto",
  };
  const diagnostics = [...parsed.diagnostics];
  const select = parsed.extras.select;
  if (select !== undefined) {
    if (!/^[A-Za-z0-9_-]{1,24}$/u.test(select))
      diagnostics.push(
        "select contains an invalid voice name. All voices are used.",
      );
    else presentation.selectedVoice = select;
  }
  const keyboard = parsed.extras.keyboard;
  if (keyboard !== undefined) {
    if (keyboard !== "off" && keyboard !== "keys" && keyboard !== "notes")
      diagnostics.push(
        "keyboard must be off, keys, or notes. The default value is used.",
      );
    else presentation.keyboard = keyboard;
  }
  const bars = parsed.extras.bars;
  if (bars !== undefined) {
    if (bars === "auto") presentation.barsPerLine = "auto";
    else if (/^(?:[1-9]|1[0-2])$/u.test(bars))
      presentation.barsPerLine = Number(bars);
    else
      diagnostics.push(
        "bars must be auto or a number from 1 to 12. The default value is used.",
      );
  }
  return { success: true, presentation, diagnostics };
}

export function parseMusicScorePresentation(
  value: unknown,
): MusicScorePresentation | null {
  const parsed = parseMusicScorePresentationDetailed(value);
  return parsed.success ? parsed.presentation : null;
}

const titleFromAbc = (source: string): string | undefined =>
  source
    .split(/\r?\n/u)
    .map((line) => line.match(/^T:\s*(.+)$/u)?.[1]?.trim())
    .find(Boolean);

const musicScoreFromPreparedAbc = (
  abc: string,
  locale: Locale,
  metadata?: unknown,
): MusicScoreSource | null => {
  try {
    const metrics = validateMusicScoreAbc(abc);
    const presentation = parseMusicScorePresentation(metadata);
    if (!presentation) return null;
    const label =
      titleFromAbc(abc) ?? translateUiMessage(locale, "rich.music.label");
    const clefs = new Set(Object.values(metrics.voiceClefs));
    const clefDescription =
      clefs.size > 1
        ? translateUiMessage(locale, "rich.music.clefs.both")
        : metrics.clef === "bass"
          ? translateUiMessage(locale, "rich.music.clefs.bass")
          : translateUiMessage(locale, "rich.music.clefs.treble");
    const description = metrics.meter
      ? translateUiMessage(locale, "rich.music.descriptionWithMeter", [
          metrics.eventCount,
          metrics.measureCount,
          metrics.keySignature,
          metrics.meter,
          clefDescription,
        ])
      : translateUiMessage(locale, "rich.music.description", [
          metrics.eventCount,
          metrics.measureCount,
          metrics.keySignature,
          clefDescription,
        ]);
    const parsed = musicScoreBlockSchema.safeParse({
      type: "musicScore",
      version: 1,
      abc,
      label,
      description,
      display: {
        staffScale: "normal",
        sizePercent: presentation.sizePercent,
        keyboard: presentation.keyboard,
        barsPerLine: presentation.barsPerLine,
        ...(presentation.selectedVoice
          ? { selectedVoice: presentation.selectedVoice }
          : {}),
        responsive: true,
      },
    });
    return parsed.success
      ? {
          ...parsed.data,
          locale,
          presentation: {
            sizePercent: presentation.sizePercent,
            width: presentation.width,
            height: presentation.height,
            background: presentation.background,
          },
        }
      : null;
  } catch {
    return null;
  }
};

export function musicScoresFromMarkdownSource(
  value: string,
  locale: Locale,
  metadata?: unknown,
): MusicScoreSource[] {
  try {
    const tunes = prepareMusicScoreAbcBook(value);
    const scores = tunes.map((abc) =>
      musicScoreFromPreparedAbc(abc, locale, metadata),
    );
    return scores.every((score): score is MusicScoreSource => score !== null)
      ? scores
      : [];
  } catch {
    return [];
  }
}

export function musicScoreFromMarkdownSource(
  value: string,
  locale: Locale,
  metadata?: unknown,
): MusicScoreSource | null {
  const scores = musicScoresFromMarkdownSource(value, locale, metadata);
  return scores.length === 1 ? scores[0]! : null;
}
