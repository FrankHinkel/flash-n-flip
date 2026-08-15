import { Capacitor } from "@capacitor/core";
import jsQR from "jsqr";
import { toQR } from "toqr";

import { phaseOneSnapshotSchema } from "@flashcards/domain/rendezvous";
import {
  decodeDirectSyncInvitation,
  encodeDirectSyncInvitation,
  persistPhaseOneSnapshot,
} from "@flashcards/sync/rendezvous";

import {
  publishDirectConnectionState,
  publishDirectPeerDeviceId,
} from "./connection-state";
import { LocalAppRepository } from "./local-app";
import {
  createDirectSyncInvitation,
  directWebRtcAvailable,
  joinDirectSyncInvitation,
} from "./peer";
import type { DirectConnection } from "./peer";
import { getDirectSyncRuntime } from "./reconnect-runtime";
import { waitForServiceWorkerControl } from "./service-worker-control";
import { createPhaseOneStore } from "./store";
import { SignedWebstackPeer } from "./webstack-peer";
import { appendLocalAppAsset } from "./local-app-asset";

const element = <T extends HTMLElement>(id: string): T => {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing pairing element: ${id}`);
  return value as T;
};

const createButton = element<HTMLButtonElement>("create-button");
const scanButton = element<HTMLButtonElement>("scan-button");
const stopScanButton = element<HTMLButtonElement>("stop-scan-button");
const joinButton = element<HTMLButtonElement>("join-button");
const openAppLink = element<HTMLAnchorElement>("open-app-link");
const macBrowserLink = element<HTMLAnchorElement>("mac-browser-link");
const invitationInput = element<HTMLTextAreaElement>("invitation-input");
const status = element<HTMLParagraphElement>("status");
const connectionState = element<HTMLElement>("connection-state");
const automaticGuidance = element<HTMLElement>("automatic-guidance");
const primaryActions = element<HTMLElement>("primary-actions");
const manualConnect = element<HTMLDetailsElement>("manual-connect");
const qrPanel = element<HTMLElement>("qr-panel");
const scannerPanel = element<HTMLElement>("scanner-panel");
const scannerVideo = element<HTMLVideoElement>("scanner-video");
const scannerCanvas = element<HTMLCanvasElement>("scanner-canvas");
const phaseOneStore = createPhaseOneStore();
const nativePlatform = Capacitor.isNativePlatform();

openAppLink.hidden = !nativePlatform;

let repository: LocalAppRepository;
let connection: DirectConnection | null = null;
let scannerStream: MediaStream | null = null;
let scannerFrame = 0;
let appOpening: Promise<void> | null = null;
const directSyncRuntime = getDirectSyncRuntime();

publishDirectConnectionState("disconnected");

const apiOrigin = (): string =>
  nativePlatform
    ? "https://flash-n-flip.com/api"
    : `${window.location.origin}/api`;

const setStatus = (message: string, error = false): void => {
  status.textContent = message;
  status.dataset.error = String(error);
};

type ConnectionState = "preparing" | "idle" | "waiting" | "connected" | "error";

const setConnectionState = (message: string, state: ConnectionState): void => {
  connectionState.textContent = message;
  connectionState.dataset.state = state;
};

const showConnectionControls = (): void => {
  primaryActions.hidden = false;
  manualConnect.hidden = false;
};

const hideConnectionControls = (): void => {
  primaryActions.hidden = true;
  manualConnect.hidden = true;
};

const openInstalledApp = (): Promise<void> => {
  appOpening ??= (async () => {
    stopScanner();
    setStatus("Flash-n-Flip wird automatisch geöffnet …");
    if (!nativePlatform && "serviceWorker" in navigator) {
      await waitForServiceWorkerControl(navigator.serviceWorker);
    }
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "/app.css";
    await appendLocalAppAsset(
      stylesheet,
      document.head,
      "Der lokale App-Stil konnte nicht geladen werden.",
    );
    document.getElementById("connect-stylesheet")?.remove();
    const root = document.createElement("div");
    root.id = "root";
    document.body.replaceChildren(root);
    window.history.replaceState(null, "", "/app");
    document.title = "Flash-n-Flip";
    const script = document.createElement("script");
    script.src = "/app.js";
    await appendLocalAppAsset(
      script,
      document.body,
      "Die lokale App konnte nicht geöffnet werden.",
    );
  })().catch((cause) => {
    appOpening = null;
    if (!nativePlatform) {
      setStatus("App-Start wird über /app fortgesetzt …");
      window.location.assign("/app");
      return;
    }
    throw cause;
  });
  return appOpening;
};

const webstackPeer = new SignedWebstackPeer(setStatus, openInstalledApp);

const renderOutbox = async (): Promise<void> => {
  const count = await repository.authority.countOutbox();
  const output = document.getElementById("outbox-count");
  if (output) output.textContent = String(count);
};

const handleConnection = (next: DirectConnection): void => {
  let openingApp = false;
  if (connection && connection !== next) void connection.close();
  connection = next;
  publishDirectConnectionState("transport-connected");
  hideConnectionControls();
  qrPanel.hidden = true;
  setConnectionState("Verbunden – App wird geladen", "connected");
  setStatus("Direkt verbunden. Die App-Version des iPhones wird angefordert …");
  void directSyncRuntime
    .adoptConnection(next, {
      beforeSync: async () => {
        await webstackPeer.start(next);
        await webstackPeer.waitForHandoff();
      },
    })
    .then(async () => {
      await renderOutbox();
      setStatus(
        "Geräte sind direkt verbunden und abgeglichen. App wird geöffnet …",
      );
      openingApp = true;
      await webstackPeer.openAppAfterHandoff();
    })
    .catch((cause) => {
      publishDirectConnectionState("error");
      if (!openingApp) webstackPeer.fail(cause);
      setConnectionState(
        openingApp
          ? "App-Start fehlgeschlagen"
          : "App-Übertragung fehlgeschlagen",
        "error",
      );
      setStatus(
        cause instanceof Error
          ? cause.message
          : openingApp
            ? "App konnte nicht geöffnet werden."
            : "App-Übertragung fehlgeschlagen.",
        true,
      );
    });
  next.channel.addEventListener("close", () => {
    if (connection !== next) return;
    webstackPeer.fail(
      new Error("Direktverbindung während der App-Übertragung geschlossen."),
    );
    connection = null;
    publishDirectPeerDeviceId(null);
    publishDirectConnectionState("disconnected");
    showConnectionControls();
    setConnectionState("Verbindung beendet", "idle");
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
  hideConnectionControls();
  setConnectionState("Verbindung wird hergestellt", "waiting");
  setStatus("Einladung wird geprüft und die Direktverbindung aufgebaut …");
  try {
    handleConnection(
      await joinDirectSyncInvitation(parseInvitation(invitationInput.value)),
    );
    if (window.location.hash.includes("rendezvous="))
      window.history.replaceState(null, "", window.location.pathname);
  } catch (cause) {
    showConnectionControls();
    setConnectionState("Verbindung fehlgeschlagen", "error");
    setStatus(
      cause instanceof Error ? cause.message : "Kopplung fehlgeschlagen.",
      true,
    );
  } finally {
    joinButton.disabled = false;
  }
};

const createInvitation = async (): Promise<void> => {
  try {
    createButton.disabled = true;
    setConnectionState("QR-Code wird erstellt", "waiting");
    setStatus("Kurzlebige, kontolose Einladung wird erstellt …");
    const pending = await createDirectSyncInvitation(apiOrigin());
    const link = `https://flash-n-flip.com/connect/index.html#rendezvous=${encodeDirectSyncInvitation(pending.invitation)}`;
    invitationInput.value = link;
    renderQrCode(link);
    hideConnectionControls();
    setConnectionState("Warte auf iPhone", "waiting");
    setStatus(
      "QR-Code bereit. Bitte mit dem iPhone scannen – danach läuft alles automatisch.",
    );
    handleConnection(await pending.connect());
  } catch (cause) {
    qrPanel.hidden = true;
    showConnectionControls();
    setConnectionState("QR-Code nicht verfügbar", "error");
    setStatus(
      cause instanceof Error ? cause.message : "Einladung fehlgeschlagen.",
      true,
    );
  } finally {
    createButton.disabled = false;
  }
};

