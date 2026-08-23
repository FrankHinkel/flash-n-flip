import {
  musicScoreBlockSchema,
  validateMusicScoreAbc,
  type MusicScoreBlock,
} from "@flashcards/domain/music-score";

export type MusicScoreSource = MusicScoreBlock & { locale: "en" | "de" };

export type MusicScorePresentation = {
  sizePercent: number;
  selectedVoice?: string;
  keyboard: "off" | "keys" | "notes";
};

export function parseMusicScorePresentation(
  value: unknown,
): MusicScorePresentation | null {
  if (value === undefined || value === null || value === "") {
    return { sizePercent: 100, keyboard: "notes" };
  }
  if (typeof value !== "string" || value.length > 200) return null;
  const match = value.trim().match(/^\{([^{}]*)\}$/u);
  if (!match) return null;
  const presentation: MusicScorePresentation = {
    sizePercent: 100,
    keyboard: "notes",
  };
  const seen = new Set<string>();
  for (const token of match[1]!.trim().split(/\s+/u).filter(Boolean)) {
    const pair = token.match(/^([a-z]+)=(\S+)$/iu);
    if (!pair) return null;
    const key = pair[1]!.toLowerCase();
    const option = pair[2]!;
    if (seen.has(key)) return null;
    seen.add(key);
    if (key === "size") {
      const size = option.match(/^(50|5[1-9]|[6-9][0-9]|1[01][0-9]|120)%$/u);
      if (!size) return null;
      presentation.sizePercent = Number(size[1]);
    } else if (key === "select") {
      if (!/^[A-Za-z0-9_-]{1,24}$/u.test(option)) return null;
      presentation.selectedVoice = option;
    } else if (key === "keyboard") {
      if (option !== "off" && option !== "keys" && option !== "notes")
        return null;
      presentation.keyboard = option;
    } else {
      return null;
    }
  }
  return presentation;
}

const titleFromAbc = (source: string): string | undefined =>
  source
    .split(/\r?\n/u)
    .map((line) => line.match(/^T:\s*(.+)$/u)?.[1]?.trim())
    .find(Boolean);

export function musicScoreFromMarkdownSource(
  value: string,
  locale: "en" | "de",
  metadata?: unknown,
): MusicScoreSource | null {
  try {
    const abc = value.replaceAll("\r\n", "\n").trim();
    const metrics = validateMusicScoreAbc(abc);
    const presentation = parseMusicScorePresentation(metadata);
    if (!presentation) return null;
    const label =
      titleFromAbc(abc) ?? (locale === "de" ? "Notensatz" : "Music notation");
    const clefs = new Set(Object.values(metrics.voiceClefs));
    const clefDescription =
      clefs.size > 1
        ? locale === "de"
          ? "Violin- und Bassschlüssel"
          : "treble and bass clefs"
        : metrics.clef === "bass"
          ? locale === "de"
            ? "Bassschlüssel"
            : "bass clef"
          : locale === "de"
            ? "Violinschlüssel"
            : "treble clef";
    const description =
      locale === "de"
        ? `${metrics.eventCount} musikalische Ereignisse in ${metrics.measureCount} Takten. Tonart ${metrics.keySignature}, ${metrics.meter ? `Taktart ${metrics.meter}, ` : ""}${clefDescription}.`
        : `${metrics.eventCount} musical events in ${metrics.measureCount} measures. Key ${metrics.keySignature}, ${metrics.meter ? `meter ${metrics.meter}, ` : ""}${clefDescription}.`;
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
        ...(presentation.selectedVoice
          ? { selectedVoice: presentation.selectedVoice }
          : {}),
        responsive: true,
      },
    });
    return parsed.success ? { ...parsed.data, locale } : null;
  } catch {
    return null;
  }
}
