"use client";

import { Sprout } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthForm } from "../../components/auth-form";
import { Brand } from "../../components/brand";
import { useI18n } from "../../components/i18n-provider";
import { api } from "../../lib/api";
import { hasBrowserSessionHint } from "../../lib/auth-storage";

export default function LoginPage() {
  const router = useRouter();
  const { text } = useI18n();
  const [checkingSession, setCheckingSession] = useState(
    () =>
      typeof window !== "undefined" &&
      hasBrowserSessionHint(window.localStorage),
  );

  useEffect(() => {
    if (!checkingSession) return;
    let active = true;
    api
      .me()
      .then(() => {
        if (active) router.replace("/app");
      })
      .catch(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, [checkingSession, router]);

  if (checkingSession) {
    return (
      <main className="auth-check" aria-busy="true" aria-live="polite">
        <Sprout size={30} />
        <span>{text("Checking session …", "Sitzung wird geprüft …")}</span>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <Brand className="auth-brand" />
      <section className="auth-panel">
        <span className="eyebrow">
          {text("Welcome back", "Willkommen zurück")}
        </span>
        <h1>{text("Keep growing.", "Weiter wachsen.")}</h1>
        <p>
          {text(
            "Your flashcards and progress are waiting for you.",
            "Deine Lernkarten und dein Fortschritt warten auf dich.",
          )}
        </p>
        <AuthForm />
      </section>
      <aside className="auth-quote">
        <blockquote>
          {text(
            "“The roots of education are bitter, but the fruit is sweet.”",
            "„Die Wurzeln der Bildung sind bitter, aber ihre Früchte sind süß.“",
          )}
        </blockquote>
        <span>Aristoteles</span>
      </aside>
    </main>
  );
}
