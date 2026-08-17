"use client";

import { useEffect, useRef, useState } from "react";

import {
  activateAudioPlayerGain,
  deactivateAudioPlayerGain,
} from "../lib/audio-player-gain";
import { downloadMediaOfflineFirst } from "../lib/offline-media";
import { useI18n } from "./i18n-provider";

type Props =
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
    };

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
        {text(
          "Image overlay could not be loaded.",
          "Bild-Overlay konnte nicht geladen werden.",
        )}
      </span>
    );
  }
  if (!sources) {
    return (
      <span className="media-loading" role="status">
        {text("Loading image …", "Bild wird geladen …")}
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
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setFailed(false);
    void downloadMediaOfflineFirst(props.mediaId)
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
  }, [props.mediaId]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) deactivateAudioPlayerGain(audio);
    };
  }, [source]);

  if (failed) {
    return (
      <span className="media-error" role="status">
        {text(
          "Media could not be loaded.",
          "Medium konnte nicht geladen werden.",
        )}
      </span>
    );
  }
  if (!source) {
    return (
      <span className="media-loading" role="status">
        {text("Loading media …", "Medium wird geladen …")}
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
  if (props.kind === "audio")
    return (
      <figure className="card-media-audio">
        <audio
          ref={audioRef}
          controls
          preload="metadata"
          src={source}
          aria-label={text("Card audio", "Kartenaudio")}
          aria-keyshortcuts="Space"
          onPlay={(event) => {
            void activateAudioPlayerGain(event.currentTarget);
          }}
          onPause={(event) => deactivateAudioPlayerGain(event.currentTarget)}
          onEnded={(event) => deactivateAudioPlayerGain(event.currentTarget)}
        >
          {text(
            "Your browser does not support audio playback.",
            "Ihr Browser unterstützt die Audiowiedergabe nicht.",
          )}
        </audio>
        {props.transcript && (
          <details>
            <summary>{text("Show transcript", "Transkript anzeigen")}</summary>
            <p>{props.transcript}</p>
          </details>
        )}
      </figure>
    );
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
        {text(
          "Your browser does not support video playback.",
          "Ihr Browser unterstützt die Videowiedergabe nicht.",
        )}
      </video>
      {props.captions && (
        <details>
          <summary>{text("Show captions", "Untertitel anzeigen")}</summary>
          <p>{props.captions}</p>
        </details>
      )}
    </figure>
  );
}
