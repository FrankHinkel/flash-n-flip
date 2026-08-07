"use client";

import type { Device } from "@flashcards/domain";
import { Check, Globe, Network, Pencil, Unplug, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../lib/api";
import { getOrCreateLocalDeviceIdentity } from "../lib/device-identity";
import {
  replacePeerDevices,
  storeLocalDeviceIdentity,
  type LocalDeviceIdentity,
} from "../lib/offline";
import {
  deviceConnectionStatusUsesVps,
  resolveDeviceConnectionStatus,
} from "./device-connection-status";
import { useI18n } from "./i18n-provider";
import { useDeviceTransport } from "./device-transport-provider";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Unknown error";

export function DeviceSyncSettings() {
  const { text } = useI18n();
  const {
    directConnected,
    pairedDeviceAvailable,
    remoteDeviceId,
    serverReachable,
    reportPairedDeviceAvailability,
    reportServerReachability,
  } = useDeviceTransport();
  const [identity, setIdentity] = useState<LocalDeviceIdentity | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [editingDeviceName, setEditingDeviceName] = useState(false);
  const [deviceNameDraft, setDeviceNameDraft] = useState("");
  const deviceNameInputRef = useRef<HTMLInputElement | null>(null);

  const refreshDevices = useCallback(
    async (localIdentity: LocalDeviceIdentity) => {
      const result = await api.listDevices();
      const activeDevices = result.devices.filter(
        (device) => !device.revokedAt,
      );
      setDevices(activeDevices);
      reportServerReachability(true);
      reportPairedDeviceAvailability(
        activeDevices.some((device) => device.id !== localIdentity.id),
      );
      await replacePeerDevices(result.devices);
    },
    [reportPairedDeviceAvailability, reportServerReachability],
  );

  useEffect(() => {
    let cancelled = false;
    if (new URLSearchParams(window.location.hash.slice(1)).has("pair")) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
    void getOrCreateLocalDeviceIdentity()
      .then(async (localIdentity) => {
        if (cancelled) return;
        setIdentity(localIdentity);
        try {
          await refreshDevices(localIdentity);
        } catch {
          if (!cancelled) reportServerReachability(false);
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
    const refresh = () => {
      if (!identity) return;
      void refreshDevices(identity).catch(() =>
        reportServerReachability(false),
      );
    };
    const handleOffline = () => reportServerReachability(false);
    const handleVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("online", refresh);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [identity, refreshDevices, reportServerReachability]);

  useEffect(() => {
    if (editingDeviceName) deviceNameInputRef.current?.focus();
  }, [editingDeviceName]);

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

  const revokeDevice = async (device: Device) => {
    if (
      !identity ||
      !window.confirm(
        text(
          `Remove ${device.displayName} from this account?`,
          `${device.displayName} aus diesem Konto entfernen?`,
        ),
      )
    ) {
      return;
    }
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
          "Your signed-in devices find and connect to each other automatically. Direct transfers do not route decks or media through the VPS.",
          "Deine angemeldeten Geräte finden und verbinden sich automatisch. Bei Direktübertragungen laufen Lernsets und Medien nicht über den VPS.",
        )}
      </p>

      <div
        className="device-connection-legend"
        aria-label={text(
          "Connection status explanation",
          "Erklärung des Verbindungsstatus",
        )}
      >
        {connectionLegend.map(({ status, Icon, description }) => (
          <div className="device-connection-legend-row" key={status}>
            <span
              className={`device-connection-sample ${
                deviceConnectionStatusUsesVps(status)
                  ? "vps-online"
                  : "vps-offline"
              } status-${status.toLowerCase().replaceAll("_", "-")}`}
              aria-hidden="true"
            >
              <Icon size={18} />
            </span>
            <span>{description}</span>
          </div>
        ))}
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
            .filter((device) => device.id !== identity.id)
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
                    : text(
                        "Registered to this account",
                        "In diesem Konto angemeldet",
                      )}
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

      {message ? (
        <p
          className={`device-sync-message ${messageIsError ? "error" : ""}`}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
