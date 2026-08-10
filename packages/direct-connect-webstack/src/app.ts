import { Capacitor } from "@capacitor/core";
import jsQR from "jsqr";
import { toQR } from "toqr";

import { phaseOneSnapshotSchema } from "@flashcards/domain/rendezvous";
import {
  decodeDirectSyncInvitation,
  encodeDirectSyncInvitation,
  persistPhaseOneSnapshot,
} from "@flashcards/sync/rendezvous";

import { getOrCreateDeviceIdentity } from "./identity";
import { LocalAppRepository } from "./local-app";
import { createDirectSyncInvitation, joinDirectSyncInvitation } from "./peer";
import type { DirectConnection } from "./peer";
import { LocalPeerSynchronizer } from "./peer-sync";
import { createPhaseOneStore } from "./store";
import { SignedWebstackPeer } from "./webstack-peer";

const element = <T extends HTMLElement>(id: string): T => {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing pairing element: ${id}`);
  return value as T;
};

const createButton = element<HTMLButtonElement>("create-button");
const scanButton = element<HTMLButtonElement>("scan-button");
const stopScanButton = element<HTMLButtonElement>("stop-scan-button");
const joinButton = element<HTMLButtonElement>("join-button");
const sendButton = element<HTMLButtonElement>("send-button");
const openAppLink = element<HTMLAnchorElement>("open-app-link");
const invitationInput = element<HTMLTextAreaElement>("invitation-input");
const status = element<HTMLParagraphElement>("status");
const qrPanel = element<HTMLElement>("qr-panel");
const scannerPanel = element<HTMLElement>("scanner-panel");
const scannerVideo = element<HTMLVideoElement>("scanner-video");
const scannerCanvas = element<HTMLCanvasElement>("scanner-canvas");
const phaseOneStore = createPhaseOneStore();

let repository: LocalAppRepository;
let synchronizer: LocalPeerSynchronizer;
let connection: DirectConnection | null = null;
let scannerStream: MediaStream | null = null;
let scannerFrame = 0;
let continuousSyncTimer = 0;
let continuousSyncRunning = false;
let appOpening: Promise<void> | null = null;

const apiOrigin = (): string =>
  Capacitor.isNativePlatform()
    ? "https://flash-n-flip.com/api"
    : `${window.location.origin}/api`;

const setStatus = (message: string, error = false): void => {
  status.textContent = message;
  status.dataset.error = String(error);
};

const openInstalledApp = (): Promise<void> => {
  appOpening ??= (async () => {
    stopScanner();
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "/app.css";
    await new Promise<void>((resolve, reject) => {
      stylesheet.addEventListener("load", () => resolve(), { once: true });
      stylesheet.addEventListener(
        "error",
        () =>
          reject(new Error("Der lokale App-Stil konnte nicht geladen werden.")),
        { once: true },
      );
      document.head.append(stylesheet);
    });
    document.getElementById("connect-stylesheet")?.remove();
    const root = document.createElement("div");
    root.id = "root";
    document.body.replaceChildren(root);
    window.history.replaceState(null, "", "/app");
    document.title = "Flash-n-Flip";
    const script = document.createElement("script");
    script.src = "/app.js";
    await new Promise<void>((resolve, reject) => {
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener(
        "error",
        () => reject(new Error("Die lokale App konnte nicht geöffnet werden.")),
        { once: true },
      );
      document.body.append(script);
    });
  })().catch((cause) => {
    appOpening = null;
    throw cause;
  });
  return appOpening;
};

const webstackPeer = new SignedWebstackPeer(setStatus, openInstalledApp);

const renderOutbox = async (): Promise<void> => {
  const count = (await repository.authority.listOutbox()).length;
  const output = document.getElementById("outbox-count");
  if (output) output.textContent = String(count);
};

const stopContinuousSync = (): void => {
  window.clearInterval(continuousSyncTimer);
  continuousSyncTimer = 0;
};

const flushConnectedChanges = async (): Promise<void> => {
  const active = connection;
  if (
    !active ||
    active.channel.readyState !== "open" ||
    continuousSyncRunning
  ) {
    return;
  }
  continuousSyncRunning = true;
  try {
    const sent = await synchronizer.sendOutbox(active);
    if (sent > 0) await synchronizer.sendMediaInventory(active);
    await renderOutbox();
  } catch (cause) {
    setStatus(
      cause instanceof Error ? cause.message : "Abgleich fehlgeschlagen.",
      true,
    );
  } finally {
    continuousSyncRunning = false;
  }
};

const handleConnection = (next: DirectConnection): void => {
  stopContinuousSync();
  if (connection && connection !== next) void connection.close();
  connection = next;
  sendButton.disabled = false;
  setStatus("Direkt verbunden. Lokale Änderungen werden abgeglichen …");
  void synchronizer
    .start(next)
    .then(async () => {
      const sent = await synchronizer.sendPending(next);
      await synchronizer.sendMediaInventory(next);
      await webstackPeer.start(next);
      return sent;
    })
    .then(async (sent) => {
      await renderOutbox();
      continuousSyncTimer = window.setInterval(
        () => void flushConnectedChanges(),
        1_500,
      );
      if (!webstackPeer.isReceiving()) {
        setStatus(
          sent > 0
            ? `${sent} lokale Änderungen direkt angeboten.`
            : "Geräte sind direkt verbunden und bereit.",
        );
      }
    })
    .catch((cause) =>
      setStatus(
        cause instanceof Error ? cause.message : "Abgleich fehlgeschlagen.",
        true,
      ),
    );
  next.channel.addEventListener("close", () => {
    if (connection !== next) return;
    stopContinuousSync();
    connection = null;
    sendButton.disabled = true;
    setStatus(
      "Direktverbindung geschlossen. Die Flash-n-Flip-App bleibt lokal nutzbar.",
    );
  });
};

const qrPath = (text: string): { path: string; size: number } => {
  const matrix = toQR(text);
  const width = Math.sqrt(matrix.length);
  if (!Number.isInteger(width)) throw new Error("Invalid QR matrix");
  const quietZone = 4;
  const commands: string[] = [];
  for (let index = 0; index < matrix.length; index += 1) {
    if (matrix[index] !== 1) continue;
    commands.push(
      `M${(index % width) + quietZone} ${Math.floor(index / width) + quietZone}h1v1h-1z`,
    );
  }
  return { path: commands.join(""), size: width + quietZone * 2 };
};

const renderQrCode = (text: string): void => {
  const qr = qrPath(text);
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", `0 0 ${qr.size} ${qr.size}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "QR-Code der Direktverbindung");
  svg.setAttribute("shape-rendering", "crispEdges");
  const background = document.createElementNS(namespace, "rect");
  background.setAttribute("width", String(qr.size));
  background.setAttribute("height", String(qr.size));
  background.setAttribute("fill", "#fff");
  const path = document.createElementNS(namespace, "path");
  path.setAttribute("d", qr.path);
  path.setAttribute("fill", "#111827");
  svg.append(background, path);
  element("qr-code").replaceChildren(svg);
  qrPanel.hidden = false;
};

