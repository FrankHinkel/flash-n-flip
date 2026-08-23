"use client";

import { Music, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  musicScoreBlockSchema,
  validateMusicScoreAbc,
  type MusicScoreBlock,
} from "@flashcards/domain/music-score";

import { MusicScore } from "./music-score";
import { useI18n } from "./i18n-provider";

const example: MusicScoreBlock = {
  type: "musicScore",
  version: 1,
  abc: `X:1
T:C-Dur-Tonleiter
M:4/4
L:1/4
Q:120
K:C clef=treble
C D E F | G A B c |`,
  label: "C-Dur-Tonleiter",
  description: "Acht Viertelnoten steigen von C bis zum höheren C.",
  display: {
    staffScale: "normal",
    sizePercent: 70,
    keyboard: "notes",
    barsPerLine: "auto",
    responsive: true,
  },
};

export function MusicScoreBlockEditor({
  value,
  onChange,
  contentLocale,
}: {
  value?: MusicScoreBlock;
  onChange: (value: MusicScoreBlock | null) => void;
  contentLocale: string;
}) {
  const { text } = useI18n();
  const [draft, setDraft] = useState<MusicScoreBlock | null>(value ?? null);
  const [preview, setPreview] = useState<MusicScoreBlock | null>(value ?? null);
  const [error, setError] = useState("");
  const onChangeRef = useRef(onChange);
  const availableVoices = useMemo(() => {
    try {
      return validateMusicScoreAbc(draft?.abc ?? "").voices;
    } catch {
      return [];
    }
  }, [draft?.abc]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const next = value ?? null;
    setDraft((current) =>
      JSON.stringify(current) === JSON.stringify(next) ? current : next,
    );
    setPreview((current) =>
      JSON.stringify(current) === JSON.stringify(next) ? current : next,
    );
  }, [value]);

  useEffect(() => {
    if (!draft) return;
    const timeout = window.setTimeout(() => {
      const parsed = musicScoreBlockSchema.safeParse(draft);
      if (!parsed.success) {
        setError(
          parsed.error.issues[0]?.message ??
            text("Invalid score", "Ungültiger Notensatz"),
        );
        return;
      }
      setError("");
      setPreview(parsed.data);
      onChangeRef.current(parsed.data);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [draft, text]);

  if (!draft) {
    return (
      <button
        type="button"
        className="button button-quiet music-score-add"
        onClick={() => {
          const localized =
            contentLocale.split("-")[0] === "de"
              ? example
              : {
                  ...example,
                  label: "C major scale",
                  description:
                    "Eight quarter notes ascend from C to the higher C.",
                };
          setDraft(localized);
          setPreview(localized);
          onChange(localized);
        }}
      >
        <Plus aria-hidden="true" size={18} />
        {text("Add music notation (ABC)", "Notensatz (ABC) hinzufügen")}
      </button>
    );
  }

  return (
    <details className="music-score-editor" open>
      <summary>
        <Music aria-hidden="true" size={18} />
        {text("Music notation (ABC)", "Notensatz (ABC)")}
      </summary>
      <div className="music-score-editor-fields">
        <label>
          {text("Title", "Titel")}
          <input
            required
            maxLength={300}
            value={draft.label}
            onChange={(event) =>
              setDraft({ ...draft, label: event.currentTarget.value })
            }
          />
        </label>
        <label>
          {text("Text alternative", "Textalternative")}
          <textarea
            required
            maxLength={5_000}
            rows={3}
            value={draft.description}
            onChange={(event) =>
              setDraft({ ...draft, description: event.currentTarget.value })
            }
          />
        </label>
        <label>
          {text("ABC source", "ABC-Quelltext")}
          <textarea
            className="music-score-source"
            required
            maxLength={30_000}
            rows={10}
            spellCheck={false}
            value={draft.abc}
            onChange={(event) =>
              setDraft({ ...draft, abc: event.currentTarget.value })
            }
          />
        </label>
        <label>
          {text("Notation size", "Notensatzgröße")}: {draft.display.sizePercent}
          %
          <input
            type="range"
            min={50}
            max={120}
            step={5}
            value={draft.display.sizePercent}
            onChange={(event) =>
              setDraft({
                ...draft,
                display: {
                  ...draft.display,
                  responsive: true,
                  sizePercent: Number(event.currentTarget.value),
                },
              })
            }
          />
        </label>
        <label>
          {text("Displayed voice", "Angezeigte Stimme")}
          <select
            value={draft.display.selectedVoice ?? ""}
            onChange={(event) => {
              const selectedVoice = event.currentTarget.value || undefined;
              setDraft({
                ...draft,
                display: {
                  staffScale: draft.display.staffScale,
                  sizePercent: draft.display.sizePercent,
                  keyboard: draft.display.keyboard,
                  barsPerLine: draft.display.barsPerLine,
                  responsive: true,
                  ...(selectedVoice ? { selectedVoice } : {}),
                },
              });
            }}
          >
            <option value="">{text("All voices", "Alle Stimmen")}</option>
            {availableVoices.map((voice) => (
              <option key={voice} value={voice}>
                {voice}
              </option>
            ))}
          </select>
        </label>
        <label>
          {text("Measures per line", "Takte pro Zeile")}
          <select
            value={draft.display.barsPerLine}
            onChange={(event) =>
              setDraft({
                ...draft,
                display: {
                  ...draft.display,
                  barsPerLine:
                    event.currentTarget.value === "auto"
                      ? "auto"
                      : Number(event.currentTarget.value),
                  responsive: true,
                },
              })
            }
          >
            <option value="auto">{text("Automatic", "Automatisch")}</option>
            {Array.from({ length: 12 }, (_, index) => index + 1).map(
              (count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ),
            )}
          </select>
        </label>
        <label>
          {text("Piano keyboard", "Klaviatur")}
          <select
            value={draft.display.keyboard}
            onChange={(event) =>
              setDraft({
                ...draft,
                display: {
                  ...draft.display,
                  keyboard: event.currentTarget.value as
                    "off" | "keys" | "notes",
                  responsive: true,
                },
              })
            }
          >
            <option value="notes">
              {text("Keys with note names", "Tasten mit Notennamen")}
            </option>
            <option value="keys">{text("Keys only", "Nur Tasten")}</option>
            <option value="off">{text("Hidden", "Ausgeblendet")}</option>
          </select>
        </label>
        {error ? (
          <p className="music-score-editor-error" role="alert">
            {error}.{" "}
            {text(
              "The last valid score remains saved.",
              "Der zuletzt gültige Notensatz bleibt gespeichert.",
            )}
          </p>
        ) : null}
        <details className="music-score-syntax-help">
          <summary>
            {text("Supported ABC syntax", "Unterstützte ABC-Syntax")}
          </summary>
          <p>
            {text(
              "Use X:, T:, M:, L:, Q:, K:, V: and w:. HTML, URLs, MIDI directives and external resources are rejected.",
              "Verwende X:, T:, M:, L:, Q:, K:, V: und w:. HTML, URLs, MIDI-Direktiven und externe Ressourcen werden abgewiesen.",
            )}
          </p>
        </details>
        {preview ? (
          <div className="music-score-editor-preview">
            <MusicScore
              score={{
                ...preview,
                locale: contentLocale.split("-")[0] === "de" ? "de" : "en",
              }}
            />
          </div>
        ) : null}
        <button
          type="button"
          className="button button-danger"
          onClick={() => {
            setDraft(null);
            setPreview(null);
            setError("");
            onChange(null);
          }}
        >
          <Trash2 aria-hidden="true" size={17} />
          {text("Remove music notation", "Notensatz entfernen")}
        </button>
      </div>
    </details>
  );
}
