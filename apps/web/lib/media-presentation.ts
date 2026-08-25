export type MediaPresentationLength = {
  value: number;
  unit: "percent" | "px" | "viewportWidth" | "viewportHeight";
};

export type MediaPresentation = {
  sizePercent: number;
  width: MediaPresentationLength;
  height: MediaPresentationLength;
  background: "auto" | "transparent" | string;
};

export type MediaPresentationParseResult =
  | {
      success: true;
      presentation: MediaPresentation;
      extras: Readonly<Record<string, string>>;
      diagnostics: readonly string[];
    }
  | { success: false; error: string };

export const defaultMediaPresentation: MediaPresentation = {
  sizePercent: 100,
  width: { value: 100, unit: "percent" },
  height: { value: 50, unit: "viewportHeight" },
  background: "auto",
};

const backgroundPattern = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;
const sharedKeys = new Set(["size", "w", "h", "bg"]);

const parseLength = (
  option: string,
  axis: "w" | "h",
): MediaPresentationLength | null => {
  const match = option.match(/^([1-9][0-9]{0,3})(%|px|vw|vh)?$/iu);
  if (!match) return null;
  const value = Number(match[1]);
  const suffix = (match[2] ?? "%").toLowerCase();
  if ((suffix === "%" || suffix === "vw" || suffix === "vh") && value > 100)
    return null;
  if (suffix === "px" && (value < (axis === "h" ? 120 : 80) || value > 2000))
    return null;
  return {
    value,
    unit:
      suffix === "%"
        ? "percent"
        : suffix === "px"
          ? "px"
          : suffix === "vw"
            ? "viewportWidth"
            : "viewportHeight",
  };
};

export function parseMediaPresentationDetailed(
  value: unknown,
  allowedExtraKeys: ReadonlySet<string> = new Set(),
): MediaPresentationParseResult {
  if (value === undefined || value === null || value === "") {
    return {
      success: true,
      presentation: defaultMediaPresentation,
      extras: {},
      diagnostics: [],
    };
  }
  if (typeof value !== "string")
    return { success: false, error: "Presentation options must be text." };
  if (value.length > 200)
    return { success: false, error: "Presentation options are too long." };
  const match = value.trim().match(/^\{([^{}]*)\}$/u);
  if (!match)
    return {
      success: false,
      error: "Presentation options must be enclosed in { and }.",
    };

  const presentation: MediaPresentation = {
    sizePercent: defaultMediaPresentation.sizePercent,
    width: { ...defaultMediaPresentation.width },
    height: { ...defaultMediaPresentation.height },
    background: defaultMediaPresentation.background,
  };
  const extras: Record<string, string> = {};
  const diagnostics: string[] = [];
  const seen = new Set<string>();
  for (const token of match[1]!.trim().split(/\s+/u).filter(Boolean)) {
    const pair = token.match(/^([a-z]+)=(\S+)$/iu);
    if (!pair) {
      diagnostics.push(
        `Invalid presentation option: ${token}. The default value is used.`,
      );
      continue;
    }
    const key = pair[1]!.toLowerCase();
    const option = pair[2]!;
    if (seen.has(key)) {
      diagnostics.push(
        `Duplicate presentation option: ${key}. The first value is used.`,
      );
      continue;
    }
    seen.add(key);

    if (key === "size") {
      const size = option.match(/^([1-9][0-9]{0,2})(?:%)?$/u);
      const sizePercent = size ? Number(size[1]) : 0;
      if (sizePercent < 25 || sizePercent > 300) {
        diagnostics.push(
          "size must be between 25 and 300 percent. The default value is used.",
        );
      } else presentation.sizePercent = sizePercent;
    } else if (key === "w" || key === "h") {
      const length =
        key === "w" && option.toLowerCase() === "fill"
          ? { value: 100, unit: "percent" as const }
          : parseLength(option, key);
      if (!length) {
        diagnostics.push(
          `${key} must be a percentage or use %, px, vw, or vh within the supported range. The default value is used.`,
        );
      } else if (key === "w") presentation.width = length;
      else presentation.height = length;
    } else if (key === "bg") {
      const normalized = option.toLowerCase();
      if (
        normalized !== "auto" &&
        normalized !== "transparent" &&
        !backgroundPattern.test(normalized)
      ) {
        diagnostics.push(
          "bg must be auto, transparent, or a hexadecimal color. The default value is used.",
        );
      } else presentation.background = normalized;
    } else if (allowedExtraKeys.has(key)) {
      extras[key] = option;
    } else {
      const supported = [...sharedKeys, ...allowedExtraKeys].join(", ");
      diagnostics.push(
        `Unknown presentation option: ${key}. Supported: ${supported}. The option is ignored.`,
      );
    }
  }
  return { success: true, presentation, extras, diagnostics };
}

export const mediaPresentationLengthCss = (
  length: MediaPresentationLength,
): string =>
  `${length.value}${
    length.unit === "percent"
      ? "%"
      : length.unit === "px"
        ? "px"
        : length.unit === "viewportWidth"
          ? "vw"
          : "dvh"
  }`;

export const mediaPresentationBackground = (
  background: MediaPresentation["background"],
): string | undefined => (background === "auto" ? undefined : background);

export const mediaPresentationPercentHeightPx = (
  percent: number,
  referenceHeight: number,
): number => Math.max(120, Math.round(referenceHeight * percent * 0.01));

export const safeRichMediaErrorDetail = (cause: unknown): string => {
  if (!(cause instanceof Error)) return "";
  return cause.message
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 280);
};
