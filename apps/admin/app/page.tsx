"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { api } from "../lib/api";
import { useI18n } from "../components/i18n-provider";

export default function AdminLogin() {
  const router = useRouter();
  const { text } = useI18n();
  const [error, setError] = useState("");
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await api.login(
        String(data.get("email")),
        String(data.get("password")),
        "Flash & Flip Moderation",
      );
      if (
        !result.user.roles.includes("ADMIN") &&
        !result.user.roles.includes("REVIEWER")
      ) {
        await api.logout();
        setError(
          text(
            "This account does not have a moderation role.",
            "Für dieses Konto fehlt die Moderationsrolle.",
          ),
        );
        return;
      }
      router.push("/queue");
    } catch {
      setError(text("Sign-in failed.", "Anmeldung fehlgeschlagen."));
    }
  }
  return (
    <main className="admin-login">
      <section>
        <span className="admin-mark">
          <ShieldCheck />
        </span>
        <small>FLASH & FLIP · INTERNAL</small>
        <h1>Moderation</h1>
        <p>
          {text(
            "For authorized reviewers and administrators only.",
            "Nur für autorisierte Prüferinnen, Prüfer und Administratoren.",
          )}
        </p>
        <form onSubmit={login}>
          <label>
            {text("Email", "E-Mail")}
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            {text("Password", "Passwort")}
            <input
              name="password"
              type="password"
              required
              minLength={12}
              autoComplete="current-password"
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button>{text("Sign in", "Anmelden")}</button>
        </form>
      </section>
    </main>
  );
}