createButton.addEventListener("click", () => {
  void createInvitation();
});

scanButton.addEventListener("click", () => {
  setConnectionState("QR-Code wird gescannt", "waiting");
  setStatus("Kamera wird geöffnet. QR-Code vollständig ins Bild halten …");
  void startScanner().catch((cause) => {
    showConnectionControls();
    setConnectionState("Kamera nicht verfügbar", "error");
    setStatus(
      cause instanceof Error ? cause.message : "Kamera nicht verfügbar.",
      true,
    );
  });
});
stopScanButton.addEventListener("click", () => {
  stopScanner();
  showConnectionControls();
  setConnectionState("Nicht verbunden", "idle");
  setStatus("Scan abgebrochen. Es wurde keine Verbindung aufgebaut.");
});
joinButton.addEventListener("click", () => void joinInvitation());
openAppLink.addEventListener("click", (event) => {
  event.preventDefault();
  void openInstalledApp().catch((cause) => {
    setConnectionState("App-Start fehlgeschlagen", "error");
    setStatus(
      cause instanceof Error
        ? cause.message
        : "App konnte nicht geöffnet werden.",
      true,
    );
  });
});
window.addEventListener("flash-n-flip:decks-changed", () => {
  void renderOutbox();
});

window.addEventListener("beforeunload", () => {
  stopScanner();
  connection?.close();
});

