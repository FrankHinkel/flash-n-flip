"use client";

import { useId } from "react";

const commonLanguageLocales = [
  "de",
  "en",
  "es",
  "fr",
  "it",
  "pt",
  "nl",
  "pl",
  "ru",
  "uk",
  "tr",
  "ar",
  "he",
  "hi",
  "zh",
  "ja",
  "ko",
  "sv",
  "da",
  "no",
  "fi",
  "cs",
  "el",
  "ro",
  "hu",
  "id",
  "th",
  "vi",
] as const;

const languageOptions = (uiLocale: string, current: string[]) => {
  const displayNames = new Intl.DisplayNames([uiLocale], { type: "language" });
  return [...new Set([...commonLanguageLocales, ...current])]
    .map((locale) => ({
      locale,
      label: displayNames.of(locale) ?? locale.toUpperCase(),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, uiLocale));
};

export function LanguageDirectionFields({
  sourceLocale,
  targetLocale,
  onSourceLocaleChange,
  onTargetLocaleChange,
  uiLocale,
  disabled = false,
}: {
  sourceLocale: string;
  targetLocale: string;
  onSourceLocaleChange: (locale: string) => void;
  onTargetLocaleChange: (locale: string) => void;
  uiLocale: string;
  disabled?: boolean;
}) {
  const descriptionId = useId();
  const options = languageOptions(uiLocale, [sourceLocale, targetLocale]);
  const germanUi = uiLocale === "de";
  const sameLanguage = sourceLocale === targetLocale;

  return (
    <fieldset
      className="language-direction-fields"
      aria-describedby={descriptionId}
      disabled={disabled}
    >
      <legend>{germanUi ? "Sprachrichtung" : "Language direction"}</legend>
      <div>
        <label>
          {germanUi
            ? "Quellsprache (Frage/Vorderseite)"
            : "Source language (question/front)"}
          <select
            value={sourceLocale}
            onChange={(event) => onSourceLocaleChange(event.target.value)}
            required
          >
            {options.map((option) => (
              <option key={option.locale} value={option.locale}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {germanUi
            ? "Zielsprache (Antwort/Rückseite)"
            : "Target language (answer/back)"}
          <select
            value={targetLocale}
            onChange={(event) => onTargetLocaleChange(event.target.value)}
            required
          >
            {options.map((option) => (
              <option key={option.locale} value={option.locale}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <small id={descriptionId}>
        {sameLanguage
          ? germanUi
            ? "Gleiche Sprache auf beiden Seiten: Das Lernset wird nicht als Übersetzung behandelt."
            : "The same language is used on both sides, so the deck is not treated as a translation."
          : germanUi
            ? "Diese Zuordnung steuert unter anderem die passende Stimme für Frage und Antwort."
            : "This direction controls the matching voice for the question and answer, among other behavior."}
      </small>
    </fieldset>
  );
}
