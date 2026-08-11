export const directConnectionStateEvent =
  "flash-n-flip:direct-connection-state";
export const directPeerDeviceChangedEvent =
  "flash-n-flip:direct-peer-device-changed";

export type DirectConnectionState =
  "disconnected" | "transport-connected" | "syncing" | "synced" | "error";

export const publishDirectConnectionState = (
  state: DirectConnectionState,
): void => {
  document.documentElement.dataset.directConnectionState = state;
  window.dispatchEvent(new Event(directConnectionStateEvent));
};

export const directConnectionIsConnected = (): boolean =>
  directConnectionState() === "synced";

export const directConnectionState = (): DirectConnectionState => {
  const state = document.documentElement.dataset.directConnectionState;
  return state === "transport-connected" ||
    state === "syncing" ||
    state === "synced" ||
    state === "error"
    ? state
    : "disconnected";
};

export const publishDirectPeerDeviceId = (deviceId: string | null): void => {
  if (deviceId) document.documentElement.dataset.directPeerDeviceId = deviceId;
  else delete document.documentElement.dataset.directPeerDeviceId;
  window.dispatchEvent(new Event(directPeerDeviceChangedEvent));
};

export const directPeerDeviceId = (): string | null =>
  document.documentElement.dataset.directPeerDeviceId ?? null;
