"use client";

import type {
  AccountShareQrPayload,
  PairingQrPayload,
} from "@flashcards/domain";

import { decodeAccountShareLink } from "./account-share-link";
import { decodePairingPayload } from "./device-identity";

const MAX_QR_VALUE_LENGTH = 8_192;

export type FlashNFlipQrAction =
  | { kind: "ACCOUNT_SHARE"; invitation: AccountShareQrPayload }
  | { kind: "DEVICE_PAIRING"; invitation: PairingQrPayload };

const assertExpectedServer = (
  serverOrigin: string,
  expectedOrigin: string,
): void => {
  if (new URL(serverOrigin).origin !== new URL(expectedOrigin).origin) {
    throw new Error("QR code belongs to another server");
  }
};

export function decodeFlashNFlipQrAction(
  value: string,
  expectedOrigin: string,
): FlashNFlipQrAction {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_QR_VALUE_LENGTH) {
    throw new Error("QR code is empty or too large");
  }

  let encodedShare: string | null = null;
  let encodedPairing: string | null = null;
  if (trimmed.includes("://")) {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("QR code protocol is not supported");
    }
    if (url.origin !== new URL(expectedOrigin).origin) {
      throw new Error("QR code belongs to another server");
    }
    const fragment = new URLSearchParams(url.hash.slice(1));
    encodedShare = fragment.get("share");
    encodedPairing = fragment.get("pair");
  } else if (trimmed.startsWith("share=") || trimmed.startsWith("pair=")) {
    const fragment = new URLSearchParams(trimmed);
    encodedShare = fragment.get("share");
    encodedPairing = fragment.get("pair");
  }

  if (encodedShare && encodedPairing) {
    throw new Error("QR code contains more than one action");
  }

  if (encodedShare) {
    const invitation = decodeAccountShareLink(encodedShare);
    assertExpectedServer(invitation.serverOrigin, expectedOrigin);
    return { kind: "ACCOUNT_SHARE", invitation };
  }
  if (encodedPairing) {
    const invitation = decodePairingPayload(encodedPairing);
    assertExpectedServer(invitation.serverOrigin, expectedOrigin);
    return { kind: "DEVICE_PAIRING", invitation };
  }

  // A copied fragment may contain only its opaque value. Supporting that form
  // keeps manual paste useful while both schemas still validate the payload.
  try {
    const invitation = decodeAccountShareLink(trimmed);
    assertExpectedServer(invitation.serverOrigin, expectedOrigin);
    return { kind: "ACCOUNT_SHARE", invitation };
  } catch {
    try {
      const invitation = decodePairingPayload(trimmed);
      assertExpectedServer(invitation.serverOrigin, expectedOrigin);
      return { kind: "DEVICE_PAIRING", invitation };
    } catch {
      throw new Error("QR code is not a supported Flash-n-Flip action");
    }
  }
}