void (async () => {
  try {
    if (!nativePlatform && "serviceWorker" in navigator) {
      setConnectionState("Lokale App wird vorbereitet", "preparing");
      setStatus("Lokaler App-Dienst wird aktiviert …");
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
      try {
        await waitForServiceWorkerControl(navigator.serviceWorker);
        window.sessionStorage.removeItem("flash-n-flip-worker-reload");
      } catch (cause) {
        if (
          window.sessionStorage.getItem("flash-n-flip-worker-reload") !==
          "attempted"
        ) {
          window.sessionStorage.setItem(
            "flash-n-flip-worker-reload",
            "attempted",
          );
          setStatus("Lokaler App-Dienst wird einmalig neu gestartet …");
          window.location.reload();
          await new Promise<never>(() => undefined);
        }
        throw cause;
      }
    }
    directSyncRuntime.configure({
      onChanged: renderOutbox,
      onUnknown: async (candidate) => {
        try {
          if (await webstackPeer.receive(connection!, candidate)) return;
        } catch (cause) {
          webstackPeer.fail(cause);
          setStatus(
            cause instanceof Error
              ? `App-Übertragung fehlgeschlagen: ${cause.message}`
              : "App-Übertragung fehlgeschlagen.",
            true,
          );
          setConnectionState("App-Übertragung fehlgeschlagen", "error");
          openAppLink.textContent = "App erneut öffnen";
          openAppLink.setAttribute(
            "aria-label",
            "Die bereits übertragene Flash-n-Flip-App erneut öffnen",
          );
          openAppLink.hidden = false;
          throw cause;
        }
        const snapshot = phaseOneSnapshotSchema.safeParse(candidate);
        if (!snapshot.success)
          throw new Error("Unbekanntes Direktabgleich-Format.");
        await persistPhaseOneSnapshot(phaseOneStore, snapshot.data);
        await repository.migratePhaseOne(snapshot.data);
        await renderOutbox();
      },
      onError: (cause) => {
        publishDirectConnectionState("error");
        setStatus(
          cause instanceof Error
            ? `Direktabgleich fehlgeschlagen: ${cause.message}`
            : "Direktabgleich fehlgeschlagen.",
          true,
        );
      },
    });
    await directSyncRuntime.initialize();
    const identity = directSyncRuntime.deviceIdentity();
    repository = directSyncRuntime.localRepository();
    element("device-id").textContent = identity.id;
    element("storage-kind").textContent =
      identity.storage === "KEYCHAIN"
        ? "SQLite + iOS-Keychain"
        : "IndexedDB (Browser)";
    await repository.migratePhaseOne(await phaseOneStore.loadSnapshot());
    await renderOutbox();
    if (!directWebRtcAvailable()) {
      hideConnectionControls();
      automaticGuidance.textContent =
        "Diese iPad-App kann auf dem Mac keine WebRTC-Direktverbindung öffnen. Verwende dafür Flash-n-Flip im Mac-Browser; die lokale App bleibt weiterhin nutzbar.";
      macBrowserLink.hidden = false;
      setConnectionState("Mac-Browser erforderlich", "error");
      setStatus(
        "Die Mac-Version von WKWebView stellt RTCPeerConnection nicht bereit.",
        true,
      );
      return;
    }
    const invitation = new URLSearchParams(window.location.hash.slice(1)).get(
      "rendezvous",
    );
    if (invitation) {
      invitationInput.value = invitation;
      await joinInvitation();
    } else if (nativePlatform) {
      automaticGuidance.textContent =
        "QR-Code scannen. Verbindung, Abgleich und App-Übertragung laufen danach automatisch.";
      createButton.textContent = "QR-Code für anderes Gerät anzeigen";
      createButton.classList.add("secondary");
      scanButton.classList.remove("secondary");
      setConnectionState("Nicht verbunden", "idle");
      setStatus("Bitte den QR-Code im Browser scannen.");
    } else {
      automaticGuidance.textContent =
        "Der QR-Code wird automatisch erstellt. Nach dem Scan werden die Geräte verbunden, die App übertragen und direkt geöffnet.";
      await createInvitation();
    }
  } catch (cause) {
    showConnectionControls();
    setConnectionState("Lokaler Start fehlgeschlagen", "error");
    setStatus(
      cause instanceof Error ? cause.message : "Lokaler Start fehlgeschlagen.",
      true,
    );
  }
})();
