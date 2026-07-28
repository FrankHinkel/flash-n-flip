"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@flashcards/api-client";

import { api } from "../lib/api";
import { useI18n } from "./i18n-provider";

export function RequiredPasswordChangeForm() {
  const router = useRouter();
  const { locale, text } = useI18n();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((user) => {
        if (!active) return;
        if (!user.passwordChangeRequired) {
          router.replace("/app");
          return;
        }
        setChecking(false);
        requestAnimationFrame(() => passwordRef.current?.focus());
      })
      .catch(() => router.replace("/login"));
    return () => {
      active = false;
    };
  }, [router]);

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
      passwordRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await api.changeRequiredPassword({
        newPassword,
        termsAccepted: true,
        privacyAcknowledged: true,
        locale,
      });
      router.replace("/app");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : text(
              "The password could not be changed.",
              "Das Passwort konnte nicht geändert werden.",
            ),
      );
      passwordRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <p className="auth-form-status" aria-live="polite">
        {text("Checking account …", "Konto wird geprüft …")}
      </p>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <p className="password-change-explanation">
        {text(
          "Your administrator issued a temporary password. Choose a personal password before continuing.",
          "Dein Administrator hat ein Startpasswort vergeben. Lege vor dem Fortfahren ein persönliches Passwort fest.",
        )}
      </p>
      <label>
        {text("New password", "Neues Passwort")}
        <input
          ref={passwordRef}
          name="newPassword"
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
          placeholder={text("At least 12 characters", "Mindestens 12 Zeichen")}
        />
      </label>
      <label>
        {text("Repeat new password", "Neues Passwort wiederholen")}
        <input
          name="confirmPassword"
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
        />
      </label>
      <label className="auth-consent">
        <input name="terms" type="checkbox" required />
        <span>
          {text("I accept the ", "Ich akzeptiere die ")}
          <Link href="/legal/terms" target="_blank">
            {text("terms of use", "Nutzungsbedingungen")}
          </Link>
          .
        </span>
      </label>
      <label className="auth-consent">
        <input name="privacy" type="checkbox" required />
        <span>
          {text(
            "I have read the privacy policy",
            "Ich habe die Datenschutzerklärung gelesen",
          )}{" "}
          (
          <Link href="/legal/privacy" target="_blank">
            {text("open", "öffnen")}
          </Link>
          ).
        </span>
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-primary button-large" disabled={busy}>
        {busy
          ? text("Saving …", "Wird gespeichert …")
          : text("Set password", "Passwort festlegen")}
      </button>
    </form>
  );
}
