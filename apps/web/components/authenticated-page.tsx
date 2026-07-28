"use client";

import { Sprout } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api, sessionClearedEvent } from "../lib/api";
import { useI18n } from "./i18n-provider";

export function AuthenticatedPage({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { text } = useI18n();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;
    const redirectToLogin = () => {
      if (active) router.replace("/login");
    };
    window.addEventListener(sessionClearedEvent, redirectToLogin);
    api
      .me()
      .then((user) => {
        if (!active) return;
        if (user.passwordChangeRequired) {
          router.replace("/password-change");
          return;
        }
        setAuthenticated(true);
      })
      .catch(() => {
        redirectToLogin();
      });
    return () => {
      active = false;
      window.removeEventListener(sessionClearedEvent, redirectToLogin);
    };
  }, [router]);

  if (!authenticated) {
    return (
      <main className="auth-check" aria-busy="true" aria-live="polite">
        <Sprout size={30} />
        <span>{text("Checking session …", "Sitzung wird geprüft …")}</span>
      </main>
    );
  }

  return children;
}
