"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@flashcards/api-client";

import { api } from "../lib/api";
import { useI18n } from "./i18n-provider";

export function AuthForm() {
  const router = useRouter();
  const { text } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await api.login(
        String(data.get("email")),
        String(data.get("password")),
        navigator.userAgent.slice(0, 100),
      );
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
      <label>
        {text("Email", "E-Mail")}
        <input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="name@hi-sys.de"
        />
      </label>
      <label>
        {text("Password", "Passwort")}
        <input
          name="password"
          type="password"
          minLength={12}
          autoComplete="current-password"
          required
          placeholder={text("At least 12 characters", "Mindestens 12 Zeichen")}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-primary button-large" disabled={busy}>
        {busy
          ? text("One moment …", "Einen Moment …")
          : text("Sign in", "Anmelden")}
      </button>
    </form>
  );
}