const parseInvitation = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Einladung fehlt.");
  if (!trimmed.includes("://")) return decodeDirectSyncInvitation(trimmed);
  const url = new URL(trimmed);
  const invitation = new URLSearchParams(url.hash.slice(1)).get("rendezvous");
  if (!invitation) throw new Error("Einladungslink ist ungültig.");
  return decodeDirectSyncInvitation(invitation);
};

const stopScanner = (): void => {
  window.cancelAnimationFrame(scannerFrame);
  scannerStream?.getTracks().forEach((track) => track.stop());
  scannerStream = null;
  scannerVideo.srcObject = null;
  scannerPanel.hidden = true;
};

const scanFrame = (): void => {
  if (!scannerStream) return;
  if (scannerVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    const context = scannerCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (context && scannerVideo.videoWidth && scannerVideo.videoHeight) {
      scannerCanvas.width = scannerVideo.videoWidth;
      scannerCanvas.height = scannerVideo.videoHeight;
      context.drawImage(scannerVideo, 0, 0);
      const image = context.getImageData(
        0,
        0,
        scannerCanvas.width,
        scannerCanvas.height,
      );
      const code = jsQR(image.data, image.width, image.height, {
        inversionAttempts: "dontInvert",
      });
      if (code?.data) {
        invitationInput.value = code.data;
        stopScanner();
        void joinInvitation();
        return;
      }
    }
  }
  scannerFrame = window.requestAnimationFrame(scanFrame);
};

const startScanner = async (): Promise<void> => {
  stopScanner();
  scannerStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false,
  });
  scannerVideo.srcObject = scannerStream;
  scannerPanel.hidden = false;
  await scannerVideo.play();
  scannerFrame = window.requestAnimationFrame(scanFrame);
};

