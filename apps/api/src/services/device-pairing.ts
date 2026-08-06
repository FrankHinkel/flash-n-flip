import type { PairingSessionState } from "@flashcards/domain/device-sync";

export const pairingSessionTtlMs = 5 * 60 * 1000;
export const maximumPairingAttempts = 8;

export function orderedPair(
  firstDeviceId: string,
  secondDeviceId: string,
): [string, string] {
  if (firstDeviceId === secondDeviceId) {
    throw new Error("A device cannot be paired with itself");
  }
  return firstDeviceId.localeCompare(secondDeviceId) < 0
    ? [firstDeviceId, secondDeviceId]
    : [secondDeviceId, firstDeviceId];
}

export function effectivePairingState(input: {
  state: string;
  expiresAt: Date;
  now?: Date;
}): PairingSessionState {
  if (
    input.state !== "CONFIRMED" &&
    input.state !== "CANCELLED" &&
    input.expiresAt <= (input.now ?? new Date())
  ) {
    return "EXPIRED";
  }
  if (
    input.state === "CREATED" ||
    input.state === "JOINED" ||
    input.state === "CONFIRMED" ||
    input.state === "CANCELLED" ||
    input.state === "EXPIRED"
  ) {
    return input.state;
  }
  throw new Error("Invalid pairing session state");
}

export function deviceParticipatesInSession(input: {
  deviceId: string;
  initiatorDeviceId: string;
  joiningDeviceId: string | null;
}): boolean {
  return (
    input.deviceId === input.initiatorDeviceId ||
    input.deviceId === input.joiningDeviceId
  );
}

export function pairingCanSignal(input: {
  state: PairingSessionState;
  expiresAt: Date;
  now?: Date;
  senderDeviceId: string;
  recipientDeviceId: string;
  initiatorDeviceId: string;
  joiningDeviceId: string | null;
}): boolean {
  if (input.expiresAt <= (input.now ?? new Date())) return false;
  if (input.state !== "JOINED" && input.state !== "CONFIRMED") return false;
  if (!input.joiningDeviceId) return false;
  const participants = new Set([
    input.initiatorDeviceId,
    input.joiningDeviceId,
  ]);
  return (
    input.senderDeviceId !== input.recipientDeviceId &&
    participants.has(input.senderDeviceId) &&
    participants.has(input.recipientDeviceId)
  );
}
