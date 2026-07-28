"use client";

import {
  ClipboardCheck,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError, type AdminUser } from "@flashcards/api-client";

import { api } from "../lib/api";
import { useI18n } from "./i18n-provider";

const randomStartPin = (): string => {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return String(value[0]! % 1_000_000).padStart(6, "0");
};

export function UserManagement() {
  const { text } = useI18n();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const createPinRef = useRef<HTMLInputElement>(null);
  const resetEmailRef = useRef<HTMLInputElement>(null);
  const resetPinRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      setUsers(await api.adminUsers());
    } catch {
      setError(
        text(
          "User accounts could not be loaded.",
          "Die Benutzerkonten konnten nicht geladen werden.",
        ),
      );
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function showError(cause: unknown) {
    setMessage("");
    setError(
      cause instanceof ApiError
        ? cause.message
        : text(
            "The operation could not be completed.",
            "Die Aktion konnte nicht abgeschlossen werden.",
          ),
    );
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const user = await api.createAdminUser({
        email: String(data.get("email")),
        displayName: String(data.get("displayName")),
        locale: String(data.get("locale")) === "de" ? "de" : "en",
        temporaryPassword: String(data.get("temporaryPassword")),
      });
      setMessage(
        text(
          `Account ${user.email} created. The start PIN must be changed at first sign-in.`,
          `Konto ${user.email} wurde angelegt. Die Start-PIN muss bei der ersten Anmeldung geändert werden.`,
        ),
      );
      form.reset();
      await refresh();
    } catch (cause) {
      showError(cause);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const user = await api.resetAdminUserPassword({
        email: String(data.get("email")),
        temporaryPassword: String(data.get("temporaryPassword")),
      });
      setMessage(
        text(
          `Start PIN reset for ${user.email}. Existing sessions were signed out.`,
          `Start-PIN für ${user.email} wurde zurückgesetzt. Bestehende Sitzungen wurden abgemeldet.`,
        ),
      );
      form.reset();
      await refresh();
    } catch (cause) {
      showError(cause);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-shell">
      <aside>
        <div className="admin-brand">
          <img
            alt=""
            aria-hidden="true"
            className="admin-brand-logo"
            src="/brand/flash-and-flip.svg"
          />
          Flash-n-Flip <small>ADMIN</small>
        </div>
        <nav aria-label={text("Admin navigation", "Admin-Navigation")}>
          <Link href="/queue" title={text("Queue", "Warteschlange")}>
            <ClipboardCheck /> {text("Queue", "Warteschlange")}
          </Link>
          <Link
            className="active"
            href="/users"
            aria-current="page"
            title={text("Users", "Benutzer")}
          >
            <Users /> {text("Users", "Benutzer")} <span>{users.length}</span>
          </Link>
        </nav>
        <button
          title={text("Sign out", "Abmelden")}
          onClick={() => api.logout().then(() => location.assign("/"))}
        >
          <LogOut /> {text("Sign out", "Abmelden")}
        </button>
      </aside>
      <main>
        <header>
          <div>
            <small>{text("ACCESS CONTROL", "ZUGANGSVERWALTUNG")}</small>
            <h1>{text("Users", "Benutzer")}</h1>
            <p>
              {text(
                "Create invited accounts and issue one-time start PINs.",
                "Eingeladene Konten anlegen und einmalige Start-PINs vergeben.",
              )}
            </p>
          </div>
          <span className="security-note">
            <ShieldCheck /> {text("Tunnel only", "Nur per Tunnel")}
          </span>
        </header>
        {message && (
          <div className="admin-message" role="status">
            {message}
          </div>
        )}
        {error && (
          <div className="admin-error" role="alert">
            {error}
          </div>
        )}
        <div className="user-admin-grid">
          <section className="user-admin-card">
            <div className="user-admin-card-heading">
              <UserPlus />
              <div>
                <h2>{text("Create account", "Konto anlegen")}</h2>
                <p>
                  {text(
                    "The email domain is unrestricted.",
                    "Die E-Mail-Domain ist frei wählbar.",
                  )}
                </p>
              </div>
            </div>
            <form onSubmit={createUser}>
              <label>
                {text("Display name", "Anzeigename")}
                <input
                  name="displayName"
                  minLength={2}
                  maxLength={80}
                  autoComplete="off"
                  required
                />
              </label>
              <label>
                {text("Email", "E-Mail")}
                <input
                  ref={resetEmailRef}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  required
                />
              </label>
              <label>
                {text("Language", "Sprache")}
                <select name="locale" defaultValue="en">
                  <option value="en">EN English</option>
                  <option value="de">DE Deutsch</option>
                </select>
              </label>
              <div className="pin-field">
                <label>
                  {text("6-digit start PIN", "6-stellige Start-PIN")}
                  <input
                    ref={createPinRef}
                    name="temporaryPassword"
                    type="text"
                    inputMode="numeric"
                    autoComplete="new-password"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    required
                  />
                </label>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    if (createPinRef.current) {
                      createPinRef.current.value = randomStartPin();
                      createPinRef.current.focus();
                      createPinRef.current.select();
                    }
                  }}
                >
                  <RefreshCw /> {text("Generate", "Erzeugen")}
                </button>
              </div>
              <button className="primary-action" disabled={busy}>
                <UserPlus /> {text("Create account", "Konto anlegen")}
              </button>
            </form>
          </section>
          <section className="user-admin-card">
            <div className="user-admin-card-heading">
              <KeyRound />
              <div>
                <h2>{text("Reset start PIN", "Start-PIN zurücksetzen")}</h2>
                <p>
                  {text(
                    "All existing sessions are signed out immediately.",
                    "Alle bestehenden Sitzungen werden sofort abgemeldet.",
                  )}
                </p>
              </div>
            </div>
            <form onSubmit={resetPassword}>
              <label>
                {text("Account email", "E-Mail des Kontos")}
                <input
                  name="email"
                  type="email"
                  inputMode="email"
                  list="admin-user-emails"
                  autoComplete="off"
                  required
                />
                <datalist id="admin-user-emails">
                  {users.map((user) => (
                    <option key={user.id} value={user.email} />
                  ))}
                </datalist>
              </label>
              <div className="pin-field">
                <label>
                  {text("New 6-digit start PIN", "Neue 6-stellige Start-PIN")}
                  <input
                    ref={resetPinRef}
                    name="temporaryPassword"
                    type="text"
                    inputMode="numeric"
                    autoComplete="new-password"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    required
                  />
                </label>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    if (resetPinRef.current) {
                      resetPinRef.current.value = randomStartPin();
                      resetPinRef.current.focus();
                      resetPinRef.current.select();
                    }
                  }}
                >
                  <RefreshCw /> {text("Generate", "Erzeugen")}
                </button>
              </div>
              <button className="primary-action" disabled={busy}>
                <KeyRound /> {text("Reset PIN", "PIN zurücksetzen")}
              </button>
            </form>
          </section>
        </div>
        <section className="user-list" aria-labelledby="user-list-title">
          <div className="user-list-heading">
            <h2 id="user-list-title">{text("Accounts", "Konten")}</h2>
            <span>{users.length}</span>
          </div>
          {users.map((user) => (
            <article key={user.id}>
              <span className="user-avatar" aria-hidden="true">
                {user.displayName.slice(0, 1).toUpperCase()}
              </span>
              <span>
                <strong>{user.displayName}</strong>
                <small>{user.email}</small>
              </span>
              <span className="user-state">
                {user.passwordChangeRequired
                  ? text("PIN change required", "PIN-Wechsel erforderlich")
                  : text("Active", "Aktiv")}
              </span>
              <button
                className="user-reset-action"
                type="button"
                onClick={() => {
                  if (resetEmailRef.current) {
                    resetEmailRef.current.value = user.email;
                    resetEmailRef.current.focus();
                    resetEmailRef.current.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }
                }}
                aria-label={text(
                  `Reset the start PIN for ${user.email}`,
                  `Start-PIN für ${user.email} zurücksetzen`,
                )}
              >
                <KeyRound />
                {text("Reset PIN", "PIN zurücksetzen")}
              </button>
            </article>
          ))}
          {!users.length && (
            <p className="user-list-empty">
              {text("No user accounts yet.", "Noch keine Benutzerkonten.")}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
