"use client";

import {
  FastForward,
  Info,
  Play,
  Rewind,
  SkipBack,
  Square,
  StepBack,
  StepForward,
} from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  const [canvasWidth, setCanvasWidth] = useState(0);
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
  const positionBarRef = useRef<HTMLSpanElement | null>(null);
  const cursorPositionRef = useRef<{ center: number; left: number } | null>(
    null,
  );
  const startedAtRef = useRef(0);
  const positionAtStartRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateWidth = (width: number) => {
      const rounded = Math.round(width);
      setCanvasWidth((current) =>
        Math.abs(current - rounded) >= 8 ? rounded : current,
      );
    };
    updateWidth(canvas.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) updateWidth(entry.contentRect.width);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (canvasWidth <= 0) return;
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
    void renderMusicScore(score, canvasWidth)
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
    score.display.barsPerLine,
    canvasWidth,
    text,
  ]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const positionBar = positionBarRef.current;
    if (!canvas || !positionBar || !rendered) return;
    for (const element of canvas.querySelectorAll(".fnf-music-cursor-active")) {
      element.classList.remove("fnf-music-cursor-active");
    }
    const cursorClass = rendered.timeline[activeEventIndex]?.cursorClass;
    if (!cursorClass) {
      positionBar.hidden = true;
      cursorPositionRef.current = null;
      return;
    }
    const activeElements = [
      ...canvas.querySelectorAll<HTMLElement>(`.${cursorClass}`),
    ];
    for (const element of activeElements) {
      element.classList.add("fnf-music-cursor-active");
    }
    if (!activeElements.length) {
      positionBar.hidden = true;
      cursorPositionRef.current = null;
      return;
    }
    const canvasBox = canvas.getBoundingClientRect();
    const activeBoxes = activeElements.map((element) =>
      element.getBoundingClientRect(),
    );
    const activeTop = Math.min(...activeBoxes.map(({ top }) => top));
    const activeBottom = Math.max(...activeBoxes.map(({ bottom }) => bottom));
    const activeLeft = Math.min(...activeBoxes.map(({ left }) => left));
    const activeRight = Math.max(...activeBoxes.map(({ right }) => right));
    const contentCenter =
      (activeTop + activeBottom) / 2 - canvasBox.top + canvas.scrollTop;
    const contentLeft = activeLeft - canvasBox.left + canvas.scrollLeft;
    const previousPosition = cursorPositionRef.current;
    const changedSystem = Boolean(
      previousPosition &&
      contentLeft < previousPosition.left - 24 &&
      contentCenter > previousPosition.center + 24,
    );
    cursorPositionRef.current = { center: contentCenter, left: contentLeft };
    positionBar.classList.toggle(
      "music-score-position-bar-jump",
      changedSystem,
    );
    positionBar.style.left = `${activeLeft - canvasBox.left + canvas.scrollLeft - 6}px`;
    positionBar.style.top = `${activeTop - canvasBox.top + canvas.scrollTop - 8}px`;
    positionBar.style.width = `${Math.max(14, activeRight - activeLeft + 12)}px`;
    positionBar.style.height = `${Math.max(24, activeBottom - activeTop + 16)}px`;
    positionBar.hidden = false;
    const safeTop = canvasBox.top + 20;
    const dockTop = canvas
      .closest(".music-score")
      ?.querySelector(".music-score-practice-dock")
      ?.getBoundingClientRect().top;
    const safeBottom = Math.min(
      canvasBox.bottom - 20,
      dockTop === undefined ? Number.POSITIVE_INFINITY : dockTop - 20,
    );
    if (changedSystem || activeTop < safeTop || activeBottom > safeBottom) {
      const activeCenter = (activeTop + activeBottom) / 2;
      const canvasCenter = (canvasBox.top + canvasBox.bottom) / 2;
      canvas.scrollTop = Math.max(
        0,
        canvas.scrollTop + activeCenter - canvasCenter,
      );
    }
    if (changedSystem) {
      // Commit the new system position without animating diagonally back from
      // the preceding line. Normal note-to-note movement resumes immediately.
      void positionBar.offsetWidth;
      positionBar.classList.remove("music-score-position-bar-jump");
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
  const practicePitches = [
    ...new Set(timeline.flatMap(({ pitches }) => pitches)),
  ];
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
      <figcaption className="sr-only">
        <strong id={titleId}>{score.label}</strong>
        <span id={descriptionId}>{score.description}</span>
      </figcaption>
      <details className="music-score-info">
        <summary aria-label={text("Music information", "Musikinformationen")}>
          <Info aria-hidden="true" size={21} />
        </summary>
        <div className="music-score-info-panel">
          <strong>{score.label}</strong>
          {score.description ? <p>{score.description}</p> : null}
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
          <ol className="music-score-event-list">
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
        </div>
      </details>
      <div
        className="music-score-canvas"
        aria-hidden={rendered?.markup.length ? true : undefined}
        ref={canvasRef}
      >
        {rendered?.markup.length ? (
          <>
            <span
              aria-hidden="true"
              className="music-score-position-bar"
              hidden
              ref={positionBarRef}
            />
            {rendered.markup.map((svg, index) => (
              <div
                dangerouslySetInnerHTML={{ __html: svg }}
                key={`${index}-${svg.length}`}
              />
            ))}
          </>
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
      </div>

      <div className="music-score-practice-dock">
        {score.display.keyboard !== "off" ? (
          <PianoKeyboard
            leftPitches={activeTimelineEvent?.leftPitches ?? []}
            rightPitches={activeTimelineEvent?.rightPitches ?? []}
            practicePitches={practicePitches}
            showNoteNames={score.display.keyboard === "notes"}
          />
        ) : null}

        <div className="music-score-player-row">
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
          <p
            className="music-score-cursor-status"
            role="status"
            aria-live="polite"
          >
            {text(
              `Measure ${activeTimelineEvent?.measure ?? 1} · note ${activeEventIndex + 1} of ${Math.max(1, timeline.length)}`,
              `Takt ${activeTimelineEvent?.measure ?? 1} · Note ${activeEventIndex + 1} von ${Math.max(1, timeline.length)}`,
            )}
          </p>
        </div>
        {playbackError ? (
          <p className="music-score-playback-error" role="status">
            {playbackError}
          </p>
        ) : null}
      </div>
    </figure>
  );
}
