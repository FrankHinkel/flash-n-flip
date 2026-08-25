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
      setMessage(text("legacy.ed3afb148e7b"));
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
      setMessage(text("legacy.d55f38a60137"));
    } catch (cause) {
      setMessageIsError(true);
      setMessage(
        cause instanceof ApiError && cause.status === 400
          ? text("legacy.f599b470e017")
          : text("legacy.ac9c934b2664"),
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
      setMessage(text("legacy.43e82f7640ff"));
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
      setMessage(text("legacy.2dc841c42c91"));
    } catch {
      setMessageIsError(true);
      setMessage(text("legacy.5c65a8fe0b9f"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="settings-section password-security-settings">
      <h2>{text("legacy.2e4223836ccc")}</h2>
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
          <strong>{text("legacy.7d87bda0ad5e")}</strong>
          <small>{text("legacy.55e6e883ed56")}</small>
        </span>
      </button>
      {changeOpen && (
        <form className="security-password-form" onSubmit={changePassword}>
          <label>
            {text("legacy.202bad36d381")}
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
            {text("legacy.070877feba4d")}
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
            {text("legacy.e5fb3fa03c46")}
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
              ? text("legacy.8e2373b43923")
              : text("legacy.91c5539d06d1")}
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
          <strong>{text("legacy.b75577ffc688")}</strong>
          <small>{text("legacy.738789a749ee")}</small>
        </span>
      </button>
      {recoveryOpen && (
        <div className="security-recovery-panel">
          <p>{text("legacy.33d6571d1b18")}</p>
          {recovery ? (
            <div className="security-recovery-code">
              <div>
                <output aria-live="polite">{recovery.recoveryCode}</output>
                <small>
                  {text("legacy.98fe6cd8347a")}{" "}
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
                aria-label={text("legacy.656d0984266b")}
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
                ? text("legacy.99feef23b003")
                : text("legacy.93097adae27d")}
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
