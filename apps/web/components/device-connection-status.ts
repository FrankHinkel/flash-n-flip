export type DeviceConnectionStatus =
  "VPS_INTERNET" | "VPS_LAN" | "LOCAL_LAN" | "VPS_ONLY" | "DISCONNECTED";

export type DeviceConnectionStatusInput = {
  directConnected: boolean;
  pairedDeviceAvailable: boolean;
  serverReachable: boolean;
};

export function resolveDeviceConnectionStatus({
  directConnected,
  pairedDeviceAvailable,
  serverReachable,
}: DeviceConnectionStatusInput): DeviceConnectionStatus {
  if (directConnected) {
    return serverReachable ? "VPS_LAN" : "LOCAL_LAN";
  }
  if (serverReachable) {
    return pairedDeviceAvailable ? "VPS_INTERNET" : "VPS_ONLY";
  }
  return "DISCONNECTED";
}

export function deviceConnectionStatusUsesVps(
  status: DeviceConnectionStatus,
): boolean {
  return (
    status === "VPS_INTERNET" || status === "VPS_LAN" || status === "VPS_ONLY"
  );
}
