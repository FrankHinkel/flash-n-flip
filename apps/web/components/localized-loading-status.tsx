"use client";

import { useI18n } from "./i18n-provider";

export function LocalizedLoadingStatus() {
  const { text } = useI18n();

  return (
    <main className="auth-check" aria-busy="true">
      <span className="sr-only">{text("app.loading")}</span>
    </main>
  );
}
