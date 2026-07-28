"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { api } from "../lib/api";
import { useI18n } from "../components/i18n-provider";

export default function AdminLogin() {
  const router = useRouter();
  const { text } = useI18n();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const data = new FormData(event.currentTarget);
    try {
      const result = await api.adminAccess(
        String(data.get("accessPassword")),
        "Flash-n-Flip Administration",
      );
      if (!result.user.roles.includes("ADMIN")) throw new Error("Forbidden");
      router.push("/queue");
    } catch {
      setError(
        text(
          "The access password is invalid or tunnel access is not configured.",
          "Das Zugangspasswort ist ungültig oder der Tunnelzugang ist nicht konfiguriert.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <main className="admin-login">
      <section>
        <span className="admin-mark" aria-hidden="true">
          <img alt="" src="/brand/flash-and-flip.svg" />
        </span>
        <small>FLASH-N-FLIP · INTERNAL</small>
        <h1>{text("Administration", "Administration")}</h1>
        <p>
          {text(
            "Open this page only through the local SSH tunnel. The password is kept for this browser tab only.",
            "Diese Seite nur über den lokalen SSH-Tunnel öffnen. Das Passwort gilt nur für diesen Browser-Tab.",
          )}
        </p>
        <form onSubmit={login}>
          <label>
            {text("Access password", "Zugangspasswort")}
            <input
              name="accessPassword"
              type="password"
              required
              minLength={32}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button disabled={submitting}>
            {submitting
              ? text("Connecting …", "Verbindet …")
              : text("Connect", "Verbinden")}
          </button>
        </form>
      </section>
    </main>
  );
}
