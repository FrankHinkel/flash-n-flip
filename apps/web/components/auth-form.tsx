"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@flashcards/api-client";

import { api } from "../lib/api";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
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
          locale: "de",
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
          : "Die Verbindung ist fehlgeschlagen. Bitte versuche es erneut.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {mode === "register" && (
        <label>
          Wie dürfen wir dich nennen?
          <input
            name="displayName"
            autoComplete="name"
            minLength={2}
            required
            placeholder="Dein Name"
          />
        </label>
      )}
      <label>
        E-Mail
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="du@beispiel.de"
        />
      </label>
      <label>
        Passwort
        <input
          name="password"
          type="password"
          minLength={12}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          placeholder="Mindestens 12 Zeichen"
        />
      </label>
      {mode === "register" && (
        <label className="check-line">
          <input name="legal" type="checkbox" required />
          <span>
            Ich akzeptiere die <Link href="/legal/terms">Bedingungen</Link> und
            habe die <Link href="/legal/privacy">Datenschutzerklärung</Link>{" "}
            gelesen.
          </span>
        </label>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-primary button-large" disabled={busy}>
        {busy
          ? "Einen Moment …"
          : mode === "login"
            ? "Anmelden"
            : "Konto erstellen"}
      </button>
      <p className="form-switch">
        {mode === "login" ? "Noch kein Konto?" : "Schon dabei?"}{" "}
        <Link href={mode === "login" ? "/register" : "/login"}>
          {mode === "login" ? "Kostenlos starten" : "Anmelden"}
        </Link>
      </p>
    </form>
  );
}
