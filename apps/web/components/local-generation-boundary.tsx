"use client";

import { useEffect, useState } from "react";

import {
  bootstrapAppleCloudBackupIfFresh,
  retireLegacyLocalProductData,
} from "../lib/local-generation";
import { updateInstalledLocalFnfHelp } from "../lib/local-curated-catalog";
import { useI18n } from "./i18n-provider";

export function LocalGenerationBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  const { text } = useI18n();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void retireLegacyLocalProductData()
      .then(() => bootstrapAppleCloudBackupIfFresh())
      .catch(() => false)
      .then(() => updateInstalledLocalFnfHelp())
      .catch(() => {
        // Keep the existing help usable; retry on the next application launch.
        console.warn("Installed Flash-n-Flip Help could not be updated.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  if (!ready) {
    return (
      <main className="auth-check" aria-busy="true">
        <span className="sr-only">{text("app.preparingLocal")}</span>
      </main>
    );
  }
  return children;
}
