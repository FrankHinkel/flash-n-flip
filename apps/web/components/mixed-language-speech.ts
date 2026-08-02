export type SpeechSegment = {
  text: string;
  locale: string;
};

const language = (locale: string): string =>
  locale.trim().replace("_", "-").toLocaleLowerCase().split("-")[0] ?? "";

const words = (value: string): string[] =>
  value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .match(/\p{L}+/gu) ?? [];

const wordProfiles: Record<string, ReadonlySet<string>> = Object.fromEntries(
  Object.entries({
    de: "der die das den dem des ein eine einen einem einer und oder aber ist sind war waren sein haben werden ich du er sie es wir ihr nicht kein mit von zu fur auf in im am an als wie wenn weil dass damit etwas mussen tun zeit eigenschaft zustand ort ziel mehr noch gleich sonst spater hinweis beispiel anm wird werden wurde welche auch sich",
    es: "el la los las un una unos unas y o pero es son ser estar haber hacer tener tengo tienes tiene tenemos tienen ir ver dar saber todo toda todos todas mismo misma que de del a al en con por para como si no mas muy algo alguien aqui hay quiero quiere poder deber necesitar esto esta este esa ese sus se lo le las verdad curso",
    en: "the a an and or but is are was were be have has do does i you he she it we they not with from to for on in as if because this that these those more example note",
    fr: "le la les un une des et ou mais est sont etre avoir je tu il elle nous vous ils pas avec de du a au en comme si parce que ce cette ces exemple remarque",
    it: "il lo la i gli le un una e o ma e sono essere avere io tu lui lei noi voi loro non con di da a in come se perche questo questa esempio nota",
    pt: "o a os as um uma e ou mas e sao ser estar ter eu tu ele ela nos voces eles nao com de do da em como se porque este esta exemplo nota",
    nl: "de het een en of maar is zijn was waren hebben ik jij hij zij wij niet met van naar voor op in als omdat dit dat deze voorbeeld opmerking",
  }).map(([locale, profile]) => [locale, new Set(profile.split(/\s+/))]),
) as Record<string, ReadonlySet<string>>;

const scriptPatterns: Record<string, RegExp> = {
  ar: /\p{Script=Arabic}/gu,
  el: /\p{Script=Greek}/gu,
  he: /\p{Script=Hebrew}/gu,
  hi: /\p{Script=Devanagari}/gu,
  ja: /[\p{Script=Hiragana}\p{Script=Katakana}]/gu,
  ko: /\p{Script=Hangul}/gu,
  ru: /\p{Script=Cyrillic}/gu,
  th: /\p{Script=Thai}/gu,
  uk: /\p{Script=Cyrillic}/gu,
  zh: /\p{Script=Han}/gu,
};

const score = (value: string, locale: string): number => {
  const base = language(locale);
  const profile = wordProfiles[base];
  let result = profile
    ? words(value).reduce(
        (total, word) => total + (profile.has(word) ? 3 : 0),
        0,
      )
    : 0;
  const script = scriptPatterns[base];
  if (script) result += (value.match(script)?.length ?? 0) * 2;
  if (base === "de") {
    result += (value.match(/[äöüß]/giu)?.length ?? 0) * 2;
    result += words(value).filter((word) =>
      /(?:ung|heit|keit|schaft|chen|lich|isch)$/.test(word),
    ).length;
  }
  if (base === "es") {
    result += (value.match(/[¿¡ñ]/giu)?.length ?? 0) * 3;
    result += words(value).filter((word) =>
      /(?:cion|ado|ido|ando|iendo|mente)$/.test(word),
    ).length;
  }
  return result;
};

const sentenceParts = (value: string): string[] => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (typeof Intl.Segmenter === "function") {
    return [
      ...new Intl.Segmenter(undefined, { granularity: "sentence" }).segment(
        normalized,
      ),
    ]
      .map((entry) => entry.segment.trim())
      .filter(Boolean);
  }
  return (
    normalized.match(/[^.!?…]+[.!?…]*/g)?.map((part) => part.trim()) ?? [
      normalized,
    ]
  );
};

const candidateParts = (value: string): string[] => {
  const parts: string[] = [];
  const protectedPart =
    /(\([^()]{1,800}\)|\[[^\[\]]{1,800}\]|«[^»]{1,800}»|“[^”]{1,800}”|"[^"\n]{1,800}")/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = protectedPart.exec(value))) {
    parts.push(...sentenceParts(value.slice(cursor, match.index)));
    const protectedText = match[0].replace(/\s+/g, " ").trim();
    if (protectedText) parts.push(protectedText);
    cursor = match.index + match[0].length;
  }
  parts.push(...sentenceParts(value.slice(cursor)));
  return parts;
};

export function segmentSpeechTextByLanguage(
  value: string,
  primaryLocale: string,
  alternateLocale?: string,
): SpeechSegment[] {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return [];
  if (
    !alternateLocale ||
    language(primaryLocale) === language(alternateLocale)
  ) {
    return [{ text, locale: primaryLocale }];
  }

  const candidates = candidateParts(text);
  const detected = candidates.map((part) => {
    const primaryScore = score(part, primaryLocale);
    const alternateScore = score(part, alternateLocale);
    if (primaryScore >= 3 && primaryScore - alternateScore >= 2) {
      return primaryLocale;
    }
    if (alternateScore >= 3 && alternateScore - primaryScore >= 2) {
      return alternateLocale;
    }
    return null;
  });
  const resolved = detected.map((locale, index) => {
    if (locale) return locale;
    const previous = detected.slice(0, index).findLast(Boolean);
    const next = detected.slice(index + 1).find(Boolean);
    return previous ?? next ?? primaryLocale;
  });
  const segments: SpeechSegment[] = [];
  candidates.forEach((part, index) => {
    const locale = resolved[index] ?? primaryLocale;
    const previous = segments.at(-1);
    if (previous?.locale === locale) {
      previous.text = `${previous.text} ${part}`.replace(/\s+/g, " ").trim();
    } else {
      segments.push({ text: part, locale });
    }
  });
  return segments;
}
