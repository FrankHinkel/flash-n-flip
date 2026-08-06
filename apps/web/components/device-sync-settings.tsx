"use client";

import type {
  DevicePairing,
  PairingSessionDetails,
} from "@flashcards/api-client";
import type { Device, PairingQrPayload } from "@flashcards/domain";
import {
  Check,
  Clipboard,
  Globe,
  Network,
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
import { replacePeerDevices, type LocalDeviceIdentity } from "../lib/offline";
import {
  establishPairingPeerConnection,
  type PairingPeerConnection,
} from "../lib/peer-connection";
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

function otherDeviceId(
  pairing: DevicePairing,
  localDeviceId: string,
): string | null {
  if (pairing.deviceAId === localDeviceId) return pairing.deviceBId;
  if (pairing.deviceBId === localDeviceId) return pairing.deviceAId;
  return null;
}

export function DeviceSyncSettings() {
  const { text } = useI18n();
  const {
    directConnected,
    remoteDeviceId,
    adoptPairingConnection,
    disconnect,
  } = useDeviceTransport();
  const [identity, setIdentity] = useState<LocalDeviceIdentity | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [pairings, setPairings] = useState<DevicePairing[]>([]);
  const [serverReachable, setServerReachable] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
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
      setServerReachable(true);
      await replacePeerDevices(result.devices);
    },
    [],
  );

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      if (identity) {
        void refreshDevices(identity).catch(() => setServerReachable(false));
      }
    };
    const handleOffline = () => {
      setOnline(false);
      setServerReachable(false);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [identity, refreshDevices]);

  useEffect(() => {
    let cancelled = false;
    void getOrCreateLocalDeviceIdentity()
      .then(async (localIdentity) => {
        if (cancelled) return;
        setIdentity(localIdentity);
        try {
          await refreshDevices(localIdentity);
        } catch {
          if (!cancelled) setServerReachable(false);
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
  }, [refreshDevices]);

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
      pairings.flatMap((pairing) => {
        if (pairing.revokedAt) return [];
        const deviceId = otherDeviceId(pairing, identity.id);
        return deviceId ? [deviceId] : [];
      }),
    );
  }, [identity, pairings]);

  const connection = !online
    ? {
        Icon: Unplug,
        label: text("Local · offline", "Lokal · offline"),
        className: "offline",
      }
    : directConnected
      ? {
          Icon: Network,
          label: text("Direct · local network", "Direkt · lokales Netzwerk"),
          className: "direct",
        }
      : serverReachable
        ? {
            Icon: Globe,
            label: text("VPS · ready", "VPS · bereit"),
            className: "server",
          }
        : {
            Icon: Unplug,
            label: text("Local only", "Nur lokal"),
            className: "offline",
          };

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

  return (
    <section className="settings-section device-sync-settings">
      <div className="device-sync-heading">
        <h2>{text("Devices", "Geräte")}</h2>
        <span
          className={`device-connection-status ${connection.className}`}
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

      {identity ? (
        <div className="device-list" aria-label={text("Devices", "Geräte")}>
          <div className="device-row current">
            <connection.Icon aria-hidden="true" />
            <span>
              <strong>{identity.displayName}</strong>
              <small>{text("This device", "Dieses Gerät")}</small>
            </span>
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
                <span>
                  <strong>{device.displayName}</strong>
                  <small>
                    {directConnected && remoteDeviceId === device.id
                      ? text("Directly connected", "Direkt verbunden")
                      : text("Paired via VPS", "Über VPS gekoppelt")}
                  </small>
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
