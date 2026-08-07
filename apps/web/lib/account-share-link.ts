"use client";

import {
  accountShareQrPayloadSchema,
  type AccountShareQrPayload,
} from "@flashcards/domain";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
};

const base64UrlToBytes = (value: string): Uint8Array => {
  const padded = `${value.replaceAll("-", "+").replaceAll("_", "/")}${"=".repeat(
    (4 - (value.length % 4)) % 4,
  )}`;
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function encodeAccountShareLink(payload: AccountShareQrPayload): string {
  const parsed = accountShareQrPayloadSchema.parse(payload);
  const encoded = bytesToBase64Url(encoder.encode(JSON.stringify(parsed)));
  return `${parsed.serverOrigin.replace(/\/$/, "")}/app/decks#share=${encoded}`;
}

export function decodeAccountShareLink(value: string): AccountShareQrPayload {
  const url = value.includes("://")
    ? new URL(value)
    : new URL(`https://share.invalid/#share=${value}`);
  const encoded = new URLSearchParams(url.hash.slice(1)).get("share");
  if (!encoded) throw new Error("Share invitation is invalid");
  return accountShareQrPayloadSchema.parse(
    JSON.parse(decoder.decode(base64UrlToBytes(encoded))),
  );
}
