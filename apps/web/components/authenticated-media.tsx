"use client";

import { useEffect, useRef, useState } from "react";

import {
  activateAudioPlayerGain,
  deactivateAudioPlayerGain,
} from "../lib/audio-player-gain";
import { exclusiveAudioRequestEvent } from "../lib/music-playback";
import type { CardAudioOptimizationStatus } from "../lib/audio-optimization";
import { downloadMediaOfflineFirst } from "../lib/offline-media";
import { useI18n } from "./i18n-provider";

type Props = (
  | {
      kind: "image";
      mediaId: string;
      alt: string;
      decorative: boolean;
    }
  | {
      kind: "audio";
      mediaId: string;
      label: string;
      transcript?: string;
    }
  | {
      kind: "video";
      mediaId: string;
      label: string;
      captions?: string;
    }
) & { sourceBlob?: Blob };

export function AuthenticatedImageOverlay({
  baseMediaId,
  overlayMediaId,
  alt,
  decorative,
}: {
  baseMediaId: string;
  overlayMediaId: string;
  alt: string;
  decorative: boolean;
}) {
  const { text } = useI18n();
  const [sources, setSources] = useState<{
    base: string;
    overlay: string;
  } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let baseUrl = "";
    let overlayUrl = "";
    setFailed(false);
    setSources(null);
    void Promise.all([
      downloadMediaOfflineFirst(baseMediaId),
      downloadMediaOfflineFirst(overlayMediaId),
    ])
      .then(([base, overlay]) => {
        if (!active) return;
        baseUrl = URL.createObjectURL(base);
        overlayUrl = URL.createObjectURL(overlay);
        setSources({ base: baseUrl, overlay: overlayUrl });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (baseUrl) URL.revokeObjectURL(baseUrl);
      if (overlayUrl) URL.revokeObjectURL(overlayUrl);
    };
  }, [baseMediaId, overlayMediaId]);

  if (failed) {
    return (
      <span className="media-error" role="status">
        {text("legacy.4ae2639e0677")}
      </span>
    );
  }
  if (!sources) {
    return (
      <span className="media-loading" role="status">
        {text("legacy.8e3b0a8ffe0d")}
      </span>
    );
  }
  return (
    <figure
      className="card-media-overlay"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : alt}
      aria-hidden={decorative || undefined}
    >
      {/* Both sources are authenticated, MIME-validated blobs from our API. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="card-media-overlay-base" src={sources.base} alt="" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="card-media-overlay-mask" src={sources.overlay} alt="" />
    </figure>
  );
}

export function AuthenticatedMedia(props: Props) {
  const { text } = useI18n();
  const [source, setSource] = useState("");
  const [failed, setFailed] = useState(false);
  const [audioOptimizationStatus, setAudioOptimizationStatus] =
    useState<CardAudioOptimizationStatus>("NOT_OPTIMIZED");
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setFailed(false);
    void (
      props.sourceBlob
        ? Promise.resolve(props.sourceBlob)
        : downloadMediaOfflineFirst(props.mediaId)
    )
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [props.mediaId, props.sourceBlob]);

  useEffect(() => {
    if (props.kind !== "audio") return;
    let active = true;
    let eventName = "";
    let refresh: (() => void) | undefined;
    let refreshVersion = 0;
    setAudioOptimizationStatus("NOT_OPTIMIZED");

    void import("../lib/audio-optimization")
      .then((optimization) => {
        if (!active) return;
        eventName = optimization.audioOptimizationChangedEvent;
        refresh = () => {
          const version = ++refreshVersion;
          void optimization
            .cardAudioOptimizationStatus(props.mediaId)
            .then((status) => {
              if (active && version === refreshVersion) {
                setAudioOptimizationStatus(status);
              }
            })
            .catch(() => {
              if (active && version === refreshVersion) {
                setAudioOptimizationStatus("NOT_OPTIMIZED");
              }
            });
        };
        window.addEventListener(eventName, refresh);
        refresh();
      })
      .catch(() => {
        if (active) setAudioOptimizationStatus("NOT_OPTIMIZED");
      });

    return () => {
      active = false;
      if (eventName && refresh) window.removeEventListener(eventName, refresh);
    };
  }, [props.kind, props.mediaId]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) deactivateAudioPlayerGain(audio);
    };
  }, [source]);

  useEffect(() => {
    const media = audioRef.current;
    if (props.kind !== "audio" || !media) return;
    const stopForAnotherSource = (event: Event) => {
      if ((event as CustomEvent).detail !== media) media.pause();
    };
    window.addEventListener(exclusiveAudioRequestEvent, stopForAnotherSource);
    return () =>
      window.removeEventListener(
        exclusiveAudioRequestEvent,
        stopForAnotherSource,
      );
  }, [props.kind, source]);

  if (failed) {
    return (
      <span className="media-error" role="status">
        {text("legacy.f98d8b0a57bf")}
      </span>
    );
  }
  if (!source) {
    return (
      <span className="media-loading" role="status">
        {text("legacy.4ca878bb1b38")}
      </span>
    );
  }
  if (props.kind === "image") {
    return (
      // The source is an authenticated, MIME-validated blob from our own API.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="card-media-image"
        src={source}
        alt={props.decorative ? "" : props.alt}
      />
    );
  }
  if (props.kind === "audio") {
    const statusLabel =
      audioOptimizationStatus === "CURRENT"
        ? text("legacy.5e77e730976e")
        : audioOptimizationStatus === "OUTDATED"
          ? text("legacy.56d003cdaca8")
          : audioOptimizationStatus === "KEPT_ORIGINAL"
            ? text("legacy.ef29f8af4d1a")
            : text("legacy.3d72cdb9cd9c");
    return (
      <figure
        className="card-media-audio"
        data-audio-optimization-status={audioOptimizationStatus}
        title={statusLabel}
      >
        <span className="sr-only">{statusLabel}</span>
        <audio
          ref={audioRef}
          controls
          preload="metadata"
          src={source}
          aria-label={text("legacy.4bd3f4738452")}
          aria-keyshortcuts="Space"
          onPlay={(event) => {
            window.dispatchEvent(
              new CustomEvent(exclusiveAudioRequestEvent, {
                detail: event.currentTarget,
              }),
            );
            void activateAudioPlayerGain(event.currentTarget);
          }}
          onPause={(event) => deactivateAudioPlayerGain(event.currentTarget)}
          onEnded={(event) => deactivateAudioPlayerGain(event.currentTarget)}
        >
          {text("legacy.727b977280a0")}
        </audio>
        {props.transcript && (
          <details>
            <summary>{text("legacy.4f0932e0e118")}</summary>
            <p>{props.transcript}</p>
          </details>
        )}
      </figure>
    );
  }
  return (
    <figure className="card-media-video">
      <figcaption>{props.label}</figcaption>
      <video
        controls
        preload="metadata"
        src={source}
        aria-label={props.label}
        aria-keyshortcuts="Space"
      >
        {text("legacy.c2de434a501f")}
      </video>
      {props.captions && (
        <details>
          <summary>{text("legacy.2ccd21ded82e")}</summary>
          <p>{props.captions}</p>
        </details>
      )}
    </figure>
  );
}
