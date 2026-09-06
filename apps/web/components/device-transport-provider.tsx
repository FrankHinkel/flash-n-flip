"use client";

import { createId, formatByteSize } from "@flashcards/domain";
import { readCloudPolicy, cloudPolicyChanged } from "@flashcards/direct-connect-webstack/cloud-library-policy";
import { Globe, Network, Unplug, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { api } from "../lib/api";
import { apiIsReachable } from "../lib/api-connectivity";
import {
  automaticConnectionPartner,
  automaticConnectionRefreshMs,
} from "../lib/automatic-device-connection";
import {
  automaticConnectionSecret,
  createEphemeralPairingKey,
  deviceCapabilities,
  getOrCreateLocalDeviceIdentity,
  pairingProof,
} from "../lib/device-identity";
import {
  establishPairingPeerConnection,
  type PairingPeerConnection,
} from "../lib/peer-connection";
import { webRtcPeerConnectionAvailable } from "../lib/web-rtc-capability";
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
  const [channel, setChannel] = useState<RTCDataChannel | null>(null);
  const [remoteDeviceId, setRemoteDeviceId] = useState<string | null>(null);
  const [serverReachable, setServerReachable] = useState(false);
  const [pairedDeviceAvailable, setPairedDeviceAvailable] = useState(false);
  const [incoming, setIncoming] = useState<IncomingDeckTransfer | null>(null);
  const [progress, setProgress] = useState<DeckTransferProgress | null>(null);
  const [error, setError] = useState("");
  const connectionRef = useRef<PairingPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const connectingRef = useRef(false);
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

  const disconnect = useCallback(() => {
    manager.detach();
    connectionRef.current?.close();
    connectionRef.current = null;
    channelRef.current = null;
    setChannel(null);
    setRemoteDeviceId(null);
  }, [manager]);

  const adoptConnection = useCallback(
    (input: {
      connection: PairingPeerConnection;
      channel: RTCDataChannel;
      localDeviceId: string;
      remoteDeviceId: string;
    }) => {
      if (connectionRef.current !== input.connection) {
        connectionRef.current?.close();
      }
      manager.attach(input.channel, input.localDeviceId, input.remoteDeviceId);
      connectionRef.current = input.connection;
      channelRef.current = input.channel;
      setChannel(input.channel);
      setRemoteDeviceId(input.remoteDeviceId);
      setError("");
      input.channel.addEventListener(
        "close",
        () => {
          if (channelRef.current !== input.channel) return;
          channelRef.current = null;
          connectionRef.current = null;
          setChannel(null);
          setRemoteDeviceId(null);
        },
        { once: true },
      );
    },
    [manager],
  );

  const refreshDevicesAndConnection = useCallback(async () => {
    if (await readCloudPolicy()) { disconnect(); return; }
    if (!navigator.onLine) return;
    const identity = await getOrCreateLocalDeviceIdentity();
    await api.registerDevice({
      id: identity.id,
      displayName: identity.displayName,
      platform: identity.platform,
      publicKey: identity.publicKey,
      capabilities: deviceCapabilities(identity.platform),
    });
    const result = await api.listDevices();
    setServerReachable(true);
    const activePeers = result.devices.filter(
      (device) => device.id !== identity.id && !device.revokedAt,
    );
    setPairedDeviceAvailable(activePeers.length > 0);
    if (
      channelRef.current?.readyState === "open" ||
      connectingRef.current ||
      !webRtcPeerConnectionAvailable()
    ) {
      return;
    }
    const partner = automaticConnectionPartner(result.devices, identity.id);
    if (!partner) return;
    connectingRef.current = true;
    try {
      let session;
      let secret: string;
      if (partner.role === "INITIATOR") {
        const [ephemeral, sessionId] = await Promise.all([
          createEphemeralPairingKey(),
          Promise.resolve(createId()),
        ]);
        secret = await automaticConnectionSecret(sessionId);
        session = await api.createAutomaticConnectionSession({
          id: sessionId,
          initiatorDeviceId: identity.id,
          joiningDeviceId: partner.device.id,
          initiatorEphemeralPublicKey: ephemeral.publicKey,
          initiatorFingerprintProof: await pairingProof(
            secret,
            `${identity.id}:${ephemeral.publicKey}`,
          ),
        });
        const deadline = Date.now() + automaticConnectionRefreshMs + 5_000;
        while (session.state === "CREATED" && Date.now() < deadline) {
          await new Promise((resolve) => window.setTimeout(resolve, 750));
          session = await api.getPairingSession(session.id, identity.id);
        }
        if (
          session.state !== "CONFIRMED" ||
          !session.joiningEphemeralPublicKey ||
          !session.joiningFingerprintProof
        ) {
          return;
        }
        const expectedJoiningProof = await pairingProof(
          secret,
          `${partner.device.id}:${session.joiningEphemeralPublicKey}`,
        );
        if (expectedJoiningProof !== session.joiningFingerprintProof) {
          throw new Error("Automatic device connection proof does not match");
        }
      } else {
        const pending = await api.getPendingAutomaticConnectionSession(
          identity.id,
        );
        if (
          !pending.session ||
          pending.session.initiatorDeviceId !== partner.device.id ||
          pending.session.joiningDeviceId !== identity.id
        ) {
          return;
        }
        secret = await automaticConnectionSecret(pending.session.id);
        const expectedInitiatorProof = await pairingProof(
          secret,
          `${partner.device.id}:${pending.session.initiatorEphemeralPublicKey}`,
        );
        if (
          expectedInitiatorProof !== pending.session.initiatorFingerprintProof
        ) {
          throw new Error("Automatic device connection proof does not match");
        }
        const ephemeral = await createEphemeralPairingKey();
        session = await api.joinPairingSession(pending.session.id, {
          joiningDeviceId: identity.id,
          joiningEphemeralPublicKey: ephemeral.publicKey,
          joiningFingerprintProof: await pairingProof(
            secret,
            `${identity.id}:${ephemeral.publicKey}`,
          ),
        });
      }
      let peerConnection: PairingPeerConnection = { close() {} };
      peerConnection = await establishPairingPeerConnection({
        session,
        localDeviceId: identity.id,
        secret,
        role: partner.role,
        onStatus(status) {
          if (status === "CLOSED" || status === "FAILED") disconnect();
        },
        onDataChannel(dataChannel) {
          adoptConnection({
            connection: peerConnection,
            channel: dataChannel,
            localDeviceId: identity.id,
            remoteDeviceId: partner.device.id,
          });
        },
      });
      connectionRef.current = peerConnection;
    } catch {
      // A peer can disappear between heartbeats. Retry quietly on the next pass.
    } finally {
      connectingRef.current = false;
    }
  }, [adoptConnection, disconnect]);

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
      void refreshDevicesAndConnection().catch(() => {});
    };
    const handleOffline = () => setServerReachable(false);
    window.addEventListener(cloudPolicyChanged, disconnect);
    refreshAll();
    const interval = window.setInterval(
      refreshAll,
      automaticConnectionRefreshMs,
    );
    window.addEventListener("focus", refreshAll);
    window.addEventListener("online", refreshAll);
    window.addEventListener("offline", handleOffline);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshAll);
      window.removeEventListener("online", refreshAll);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(cloudPolicyChanged, disconnect);
    };
  }, [refreshDevicesAndConnection, refreshServerReachability]);

  useEffect(
    () => () => {
      manager.detach();
      connectionRef.current?.close();
    },
    [manager],
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
        adoptConnection(input);
      },
      disconnect,
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
      adoptConnection,
      disconnect,
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
    VPS_INTERNET: text("legacy.790a0cea442c"),
    VPS_LAN: text("legacy.9eec5ce41d05"),
    LOCAL_LAN: text("legacy.c366a9831f3c"),
    VPS_ONLY: text("legacy.49512a722fd1"),
    DISCONNECTED: text("legacy.3dd88cda3ced"),
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
              {text("legacy.ad023b82c3e5")}: {incoming.deckTitle}
            </strong>
            <span>
              {incoming.cardCount} {text("legacy.69551da67e93")} ·{" "}
              {formatByteSize(incoming.totalBytes)}
            </span>
          </>
        ) : progress ? (
          <>
            <strong>
              {progress.direction === "SEND"
                ? text("legacy.8cf715b2c9a3")
                : text("legacy.eca6bd956a64")}
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
            {text("legacy.aecf1f3f62c7")}
          </button>
          <button className="button" onClick={() => void acceptIncoming()}>
            {text("legacy.ad023b82c3e5")}
          </button>
        </div>
      ) : progressDone || error ? (
        <button
          className="icon-button"
          aria-label={text("legacy.43e98a780aef")}
          onClick={clearError}
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
    </aside>
  );
}
