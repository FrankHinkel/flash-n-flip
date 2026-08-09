"use client";

import { ArrowLeftRight, Dices, Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  createNumberPracticeSequence,
  formatNumberDigits,
  numberLanguages,
  numberLanguage,
  numberPracticeRanges,
  resolveDefaultNumberLocale,
  spellNumber,
  type NumberLocale,
  type NumberPracticeMaximum,
} from "@flashcards/domain/numbers";

import { useI18n } from "./i18n-provider";

const secureRandom = (): number => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0]! / 2 ** 32;
};

const optionLabel = (locale: NumberLocale): string => {
  const language = numberLanguage(locale);
  return `${language.nativeName} · ${language.englishName}`;
};

export function NumberGenerator() {
  const { locale: uiLocale, text } = useI18n();
  const defaultSource = resolveDefaultNumberLocale(uiLocale);
  const [sourceLocale, setSourceLocale] = useState<NumberLocale>(defaultSource);
  const [targetLocale, setTargetLocale] = useState<NumberLocale>(
    defaultSource === "en-US" ? "de-DE" : "en-US",
  );
  const [value, setValue] = useState(42);
  const [inputValue, setInputValue] = useState("42");
  const [rangeMaximum, setRangeMaximum] = useState<NumberPracticeMaximum>(100);
  const [practiceSequence, setPracticeSequence] = useState<number[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [sourceWords, setSourceWords] = useState("");
  const [targetWords, setTargetWords] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const source = resolveDefaultNumberLocale(uiLocale);
    setSourceLocale(source);
    setTargetLocale(source === "en-US" ? "de-DE" : "en-US");
    setRevealed(false);
  }, [uiLocale]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void Promise.all([
      spellNumber(value, sourceLocale),
      spellNumber(value, targetLocale),
    ])
      .then(([source, target]) => {
        if (!active) return;
        setSourceWords(source);
        setTargetWords(target);
      })
      .catch(() => {
        if (active) {
          setError(
            text(
              "This number could not be generated.",
              "Diese Zahl konnte nicht erzeugt werden.",
            ),
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sourceLocale, targetLocale, text, value]);

  const orderedLanguages = useMemo(
    () =>
      [...numberLanguages].sort((left, right) =>
        optionLabel(left.locale).localeCompare(
          optionLabel(right.locale),
          uiLocale,
        ),
      ),
    [uiLocale],
  );
  const sourceLanguage = numberLanguage(sourceLocale);
  const targetLanguage = numberLanguage(targetLocale);

  useEffect(() => {
    const sequence = createNumberPracticeSequence(100, secureRandom);
    setPracticeSequence(sequence);
    setPracticeIndex(0);
    chooseValue(sequence[0]!);
  }, []);

  function chooseValue(next: number) {
    if (!Number.isSafeInteger(next) || next < 1 || next > rangeMaximum) return;
    setValue(next);
    setInputValue(String(next));
    setRevealed(false);
  }

  function startSequence(maximum: NumberPracticeMaximum) {
    const sequence = createNumberPracticeSequence(maximum, secureRandom);
    setRangeMaximum(maximum);
    setPracticeSequence(sequence);
    setPracticeIndex(0);
    setValue(sequence[0]!);
    setInputValue(String(sequence[0]!));
    setRevealed(false);
  }

  function chooseNextValue() {
    const nextIndex = practiceIndex + 1;
    if (nextIndex < practiceSequence.length) {
      setPracticeIndex(nextIndex);
      chooseValue(practiceSequence[nextIndex]!);
      return;
    }
    startSequence(rangeMaximum);
  }

  return (
    <main className="number-generator-page">
      <header className="number-generator-header">
        <span className="eyebrow">
          {text("Virtual language collection", "Virtuelle Sprachcollection")}
        </span>
        <h1>{text("Numbers across languages", "Zahlen in vielen Sprachen")}</h1>
        <p>
          {text(
            "Choose any two available main languages. No deck or audio is downloaded: every number is generated locally only when needed.",
            "Wähle zwei beliebige verfügbare Hauptsprachen. Es werden weder Lernsets noch Audios geladen: Jede Zahl entsteht erst bei Bedarf lokal.",
          )}
        </p>
      </header>

      <section
        className="number-generator-controls"
        aria-label={text("Generator settings", "Generator-Einstellungen")}
      >
        <label>
          <span>{text("Source language", "Ausgangssprache")}</span>
          <select
            value={sourceLocale}
            onChange={(event) => {
              const next = event.target.value as NumberLocale;
              setSourceLocale(next);
              if (next === targetLocale) setTargetLocale(sourceLocale);
              setRevealed(false);
            }}
          >
            {orderedLanguages.map((language) => (
              <option
                key={language.locale}
                value={language.locale}
                disabled={language.locale === targetLocale}
              >
                {optionLabel(language.locale)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button button-quiet number-language-swap"
          aria-label={text("Swap languages", "Sprachen tauschen")}
          onClick={() => {
            setSourceLocale(targetLocale);
            setTargetLocale(sourceLocale);
            setRevealed(false);
          }}
        >
          <ArrowLeftRight aria-hidden="true" />
        </button>
        <label>
          <span>{text("Target language", "Zielsprache")}</span>
          <select
            value={targetLocale}
            onChange={(event) => {
              setTargetLocale(event.target.value as NumberLocale);
              setRevealed(false);
            }}
          >
            {orderedLanguages.map((language) => (
              <option
                key={language.locale}
                value={language.locale}
                disabled={language.locale === sourceLocale}
              >
                {optionLabel(language.locale)}
              </option>
            ))}
          </select>
        </label>
        <label className="number-range-field">
          <span>{text("Number space", "Zahlenraum")}</span>
          <select
            value={rangeMaximum}
            onChange={(event) => {
              const maximum = Number(event.target.value);
              if (
                numberPracticeRanges.includes(maximum as NumberPracticeMaximum)
              ) {
                startSequence(maximum as NumberPracticeMaximum);
              }
            }}
          >
            {numberPracticeRanges.map((maximum) => (
              <option key={maximum} value={maximum}>
                1–{formatNumberDigits(maximum, defaultSource)}
              </option>
            ))}
          </select>
        </label>
        <label className="number-value-field">
          <span>
            {text("Current number", "Aktuelle Zahl")} · {practiceIndex + 1}/
            {practiceSequence.length || rangeMaximum}
          </span>
          <input
            type="number"
            min={1}
            max={rangeMaximum}
            step={1}
            inputMode="numeric"
            value={inputValue}
            onChange={(event) => {
              const nextInput = event.target.value;
              setInputValue(nextInput);
              const next = Number(nextInput);
              if (
                nextInput !== "" &&
                Number.isSafeInteger(next) &&
                next >= 1 &&
                next <= rangeMaximum
              ) {
                setValue(next);
                setRevealed(false);
              }
            }}
            onBlur={() => setInputValue(String(value))}
          />
        </label>
        <button
          type="button"
          className="button button-quiet"
          onClick={chooseNextValue}
        >
          <Dices aria-hidden="true" />
          {text("Next number", "Nächste Zahl")}
        </button>
      </section>

      <section
        className="number-generator-card"
        data-number-card
        aria-live="polite"
        aria-busy={loading}
      >
        <div className="number-card-side">
          <span>{sourceLanguage.nativeName}</span>
          <strong dir={sourceLanguage.direction}>
            {formatNumberDigits(value, sourceLocale)}
          </strong>
          <p lang={sourceLocale} dir={sourceLanguage.direction}>
            {loading ? "…" : sourceWords}
          </p>
        </div>
        <div className="number-card-divider" aria-hidden="true">
          →
        </div>
        <div
          className={`number-card-side number-card-answer${revealed ? " revealed" : ""}`}
        >
          <span>{targetLanguage.nativeName}</span>
          {revealed ? (
            <>
              <strong dir={targetLanguage.direction}>
                {formatNumberDigits(value, targetLocale)}
              </strong>
              <p lang={targetLocale} dir={targetLanguage.direction}>
                {loading ? "…" : targetWords}
              </p>
            </>
          ) : (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setRevealed(true)}
              disabled={loading || Boolean(error)}
            >
              <Eye aria-hidden="true" />
              {text("Show answer", "Antwort zeigen")}
            </button>
          )}
        </div>
      </section>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="number-generator-note">
        {rangeMaximum <= 100
          ? text(
              "Each number appears exactly once per round.",
              "Jede Zahl erscheint pro Runde genau einmal.",
            )
          : text(
              "Each round contains 100 different random numbers and covers all structural forms.",
              "Jede Runde enthält 100 unterschiedliche Zufallszahlen und deckt alle Bauformen ab.",
            )}{" "}
        {text(
          `${numberLanguages.length} main languages are currently supported. Additional Xefjord languages will appear only after their number rules have been verified.`,
          `${numberLanguages.length} Hauptsprachen werden derzeit unterstützt. Weitere Xefjord-Sprachen erscheinen erst nach Prüfung ihrer Zahlregeln.`,
        )}
      </p>
    </main>
  );
}
