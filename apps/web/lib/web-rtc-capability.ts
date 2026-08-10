"use client";

export const webRtcPeerConnectionAvailable = (): boolean =>
  typeof globalThis.RTCPeerConnection === "function";

export const createWebRtcPeerConnection = (
  configuration: RTCConfiguration,
): RTCPeerConnection => {
  const PeerConnection = globalThis.RTCPeerConnection;
  if (typeof PeerConnection !== "function") {
    throw new Error(
      "Direkte Geräteverbindungen sind in dieser Mac-App nicht verfügbar. Bitte Flash-n-Flip im Mac-Browser öffnen.",
    );
  }
  return new PeerConnection(configuration);
};
