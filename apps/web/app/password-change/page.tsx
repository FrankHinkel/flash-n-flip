"use client";

import { Brand } from "../../components/brand";
import { RequiredPasswordChangeForm } from "../../components/required-password-change-form";
import { useI18n } from "../../components/i18n-provider";

export default function PasswordChangePage() {
  const { text } = useI18n();
  return (
    <main className="auth-page password-change-page">
      <Brand className="auth-brand" />
      <section className="auth-panel">
        <span className="eyebrow">
          {text("Secure your account", "Konto absichern")}
        </span>
        <h1>{text("Choose a new password.", "Neues Passwort festlegen.")}</h1>
        <RequiredPasswordChangeForm />
      </section>
    </main>
  );
}
