"use client";

import { useEffect, useState } from "react";

import {
  bootstrapAppleCloudBackupIfFresh,
  retireLegacyLocalProductData,
} from "../lib/local-generation";

export function LocalGenerationBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
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
        <span className="sr-only">Preparing local application …</span>
      </main>
    );
  }
  return children;
}
