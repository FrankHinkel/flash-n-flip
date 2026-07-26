"use client";

import { AuthForm } from "../../components/auth-form";
import { Brand } from "../../components/brand";
import { useI18n } from "../../components/i18n-provider";

export default function RegisterPage() {
  const { text } = useI18n();
  return (
    <main className="auth-page">
      <Brand className="auth-brand" />
      <section className="auth-panel">
        <span className="eyebrow">
          {text("Your learning space", "Dein Lernraum")}
        </span>
        <h1>
          {text(
            "Start today. Remember for longer.",
            "Heute anfangen. Lange erinnern.",
          )}
        </h1>
        <p>
          {text(
            "Create your free Flash-n-Flip account.",
            "Erstelle dein kostenloses Flash-n-Flip-Konto.",
          )}
        </p>
        <AuthForm mode="register" />
      </section>
      <aside className="auth-quote auth-illustration">
        <span className="orbit orbit-a" />
        <span className="orbit orbit-b" />
        <strong>{text("small steps", "kleine Schritte")}</strong>
        <em>{text("lasting knowledge", "großes Wissen")}</em>
      </aside>
    </main>
  );
}
