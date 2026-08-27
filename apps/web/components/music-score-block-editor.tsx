"use client";

import { Music, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  musicScoreBlockSchema,
  maximumMusicScoreSourceLength,
  prepareMusicScoreAbcBook,
  validateMusicScoreAbc,
  type MusicScoreBlock,
} from "@flashcards/domain/music-score";

import { MusicScore } from "./music-score";
import { useI18n } from "./i18n-provider";

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
      const tunes = prepareMusicScoreAbcBook(draft?.abc ?? "");
      return tunes.length === 1 ? validateMusicScoreAbc(tunes[0]!).voices : [];
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
      let normalizedDraft = draft;
      try {
        const tunes = prepareMusicScoreAbcBook(draft.abc);
        if (tunes.length !== 1) throw new Error("Expected one ABC tune");
        normalizedDraft = { ...draft, abc: tunes[0]! };
      } catch {
        setError(text("legacy.b3005d82122b"));
        return;
      }
      const parsed = musicScoreBlockSchema.safeParse(normalizedDraft);
      if (!parsed.success) {
        setError(
          parsed.error.issues[0]?.message ?? text("legacy.c17a00415ec7"),
        );
        return;
      }
      setError("");
      setPreview(parsed.data);
      onChangeRef.current(parsed.data);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [draft, text]);

  if (!draft) return null;

  return (
    <details className="music-score-editor" open>
      <summary>
        <Music aria-hidden="true" size={18} />
        {text("legacy.b8948b79d62d")}
      </summary>
      <div className="music-score-editor-fields">
        <label>
          {text("legacy.1416821a59bb")}
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
          {text("legacy.aa393ea357d1")}
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
          {text("legacy.4fb23a5f4672")}
          <textarea
            className="music-score-source"
            required
            maxLength={maximumMusicScoreSourceLength}
            rows={10}
            spellCheck={false}
            value={draft.abc}
            onChange={(event) =>
              setDraft({ ...draft, abc: event.currentTarget.value })
            }
          />
        </label>
        <label>
          {text("legacy.1d54c05dca3c")}: {draft.display.sizePercent}
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
          {text("legacy.6cfab444db56")}
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
                  ...(draft.display.fingerings
                    ? { fingerings: draft.display.fingerings }
                    : {}),
                  responsive: true,
                  ...(selectedVoice ? { selectedVoice } : {}),
                },
              });
            }}
          >
            <option value="">{text("legacy.7b4750e30546")}</option>
            {availableVoices.map((voice) => (
              <option key={voice} value={voice}>
                {voice}
              </option>
            ))}
          </select>
        </label>
        <label>
          {text("legacy.8cd64cef9192")}
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
            <option value="auto">{text("legacy.1b74f2ea14b8")}</option>
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
          {text("legacy.20f3cc3ed4ac")}
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
            <option value="notes">{text("legacy.f5cd0b71cf75")}</option>
            <option value="keys">{text("legacy.554a3cb66fec")}</option>
            <option value="off">{text("legacy.6c5b6ac7f365")}</option>
          </select>
        </label>
        {error ? (
          <p className="music-score-editor-error" role="alert">
            {error}. {text("legacy.d3718903e083")}
          </p>
        ) : null}
        <details className="music-score-syntax-help">
          <summary>{text("legacy.c00d9eabb961")}</summary>
          <p>{text("legacy.76118a5a111b")}</p>
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
          {text("legacy.978220d11dff")}
        </button>
      </div>
    </details>
  );
}
