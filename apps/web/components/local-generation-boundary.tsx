"use client";

import { useEffect, useState } from "react";

import {
  bootstrapAppleCloudBackupIfFresh,
  retireLegacyLocalProductData,
} from "../lib/local-generation";
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
