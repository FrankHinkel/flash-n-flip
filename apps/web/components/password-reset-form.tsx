"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@flashcards/api-client";

import { api } from "../lib/api";
import { useI18n } from "./i18n-provider";

export function PasswordResetForm() {
  const router = useRouter();
  const { text } = useI18n();
  const passwordRef = useRef<HTMLInputElement>(null);
  const recoveryCodeRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get("newPassword"));
    if (newPassword !== String(data.get("confirmPassword"))) {
      setError(text("legacy.ed3afb148e7b"));
      confirmPasswordRef.current?.focus();
      return;
    }

    setBusy(true);
    try {
      await api.resetPassword({
        email: String(data.get("email")),
        recoveryCode: String(data.get("recoveryCode")),
        newPassword,
        deviceName: navigator.userAgent.slice(0, 100),
      });
      router.replace("/app");
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 400
          ? text("legacy.db8548fd8c61")
          : text("legacy.fd1dd0dd72f2"),
      );
      if (cause instanceof ApiError && cause.status === 400) {
        recoveryCodeRef.current?.focus();
      } else {
        passwordRef.current?.focus();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <p className="password-change-explanation">
        {text("legacy.f366a217d099")}
      </p>
      <label>
        {text("legacy.a4a2cbfc82fd")}
        <input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          autoFocus
          placeholder="name@example.com"
        />
      </label>
      <label>
        {text("legacy.b75577ffc688")}
        <input
          ref={recoveryCodeRef}
          name="recoveryCode"
          type="text"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          minLength={12}
          maxLength={14}
          required
          placeholder="XXXX-XXXX-XXXX"
        />
      </label>
      <label>
        {text("legacy.070877feba4d")}
        <input
          ref={passwordRef}
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          placeholder={text("legacy.46d2fc265688")}
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
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-primary button-large" disabled={busy}>
        {busy ? text("legacy.7ccb1e11bdc5") : text("legacy.bdc311c7d0f7")}
      </button>
      <p className="form-switch">
        <Link href="/login">{text("legacy.70f4abb786b7")}</Link>
      </p>
    </form>
  );
}
