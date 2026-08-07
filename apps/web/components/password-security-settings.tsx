"use client";

import { Check, Clipboard, KeyRound, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@flashcards/api-client";

import { api } from "../lib/api";
import { useI18n } from "./i18n-provider";

type RecoveryCode = { recoveryCode: string; expiresAt: string };

export function PasswordSecuritySettings() {
  const { locale, text } = useI18n();
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [busy, setBusy] = useState<"change" | "recovery" | "copy" | null>(null);
  const [recovery, setRecovery] = useState<RecoveryCode | null>(null);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setMessageIsError(false);
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword"));
    if (newPassword !== String(data.get("confirmPassword"))) {
      setMessageIsError(true);
      setMessage(
        text(
          "The passwords do not match.",
          "Die Passwörter stimmen nicht überein.",
        ),
      );
      confirmPasswordRef.current?.focus();
      return;
    }

    setBusy("change");
    try {
      await api.changePassword({
        currentPassword: String(data.get("currentPassword")),
        newPassword,
      });
      form.reset();
      setChangeOpen(false);
      setRecovery(null);
      setMessage(
        text(
          "Password changed. Other devices must sign in again.",
          "Passwort geändert. Andere Geräte müssen sich erneut anmelden.",
        ),
      );
    } catch (cause) {
      setMessageIsError(true);
      setMessage(
        cause instanceof ApiError && cause.status === 400
          ? text(
              "The current password is incorrect or the new password is unchanged.",
              "Das aktuelle Passwort ist falsch oder das neue Passwort ist unverändert.",
            )
          : text(
              "The password could not be changed.",
              "Das Passwort konnte nicht geändert werden.",
            ),
      );
      currentPasswordRef.current?.focus();
    } finally {
      setBusy(null);
    }
  }

  async function createRecoveryCode() {
    setMessage("");
    setMessageIsError(false);
    setBusy("recovery");
    try {
      setRecovery(await api.createPasswordRecoveryCode());
    } catch {
      setMessageIsError(true);
      setMessage(
        text(
          "A recovery code could not be created.",
          "Es konnte kein Wiederherstellungscode erzeugt werden.",
        ),
      );
    } finally {
      setBusy(null);
    }
  }

  async function copyRecoveryCode() {
    if (!recovery) return;
    setBusy("copy");
    try {
      await navigator.clipboard.writeText(recovery.recoveryCode);
      setMessageIsError(false);
      setMessage(text("Code copied.", "Code kopiert."));
    } catch {
      setMessageIsError(true);
      setMessage(
        text(
          "Copying failed. Select the code manually.",
          "Kopieren fehlgeschlagen. Markiere den Code manuell.",
        ),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="settings-section password-security-settings">
      <h2>{text("Security", "Sicherheit")}</h2>
      <button
        className="setting-action"
        type="button"
        aria-expanded={changeOpen}
        onClick={() => {
          setChangeOpen((open) => !open);
          setRecoveryOpen(false);
          setMessage("");
        }}
      >
        <KeyRound aria-hidden="true" />
        <span>
          <strong>{text("Change password", "Passwort ändern")}</strong>
          <small>
            {text(
              "Other devices will sign out",
              "Andere Geräte werden abgemeldet",
            )}
          </small>
        </span>
      </button>
      {changeOpen && (
        <form className="security-password-form" onSubmit={changePassword}>
          <label>
            {text("Current password", "Aktuelles Passwort")}
            <input
              ref={currentPasswordRef}
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              minLength={6}
              maxLength={128}
              required
              autoFocus
            />
          </label>
          <label>
            {text("New password", "Neues Passwort")}
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
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
          <button
            className="button button-primary"
            disabled={busy === "change"}
          >
            {busy === "change"
              ? text("Saving …", "Wird gespeichert …")
              : text("Save password", "Passwort speichern")}
          </button>
        </form>
      )}

      <button
        className="setting-action"
        type="button"
        aria-expanded={recoveryOpen}
        onClick={() => {
          setRecoveryOpen((open) => !open);
          setChangeOpen(false);
          setMessage("");
        }}
      >
        <ShieldCheck aria-hidden="true" />
        <span>
          <strong>{text("Recovery code", "Wiederherstellungscode")}</strong>
          <small>
            {text(
              "Reset another signed-out device without email",
              "Passwort ohne E-Mail auf einem abgemeldeten Gerät zurücksetzen",
            )}
          </small>
        </span>
      </button>
      {recoveryOpen && (
        <div className="security-recovery-panel">
          <p>
            {text(
              "Create a one-time code, then enter it on the password reset page of the other device. It expires after 10 minutes.",
              "Erzeuge einen Einmalcode und gib ihn auf der Passwort-zurücksetzen-Seite des anderen Geräts ein. Er läuft nach 10 Minuten ab.",
            )}
          </p>
          {recovery ? (
            <div className="security-recovery-code">
              <div>
                <output aria-live="polite">{recovery.recoveryCode}</output>
                <small>
                  {text("Valid until", "Gültig bis")}{" "}
                  {new Intl.DateTimeFormat(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(recovery.expiresAt))}
                </small>
              </div>
              <button
                className="icon-button"
                type="button"
                disabled={busy === "copy"}
                aria-label={text("Copy recovery code", "Code kopieren")}
                onClick={() => void copyRecoveryCode()}
              >
                {busy === "copy" ? (
                  <Check aria-hidden="true" />
                ) : (
                  <Clipboard aria-hidden="true" />
                )}
              </button>
            </div>
          ) : (
            <button
              className="button button-primary"
              type="button"
              disabled={busy === "recovery"}
              onClick={() => void createRecoveryCode()}
            >
              {busy === "recovery"
                ? text("Creating …", "Wird erzeugt …")
                : text("Create code", "Code erzeugen")}
            </button>
          )}
        </div>
      )}
      {message && (
        <p
          className={`security-password-message${messageIsError ? " error" : ""}`}
          role={messageIsError ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </section>
  );
}
