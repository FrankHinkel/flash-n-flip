"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { formatAppBuildTime } from "../lib/app-build";
import { useI18n } from "./i18n-provider";
import { usePwaUpdate } from "./pwa-update-provider";

export function PwaUpdateSettings() {
  const { locale, text } = useI18n();
  const {
    applyUpdate,
    checkForUpdate,
    phase,
    reloadRequired,
    supported,
    trustedIphoneVersion,
  } = usePwaUpdate();
  const buildTime = process.env.NEXT_PUBLIC_FNF_WEB_BUILD_TIME ?? "";
  const version = process.env.NEXT_PUBLIC_FNF_APP_VERSION ?? "";
  const [localizedBuildTime, setLocalizedBuildTime] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setLocalizedBuildTime(formatAppBuildTime(buildTime, locale));
  }, [buildTime, locale]);

  if (!supported) return null;

  const updateAvailable = phase === "available";
  const busy = phase === "checking" || phase === "applying";
  const title =
    phase === "available"
      ? text("legacy.5b0f7f181e33")
      : phase === "checking"
        ? text("legacy.d7ade3005d8c")
        : phase === "applying"
          ? text("legacy.f3d2e1fdee8a")
          : phase === "error"
            ? text("legacy.4bdda29540bd")
            : text("legacy.092463b0d9a3");
  const description =
    phase === "available"
      ? trustedIphoneVersion
        ? text("legacy.a8e687d8e7a0", [trustedIphoneVersion])
        : reloadRequired
          ? text("legacy.298fb402d67d")
          : text("legacy.cd18a41ea0d5")
      : phase === "current"
        ? text("legacy.903a3a7b8905")
        : phase === "error"
          ? text("legacy.d244be2624f5")
          : text("legacy.5b46cb808259");

  return (
    <section className="settings-section pwa-update-settings">
      <h2>{text("legacy.c13624186335")}</h2>
      <div className="setting-row">
        <div>
          <RefreshCw aria-hidden="true" />
          <div className="pwa-update-settings-copy">
            <span aria-live="polite">
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            {(version || localizedBuildTime) && (
              <small className="pwa-update-build">
                {version && (
                  <>
                    {text("legacy.efd407326133")} {version}
                  </>
                )}
                {version && localizedBuildTime && " · "}
                {localizedBuildTime && (
                  <>
                    {text("legacy.f626b1ba4390")}:{" "}
                    <time dateTime={buildTime}>{localizedBuildTime}</time>
                  </>
                )}
              </small>
            )}
          </div>
        </div>
        <button
          className="button button-quiet pwa-update-settings-button"
          disabled={busy}
          onClick={() =>
            void (updateAvailable ? applyUpdate() : checkForUpdate())
          }
        >
          {phase === "checking"
            ? text("legacy.28ad1f395a19")
            : phase === "applying"
              ? text("legacy.7baf61c8976e")
              : updateAvailable
                ? text("legacy.42e433696b8c")
                : text("legacy.608b14acda35")}
        </button>
      </div>
    </section>
  );
}
