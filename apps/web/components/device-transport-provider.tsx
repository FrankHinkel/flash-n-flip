"use client";

import { formatByteSize } from "@flashcards/domain";
import { Network, X } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { PairingPeerConnection } from "../lib/peer-connection";
import {
  PeerDeckTransferManager,
  type DeckTransferProgress,
  type IncomingDeckTransfer,
} from "../lib/peer-deck-transfer";
import { useI18n } from "./i18n-provider";

type DeviceTransportValue = {
  directConnected: boolean;
  remoteDeviceId: string | null;
  incoming: IncomingDeckTransfer | null;
  progress: DeckTransferProgress | null;
  error: string;
  adoptPairingConnection(input: {
    connection: PairingPeerConnection;
    channel: RTCDataChannel;
    localDeviceId: string;
    remoteDeviceId: string;
  }): void;
  disconnect(): void;
  sendDeck(deckId: string): Promise<void>;
  acceptIncoming(): Promise<void>;
  rejectIncoming(): void;
  clearError(): void;
};

const DeviceTransportContext = createContext<DeviceTransportValue | null>(null);

export function DeviceTransportProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [connection, setConnection] = useState<PairingPeerConnection | null>(
    null,
  );
  const [channel, setChannel] = useState<RTCDataChannel | null>(null);
  const [remoteDeviceId, setRemoteDeviceId] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<IncomingDeckTransfer | null>(null);
  const [progress, setProgress] = useState<DeckTransferProgress | null>(null);
  const [error, setError] = useState("");
  const manager = useMemo(
    () =>
      new PeerDeckTransferManager({
        onIncoming: setIncoming,
        onProgress: setProgress,
        onError: setError,
      }),
    [],
  );

  useEffect(
    () => () => {
      manager.detach();
      connection?.close();
    },
    [connection, manager],
  );

  const value = useMemo<DeviceTransportValue>(
    () => ({
      directConnected: channel?.readyState === "open",
      remoteDeviceId,
      incoming,
      progress,
      error,
      adoptPairingConnection(input) {
        connection?.close();
        manager.attach(
          input.channel,
          input.localDeviceId,
          input.remoteDeviceId,
        );
        setConnection(input.connection);
        setChannel(input.channel);
        setRemoteDeviceId(input.remoteDeviceId);
        setError("");
        input.channel.addEventListener(
          "close",
          () => {
            setChannel(null);
            setRemoteDeviceId(null);
          },
          { once: true },
        );
      },
      disconnect() {
        manager.detach();
        connection?.close();
        setConnection(null);
        setChannel(null);
        setRemoteDeviceId(null);
      },
      sendDeck: (deckId) => manager.sendDeck(deckId),
      acceptIncoming: () => manager.acceptIncoming(),
      rejectIncoming: () => manager.rejectIncoming(),
      clearError: () => {
        setError("");
        setProgress(null);
      },
    }),
    [channel, connection, error, incoming, manager, progress, remoteDeviceId],
  );

  return (
    <DeviceTransportContext.Provider value={value}>
      {children}
    </DeviceTransportContext.Provider>
  );
}

export function useDeviceTransport(): DeviceTransportValue {
  const value = useContext(DeviceTransportContext);
  if (!value) {
    throw new Error(
      "useDeviceTransport must be used inside DeviceTransportProvider",
    );
  }
  return value;
}

export function DeviceTransferBanner() {
  const { text } = useI18n();
  const {
    incoming,
    progress,
    error,
    acceptIncoming,
    rejectIncoming,
    clearError,
  } = useDeviceTransport();
  if (!incoming && !progress && !error) return null;
  const percent = progress
    ? progress.totalBytes === 0
      ? 100
      : Math.min(100, (progress.verifiedBytes / progress.totalBytes) * 100)
    : 0;
  const progressDone =
    progress?.state === "COMPLETED" || progress?.state === "FAILED";
  return (
    <aside className="device-transfer-banner" aria-live="polite">
      <Network aria-hidden="true" />
      <div>
        {incoming ? (
          <>
            <strong>
              {text("Receive", "Empfangen")}: {incoming.deckTitle}
            </strong>
            <span>
              {incoming.cardCount} {text("cards", "Karten")} ·{" "}
              {formatByteSize(incoming.totalBytes)}
            </span>
          </>
        ) : progress ? (
          <>
            <strong>
              {progress.direction === "SEND"
                ? text("Sending", "Wird gesendet")
                : text("Receiving", "Wird empfangen")}
              : {progress.deckTitle}
            </strong>
            <span>
              {formatByteSize(progress.verifiedBytes)} /{" "}
              {formatByteSize(progress.totalBytes)} · {Math.round(percent)} %
            </span>
            <progress max={100} value={percent}>
              {Math.round(percent)} %
            </progress>
          </>
        ) : (
          <strong>{error}</strong>
        )}
      </div>
      {incoming ? (
        <div className="device-transfer-actions">
          <button className="button button-quiet" onClick={rejectIncoming}>
            {text("Decline", "Ablehnen")}
          </button>
          <button className="button" onClick={() => void acceptIncoming()}>
            {text("Receive", "Empfangen")}
          </button>
        </div>
      ) : progressDone || error ? (
        <button
          className="icon-button"
          aria-label={text("Close status", "Status schließen")}
          onClick={clearError}
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
    </aside>
  );
}
