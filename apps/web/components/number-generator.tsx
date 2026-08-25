"use client";

import { ArrowLeftRight, Check, Dices, Download, Eye } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  createNumberPracticeSequence,
  formatNumberDigits,
  numberPracticeSequenceVersion,
  numberLanguages,
  numberLanguage,
  numberPracticeRanges,
  resolveDefaultNumberLocale,
  spellNumber,
  type NumberLocale,
  type NumberPracticeMaximum,
} from "@flashcards/domain/numbers";

import {
  installLocalNumberCollection,
  localNumberCollectionTemplate,
} from "../lib/local-product-repository";
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

const sequenceStorageKey = (maximum: NumberPracticeMaximum): string =>
  `flash-n-flip.number-practice.v${numberPracticeSequenceVersion}.${maximum}`;

const expectedSequenceLength = (maximum: NumberPracticeMaximum): number =>
  maximum === 10 ? 11 : maximum === 100 ? 37 : 100;

const validStoredSequence = (
  maximum: NumberPracticeMaximum,
  sequence: unknown,
  index: unknown,
): sequence is number[] =>
  Array.isArray(sequence) &&
  sequence.length === expectedSequenceLength(maximum) &&
  new Set(sequence).size === sequence.length &&
  sequence.every(
    (entry) =>
      Number.isSafeInteger(entry) &&
      entry >= (maximum <= 100 ? 0 : 1) &&
      entry <= maximum,
  ) &&
  Number.isSafeInteger(index) &&
  Number(index) >= 0 &&
  Number(index) < sequence.length;

