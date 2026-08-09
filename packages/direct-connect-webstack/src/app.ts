import { Capacitor } from "@capacitor/core";
import jsQR from "jsqr";
import { toQR } from "toqr";

import { phaseOneSnapshotSchema } from "@flashcards/domain/rendezvous";
import type { PhaseOneSnapshot } from "@flashcards/domain/rendezvous";
import {
  decodeDirectSyncInvitation,
  encodeDirectSyncInvitation,
  persistPhaseOneSnapshot,
} from "@flashcards/sync/rendezvous";

import { getOrCreateDeviceIdentity } from "./identity";
import { createDirectSyncInvitation, joinDirectSyncInvitation } from "./peer";
import type { DirectConnection } from "./peer";
import { createPhaseOneStore } from "./store";

const element = <T extends HTMLElement>(id: string): T => {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing application element: ${id}`);
  return value as T;
};

const createButton = element<HTMLButtonElement>("create-button");
const scanButton = element<HTMLButtonElement>("scan-button");
const stopScanButton = element<HTMLButtonElement>("stop-scan-button");
const joinButton = element<HTMLButtonElement>("join-button");
const sendButton = element<HTMLButtonElement>("send-button");
const invitationInput = element<HTMLTextAreaElement>("invitation-input");
const status = element<HTMLParagraphElement>("status");
const qrPanel = element<HTMLElement>("qr-panel");
const scannerPanel = element<HTMLElement>("scanner-panel");
const scannerVideo = element<HTMLVideoElement>("scanner-video");
const scannerCanvas = element<HTMLCanvasElement>("scanner-canvas");
const store = createPhaseOneStore();

let connection: DirectConnection | null = null;
let scannerStream: MediaStream | null = null;
let scannerFrame = 0;

const apiOrigin = (): string =>
  Capacitor.isNativePlatform()
    ? "https://flash-n-flip.com/api"
    : `${window.location.origin}/api`;

const setStatus = (message: string, error = false): void => {
  status.textContent = message;
  status.dataset.error = String(error);
};

const renderSnapshot = (snapshot: PhaseOneSnapshot | null): void => {
  element<HTMLElement>("empty-state").hidden = Boolean(snapshot);
  const article = element<HTMLElement>("snapshot");
  article.hidden = !snapshot;
  if (!snapshot) return;
  element("deck-title").textContent = snapshot.deck.title;
  element("card-front").textContent = snapshot.deck.cards[0]?.front ?? "";
  element("card-back").textContent = snapshot.deck.cards[0]?.back ?? "";
  element("review-rating").textContent =
    `${snapshot.review.rating} · ${new Date(snapshot.review.reviewedAt).toLocaleString("de-DE")}`;
};

const testSnapshot = (): PhaseOneSnapshot => {
  const sentAt = new Date().toISOString();
  const deckId = crypto.randomUUID();
  const cardId = crypto.randomUUID();
  return phaseOneSnapshotSchema.parse({
    version: 1,
    transferId: crypto.randomUUID(),
    sentAt,
    deck: {
      id: deckId,
      title: "Phase-1-Testdeck",
      modifiedAt: sentAt,
      cards: [
        {
          id: cardId,
          front: "Laufen meine Nutzdaten über den VPS?",
          back: "Nein – dieser Datensatz kam direkt über WebRTC.",
        },
      ],
    },
    review: {
      mutationId: crypto.randomUUID(),
      deckId,
      cardId,
      rating: "GOOD",
      reviewedAt: sentAt,
    },
  });
};

let outgoingSnapshot = testSnapshot();

const attachConnection = (next: DirectConnection): void => {
  connection = next;
  sendButton.disabled = false;
  setStatus("Direkte WebRTC-Verbindung steht. Bereit zum Senden.");
  next.channel.addEventListener("message", (event) => {
    void (async () => {
      try {
        const raw =
          typeof event.data === "string"
            ? event.data
            : new TextDecoder().decode(event.data as ArrayBuffer);
        const result = await persistPhaseOneSnapshot(store, JSON.parse(raw));
        renderSnapshot(await store.loadSnapshot());
        setStatus(
          result === "INSERTED"
            ? "Testdeck und Review dauerhaft lokal gespeichert."
            : "Doppelzustellung erkannt; vorhandene Daten blieben unverändert.",
        );
      } catch (cause) {
        setStatus(
          cause instanceof Error ? cause.message : "Empfang fehlgeschlagen.",
          true,
        );
      }
    })();
  });
  next.channel.addEventListener("close", () => {
    sendButton.disabled = true;
    setStatus("Direktverbindung geschlossen.");
  });
};

const qrPath = (value: string): { path: string; size: number } => {
  const modules = toQR(value);
  const side = Math.sqrt(modules.length);
  if (!Number.isInteger(side)) throw new Error("Invalid QR matrix");
  const quiet = 4;
  const commands: string[] = [];
  for (let index = 0; index < modules.length; index += 1) {
    if (modules[index] !== 1) continue;
    commands.push(
      `M${(index % side) + quiet} ${Math.floor(index / side) + quiet}h1v1h-1z`,
    );
  }
  return { path: commands.join(""), size: side + quiet * 2 };
};

const showQrCode = (value: string): void => {
  const qr = qrPath(value);
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

const invitationFromValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Einladung fehlt.");
  if (!trimmed.includes("://")) return decodeDirectSyncInvitation(trimmed);
  const url = new URL(trimmed);
  const encoded = new URLSearchParams(url.hash.slice(1)).get("rendezvous");
  if (!encoded) throw new Error("Einladungslink ist ungültig.");
  return decodeDirectSyncInvitation(encoded);
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
      const decoded = jsQR(image.data, image.width, image.height, {
        inversionAttempts: "dontInvert",
      });
      if (decoded?.data) {
        invitationInput.value = decoded.data;
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
    attachConnection(
      await joinDirectSyncInvitation(
        invitationFromValue(invitationInput.value),
      ),
    );
    if (window.location.hash.includes("rendezvous=")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
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
    try {
      const created = await createDirectSyncInvitation(apiOrigin());
      const encoded = encodeDirectSyncInvitation(created.invitation);
      const url = `https://flash-n-flip.com/connect/index.html#rendezvous=${encoded}`;
      invitationInput.value = url;
      showQrCode(url);
      setStatus("QR-Code bereit. Warte auf das zweite Gerät …");
      attachConnection(await created.connect());
    } catch (cause) {
      setStatus(
        cause instanceof Error ? cause.message : "Einladung fehlgeschlagen.",
        true,
      );
    } finally {
      createButton.disabled = false;
    }
  })();
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
sendButton.addEventListener("click", () => {
  if (!connection || connection.channel.readyState !== "open") {
    setStatus("Keine direkte Verbindung vorhanden.", true);
    return;
  }
  connection.channel.send(JSON.stringify(outgoingSnapshot));
  setStatus("Testdeck und Review direkt gesendet.");
});

window.addEventListener("beforeunload", () => {
  stopScanner();
  void connection?.close();
});

void (async () => {
  try {
    if (!Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }
    const identity = await getOrCreateDeviceIdentity();
    element("device-id").textContent = identity.id;
    element("storage-kind").textContent =
      identity.storage === "KEYCHAIN"
        ? "SQLite + iOS-Keychain"
        : "IndexedDB (Browser)";
    renderSnapshot(await store.loadSnapshot());
    const encoded = new URLSearchParams(window.location.hash.slice(1)).get(
      "rendezvous",
    );
    if (encoded) {
      invitationInput.value = encoded;
      await joinInvitation();
    }
  } catch (cause) {
    setStatus(
      cause instanceof Error ? cause.message : "Lokaler Start fehlgeschlagen.",
      true,
    );
  }
})();
