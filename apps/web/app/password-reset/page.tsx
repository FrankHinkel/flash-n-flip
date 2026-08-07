"use client";

import { Brand } from "../../components/brand";
import { useI18n } from "../../components/i18n-provider";
import { PasswordResetForm } from "../../components/password-reset-form";

export default function PasswordResetPage() {
  const { text } = useI18n();
  return (
    <main className="auth-page password-change-page">
      <Brand className="auth-brand" />
      <section className="auth-panel">
        <span className="eyebrow">
          {text("Account recovery", "Kontowiederherstellung")}
        </span>
        <h1>{text("Reset password.", "Passwort zurücksetzen.")}</h1>
        <PasswordResetForm />
      </section>
    </main>
  );
}
