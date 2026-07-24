"use client";

import { useEffect, useState } from "react";

import { api } from "../lib/api";
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
    };

export function AuthenticatedMedia(props: Props) {
  const { text } = useI18n();
  const [source, setSource] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setFailed(false);
    void api
      .downloadMedia(props.mediaId)
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
  return (
    <figure className="card-media-audio">
      <figcaption>{props.label}</figcaption>
      <audio controls preload="metadata" src={source} aria-label={props.label}>
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
}