const joinInvitation = async (): Promise<void> => {
  joinButton.disabled = true;
  setStatus("Einladung wird geprüft und die Direktverbindung aufgebaut …");
  try {
    handleConnection(
      await joinDirectSyncInvitation(parseInvitation(invitationInput.value)),
    );
    if (window.location.hash.includes("rendezvous="))
      window.history.replaceState(null, "", window.location.pathname);
  } catch (cause) {
    setStatus(
      cause instanceof Error ? cause.message : "Kopplung fehlgeschlagen.",
      true,
    );
  } finally {
    joinButton.disabled = false;
  }
};

createButton.addEventListener("click", () => {
  void (async () => {
    createButton.disabled = true;
    setStatus("Kurzlebige, kontolose Einladung wird erstellt …");
    const pending = await createDirectSyncInvitation(apiOrigin());
    const link = `https://flash-n-flip.com/connect/index.html#rendezvous=${encodeDirectSyncInvitation(pending.invitation)}`;
    invitationInput.value = link;
    renderQrCode(link);
    setStatus("QR-Code bereit. Warte auf das zweite Gerät …");
    handleConnection(await pending.connect());
  })()
    .catch((cause) =>
      setStatus(
        cause instanceof Error ? cause.message : "Einladung fehlgeschlagen.",
        true,
      ),
    )
    .finally(() => {
      createButton.disabled = false;
    });
});

scanButton.addEventListener("click", () => {
  void startScanner().catch((cause) =>
    setStatus(
      cause instanceof Error ? cause.message : "Kamera nicht verfügbar.",
      true,
    ),
  );
});
stopScanButton.addEventListener("click", stopScanner);
joinButton.addEventListener("click", () => void joinInvitation());
openAppLink.addEventListener("click", (event) => {
  event.preventDefault();
  void openInstalledApp().catch((cause) =>
    setStatus(
      cause instanceof Error
        ? cause.message
        : "App konnte nicht geöffnet werden.",
      true,
    ),
  );
});
window.addEventListener("flash-n-flip:decks-changed", () => {
  void flushConnectedChanges();
});
sendButton.addEventListener("click", () => {
  if (!connection) {
    setStatus("Keine direkte Verbindung vorhanden.", true);
    return;
  }
  void synchronizer
    .sendPending(connection)
    .then(async (sent) => {
      await synchronizer.sendMediaInventory(connection!);
      await renderOutbox();
      setStatus(
        sent > 0
          ? `${sent} Änderungen direkt gesendet.`
          : "Keine offenen lokalen Änderungen.",
      );
    })
    .catch((cause) =>
      setStatus(
        cause instanceof Error ? cause.message : "Abgleich fehlgeschlagen.",
        true,
      ),
    );
});

window.addEventListener("beforeunload", () => {
  stopContinuousSync();
  stopScanner();
  connection?.close();
});

void (async () => {
  try {
    if (!Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations
          .filter((registration) =>
            registration.active?.scriptURL.endsWith("/connect/sw.js"),
          )
          .map((registration) => registration.unregister()),
      );
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
    }
    const identity = await getOrCreateDeviceIdentity();
    repository = new LocalAppRepository(identity.id);
    synchronizer = new LocalPeerSynchronizer(
      repository.authority,
      identity.id,
      renderOutbox,
      async (candidate) => {
        try {
          if (await webstackPeer.receive(connection!, candidate)) return;
        } catch (cause) {
          setStatus(
            cause instanceof Error
              ? `App-Übertragung fehlgeschlagen: ${cause.message}`
              : "App-Übertragung fehlgeschlagen.",
            true,
          );
          throw cause;
        }
        const snapshot = phaseOneSnapshotSchema.safeParse(candidate);
        if (!snapshot.success)
          throw new Error("Unbekanntes Direktabgleich-Format.");
        await persistPhaseOneSnapshot(phaseOneStore, snapshot.data);
        await repository.migratePhaseOne(snapshot.data);
        await renderOutbox();
      },
      repository,
    );
    element("device-id").textContent = identity.id;
    element("storage-kind").textContent =
      identity.storage === "KEYCHAIN"
        ? "SQLite + iOS-Keychain"
        : "IndexedDB (Browser)";
    await repository.migratePhaseOne(await phaseOneStore.loadSnapshot());
    await renderOutbox();
    setStatus("Bereit zum Verbinden.");
    const invitation = new URLSearchParams(window.location.hash.slice(1)).get(
      "rendezvous",
    );
    if (invitation) {
      invitationInput.value = invitation;
      await joinInvitation();
    }
  } catch (cause) {
    setStatus(
      cause instanceof Error ? cause.message : "Lokaler Start fehlgeschlagen.",
      true,
    );
  }
})();
