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
      setInstallStatus(
        text(
          "The language combination is installed. Existing progress was preserved.",
          "Die Sprachkombination ist installiert. Vorhandener Lernfortschritt blieb erhalten.",
        ),
      );
    } catch {
      setError(
        text(
          "The number collection could not be installed.",
          "Die Zahlen-Collection konnte nicht installiert werden.",
        ),
      );
    } finally {
      setInstalling(false);
    }
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
            "Configure a language direction and install it as a normal collection. Exercises are generated only when they become due, while progress remains attached to stable categories.",
            "Konfiguriere eine Sprachrichtung und installiere sie als normale Collection. Aufgaben werden erst bei Fälligkeit erzeugt, der Lernfortschritt bleibt stabilen Kategorien zugeordnet.",
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
            {text("Current number", "Aktuelle Zahl")} · {practiceIndex + 1}/
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
          {text("Next number", "Nächste Zahl")}
        </button>
      </section>

      <section className="number-generator-install" aria-live="polite">
        <div>
          <strong>
            {text(
              `${sourceLanguage.nativeName} to ${targetLanguage.nativeName}`,
              `${sourceLanguage.nativeName} → ${targetLanguage.nativeName}`,
            )}
          </strong>
          <span>
            {text(
              "Each language direction keeps its own category progress.",
              "Jede Sprachrichtung behält ihren eigenen Kategorienfortschritt.",
            )}
          </span>
        </div>
        <button
          type="button"
          className="button button-primary"
          onClick={() => void installCollection()}
          disabled={installing}
        >
          <Download aria-hidden="true" />
          {installing
            ? text("Installing …", "Wird installiert …")
            : installedDeckId
              ? text(
                  "Add or update direction",
                  "Richtung hinzufügen/aktualisieren",
                )
              : text("Install collection", "Collection installieren")}
        </button>
        {installedDeckId ? (
          <Link
            className="button button-quiet"
            href={`/app/decks?expand=${installedDeckId}`}
          >
            <Check aria-hidden="true" />
            {text("Open in Decks", "Unter Decks öffnen")}
          </Link>
        ) : null}
        {installedPairDeckId ? (
          <Link
            className="button button-quiet"
            href={`/app/learn?deckId=${installedPairDeckId}`}
          >
            {text("Study this direction", "Diese Richtung lernen")}
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
        {text(
          "The preview does not change progress. Installed decks rate stable competency slots; their concrete numbers change after a review.",
          "Die Vorschau verändert keinen Fortschritt. Installierte Decks bewerten stabile Kompetenzplätze; deren konkrete Zahlen wechseln nach einer Bewertung.",
        )}{" "}
        {text(
          `${numberLanguages.length} main languages are currently supported. Additional Xefjord languages will appear only after their number rules have been verified.`,
          `${numberLanguages.length} Hauptsprachen werden derzeit unterstützt. Weitere Xefjord-Sprachen erscheinen erst nach Prüfung ihrer Zahlregeln.`,
        )}
      </p>
    </main>
  );
}
