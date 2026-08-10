export const directConnectionStateEvent =
  "flash-n-flip:direct-connection-state";

export type DirectConnectionState = "connected" | "disconnected";

export const publishDirectConnectionState = (
  state: DirectConnectionState,
): void => {
  document.documentElement.dataset.directConnectionState = state;
  window.dispatchEvent(new Event(directConnectionStateEvent));
};

export const directConnectionIsConnected = (): boolean =>
  document.documentElement.dataset.directConnectionState === "connected";
