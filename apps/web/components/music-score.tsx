"use client";

import {
  FastForward,
  Play,
  Rewind,
  SkipBack,
  Square,
  StepBack,
  StepForward,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  validateMusicScoreAbc,
  type MusicScoreBlock,
} from "@flashcards/domain/music-score";

import type { MusicScoreSource } from "../lib/music-markdown";
import {
  createMusicPlaybackSession,
  exclusiveAudioRequestEvent,
  type MusicPlaybackSession,
} from "../lib/music-playback";
import {
  renderMusicScore,
  type RenderedMusicScore,
} from "../lib/music-renderer";
import { useI18n } from "./i18n-provider";
import { PianoKeyboard } from "./piano-keyboard";

const renderTimeoutMs = 12_000;

export function MusicScore({
  score,
}: {
  score: MusicScoreSource | (MusicScoreBlock & { locale?: "en" | "de" });
}) {
  const { text } = useI18n();
  const metrics = useMemo(() => validateMusicScoreAbc(score.abc), [score.abc]);
  const scoreClefs = useMemo(
    () => new Set(Object.values(metrics.voiceClefs)),
    [metrics.voiceClefs],
  );
  const titleId = useId();
  const descriptionId = useId();
  const [rendered, setRendered] = useState<RenderedMusicScore | null>(null);
  const [renderError, setRenderError] = useState("");
  const [playbackError, setPlaybackError] = useState("");
  const [playbackState, setPlaybackState] = useState<
    "idle" | "loading" | "playing"
  >("idle");
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeEventIndex, setActiveEventIndex] = useState(0);
  const activeEventIndexRef = useRef(0);
  const sessionRef = useRef<MusicPlaybackSession | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const startedAtRef = useRef(0);
  const positionAtStartRef = useRef(0);

  useEffect(() => {
    let active = true;
    setRendered(null);
    setRenderError("");
    const timeout = window.setTimeout(() => {
      if (!active) return;
      active = false;
      setRenderError(
        text(
          "The music notation took too long to render.",
          "Der Notensatz brauchte zu lange zum Rendern.",
        ),
      );
    }, renderTimeoutMs);
    void renderMusicScore(score)
      .then((result) => {
        if (!active) return;
        window.clearTimeout(timeout);
        setRendered(result);
        activeEventIndexRef.current = 0;
        setActiveEventIndex(0);
      })
      .catch(() => {
        if (!active) return;
        window.clearTimeout(timeout);
        setRenderError(
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
  }, [
    score.abc,
    score.display.selectedVoice,
    score.display.sizePercent,
    score.display.staffScale,
    text,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rendered) return;
    for (const element of canvas.querySelectorAll(".fnf-music-cursor-active")) {
      element.classList.remove("fnf-music-cursor-active");
    }
    const cursorClass = rendered.timeline[activeEventIndex]?.cursorClass;
    if (!cursorClass) return;
    for (const element of canvas.querySelectorAll(`.${cursorClass}`)) {
      element.classList.add("fnf-music-cursor-active");
    }
  }, [activeEventIndex, rendered]);

  useEffect(() => {
    if (playbackState !== "playing") return;
    let frame = 0;
    const update = () => {
      const next = Math.min(
        duration,
        positionAtStartRef.current +
          (performance.now() - startedAtRef.current) / 1_000,
      );
      const timeline = rendered?.timeline ?? [];
      const nextEvent = timeline.findLastIndex(
        (event) => event.seconds <= next + 0.02,
      );
      if (nextEvent >= 0 && nextEvent !== activeEventIndexRef.current) {
        activeEventIndexRef.current = nextEvent;
        setActiveEventIndex(nextEvent);
      }
      if (next < duration) frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, playbackState, rendered]);

  useEffect(() => {
    const stop = (resetState = true) => {
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) void session.destroy();
      if (resetState) {
        setPlaybackState("idle");
        setPosition(0);
        setDuration(0);
        activeEventIndexRef.current = 0;
        setActiveEventIndex(0);
      }
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") stop();
    };
    const anotherAudioSource = (event: Event) => {
      if ((event as CustomEvent).detail !== "music") stop();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener(exclusiveAudioRequestEvent, anotherAudioSource);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener(
        exclusiveAudioRequestEvent,
        anotherAudioSource,
      );
      stop(false);
    };
  }, []);

  const beginPlayback = async () => {
    setPlaybackError("");
    if (playbackState === "playing") {
      const next = Math.min(
        duration,
        positionAtStartRef.current +
          (performance.now() - startedAtRef.current) / 1_000,
      );
      setPosition(next);
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) await session.destroy();
      setPlaybackState("idle");
      return;
    }
    if (!rendered?.visual) return;
    setPlaybackState("loading");
    try {
      const session = await createMusicPlaybackSession(rendered.visual, () => {
        const completed = sessionRef.current;
        sessionRef.current = null;
        if (completed) void completed.destroy();
        setPlaybackState("idle");
        setPosition(0);
        setDuration(0);
        activeEventIndexRef.current = 0;
        setActiveEventIndex(0);
      });
      sessionRef.current = session;
      setDuration(session.durationSeconds);
      session.seek(position);
      positionAtStartRef.current = position;
      startedAtRef.current = performance.now();
      session.start();
      setPlaybackState("playing");
    } catch {
      setPlaybackState("idle");
      setPlaybackError(
        text(
          "Local piano playback is unavailable for this score.",
          "Die lokale Klavierwiedergabe ist für diesen Notensatz nicht verfügbar.",
        ),
      );
    }
  };

  const seekToEvent = (requestedIndex: number) => {
    const timeline = rendered?.timeline ?? [];
    if (!timeline.length) return;
    const index = Math.min(timeline.length - 1, Math.max(0, requestedIndex));
    const seconds = timeline[index]!.seconds;
    sessionRef.current?.seek(seconds);
    activeEventIndexRef.current = index;
    setActiveEventIndex(index);
    setPosition(seconds);
    positionAtStartRef.current = seconds;
    startedAtRef.current = performance.now();
  };

  const timeline = rendered?.timeline ?? [];
  const activeTimelineEvent = timeline[activeEventIndex];
  const currentMeasure = activeTimelineEvent?.measure ?? 1;
  const firstInCurrentMeasure = timeline.findIndex(
    (event) => event.measure === currentMeasure,
  );
  const previousMeasureIndex =
    activeEventIndex > firstInCurrentMeasure
      ? firstInCurrentMeasure
      : timeline.findLastIndex((event) => event.measure < currentMeasure);
  const nextMeasureIndex = timeline.findIndex(
    (event) => event.measure > currentMeasure,
  );

  const measures = Array.from({ length: metrics.measureCount }, (_, index) => {
    const measure = index + 1;
    return {
      measure,
      events: metrics.events.filter((event) => event.measure === measure),
    };
  }).filter(({ events }) => events.length);

  return (
    <figure
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className={`music-score music-score-${score.display.staffScale}`}
      data-music-score="abcjs"
      onClick={(event) => event.stopPropagation()}
    >
      <figcaption className="music-score-heading">
        <strong id={titleId}>{score.label}</strong>
        <span id={descriptionId}>{score.description}</span>
      </figcaption>
      <dl className="music-score-metadata">
        <div>
          <dt>{text("Key", "Tonart")}</dt>
          <dd>{metrics.keySignature}</dd>
        </div>
        {metrics.meter ? (
          <div>
            <dt>{text("Meter", "Taktart")}</dt>
            <dd>{metrics.meter}</dd>
          </div>
        ) : null}
        <div>
          <dt>{text("Clef", "Schlüssel")}</dt>
          <dd>
            {scoreClefs.size > 1
              ? text("Treble + bass", "Violine + Bass")
              : metrics.clef === "bass"
                ? text("Bass", "Bass")
                : text("Treble", "Violine")}
          </dd>
        </div>
        <div>
          <dt>{text("Voices", "Stimmen")}</dt>
          <dd>{metrics.voices.length}</dd>
        </div>
      </dl>
      {rendered?.markup.length ? (
        <div className="music-score-canvas" aria-hidden="true" ref={canvasRef}>
          {rendered.markup.map((svg, index) => (
            <div
              dangerouslySetInnerHTML={{ __html: svg }}
              key={`${index}-${svg.length}`}
            />
          ))}
        </div>
      ) : renderError ? (
        <div className="music-score-error" role="alert">
          <p>{renderError}</p>
          <pre>
            <code>{score.abc}</code>
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

      {score.display.keyboard !== "off" ? (
        <PianoKeyboard
          activePitches={activeTimelineEvent?.pitches ?? []}
          showNoteNames={score.display.keyboard === "notes"}
        />
      ) : null}

      <div
        className="music-score-playback"
        aria-label={text("Piano playback", "Klavierwiedergabe")}
        role="group"
      >
        <button
          type="button"
          disabled={!timeline.length || activeEventIndex === 0}
          aria-label={text("Go to beginning", "Zum Anfang")}
          onClick={() => seekToEvent(0)}
        >
          <SkipBack aria-hidden="true" size={21} />
        </button>
        <button
          type="button"
          disabled={previousMeasureIndex < 0}
          aria-label={text("Previous measure", "Takt zurück")}
          onClick={() => seekToEvent(previousMeasureIndex)}
        >
          <Rewind aria-hidden="true" size={21} />
        </button>
        <button
          type="button"
          disabled={activeEventIndex <= 0}
          aria-label={text("Previous note", "Note zurück")}
          onClick={() => seekToEvent(activeEventIndex - 1)}
        >
          <StepBack aria-hidden="true" size={21} />
        </button>
        <button
          type="button"
          disabled={playbackState === "loading" || !rendered}
          aria-label={
            playbackState === "playing"
              ? text("Stop piano playback", "Klavierwiedergabe stoppen")
              : text(
                  "Play score on piano",
                  "Notensatz auf dem Klavier abspielen",
                )
          }
          onClick={() => void beginPlayback()}
        >
          {playbackState === "playing" ? (
            <Square aria-hidden="true" size={20} />
          ) : (
            <Play aria-hidden="true" size={21} />
          )}
        </button>
        <button
          type="button"
          disabled={activeEventIndex >= timeline.length - 1}
          aria-label={text("Next note", "Note vor")}
          onClick={() => seekToEvent(activeEventIndex + 1)}
        >
          <StepForward aria-hidden="true" size={21} />
        </button>
        <button
          type="button"
          disabled={nextMeasureIndex < 0}
          aria-label={text("Next measure", "Takt vor")}
          onClick={() => seekToEvent(nextMeasureIndex)}
        >
          <FastForward aria-hidden="true" size={21} />
        </button>
      </div>
      <p className="music-score-cursor-status" role="status" aria-live="polite">
        {text(
          `Measure ${activeTimelineEvent?.measure ?? 1}, note ${activeEventIndex + 1} of ${Math.max(1, timeline.length)}`,
          `Takt ${activeTimelineEvent?.measure ?? 1}, Note ${activeEventIndex + 1} von ${Math.max(1, timeline.length)}`,
        )}
      </p>
      {playbackError ? (
        <p className="music-score-playback-error" role="status">
          {playbackError}
        </p>
      ) : null}

      <details className="music-score-text-view">
        <summary>
          {text("Accessible event list", "Zugängliche Ereignisliste")}
        </summary>
        <ol>
          {measures.map(({ measure, events }) => (
            <li key={measure} tabIndex={0}>
              <strong>{text(`Measure ${measure}`, `Takt ${measure}`)}</strong>{" "}
              {events
                .map((event) =>
                  event.kind === "rest"
                    ? text(`rest ${event.value}`, `Pause ${event.value}`)
                    : text(`note ${event.value}`, `Note ${event.value}`),
                )
                .join(", ")}
            </li>
          ))}
        </ol>
      </details>
    </figure>
  );
}