export function NumberGenerator() {
  const { locale: uiLocale, text } = useI18n();
  const defaultSource = resolveDefaultNumberLocale(uiLocale);
  const [sourceLocale, setSourceLocale] = useState<NumberLocale>(defaultSource);
  const [targetLocale, setTargetLocale] = useState<NumberLocale>(
    defaultSource === "en-US" ? "de-DE" : "en-US",
  );
  const [value, setValue] = useState(0);
  const [inputValue, setInputValue] = useState("0");
  const [rangeMaximum, setRangeMaximum] = useState<NumberPracticeMaximum>(100);
  const [practiceSequence, setPracticeSequence] = useState<number[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [sourceWords, setSourceWords] = useState("");
  const [targetWords, setTargetWords] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [installedDeckId, setInstalledDeckId] = useState<string | null>(null);
  const [installedPairDeckId, setInstalledPairDeckId] = useState<string | null>(
    null,
  );
  const [installing, setInstalling] = useState(false);
  const [installStatus, setInstallStatus] = useState("");

  useEffect(() => {
    let active = true;
    const refresh = () =>
      void localNumberCollectionTemplate()
        .then((template) => {
          if (active) setInstalledDeckId(template.installedDeckId);
        })
        .catch(() => {});
    refresh();
    window.addEventListener("flash-n-flip:decks-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("flash-n-flip:decks-changed", refresh);
    };
  }, []);

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
          setError(text("legacy.fce677df2d11"));
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
    resumeSequence(100);
  }, []);

  function chooseValue(next: number) {
    if (!Number.isSafeInteger(next) || next < 0 || next > rangeMaximum) return;
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
    localStorage.setItem(
      sequenceStorageKey(maximum),
      JSON.stringify({ sequence, index: 0 }),
    );
  }

  function resumeSequence(maximum: NumberPracticeMaximum) {
    try {
      const stored = JSON.parse(
        localStorage.getItem(sequenceStorageKey(maximum)) ?? "null",
      ) as { sequence?: unknown; index?: unknown } | null;
      if (
        stored &&
        validStoredSequence(maximum, stored.sequence, stored.index)
      ) {
        const index = Number(stored.index);
        setRangeMaximum(maximum);
        setPracticeSequence(stored.sequence);
        setPracticeIndex(index);
        setValue(stored.sequence[index]!);
        setInputValue(String(stored.sequence[index]!));
        setRevealed(false);
        return;
      }
    } catch {
      // A damaged local preview round is safely replaced below.
    }
    startSequence(maximum);
  }

  function chooseNextValue() {
    const nextIndex = practiceIndex + 1;
    if (nextIndex < practiceSequence.length) {
      setPracticeIndex(nextIndex);
      chooseValue(practiceSequence[nextIndex]!);
      localStorage.setItem(
        sequenceStorageKey(rangeMaximum),
        JSON.stringify({ sequence: practiceSequence, index: nextIndex }),
      );
      return;
    }
    startSequence(rangeMaximum);
  }

  async function installCollection() {
    setInstalling(true);
    setError("");
    setInstallStatus("");
    try {
      const result = await installLocalNumberCollection({
        sourceLocale,
        targetLocale,
        maximum: rangeMaximum,
        uiLocale: uiLocale === "de" ? "de" : "en",
      });
      setInstalledDeckId(result.selectedDeckId);
      setInstalledPairDeckId(result.pairDeckId);
      window.dispatchEvent(new CustomEvent("flash-n-flip:decks-changed"));
      setInstallStatus(text("legacy.36d1104a4e31"));
    } catch {
      setError(text("legacy.a96431cb8034"));
    } finally {
      setInstalling(false);
    }
  }

  return (
    <main className="number-generator-page">
      <header className="number-generator-header">
        <span className="eyebrow">{text("legacy.a088efe14bba")}</span>
        <h1>{text("legacy.9d9809fb87c7")}</h1>
        <p>{text("legacy.d662a764268f")}</p>
      </header>

      <section
        className="number-generator-controls"
        aria-label={text("legacy.de6a3ecc72a8")}
      >
        <label>
          <span>{text("legacy.51464bd8fbba")}</span>
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
          aria-label={text("legacy.1a0b869f56aa")}
          onClick={() => {
            setSourceLocale(targetLocale);
            setTargetLocale(sourceLocale);
            setRevealed(false);
          }}
        >
          <ArrowLeftRight aria-hidden="true" />
        </button>
        <label>
          <span>{text("legacy.b8d8447ad6c8")}</span>
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
          <span>{text("legacy.3c0f6d25d8aa")}</span>
          <select
            value={rangeMaximum}
            onChange={(event) => {
              const maximum = Number(event.target.value);
              if (
                numberPracticeRanges.includes(maximum as NumberPracticeMaximum)
              ) {
                resumeSequence(maximum as NumberPracticeMaximum);
              }
            }}
          >
            {numberPracticeRanges.map((maximum) => (
              <option key={maximum} value={maximum}>
                0–{formatNumberDigits(maximum, defaultSource)}
              </option>
            ))}
          </select>
        </label>
        <label className="number-value-field">
          <span>
            {text("legacy.364b99cb7fa6")} · {practiceIndex + 1}/
            {practiceSequence.length || rangeMaximum}
          </span>
          <input
            type="number"
            min={0}
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
                next >= 0 &&
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
          {text("legacy.338acf3297a6")}
        </button>
      </section>

      <section className="number-generator-install" aria-live="polite">
        <div>
          <strong>
            {text("legacy.9c7318d5a591", [
              sourceLanguage.nativeName,
              targetLanguage.nativeName,
            ])}
          </strong>
          <span>{text("legacy.c9acea3d57e0")}</span>
        </div>
        <button
          type="button"
          className="button button-primary"
          onClick={() => void installCollection()}
          disabled={installing}
        >
          <Download aria-hidden="true" />
          {installing
            ? text("legacy.4b9c0cb20372")
            : installedDeckId
              ? text("legacy.0ee6a04994f0")
              : text("legacy.92c0875233f7")}
        </button>
        {installedDeckId ? (
          <Link
            className="button button-quiet"
            href={`/app/decks?expand=${installedDeckId}`}
          >
            <Check aria-hidden="true" />
            {text("legacy.8c2cb0d5a918")}
          </Link>
        ) : null}
        {installedPairDeckId ? (
          <Link
            className="button button-quiet"
            href={`/app/learn?deckId=${installedPairDeckId}`}
          >
            {text("legacy.72a92f8498c4")}
          </Link>
        ) : null}
        {installStatus ? <p className="form-success">{installStatus}</p> : null}
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
              {text("legacy.955f77c8a724")}
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
        {text("legacy.b61e91917468")}{" "}
        {text("legacy.45a08696fded", [numberLanguages.length])}
      </p>
    </main>
  );
}
