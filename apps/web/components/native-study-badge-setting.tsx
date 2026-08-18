"use client";

import { BellRing, CircleCheck } from "lucide-react";
import { useEffect, useState } from "react";

import {
  getNativeStudyBadgePermission,
  refreshNativeStudyBadge,
  studyBadgePermissionIsGranted,
  type StudyBadgePermissionStatus,
} from "../lib/native-study-badge";
import { useI18n } from "./i18n-provider";

type VisibleStatus = StudyBadgePermissionStatus | "loading" | "unavailable";

export function NativeStudyBadgeSetting() {
  const { text } = useI18n();
  const [status, setStatus] = useState<VisibleStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      void getNativeStudyBadgePermission()
        .then(setStatus)
        .catch(() => setStatus("unavailable"));
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

  if (status === "loading" || status === "unavailable") return null;

  const granted = studyBadgePermissionIsGranted(status);
  const description =
    status === "denied"
      ? text(
          "Badges are disabled. Enable Badges for Flash-n-Flip in iOS Settings under Notifications.",
          "Badges sind deaktiviert. Aktiviere sie in den iOS-Einstellungen unter Mitteilungen für Flash-n-Flip.",
        )
      : granted
        ? text(
            "Shows learned cards from the active plan as soon as they are due. No banner or sound is used.",
            "Zeigt gelernte Karten aus dem aktiven Plan, sobald sie fällig sind. Ohne Banner und Ton.",
          )
        : text(
            "Allow Flash-n-Flip to show the number of due review cards on the app icon. New cards are not counted.",
            "Erlaube Flash-n-Flip, die Anzahl fälliger Wiederholungskarten am App-Icon zu zeigen. Neue Karten zählen nicht mit.",
          );

  if (status === "denied") {
    return (
      <div className="setting-row">
        <div>
          <BellRing aria-hidden="true" />
          <span>
            <strong>{text("App icon badge", "App-Icon-Badge")}</strong>
            <small>{description}</small>
          </span>
        </div>
      </div>
    );
  }

  return (
    <button
      aria-busy={busy || undefined}
      className="setting-action"
      disabled={busy}
      onClick={() => {
        void (async () => {
          setBusy(true);
          setError("");
          const result = await refreshNativeStudyBadge({
            requestPermission: !granted,
          });
          setStatus(result.status);
          setError(result.error ?? "");
          setBusy(false);
        })();
      }}
      type="button"
    >
      {granted ? (
        <CircleCheck aria-hidden="true" />
      ) : (
        <BellRing aria-hidden="true" />
      )}
      <span>
        <strong>{text("App icon badge", "App-Icon-Badge")}</strong>
        <small aria-live="polite">
          {error ||
            (busy ? text("Updating …", "Wird aktualisiert …") : description)}
        </small>
      </span>
    </button>
  );
}
