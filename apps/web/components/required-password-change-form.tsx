"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ApiError } from "@flashcards/api-client";

import { api } from "../lib/api";
import { useI18n } from "./i18n-provider";

export function RequiredPasswordChangeForm() {
  const router = useRouter();
  const { locale, text } = useI18n();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .me()
      .then((user) => {
        if (!active) return;
        if (!user.passwordChangeRequired) {
          router.replace("/app");
          return;
        }
        setChecking(false);
        requestAnimationFrame(() => passwordRef.current?.focus());
      })
      .catch(() => router.replace("/login"));
    return () => {
      active = false;
    };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get("newPassword"));
    if (newPassword !== String(data.get("confirmPassword"))) {
      setError(text("legacy.ed3afb148e7b"));
      passwordRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await api.changeRequiredPassword({
        newPassword,
        termsAccepted: true,
        privacyAcknowledged: true,
        locale,
      });
      router.replace("/app");
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : text("legacy.ac9c934b2664"),
      );
      passwordRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <p className="auth-form-status" aria-live="polite">
        {text("legacy.0f581900c8e4")}
      </p>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <p className="password-change-explanation">
        {text("legacy.8e6e65bd38c2")}
      </p>
      <label>
        {text("legacy.070877feba4d")}
        <input
          ref={passwordRef}
          name="newPassword"
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
          placeholder={text("legacy.46d2fc265688")}
        />
      </label>
      <label>
        {text("legacy.e5fb3fa03c46")}
        <input
          name="confirmPassword"
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
        />
      </label>
      <label className="auth-consent">
        <input name="terms" type="checkbox" required />
        <span>
          {text("legacy.243f5b03b367")}
          <Link href="/legal/terms" target="_blank">
            {text("legacy.e4c4916120a2")}
          </Link>
          .
        </span>
      </label>
      <label className="auth-consent">
        <input name="privacy" type="checkbox" required />
        <span>
          {text("legacy.32a1d4cdf16b")} (
          <Link href="/legal/privacy" target="_blank">
            {text("legacy.91f0d20f8e70")}
          </Link>
          ).
        </span>
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-primary button-large" disabled={busy}>
        {busy ? text("legacy.8e2373b43923") : text("legacy.eb50fcebf469")}
      </button>
    </form>
  );
}
