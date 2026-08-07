"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@flashcards/api-client";

import { api } from "../lib/api";
import { useI18n } from "./i18n-provider";

export function PasswordResetForm() {
  const router = useRouter();
  const { text } = useI18n();
  const passwordRef = useRef<HTMLInputElement>(null);
  const recoveryCodeRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get("newPassword"));
    if (newPassword !== String(data.get("confirmPassword"))) {
      setError(
        text(
          "The passwords do not match.",
          "Die Passwörter stimmen nicht überein.",
        ),
      );
      confirmPasswordRef.current?.focus();
      return;
    }

    setBusy(true);
    try {
      await api.resetPassword({
        email: String(data.get("email")),
        recoveryCode: String(data.get("recoveryCode")),
        newPassword,
        deviceName: navigator.userAgent.slice(0, 100),
      });
      router.replace("/app");
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 400
          ? text(
              "The recovery code is invalid or expired.",
              "Der Wiederherstellungscode ist ungültig oder abgelaufen.",
            )
          : text(
              "The password could not be reset. Please try again.",
              "Das Passwort konnte nicht zurückgesetzt werden. Bitte versuche es erneut.",
            ),
      );
      if (cause instanceof ApiError && cause.status === 400) {
        recoveryCodeRef.current?.focus();
      } else {
        passwordRef.current?.focus();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <p className="password-change-explanation">
        {text(
          "On a device that is still signed in, open Settings → Security and create a recovery code.",
          "Öffne auf einem noch angemeldeten Gerät Einstellungen → Sicherheit und erzeuge dort einen Wiederherstellungscode.",
        )}
      </p>
      <label>
        {text("Email", "E-Mail")}
        <input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
          placeholder="name@example.com"
        />
      </label>
      <label>
        {text("Recovery code", "Wiederherstellungscode")}
        <input
          ref={recoveryCodeRef}
          name="recoveryCode"
          type="text"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          minLength={12}
          maxLength={14}
          required
          placeholder="XXXX-XXXX-XXXX"
        />
      </label>
      <label>
        {text("New password", "Neues Passwort")}
        <input
          ref={passwordRef}
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          placeholder={text("At least 12 characters", "Mindestens 12 Zeichen")}
        />
      </label>
      <label>
        {text("Repeat new password", "Neues Passwort wiederholen")}
        <input
          ref={confirmPasswordRef}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-primary button-large" disabled={busy}>
        {busy
          ? text("Resetting …", "Wird zurückgesetzt …")
          : text("Reset password", "Passwort zurücksetzen")}
      </button>
      <p className="form-switch">
        <Link href="/login">
          {text("Back to sign in", "Zurück zur Anmeldung")}
        </Link>
      </p>
    </form>
  );
}
