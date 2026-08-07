import type { Device } from "@flashcards/domain";

export const automaticConnectionRefreshMs = 30_000;
export const automaticDeviceActivityMs = 120_000;

export function automaticConnectionPartner(
  devices: readonly Device[],
  localDeviceId: string,
  now = Date.now(),
): { device: Device; role: "INITIATOR" | "JOINER" } | null {
  const active = devices
    .filter(
      (device) =>
        !device.revokedAt &&
        device.capabilities.includes("WEBRTC_V1") &&
        now - new Date(device.lastSeenAt).getTime() <=
          automaticDeviceActivityMs,
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const localIndex = active.findIndex((device) => device.id === localDeviceId);
  if (localIndex < 0) return null;
  const partnerIndex = localIndex % 2 === 0 ? localIndex + 1 : localIndex - 1;
  const device = active[partnerIndex];
  if (!device) return null;
  return {
    device,
    role: localDeviceId.localeCompare(device.id) < 0 ? "INITIATOR" : "JOINER",
  };
}
