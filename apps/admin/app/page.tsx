"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { api } from "../lib/api";

export default function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState("");
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const result = await api.login(
        String(data.get("email")),
        String(data.get("password")),
        "Flora Moderation",
      );
      if (
        !result.user.roles.includes("ADMIN") &&
        !result.user.roles.includes("REVIEWER")
      ) {
        await api.logout();
        setError("Für dieses Konto fehlt die Moderationsrolle.");
        return;
      }
      router.push("/queue");
    } catch {
      setError("Anmeldung fehlgeschlagen.");
    }
  }
  return (
    <main className="admin-login">
      <section>
        <span className="admin-mark">
          <ShieldCheck />
        </span>
        <small>FLORA · INTERN</small>
        <h1>Moderation</h1>
        <p>Nur für autorisierte Prüferinnen, Prüfer und Administratoren.</p>
        <form onSubmit={login}>
          <label>
            E-Mail
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Passwort
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
          <button>Anmelden</button>
        </form>
      </section>
    </main>
  );
}
