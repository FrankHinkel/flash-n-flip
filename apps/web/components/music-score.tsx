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
  defaultMediaPresentation,
  mediaPresentationBackground,
  mediaPresentationLengthCss,
  safeRichMediaErrorDetail,
} from "../lib/media-presentation";
import {
  musicPracticeBounds,
  musicPracticeEndSeconds,
  pianoKeyHighlightsAt,
} from "../lib/music-practice";
import {
  createMusicPlaybackSession,
  exclusiveAudioRequestEvent,
  type MusicPlaybackSession,
} from "../lib/music-playback";
import {
  renderMusicScore,
  type RenderedMusicScore,
} from "../lib/music-renderer";
import { useMediaPresentationHeight } from "../lib/use-media-presentation";
import { useI18n } from "./i18n-provider";
import { PianoKeyboard } from "./piano-keyboard";

const renderTimeoutMs = 12_000;

export function MusicScore({
  score,
}: {
  score: MusicScoreSource | (MusicScoreBlock & { locale?: "en" | "de" });
}) {
  const { text } = useI18n();
  const presentation =
    "presentation" in score ? score.presentation : defaultMediaPresentation;
  const metrics = useMemo(() => validateMusicScoreAbc(score.abc), [score.abc]);
  const scoreClefs = useMemo(
    () => new Set(Object.values(metrics.voiceClefs)),
    [metrics.voiceClefs],
  );
  const titleId = useId();
  const descriptionId = useId();
  const diagnosticTitleId = useId();
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
  const [practicePointA, setPracticePointA] = useState<number | null>(null);
  const [practicePointB, setPracticePointB] = useState<number | null>(null);
  const activeEventIndexRef = useRef(0);
  const sessionRef = useRef<MusicPlaybackSession | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const figureRef = useRef<HTMLElement | null>(null);
  const positionBarRef = useRef<HTMLSpanElement | null>(null);
  const cursorPositionRef = useRef<{ center: number; left: number } | null>(
    null,
  );
  const startedAtRef = useRef(0);
  const positionAtStartRef = useRef(0);
  const lastPositionUpdateRef = useRef(0);
  const playbackEndRef = useRef({ seconds: 0, index: 0 });
  const requestedHeight = useMediaPresentationHeight(
    figureRef,
    presentation.height,
  );
  const requestedWidth = mediaPresentationLengthCss(presentation.width);
  const requestedBackground = mediaPresentationBackground(
    presentation.background,
  );
  const timeline = rendered?.timeline ?? [];
  const { startIndex: practiceStartIndex, endIndex: practiceEndIndex } =
    musicPracticeBounds(timeline.length, practicePointA, practicePointB);

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
    setPracticePointA(null);
    setPracticePointB(null);
    setPosition(0);
    setDuration(0);
    activeEventIndexRef.current = 0;
    setActiveEventIndex(0);
  }, [score.abc, score.display.selectedVoice]);

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
      })
      .catch((cause) => {
        if (!active) return;
        window.clearTimeout(timeout);
        const detail = safeRichMediaErrorDetail(cause);
        const summary = text(
          "The music notation could not be rendered safely.",
          "Der Notensatz konnte nicht sicher gerendert werden.",
        );
        setRenderError(detail ? `${summary} ${detail}` : summary);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rendered) return;
    canvas
      .querySelectorAll(".music-score-diagnostic-bar")
      .forEach((element) => element.remove());
    const canvasBox = canvas.getBoundingClientRect();
    for (const diagnostic of rendered.diagnostics) {
      const elements = [
        ...canvas.querySelectorAll<HTMLElement>(`.${diagnostic.markerClass}`),
      ];
      const segments: DOMRect[][] = [];
      for (const element of elements) {
        const box = element.getBoundingClientRect();
        const previous = segments.at(-1)?.at(-1);
        if (
          !previous ||
          Math.abs(
            (previous.top + previous.bottom) / 2 - (box.top + box.bottom) / 2,
          ) > 48 ||
          box.left < previous.left - 12
        ) {
          segments.push([box]);
        } else {
          segments.at(-1)!.push(box);
        }
      }
      for (const boxes of segments) {
        const marker = document.createElement("span");
        marker.className = "music-score-diagnostic-bar";
        marker.setAttribute("aria-hidden", "true");
        marker.textContent = "!";
        const left = Math.min(...boxes.map(({ left: value }) => value));
        const right = Math.max(...boxes.map(({ right: value }) => value));
        const top = Math.min(...boxes.map(({ top: value }) => value));
        const bottom = Math.max(...boxes.map(({ bottom: value }) => value));
        marker.style.left = `${left - canvasBox.left + canvas.scrollLeft - 6}px`;
        marker.style.top = `${top - canvasBox.top + canvas.scrollTop - 8}px`;
        marker.style.width = `${Math.max(20, right - left + 12)}px`;
        marker.style.height = `${Math.max(28, bottom - top + 16)}px`;
        canvas.append(marker);
      }
    }
    return () => {
      canvas
        .querySelectorAll(".music-score-diagnostic-bar")
        .forEach((element) => element.remove());
    };
  }, [canvasWidth, rendered]);

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
      const playbackEnd = playbackEndRef.current;
      const next = Math.min(
        playbackEnd.seconds,
        positionAtStartRef.current +
          (performance.now() - startedAtRef.current) / 1_000,
      );
      const nextEvent = timeline.findLastIndex(
        (event) => event.seconds <= next + 0.02,
      );
      const boundedEvent = Math.min(playbackEnd.index, nextEvent);
      if (boundedEvent >= 0 && boundedEvent !== activeEventIndexRef.current) {
        activeEventIndexRef.current = boundedEvent;
        setActiveEventIndex(boundedEvent);
      }
      if (
        next - lastPositionUpdateRef.current >= 0.04 ||
        next >= playbackEnd.seconds
      ) {
        lastPositionUpdateRef.current = next;
        setPosition(next);
      }
      if (next >= playbackEnd.seconds - 0.005) {
        const session = sessionRef.current;
        sessionRef.current = null;
        session?.pause();
        if (session) void session.destroy();
        setPlaybackState("idle");
        setPosition(playbackEnd.seconds);
        positionAtStartRef.current = playbackEnd.seconds;
        activeEventIndexRef.current = playbackEnd.index;
        setActiveEventIndex(playbackEnd.index);
        return;
      }
      frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [playbackState, timeline]);

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
      if (document.visibilityState === "hidden") {
        stop();
      }
    };
    const anotherAudioSource = (event: Event) => {
      if ((event as CustomEvent).detail !== "music") {
        stop();
      }
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
        playbackEndRef.current.seconds,
        positionAtStartRef.current +
          (performance.now() - startedAtRef.current) / 1_000,
      );
      setPosition(next);
      const pausedEventIndex = Math.min(
        playbackEndRef.current.index,
        timeline.findLastIndex((event) => event.seconds <= next + 0.02),
      );
      if (pausedEventIndex >= 0) {
        activeEventIndexRef.current = pausedEventIndex;
        setActiveEventIndex(pausedEventIndex);
      }
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) await session.destroy();
      setPlaybackState("idle");
      return;
    }
    if (!rendered?.visual) return;
    setPlaybackState("loading");
    try {
      const requestedStart =
        position < (timeline[practiceStartIndex]?.seconds ?? 0) ||
        position >=
          musicPracticeEndSeconds(
            timeline,
            practiceEndIndex,
            duration || Number.POSITIVE_INFINITY,
          ) -
            0.005
          ? (timeline[practiceStartIndex]?.seconds ?? 0)
          : position;
      const requestedStartIndex = Math.min(
        practiceEndIndex,
        Math.max(
          practiceStartIndex,
          timeline.findLastIndex(
            (event) => event.seconds <= requestedStart + 0.02,
          ),
        ),
      );
      const session = await createMusicPlaybackSession(rendered.visual, () => {
        const playbackEnd = playbackEndRef.current;
        const completed = sessionRef.current;
        sessionRef.current = null;
        if (completed) void completed.destroy();
        setPlaybackState("idle");
        setPosition(playbackEnd.seconds);
        positionAtStartRef.current = playbackEnd.seconds;
        activeEventIndexRef.current = playbackEnd.index;
        setActiveEventIndex(playbackEnd.index);
      });
      sessionRef.current = session;
      setDuration(session.durationSeconds);
      const playbackEndSeconds = musicPracticeEndSeconds(
        timeline,
        practiceEndIndex,
        session.durationSeconds,
      );
      playbackEndRef.current = {
        seconds: playbackEndSeconds,
        index: practiceEndIndex,
      };
      session.seek(requestedStart);
      setPosition(requestedStart);
      activeEventIndexRef.current = requestedStartIndex;
      setActiveEventIndex(requestedStartIndex);
      positionAtStartRef.current = requestedStart;
      lastPositionUpdateRef.current = requestedStart;
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
    if (!timeline.length) return;
    const index = Math.min(
      practiceEndIndex,
      Math.max(practiceStartIndex, requestedIndex),
    );
    const seconds = timeline[index]!.seconds;
    sessionRef.current?.seek(seconds);
    activeEventIndexRef.current = index;
    setActiveEventIndex(index);
    setPosition(seconds);
    positionAtStartRef.current = seconds;
    startedAtRef.current = performance.now();
  };

  const practicePitches = [
    ...new Set(timeline.flatMap(({ pitches }) => pitches)),
  ];
  const activeTimelineEvent = timeline[activeEventIndex];
  const practiceTimeline = timeline.slice(
    practiceStartIndex,
    practiceEndIndex + 1,
  );
  const keyHighlights = pianoKeyHighlightsAt(practiceTimeline, position);
  const currentMeasure = activeTimelineEvent?.measure ?? 1;
  const firstInCurrentMeasure = timeline.findIndex(
    (event) => event.measure === currentMeasure,
  );
  const currentMeasureStart = Math.max(
    practiceStartIndex,
    firstInCurrentMeasure,
  );
  const previousMeasureIndex =
    activeEventIndex > currentMeasureStart
      ? currentMeasureStart
      : timeline.findLastIndex(
          (event, index) =>
            index >= practiceStartIndex && event.measure < currentMeasure,
        );
  const nextMeasureIndex = timeline.findIndex(
    (event, index) =>
      index > activeEventIndex &&
      index <= practiceEndIndex &&
      event.measure > currentMeasure,
  );

  const practicePointLabel = (point: number | null) => {
    if (point === null) return text("not set", "nicht gesetzt");
    const event = timeline[point];
    return text(
      `measure ${event?.measure ?? 1}, note ${point + 1}`,
      `Takt ${event?.measure ?? 1}, Note ${point + 1}`,
    );
  };

  const togglePracticePointA = () => {
    if (practicePointA !== null) {
      setPracticePointA(null);
      return;
    }
    setPracticePointA(activeEventIndex);
    if (practicePointB !== null && activeEventIndex > practicePointB) {
      setPracticePointB(null);
    }
  };

  const togglePracticePointB = () => {
    if (practicePointB !== null) {
      setPracticePointB(null);
      return;
    }
    setPracticePointB(activeEventIndex);
    if (practicePointA !== null && activeEventIndex < practicePointA) {
      setPracticePointA(null);
    }
  };

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
      ref={figureRef}
      style={{ background: requestedBackground, width: requestedWidth }}
    >
      <figcaption className="sr-only">
        <strong id={titleId}>{score.label}</strong>
        <span id={descriptionId}>{score.description}</span>
      </figcaption>
      <details className="music-score-info">
        <summary
          aria-label={
            rendered?.diagnostics.length
              ? text(
                  "Music information, notation warning",
                  "Musikinformationen, Notationswarnung",
                )
              : text("Music information", "Musikinformationen")
          }
        >
          <Info aria-hidden="true" size={21} />
          {rendered?.diagnostics.length ? (
            <span aria-hidden="true" className="music-score-info-warning">
              !
            </span>
          ) : null}
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
          {rendered?.diagnostics.length ? (
            <section
              aria-labelledby={diagnosticTitleId}
              className="music-score-diagnostics"
            >
              <strong id={diagnosticTitleId}>
                {text("Notation warnings", "Notationswarnungen")}
              </strong>
              <ul>
                {rendered.diagnostics.map((diagnostic) => (
                  <li key={`${diagnostic.voice}-${diagnostic.measure}`}>
                    {text(
                      `${diagnostic.voice}, measure ${diagnostic.measure}: ${diagnostic.actualUnits} instead of ${diagnostic.expectedUnits} 1/${diagnostic.unitDenominator} units.`,
                      `${diagnostic.voice}, Takt ${diagnostic.measure}: ${diagnostic.actualUnits} statt ${diagnostic.expectedUnits} ${diagnostic.unitDenominator}tel-Einheiten.`,
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
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
        data-custom-height="true"
        aria-hidden={rendered?.markup.length ? true : undefined}
        ref={canvasRef}
        style={{ height: requestedHeight }}
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
            heldLeftPitches={keyHighlights.heldLeft}
            heldRightPitches={keyHighlights.heldRight}
            leftPitches={keyHighlights.attackedLeft}
            rightPitches={keyHighlights.attackedRight}
            practicePitches={practicePitches}
            showNoteNames={score.display.keyboard === "notes"}
          />
        ) : null}

        <div className="music-score-player-row">
          <div
            aria-label={text(
              "Temporary practice range",
              "Temporärer Übungsbereich",
            )}
            className="music-score-practice-points"
            role="group"
          >
            <button
              aria-label={text(
                `${practicePointA === null ? "Set" : "Clear"} practice start A, ${practicePointLabel(practicePointA)}`,
                `Übungsanfang A ${practicePointA === null ? "setzen" : "löschen"}, ${practicePointLabel(practicePointA)}`,
              )}
              aria-pressed={practicePointA !== null}
              disabled={playbackState !== "idle" || !timeline.length}
              onClick={togglePracticePointA}
              type="button"
            >
              <span>A</span>
              <small>
                {practicePointA === null ? "–" : practicePointA + 1}
              </small>
            </button>
            <button
              aria-label={text(
                `${practicePointB === null ? "Set" : "Clear"} practice end B, ${practicePointLabel(practicePointB)}`,
                `Übungsende B ${practicePointB === null ? "setzen" : "löschen"}, ${practicePointLabel(practicePointB)}`,
              )}
              aria-pressed={practicePointB !== null}
              disabled={playbackState !== "idle" || !timeline.length}
              onClick={togglePracticePointB}
              type="button"
            >
              <span>B</span>
              <small>
                {practicePointB === null ? "–" : practicePointB + 1}
              </small>
            </button>
          </div>
          <div
            className="music-score-playback"
            aria-label={text("Piano playback", "Klavierwiedergabe")}
            role="group"
          >
            <button
              type="button"
              disabled={
                !timeline.length || activeEventIndex === practiceStartIndex
              }
              aria-label={text("Go to beginning", "Zum Anfang")}
              onClick={() => seekToEvent(practiceStartIndex)}
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
              disabled={activeEventIndex <= practiceStartIndex}
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
              disabled={activeEventIndex >= practiceEndIndex}
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
