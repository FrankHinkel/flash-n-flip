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
      ? text("legacy.951981033c32")
      : granted
        ? text("legacy.3ba06e495573")
        : text("legacy.7c5625852818");

  if (status === "denied") {
    return (
      <div className="setting-row">
        <div>
          <BellRing aria-hidden="true" />
          <span>
            <strong>{text("legacy.75a4aa561e40")}</strong>
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
        <strong>{text("legacy.75a4aa561e40")}</strong>
        <small aria-live="polite">
          {error || (busy ? text("legacy.b715aecd60dd") : description)}
        </small>
      </span>
    </button>
  );
}
