"use client";

import type {
  DevicePairing,
  PairingSessionDetails,
} from "@flashcards/api-client";
import {
  trustedDeviceGroupMembers,
  type Device,
  type PairingQrPayload,
} from "@flashcards/domain";
import {
  Check,
  Clipboard,
  Globe,
  Network,
  Pencil,
  Plus,
  Unplug,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "../lib/api";
import {
  createEphemeralPairingKey,
  createPairingSecret,
  decodePairingPayload,
  deviceCapabilities,
  encodePairingPayload,
  getOrCreateLocalDeviceIdentity,
  pairingConfirmationCode,
  pairingProof,
} from "../lib/device-identity";
import {
  replacePeerDevices,
  storeLocalDeviceIdentity,
  type LocalDeviceIdentity,
} from "../lib/offline";
import {
  establishPairingPeerConnection,
  type PairingPeerConnection,
} from "../lib/peer-connection";
import {
  deviceConnectionStatusUsesVps,
  resolveDeviceConnectionStatus,
} from "./device-connection-status";
import { useI18n } from "./i18n-provider";
import { useDeviceTransport } from "./device-transport-provider";
import { QrCode } from "./qr-code";

type PairingDraft = {
  side: "INITIATOR" | "JOINER";
  secret: string;
  session: PairingSessionDetails;
  qrValue: string | null;
  confirmationCode: string | null;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

export function DeviceSyncSettings() {
  const { text } = useI18n();
  const {
    directConnected,
    pairedDeviceAvailable,
    remoteDeviceId,
    serverReachable,
    adoptPairingConnection,
    disconnect,
    reportPairedDeviceAvailability,
    reportServerReachability,
  } = useDeviceTransport();
  const [identity, setIdentity] = useState<LocalDeviceIdentity | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [pairings, setPairings] = useState<DevicePairing[]>([]);
  const peerConnectionRef = useRef<PairingPeerConnection | null>(null);
  const peerConnectionSessionRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [pendingPayload, setPendingPayload] = useState<PairingQrPayload | null>(
    null,
  );
  const [draft, setDraft] = useState<PairingDraft | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState(false);
  const [deviceNameDraft, setDeviceNameDraft] = useState("");
  const deviceNameInputRef = useRef<HTMLInputElement | null>(null);

  const refreshDevices = useCallback(
    async (localIdentity: LocalDeviceIdentity) => {
      await api.registerDevice({
        id: localIdentity.id,
        displayName: localIdentity.displayName,
        platform: localIdentity.platform,
        publicKey: localIdentity.publicKey,
        capabilities: deviceCapabilities(localIdentity.platform),
      });
      const result = await api.listDevices();
      setDevices(result.devices);
      setPairings(result.pairings);
      reportServerReachability(true);
      const activeDeviceIds = new Set(
        result.devices
          .filter((device) => !device.revokedAt)
          .map((device) => device.id),
      );
      const trustedDeviceIds = new Set(
        trustedDeviceGroupMembers({
          seedDeviceIds: [localIdentity.id],
          activeDeviceIds: [...activeDeviceIds],
          pairings: result.pairings,
        }),
      );
      reportPairedDeviceAvailability(
        [...trustedDeviceIds].some((deviceId) => deviceId !== localIdentity.id),
      );
      await replacePeerDevices(result.devices);
    },
    [reportPairedDeviceAvailability, reportServerReachability],
  );

  useEffect(() => {
    const handleOnline = () => {
      if (identity) {
        void refreshDevices(identity).catch(() =>
          reportServerReachability(false),
        );
      }
    };
    const handleOffline = () => reportServerReachability(false);
    const handleVisible = () => {
      if (identity && document.visibilityState === "visible") handleOnline();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleOnline);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleOnline);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [identity, refreshDevices, reportServerReachability]);

  useEffect(() => {
    let cancelled = false;
    void getOrCreateLocalDeviceIdentity()
      .then(async (localIdentity) => {
        if (cancelled) return;
        setIdentity(localIdentity);
        try {
          await refreshDevices(localIdentity);
        } catch {
          if (!cancelled) reportServerReachability(false);
        }
        const fragment = new URLSearchParams(window.location.hash.slice(1)).get(
          "pair",
        );
        if (fragment && !cancelled) {
          try {
            const payload = decodePairingPayload(fragment);
            if (
              new URL(payload.serverOrigin).origin !== window.location.origin
            ) {
              throw new Error("Pairing server does not match this app");
            }
            setPendingPayload(payload);
          } catch (error) {
            setMessageIsError(true);
            setMessage(errorMessage(error));
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMessageIsError(true);
          setMessage(errorMessage(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshDevices, reportServerReachability]);

  useEffect(() => {
    if (editingDeviceName) deviceNameInputRef.current?.focus();
  }, [editingDeviceName]);

  const pairingSessionId = draft?.session.id ?? null;
  const pairingSecret = draft?.secret ?? null;
  const pairingConfirmation = draft?.confirmationCode ?? null;
  const pairingState = draft?.session.state ?? null;

  useEffect(() => {
    if (!pairingSessionId || !pairingSecret || !identity) return;
    if (
      pairingState === "CONFIRMED" ||
      pairingState === "CANCELLED" ||
      pairingState === "EXPIRED"
    ) {
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const session = await api.getPairingSession(
          pairingSessionId,
          identity.id,
        );
        let confirmationCode = pairingConfirmation;
        if (
          !confirmationCode &&
          session.joiningDeviceId &&
          session.joiningEphemeralPublicKey &&
          session.joiningFingerprintProof
        ) {
          const expectedProof = await pairingProof(
            pairingSecret,
            `${session.joiningDeviceId}:${session.joiningEphemeralPublicKey}`,
          );
          if (expectedProof !== session.joiningFingerprintProof) {
            throw new Error("Pairing proof does not match");
          }
          confirmationCode = await pairingConfirmationCode(
            pairingSecret,
            session.initiatorEphemeralPublicKey,
            session.joiningEphemeralPublicKey,
          );
        }
        if (!cancelled) {
          setDraft((current) =>
            current?.session.id === session.id
              ? { ...current, session, confirmationCode }
              : current,
          );
          if (session.state === "CONFIRMED") {
            setMessageIsError(false);
            setMessage(text("Device paired.", "Gerät gekoppelt."));
            await refreshDevices(identity);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setMessageIsError(true);
          setMessage(errorMessage(error));
        }
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    identity,
    pairingConfirmation,
    pairingSecret,
    pairingSessionId,
    pairingState,
    refreshDevices,
    text,
  ]);

  useEffect(() => {
    if (
      !draft?.confirmationCode ||
      !identity ||
      !draft.session.joiningDeviceId
    ) {
      return;
    }
    if (peerConnectionSessionRef.current === draft.session.id) return;
    peerConnectionRef.current?.close();
    peerConnectionSessionRef.current = draft.session.id;
    let cancelled = false;
    void establishPairingPeerConnection({
      session: draft.session,
      localDeviceId: identity.id,
      secret: draft.secret,
      role: draft.side,
      onStatus(status) {
        if (cancelled) return;
        if (status === "CLOSED" || status === "FAILED") disconnect();
      },
      onDataChannel(channel) {
        const connection = peerConnectionRef.current;
        const remoteDeviceId =
          identity.id === draft.session.initiatorDeviceId
            ? draft.session.joiningDeviceId!
            : draft.session.initiatorDeviceId;
        if (connection) {
          adoptPairingConnection({
            connection,
            channel,
            localDeviceId: identity.id,
            remoteDeviceId,
          });
        }
      },
    })
      .then((connection) => {
        if (cancelled) connection.close();
        else peerConnectionRef.current = connection;
      })
      .catch((error) => {
        if (!cancelled) {
          setMessageIsError(true);
          setMessage(errorMessage(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    adoptPairingConnection,
    disconnect,
    draft?.confirmationCode,
    draft?.session.id,
    identity,
  ]);

  const pairedDeviceIds = useMemo(() => {
    if (!identity) return new Set<string>();
    return new Set(
      trustedDeviceGroupMembers({
        seedDeviceIds: [identity.id],
        activeDeviceIds: devices
          .filter((device) => !device.revokedAt)
          .map((device) => device.id),
        pairings,
      }),
    );
  }, [devices, identity, pairings]);

  const connectionStatus = resolveDeviceConnectionStatus({
    directConnected,
    pairedDeviceAvailable,
    serverReachable,
  });
  const connection = {
    VPS_INTERNET: {
      Icon: Globe,
      label: text("Internet · VPS", "Internet · VPS"),
    },
    VPS_LAN: {
      Icon: Network,
      label: text("Local network · VPS", "Lokales Netzwerk · VPS"),
    },
    LOCAL_LAN: {
      Icon: Network,
      label: text("Local network", "Lokales Netzwerk"),
    },
    VPS_ONLY: {
      Icon: Unplug,
      label: text("VPS · no device", "VPS · kein Gerät"),
    },
    DISCONNECTED: {
      Icon: Unplug,
      label: text("No connection", "Keine Verbindung"),
    },
  }[connectionStatus];
  const connectionClassName = `${
    deviceConnectionStatusUsesVps(connectionStatus)
      ? "vps-online"
      : "vps-offline"
  } status-${connectionStatus.toLowerCase().replaceAll("_", "-")}`;
  const connectionLegend = [
    {
      status: "VPS_INTERNET",
      Icon: Globe,
      description: text(
        "VPS connected; transfer via internet.",
        "VPS verbunden; Übertragung per Internet.",
      ),
    },
    {
      status: "VPS_LAN",
      Icon: Network,
      description: text(
        "VPS connected; direct transfer on the local network.",
        "VPS verbunden; direkte Übertragung im lokalen Netzwerk.",
      ),
    },
    {
      status: "LOCAL_LAN",
      Icon: Network,
      description: text(
        "VPS unavailable; direct transfer on the local network.",
        "VPS nicht erreichbar; direkte Übertragung im lokalen Netzwerk.",
      ),
    },
    {
      status: "VPS_ONLY",
      Icon: Unplug,
      description: text(
        "VPS connected; no device connected.",
        "VPS verbunden; kein Gerät verbunden.",
      ),
    },
    {
      status: "DISCONNECTED",
      Icon: Unplug,
      description: text(
        "Neither the VPS nor another device is connected.",
        "Weder der VPS noch ein anderes Gerät ist verbunden.",
      ),
    },
  ] as const;

  const beginPairing = async () => {
    if (!identity) return;
    setBusy(true);
    setMessage("");
    try {
      const [ephemeral, secret] = await Promise.all([
        createEphemeralPairingKey(),
        Promise.resolve(createPairingSecret()),
      ]);
      const session = await api.createPairingSession({
        initiatorDeviceId: identity.id,
        initiatorEphemeralPublicKey: ephemeral.publicKey,
        initiatorFingerprintProof: await pairingProof(
          secret,
          `${identity.id}:${ephemeral.publicKey}`,
        ),
      });
      const qrValue = encodePairingPayload({
        version: 1,
        serverOrigin: window.location.origin,
        sessionId: session.id,
        secret,
        initiatorDeviceId: identity.id,
        initiatorEphemeralPublicKey: ephemeral.publicKey,
      });
      setDraft({
        side: "INITIATOR",
        secret,
        session,
        qrValue,
        confirmationCode: null,
      });
      setMessageIsError(false);
    } catch (error) {
      setMessageIsError(true);
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const readManualCode = () => {
    try {
      const payload = decodePairingPayload(manualCode.trim());
      if (new URL(payload.serverOrigin).origin !== window.location.origin) {
        throw new Error("Pairing server does not match this app");
      }
      setPendingPayload(payload);
      setMessage("");
      setMessageIsError(false);
    } catch (error) {
      setMessageIsError(true);
      setMessage(errorMessage(error));
    }
  };

  const joinPairing = async () => {
    if (!identity || !pendingPayload) return;
    setBusy(true);
    setMessage("");
    try {
      if (pendingPayload.initiatorDeviceId === identity.id) {
        throw new Error("A device cannot pair with itself");
      }
      const ephemeral = await createEphemeralPairingKey();
      const session = await api.joinPairingSession(pendingPayload.sessionId, {
        joiningDeviceId: identity.id,
        joiningEphemeralPublicKey: ephemeral.publicKey,
        joiningFingerprintProof: await pairingProof(
          pendingPayload.secret,
          `${identity.id}:${ephemeral.publicKey}`,
        ),
      });
      if (
        session.initiatorDeviceId !== pendingPayload.initiatorDeviceId ||
        session.initiatorEphemeralPublicKey !==
          pendingPayload.initiatorEphemeralPublicKey
      ) {
        throw new Error("Pairing session does not match the scanned code");
      }
      const expectedInitiatorProof = await pairingProof(
        pendingPayload.secret,
        `${session.initiatorDeviceId}:${session.initiatorEphemeralPublicKey}`,
      );
      if (expectedInitiatorProof !== session.initiatorFingerprintProof) {
        throw new Error("Pairing proof does not match");
      }
      const confirmationCode = await pairingConfirmationCode(
        pendingPayload.secret,
        session.initiatorEphemeralPublicKey,
        ephemeral.publicKey,
      );
      setDraft({
        side: "JOINER",
        secret: pendingPayload.secret,
        session,
        qrValue: null,
        confirmationCode,
      });
      setPendingPayload(null);
      window.history.replaceState(null, "", window.location.pathname);
      setMessageIsError(false);
    } catch (error) {
      setMessageIsError(true);
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const confirmPairing = async () => {
    if (!identity || !draft?.confirmationCode) return;
    setBusy(true);
    try {
      const confirmationProof = await pairingProof(
        draft.secret,
        `confirm:${draft.session.id}:${identity.id}:${draft.confirmationCode}`,
      );
      const session = await api.confirmPairingSession(draft.session.id, {
        deviceId: identity.id,
        confirmationProof,
      });
      setDraft((current) => (current ? { ...current, session } : current));
      setMessageIsError(false);
      setMessage(
        session.state === "CONFIRMED"
          ? text("Device paired.", "Gerät gekoppelt.")
          : text(
              "Confirmed. Waiting for the other device …",
              "Bestätigt. Warte auf das andere Gerät …",
            ),
      );
      if (session.state === "CONFIRMED") await refreshDevices(identity);
    } catch (error) {
      setMessageIsError(true);
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const cancelPairing = async () => {
    if (!identity || !draft) return;
    try {
      await api.cancelPairingSession(draft.session.id, identity.id);
    } catch {
      // An expired or already consumed session needs no additional cleanup.
    }
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    peerConnectionSessionRef.current = null;
    disconnect();
    setDraft(null);
  };

  const revokeDevice = async (device: Device) => {
    if (
      !identity ||
      !window.confirm(
        text(
          `Remove ${device.displayName} from paired devices?`,
          `${device.displayName} aus den gekoppelten Geräten entfernen?`,
        ),
      )
    )
      return;
    setBusy(true);
    try {
      await api.revokeDevice(device.id);
      await refreshDevices(identity);
      setMessageIsError(false);
      setMessage(text("Device removed.", "Gerät entfernt."));
    } catch (error) {
      setMessageIsError(true);
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const beginDeviceNameEdit = () => {
    if (!identity) return;
    setDeviceNameDraft(identity.displayName);
    setEditingDeviceName(true);
  };

  const saveDeviceName = async () => {
    if (!identity) return;
    const displayName = deviceNameDraft.trim();
    if (!displayName || displayName.length > 80) return;
    const updatedIdentity = { ...identity, displayName };
    setBusy(true);
    let savedLocally = false;
    try {
      await storeLocalDeviceIdentity(updatedIdentity);
      savedLocally = true;
      setIdentity(updatedIdentity);
      setEditingDeviceName(false);
      await api.updateDevice(identity.id, { displayName });
      await refreshDevices(updatedIdentity);
      setMessageIsError(false);
      setMessage(text("Device name saved.", "Gerätename gespeichert."));
    } catch (error) {
      setMessageIsError(true);
      if (savedLocally) {
        setMessage(
          text(
            "Name saved locally and will sync when the VPS is reachable.",
            "Name lokal gespeichert und wird synchronisiert, sobald der VPS erreichbar ist.",
          ),
        );
        reportServerReachability(false);
      } else {
        setMessage(errorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="settings-section device-sync-settings">
      <div className="device-sync-heading">
        <h2>{text("Devices", "Geräte")}</h2>
        <span
          className={`device-connection-status ${connectionClassName}`}
          role="status"
        >
          <connection.Icon aria-hidden="true" size={18} />
          {connection.label}
        </span>
      </div>
      <p className="device-sync-intro">
        {text(
          "Pair your own devices. Decks and learning progress travel directly whenever possible.",
          "Kopple deine eigenen Geräte. Lernsets und Lernfortschritt werden möglichst direkt übertragen.",
        )}
      </p>

      <div
        className="device-connection-legend"
        aria-label={text(
          "Connection status explanation",
          "Erklärung des Verbindungsstatus",
        )}
      >
        {connectionLegend.map(({ status, Icon, description }) => {
          const usesVps = deviceConnectionStatusUsesVps(status);
          return (
            <div className="device-connection-legend-row" key={status}>
              <span
                className={`device-connection-sample ${
                  usesVps ? "vps-online" : "vps-offline"
                } status-${status.toLowerCase().replaceAll("_", "-")}`}
                aria-hidden="true"
              >
                <Icon size={18} />
              </span>
              <span>{description}</span>
            </div>
          );
        })}
      </div>

      {identity ? (
        <div className="device-list" aria-label={text("Devices", "Geräte")}>
          <div className="device-row current">
            <Check aria-hidden="true" />
            {editingDeviceName ? (
              <input
                ref={deviceNameInputRef}
                className="device-name-input"
                value={deviceNameDraft}
                maxLength={80}
                aria-label={text("Device name", "Gerätename")}
                onChange={(event) => setDeviceNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void saveDeviceName();
                  if (event.key === "Escape") setEditingDeviceName(false);
                }}
              />
            ) : (
              <strong>{identity.displayName}</strong>
            )}
            {editingDeviceName ? (
              <span className="device-row-actions">
                <button
                  className="icon-button save"
                  type="button"
                  disabled={!deviceNameDraft.trim() || busy}
                  aria-label={text("Save device name", "Gerätenamen speichern")}
                  onClick={() => void saveDeviceName()}
                >
                  <Check aria-hidden="true" size={19} />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={text("Cancel", "Abbrechen")}
                  onClick={() => setEditingDeviceName(false)}
                >
                  <X aria-hidden="true" size={19} />
                </button>
              </span>
            ) : (
              <button
                className="icon-button edit"
                type="button"
                disabled={busy}
                aria-label={text("Edit device name", "Gerätenamen bearbeiten")}
                onClick={beginDeviceNameEdit}
              >
                <Pencil aria-hidden="true" size={18} />
              </button>
            )}
          </div>
          {devices
            .filter(
              (device) =>
                device.id !== identity.id &&
                !device.revokedAt &&
                pairedDeviceIds.has(device.id),
            )
            .map((device) => (
              <div className="device-row" key={device.id}>
                {directConnected && remoteDeviceId === device.id ? (
                  <Network aria-hidden="true" />
                ) : (
                  <Globe aria-hidden="true" />
                )}
                <strong>{device.displayName}</strong>
                <span className="sr-only">
                  {directConnected && remoteDeviceId === device.id
                    ? text("Directly connected", "Direkt verbunden")
                    : text("Paired via VPS", "Über VPS gekoppelt")}
                </span>
                <button
                  className="icon-button"
                  type="button"
                  disabled={busy}
                  aria-label={text(
                    `Remove ${device.displayName}`,
                    `${device.displayName} entfernen`,
                  )}
                  onClick={() => void revokeDevice(device)}
                >
                  <X aria-hidden="true" size={19} />
                </button>
              </div>
            ))}
        </div>
      ) : null}

      {!draft ? (
        <div className="device-pairing-actions">
          <button
            className="button"
            type="button"
            disabled={!identity || busy || !serverReachable}
            onClick={() => void beginPairing()}
          >
            <Plus aria-hidden="true" size={18} />
            {text("Pair device", "Gerät koppeln")}
          </button>
          <div className="manual-pairing">
            <label htmlFor="manual-pairing-code">
              {text("Pairing link", "Kopplungslink")}
            </label>
            <div>
              <input
                id="manual-pairing-code"
                value={manualCode}
                autoComplete="off"
                spellCheck={false}
                placeholder={text("Paste link", "Link einfügen")}
                onChange={(event) => setManualCode(event.target.value)}
              />
              <button
                className="button button-quiet"
                type="button"
                disabled={!manualCode.trim() || busy}
                onClick={readManualCode}
              >
                <Clipboard aria-hidden="true" size={18} />
                {text("Use", "Öffnen")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingPayload && !draft ? (
        <div className="pairing-confirmation-card">
          <strong>{text("Pair this device?", "Dieses Gerät koppeln?")}</strong>
          <p>
            {text(
              "Continue only if you opened the code shown on your other device.",
              "Fahre nur fort, wenn du den Code auf deinem anderen Gerät geöffnet hast.",
            )}
          </p>
          <div>
            <button
              className="button button-quiet"
              type="button"
              onClick={() => setPendingPayload(null)}
            >
              {text("Cancel", "Abbrechen")}
            </button>
            <button
              className="button"
              type="button"
              disabled={busy}
              onClick={() => void joinPairing()}
            >
              {text("Continue", "Weiter")}
            </button>
          </div>
        </div>
      ) : null}

      {draft ? (
        <div className="pairing-dialog" aria-live="polite">
          {draft.qrValue && !draft.confirmationCode ? (
            <>
              <strong>
                {text(
                  "Scan on the other device",
                  "Auf dem anderen Gerät scannen",
                )}
              </strong>
              <QrCode
                value={draft.qrValue}
                label={text(
                  "QR code for device pairing",
                  "QR-Code zur Gerätekopplung",
                )}
              />
              <button
                className="text-link"
                type="button"
                onClick={() =>
                  void navigator.clipboard.writeText(draft.qrValue!)
                }
              >
                {text("Copy pairing link", "Kopplungslink kopieren")}
              </button>
              <small>
                {text(
                  "Expires after five minutes",
                  "Läuft nach fünf Minuten ab",
                )}
              </small>
            </>
          ) : null}
          {draft.confirmationCode ? (
            <>
              <strong>
                {text(
                  "Compare on both devices",
                  "Auf beiden Geräten vergleichen",
                )}
              </strong>
              <output
                className="pairing-code"
                aria-label={text("Confirmation code", "Bestätigungscode")}
              >
                {draft.confirmationCode.slice(0, 3)}{" "}
                {draft.confirmationCode.slice(3)}
              </output>
              <button
                className="button"
                type="button"
                disabled={busy || draft.session.state === "CONFIRMED"}
                onClick={() => void confirmPairing()}
              >
                <Check aria-hidden="true" size={18} />
                {text("Code matches", "Code stimmt")}
              </button>
            </>
          ) : null}
          <button
            className="button button-quiet"
            type="button"
            disabled={busy}
            onClick={() => void cancelPairing()}
          >
            {text("Cancel", "Abbrechen")}
          </button>
        </div>
      ) : null}

      {message ? (
        <p
          className={`device-sync-message${messageIsError ? " error" : ""}`}
          role={messageIsError ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
