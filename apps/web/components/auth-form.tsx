"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@flashcards/api-client";

import { api } from "../lib/api";
import { useI18n } from "./i18n-provider";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { locale, text } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (mode === "login") {
        await api.login(
          String(data.get("email")),
          String(data.get("password")),
          navigator.userAgent.slice(0, 100),
        );
      } else {
        await api.register({
          email: String(data.get("email")),
          password: String(data.get("password")),
          displayName: String(data.get("displayName")),
          locale,
          deviceName: navigator.userAgent.slice(0, 100),
          termsVersion: "2026-07-24",
          privacyVersion: "2026-07-24",
        });
      }
      router.push("/app");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : text(
              "The connection failed. Please try again.",
              "Die Verbindung ist fehlgeschlagen. Bitte versuche es erneut.",
            ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {mode === "register" && (
        <label>
          {text("What should we call you?", "Wie dürfen wir dich nennen?")}
          <input
            name="displayName"
            autoComplete="name"
            minLength={2}
            required
            placeholder={text("Your name", "Dein Name")}
          />
        </label>
      )}
      <label>
        {text("Email", "E-Mail")}
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder={text("you@example.com", "du@beispiel.de")}
        />
      </label>
      <label>
        {text("Password", "Passwort")}
        <input
          name="password"
          type="password"
          minLength={12}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          placeholder={text("At least 12 characters", "Mindestens 12 Zeichen")}
        />
      </label>
      {mode === "register" && (
        <>
          <label className="check-line">
            <input name="terms" type="checkbox" required />
            <span>
              {text("I accept the ", "Ich akzeptiere die ")}
              <Link href="/legal/terms">{text("terms", "Bedingungen")}</Link>.
            </span>
          </label>
          <label className="check-line">
            <input name="privacy" type="checkbox" required />
            <span>
              {text("I have read the ", "Ich habe die ")}
              <Link href="/legal/privacy">
                {text("privacy policy", "Datenschutzerklärung")}
              </Link>
              {text(".", " gelesen.")}
            </span>
          </label>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-primary button-large" disabled={busy}>
        {busy
          ? text("One moment …", "Einen Moment …")
          : mode === "login"
            ? text("Sign in", "Anmelden")
            : text("Create account", "Konto erstellen")}
      </button>
      <p className="form-switch">
        {mode === "login"
          ? text("No account yet?", "Noch kein Konto?")
          : text("Already joined?", "Schon dabei?")}{" "}
        <Link href={mode === "login" ? "/register" : "/login"}>
          {mode === "login"
            ? text("Start for free", "Kostenlos starten")
            : text("Sign in", "Anmelden")}
        </Link>
      </p>
    </form>
  );
}
