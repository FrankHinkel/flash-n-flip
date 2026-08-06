"use client";

import { formatByteSize } from "@flashcards/domain";
import { Globe, Network, Unplug, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api } from "../lib/api";
import { apiIsReachable } from "../lib/api-connectivity";
import { getLocalDeviceIdentity } from "../lib/offline";
import type { PairingPeerConnection } from "../lib/peer-connection";
import {
  PeerDeckTransferManager,
  type DeckTransferProgress,
  type IncomingDeckTransfer,
} from "../lib/peer-deck-transfer";
import {
  deviceConnectionStatusUsesVps,
  resolveDeviceConnectionStatus,
  type DeviceConnectionStatus,
} from "./device-connection-status";
import { useI18n } from "./i18n-provider";

type DeviceTransportValue = {
  directConnected: boolean;
  pairedDeviceAvailable: boolean;
  remoteDeviceId: string | null;
  serverReachable: boolean;
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
  reportPairedDeviceAvailability(available: boolean): void;
  reportServerReachability(reachable: boolean): void;
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
  const [serverReachable, setServerReachable] = useState(false);
  const [pairedDeviceAvailable, setPairedDeviceAvailable] = useState(false);
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

  const refreshServerReachability = useCallback(async () => {
    if (!navigator.onLine) {
      setServerReachable(false);
      return;
    }
    setServerReachable(await apiIsReachable());
  }, []);

  const refreshPairedDeviceAvailability = useCallback(async () => {
    if (!navigator.onLine) return;
    const identity = await getLocalDeviceIdentity();
    if (!identity) {
      setPairedDeviceAvailable(false);
      return;
    }
    const result = await api.listDevices();
    const activeDeviceIds = new Set(
      result.devices
        .filter((device) => !device.revokedAt)
        .map((device) => device.id),
    );
    setPairedDeviceAvailable(
      result.pairings.some((pairing) => {
        if (pairing.revokedAt) return false;
        const remoteDeviceId =
          pairing.deviceAId === identity.id
            ? pairing.deviceBId
            : pairing.deviceBId === identity.id
              ? pairing.deviceAId
              : null;
        return Boolean(remoteDeviceId && activeDeviceIds.has(remoteDeviceId));
      }),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    let checking = false;
    const refresh = async () => {
      if (checking) return;
      checking = true;
      try {
        if (!cancelled) await refreshServerReachability();
      } finally {
        checking = false;
      }
    };
    const refreshAll = () => {
      void refresh();
      void refreshPairedDeviceAvailability().catch(() => {});
    };
    const handleOffline = () => setServerReachable(false);
    refreshAll();
    const interval = window.setInterval(() => void refresh(), 60_000);
    window.addEventListener("focus", refreshAll);
    window.addEventListener("online", refreshAll);
    window.addEventListener("offline", handleOffline);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshAll);
      window.removeEventListener("online", refreshAll);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshPairedDeviceAvailability, refreshServerReachability]);

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
      pairedDeviceAvailable,
      remoteDeviceId,
      serverReachable,
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
      reportPairedDeviceAvailability: setPairedDeviceAvailable,
      reportServerReachability: setServerReachable,
    }),
    [
      channel,
      connection,
      error,
      incoming,
      manager,
      pairedDeviceAvailable,
      progress,
      remoteDeviceId,
      serverReachable,
    ],
  );

  return (
    <DeviceTransportContext.Provider value={value}>
      {children}
    </DeviceTransportContext.Provider>
  );
}

const statusIcon = (status: DeviceConnectionStatus) => {
  if (status === "VPS_INTERNET") return Globe;
  if (status === "VPS_LAN" || status === "LOCAL_LAN") return Network;
  return Unplug;
};

export function DeviceConnectionIndicator() {
  const { text } = useI18n();
  const { directConnected, pairedDeviceAvailable, serverReachable } =
    useDeviceTransport();
  const status = resolveDeviceConnectionStatus({
    directConnected,
    pairedDeviceAvailable,
    serverReachable,
  });
  const Icon = statusIcon(status);
  const label = {
    VPS_INTERNET: text(
      "VPS connected, transfer via internet",
      "VPS verbunden, Übertragung per Internet",
    ),
    VPS_LAN: text(
      "VPS connected, transfer via local network",
      "VPS verbunden, Übertragung im lokalen Netzwerk",
    ),
    LOCAL_LAN: text(
      "VPS unavailable, transfer via local network",
      "VPS nicht erreichbar, Übertragung im lokalen Netzwerk",
    ),
    VPS_ONLY: text(
      "VPS connected, no device connected",
      "VPS verbunden, kein Gerät verbunden",
    ),
    DISCONNECTED: text(
      "VPS and device unavailable",
      "VPS und Gerät nicht erreichbar",
    ),
  }[status];

  return (
    <span
      aria-label={label}
      aria-live="polite"
      className={`device-connection-indicator ${
        deviceConnectionStatusUsesVps(status) ? "vps-online" : "vps-offline"
      } status-${status.toLowerCase().replaceAll("_", "-")}`}
      data-device-connection-status={status}
      role="status"
    >
      <Icon aria-hidden="true" size={20} />
    </span>
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
