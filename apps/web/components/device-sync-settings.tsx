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
      label: text("legacy.58479f4a00c0"),
    },
    VPS_LAN: {
      Icon: Network,
      label: text("legacy.743411708d24"),
    },
    LOCAL_LAN: {
      Icon: Network,
      label: text("legacy.1201050a3285"),
    },
    VPS_ONLY: {
      Icon: Unplug,
      label: text("legacy.3ecef7bec288"),
    },
    DISCONNECTED: {
      Icon: Unplug,
      label: text("legacy.242a7a2b4a21"),
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
      description: text("legacy.b58fc8f27cf1"),
    },
    {
      status: "VPS_LAN",
      Icon: Network,
      description: text("legacy.623a8826a28f"),
    },
    {
      status: "LOCAL_LAN",
      Icon: Network,
      description: text("legacy.365facdb07f5"),
    },
    {
      status: "VPS_ONLY",
      Icon: Unplug,
      description: text("legacy.c64845ec72f9"),
    },
    {
      status: "DISCONNECTED",
      Icon: Unplug,
      description: text("legacy.32e1d9103803"),
    },
  ] as const;

  const revokeDevice = async (device: Device) => {
    if (
      !identity ||
      !window.confirm(text("legacy.f054e5286ce0", [device.displayName]))
    ) {
      return;
    }
    setBusy(true);
    try {
      await api.revokeDevice(device.id);
      await refreshDevices(identity);
      setMessageIsError(false);
      setMessage(text("legacy.2165b9be2986"));
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
      setMessage(text("legacy.73e897ed080f"));
    } catch (error) {
      setMessageIsError(true);
      if (savedLocally) {
        setMessage(text("legacy.8a0150fdfb39"));
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
        <h2>{text("legacy.cc03aaa0ccef")}</h2>
        <span
          className={`device-connection-status ${connectionClassName}`}
          role="status"
        >
          <connection.Icon aria-hidden="true" size={18} />
          {connection.label}
        </span>
      </div>
      <p className="device-sync-intro">{text("legacy.dc291b9fa622")}</p>

      <div
        className="device-connection-legend"
        aria-label={text("legacy.233508aa92aa")}
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
        <div className="device-list" aria-label={text("legacy.cc03aaa0ccef")}>
          <div className="device-row current">
            <Check aria-hidden="true" />
            {editingDeviceName ? (
              <input
                ref={deviceNameInputRef}
                className="device-name-input"
                value={deviceNameDraft}
                maxLength={80}
                aria-label={text("legacy.9e53965518dc")}
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
                  aria-label={text("legacy.dd306f492cc6")}
                  onClick={() => void saveDeviceName()}
                >
                  <Check aria-hidden="true" size={19} />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={text("legacy.9152eb9ad90b")}
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
                aria-label={text("legacy.dd8f53312d91")}
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
                    ? text("legacy.516dbcae211d")
                    : text("legacy.6827e7503bfb")}
                </span>
                <button
                  className="icon-button"
                  type="button"
                  disabled={busy}
                  aria-label={text("legacy.5c532a2e4aea", [device.displayName])}
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
