import type { PairingSessionState } from "@flashcards/domain/device-sync";

export const pairingSessionTtlMs = 5 * 60 * 1000;
export const maximumPairingAttempts = 8;
export const maximumTrustedDeviceGroupSize = 16;

export type DevicePairingEdge = {
  deviceAId: string;
  deviceBId: string;
  revokedAt: Date | string | null;
};

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

export function trustedDeviceGroupMembers(input: {
  seedDeviceIds: readonly string[];
  activeDeviceIds: readonly string[];
  pairings: readonly DevicePairingEdge[];
}): string[] {
  const active = new Set(input.activeDeviceIds);
  const adjacency = new Map<string, Set<string>>();
  for (const pairing of input.pairings) {
    if (
      pairing.revokedAt ||
      !active.has(pairing.deviceAId) ||
      !active.has(pairing.deviceBId)
    ) {
      continue;
    }
    const fromA = adjacency.get(pairing.deviceAId) ?? new Set<string>();
    fromA.add(pairing.deviceBId);
    adjacency.set(pairing.deviceAId, fromA);
    const fromB = adjacency.get(pairing.deviceBId) ?? new Set<string>();
    fromB.add(pairing.deviceAId);
    adjacency.set(pairing.deviceBId, fromB);
  }

  const members = new Set(
    input.seedDeviceIds.filter((deviceId) => active.has(deviceId)),
  );
  const pending = [...members];
  while (pending.length > 0) {
    const deviceId = pending.shift()!;
    for (const peerDeviceId of adjacency.get(deviceId) ?? []) {
      if (members.has(peerDeviceId)) continue;
      members.add(peerDeviceId);
      pending.push(peerDeviceId);
    }
  }
  if (members.size > maximumTrustedDeviceGroupSize) {
    throw new Error(
      `A trusted device group is limited to ${maximumTrustedDeviceGroupSize} devices`,
    );
  }
  return [...members].sort((left, right) => left.localeCompare(right));
}

export function completeTrustedDeviceGroupPairings(
  deviceIds: readonly string[],
): Array<[string, string]> {
  const devices = [...new Set(deviceIds)].sort((left, right) =>
    left.localeCompare(right),
  );
  if (devices.length > maximumTrustedDeviceGroupSize) {
    throw new Error(
      `A trusted device group is limited to ${maximumTrustedDeviceGroupSize} devices`,
    );
  }
  const pairs: Array<[string, string]> = [];
  for (let left = 0; left < devices.length; left += 1) {
    for (let right = left + 1; right < devices.length; right += 1) {
      pairs.push([devices[left]!, devices[right]!]);
    }
  }
  return pairs;
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
