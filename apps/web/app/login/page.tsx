"use client";

import { AuthForm } from "../../components/auth-form";
import { Brand } from "../../components/brand";
import { useI18n } from "../../components/i18n-provider";

export default function LoginPage() {
  const { text } = useI18n();
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
        <AuthForm mode="login" />
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
