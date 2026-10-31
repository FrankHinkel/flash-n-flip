"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  numberLanguages,
  resolveDefaultNumberLocale,
  type NumberLocale,
} from "@flashcards/domain/numbers";
import {
  numberPracticeBands,
  numberPracticeValues,
  type NumberPracticeBand,
  type NumberPracticeSettings,
} from "@flashcards/domain/number-collection";
import {
  installLocalFixedNumberPractice,
  localFixedNumberPracticeSettings,
} from "../lib/local-product-repository";
import { useI18n } from "./i18n-provider";

const preferenceKey = "flash-n-flip.number-settings.v1";
const initialSettings = (
  targetLocale: NumberLocale,
): NumberPracticeSettings => ({
  targetLocale,
  bands: ["0-10"],
  allBelowHundred: false,
});

export function NumberGenerator() {
  const { locale, text } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const requestedLanguage = params.get("language");
  const [settings, setSettings] = useState<NumberPracticeSettings>(() =>
    initialSettings(locale === "en" ? "fr-FR" : "en-US"),
  );
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let next = initialSettings(
      requestedLanguage
        ? resolveDefaultNumberLocale(requestedLanguage)
        : locale === "en"
          ? "fr-FR"
          : "en-US",
    );
    try {
      const stored = JSON.parse(
        localStorage.getItem(preferenceKey) ?? "null",
      ) as NumberPracticeSettings | null;
      if (stored) {
        numberPracticeValues(stored);
        if (!requestedLanguage || stored.targetLocale === next.targetLocale)
          next = stored;
      }
    } catch {
      /* A missing/damaged device preference does not replace saved deck settings. */
    }
    setSettings(next);
    setInitialized(true);
  }, [requestedLanguage, locale]);

  const target = settings.targetLocale;
  useEffect(() => {
    if (!initialized) return;
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    setError("");
    void localFixedNumberPracticeSettings(target)
      .then((stored) => {
        if (active && stored) setSettings(stored);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [target, initialized, retry]);

  const languageOptions = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: "language" });
    return numberLanguages
      .map((language) => ({
        ...language,
        label:
          language.locale === "ko-KR"
            ? text("numbers.korean")
            : (names.of(language.locale) ?? language.nativeName),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [locale, text]);
  const count = settings.bands.length
    ? numberPracticeValues(settings).length
    : 0;
  const compactSmallCount = numberPracticeValues({
    ...settings,
    bands: ["11-100"],
    allBelowHundred: false,
  }).length;
  const busy = loading || saving;

  function toggleBand(band: NumberPracticeBand) {
    setError("");
    setSettings((previous) => ({
      ...previous,
      bands: numberPracticeBands.filter((item) =>
        item === band
          ? !previous.bands.includes(item)
          : previous.bands.includes(item),
      ),
    }));
  }

  async function start() {
    if (busy || loadFailed || !count) return;
    setSaving(true);
    setError("");
    try {
      const { deckId } = await installLocalFixedNumberPractice(
        settings,
        locale,
      );
      try {
        localStorage.setItem(preferenceKey, JSON.stringify(settings));
      } catch {
        /* The authoritative selection is already saved with the deck. */
      }
      window.dispatchEvent(new CustomEvent("flash-n-flip:decks-changed"));
      router.push(`/app/learn?deckId=${encodeURIComponent(deckId)}`);
    } catch {
      setError(text("numbers.saveError"));
      setSaving(false);
    }
  }

  return (
    <main className="number-setup-page">
      <Link className="back-link" href="/community?category=languages">
        {text("discover.category.languages")}
      </Link>
      <header>
        <h1>{text("discover.offer.numbers")}</h1>
        <p>{text("numbers.intro")}</p>
      </header>
      <form
        className="number-setup-form"
        onSubmit={(event) => {
          event.preventDefault();
          void start();
        }}
        aria-busy={busy}
      >
        <label className="number-target-field" htmlFor="number-target">
          <span>{text("numbers.target")}</span>
          <select
            id="number-target"
            value={target}
            disabled={busy}
            onChange={(event) => {
              setSettings(initialSettings(event.target.value as NumberLocale));
            }}
          >
            {languageOptions.map((language) => (
              <option key={language.locale} value={language.locale}>
                {language.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset
          disabled={busy || loadFailed}
          aria-describedby="number-scope-note"
        >
          <legend>{text("numbers.ranges")}</legend>
          {numberPracticeBands.map((band) => (
            <label className="number-range-option" key={band}>
              <input
                type="checkbox"
                checked={settings.bands.includes(band)}
                onChange={() => toggleBand(band)}
              />
              <span>
                {band === "101-1000" ? "101–1000" : band.replace("-", "–")}
              </span>
            </label>
          ))}
          {settings.bands.includes("11-100") && compactSmallCount < 90 ? (
            <label className="number-all-option">
              <input
                type="checkbox"
                checked={settings.allBelowHundred}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    allBelowHundred: event.target.checked,
                  }))
                }
              />
              <span>{text("numbers.all")}</span>
            </label>
          ) : null}
        </fieldset>
        <p id="number-scope-note" className="number-setup-hint">
          {text(
            compactSmallCount === 90 && settings.bands.includes("11-100")
              ? "numbers.fullVocabulary"
              : "numbers.compact",
          )}
        </p>
        <p className="number-setup-count" role="status">
          {count ? text("numbers.count", [count]) : text("numbers.empty")}
        </p>
        {loadFailed ? (
          <div role="alert">
            <p>{text("numbers.loadError")}</p>
            <button
              type="button"
              className="button button-quiet"
              onClick={() => setRetry((value) => value + 1)}
            >
              {text("numbers.retry")}
            </button>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="button button-primary"
          disabled={busy || loadFailed || !count}
        >
          {saving ? text("numbers.starting") : text("numbers.start")}
        </button>
        <p className="number-setup-hint">{text("numbers.saved")}</p>
      </form>
    </main>
  );
}
