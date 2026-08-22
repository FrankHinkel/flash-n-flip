"use client";

import { useEffect, useState } from "react";

import type { MusicScoreSource } from "../lib/music-markdown";
import { renderMusicScore } from "../lib/music-renderer";
import { useI18n } from "./i18n-provider";

const renderTimeoutMs = 12_000;

export function MusicScore({ score }: { score: MusicScoreSource }) {
  const { text } = useI18n();
  const { keySignature, label, locale, meter, source } = score;
  const [markup, setMarkup] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setMarkup([]);
    setError("");
    const timeout = window.setTimeout(() => {
      if (!active) return;
      active = false;
      setError(
        text(
          "The music notation took too long to render.",
          "Der Notensatz brauchte zu lange zum Rendern.",
        ),
      );
    }, renderTimeoutMs);
    void renderMusicScore(source, label)
      .then((result) => {
        if (!active) return;
        window.clearTimeout(timeout);
        setMarkup(result);
      })
      .catch(() => {
        if (!active) return;
        window.clearTimeout(timeout);
        setError(
          text(
            "The music notation could not be rendered safely.",
            "Der Notensatz konnte nicht sicher gerendert werden.",
          ),
        );
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [label, source, text]);

  const description = [
    label,
    keySignature
      ? locale === "de"
        ? `Tonart: ${keySignature}`
        : `Key: ${keySignature}`
      : "",
    meter ? (locale === "de" ? `Taktart: ${meter}` : `Meter: ${meter}`) : "",
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <figure
      aria-label={description}
      className="music-score"
      data-music-score="abcjs"
      onClick={(event) => event.stopPropagation()}
    >
      {markup.length ? (
        <div className="music-score-canvas" aria-hidden="true">
          {markup.map((svg, index) => (
            <div
              // The renderer accepts only output that passed the shared inert
              // SVG allowlist; authored SVG never reaches this path.
              dangerouslySetInnerHTML={{ __html: svg }}
              key={`${index}-${svg.length}`}
            />
          ))}
        </div>
      ) : error ? (
        <div className="music-score-error" role="alert">
          <p>{error}</p>
          <pre>
            <code>{source}</code>
          </pre>
        </div>
      ) : (
        <p className="music-score-loading" role="status">
          {text(
            "Rendering music notation locally …",
            "Notensatz wird lokal gerendert …",
          )}
        </p>
      )}
      <figcaption className="sr-only">{description}</figcaption>
    </figure>
  );
}
