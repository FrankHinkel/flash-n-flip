import { Capacitor } from "@capacitor/core";
import jsQR from "jsqr";
import { toQR } from "toqr";

import { phaseOneSnapshotSchema } from "@flashcards/domain/rendezvous";
import type { ReviewRating } from "@flashcards/domain";
import { previewRatings } from "@flashcards/scheduler";
import {
  decodeDirectSyncInvitation,
  encodeDirectSyncInvitation,
  persistPhaseOneSnapshot,
} from "@flashcards/sync/rendezvous";

import { getOrCreateDeviceIdentity } from "./identity";
import { LocalAppRepository, localCardContentPlainText } from "./local-app";
import type { VersionedLocalEntity } from "./local-app";
import type {
  LocalCardPayload,
  LocalDeckPayload,
  LocalMediaReferencePayload,
} from "@flashcards/domain/local-app-data";
import { createDirectSyncInvitation, joinDirectSyncInvitation } from "./peer";
import type { DirectConnection } from "./peer";
import { LocalPeerSynchronizer } from "./peer-sync";
import { createPhaseOneStore } from "./store";

const element = <T extends HTMLElement>(id: string): T => {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing application element: ${id}`);
  return value as T;
};

const value = (id: string): string => element<HTMLInputElement>(id).value;
const setValue = (id: string, next: string): void => {
  element<HTMLInputElement | HTMLTextAreaElement>(id).value = next;
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
const studyDialog = element<HTMLDialogElement>("study-dialog");
const phaseOneStore = createPhaseOneStore();

let repository: LocalAppRepository;
let synchronizer: LocalPeerSynchronizer;
let connection: DirectConnection | null = null;
let scannerStream: MediaStream | null = null;
let scannerFrame = 0;
let studyCards: VersionedLocalEntity<LocalCardPayload>[] = [];
let studyIndex = 0;

const apiOrigin = (): string =>
  Capacitor.isNativePlatform()
    ? "https://flash-n-flip.com/api"
    : `${window.location.origin}/api`;

const setStatus = (message: string, error = false): void => {
  status.textContent = message;
  status.dataset.error = String(error);
};

const applyTheme = (theme: "SYSTEM" | "LIGHT" | "DARK"): void => {
  document.documentElement.dataset.theme = theme.toLowerCase();
};

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatInterval = (due: string, now: Date): string => {
  const minutes = Math.max(
    1,
    Math.round((new Date(due).getTime() - now.getTime()) / 60_000),
  );
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} Std.`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "Tag" : "Tage"}`;
};

const button = (
  label: string,
  action: () => void | Promise<void>,
  className = "secondary",
): HTMLButtonElement => {
  const result = document.createElement("button");
  result.type = "button";
  result.className = className;
  result.textContent = label;
  result.addEventListener("click", () => {
    void Promise.resolve(action()).catch((cause) =>
      setStatus(
        cause instanceof Error ? cause.message : "Aktion fehlgeschlagen.",
        true,
      ),
    );
  });
  return result;
};

const resetCardForm = (): void => {
  setValue("card-id", "");
  setValue("card-version", "");
  setValue("card-front-input", "");
  setValue("card-back-input", "");
};

const resetDeckForm = (): void => {
  setValue("deck-id", "");
  setValue("deck-version", "");
  setValue("deck-title-input", "");
  setValue("deck-description-input", "");
  setValue("deck-language-input", "de");
  element("card-editor").hidden = true;
  resetCardForm();
};

const renderOutbox = async (): Promise<void> => {
  const count = (await repository.authority.listOutbox()).length;
  element("outbox-count").textContent =
    `${count} ${count === 1 ? "Änderung" : "Änderungen"}`;
};

const editCard = (card: VersionedLocalEntity<LocalCardPayload>): void => {
  setValue("card-id", card.id);
  setValue("card-version", String(card.version));
  setValue("card-front-input", localCardContentPlainText(card.payload.front));
  setValue("card-back-input", localCardContentPlainText(card.payload.back));
  element<HTMLTextAreaElement>("card-front-input").focus();
};

const renderEditor = async (
  deck: VersionedLocalEntity<LocalDeckPayload>,
): Promise<void> => {
  setValue("deck-id", deck.id);
  setValue("deck-version", String(deck.version));
  setValue("deck-title-input", deck.payload.title);
  setValue("deck-description-input", deck.payload.description);
  setValue("deck-language-input", deck.payload.language);
  element("card-editor").hidden = false;
  element("card-editor-heading").textContent =
    `Karten in „${deck.payload.title}“`;
  resetCardForm();
  const cards = await repository.listCards(deck.id);
  const list = element("card-list");
  list.replaceChildren();
  for (const card of cards) {
    const row = document.createElement("article");
    row.className = "editor-card-row";
    const front = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = localCardContentPlainText(card.payload.front);
    front.append(strong);
    const back = document.createElement("p");
    back.className = "deck-meta";
    back.textContent = localCardContentPlainText(card.payload.back);
    const actions = document.createElement("div");
    actions.className = "row-actions";
    actions.append(
      button("Bearbeiten", () => editCard(card)),
      button(
        "Löschen",
        async () => {
          if (!window.confirm("Diese Karte lokal löschen?")) return;
          await repository.deleteCard(card);
          await renderAll();
          const refreshed = (await repository.listDecks()).find(
            (candidate) => candidate.id === deck.id,
          );
          if (refreshed) await renderEditor(refreshed);
          setStatus("Karte als Tombstone gespeichert.");
        },
        "danger",
      ),
    );
    row.append(front, back, actions);
    list.append(row);
  }
  const media = await repository.listMedia(deck.id);
  const mediaList = element("media-list");
  mediaList.replaceChildren();
  for (const item of media) {
    const entry = document.createElement("li");
    entry.textContent = `${item.payload.fileName} · ${formatBytes(item.payload.byteSize)} `;
    entry.append(
      button(
        "Entfernen",
        async () => {
          if (!window.confirm("Diese lokale Mediendatei löschen?")) return;
          await repository.deleteEntity(item, "MEDIA_REFERENCE");
          await renderEditor(deck);
          await renderOutbox();
        },
        "danger",
      ),
    );
    mediaList.append(entry);
  }
};

const showStudyCard = (): void => {
  const card = studyCards[studyIndex];
  if (!card) {
    studyDialog.close();
    setStatus("Lernrunde abgeschlossen.");
    return;
  }
  element("study-front").textContent = localCardContentPlainText(
    card.payload.front,
  );
  element("study-answer-front").textContent = localCardContentPlainText(
    card.payload.front,
  );
  element("study-back").textContent = localCardContentPlainText(
    card.payload.back,
  );
  element("study-question").hidden = false;
  element("study-answer").hidden = true;
  element("rating-buttons").hidden = true;
  element<HTMLButtonElement>("reveal-button").hidden = false;
  const studyCard =
    element<HTMLElement>("study-dialog").querySelector<HTMLElement>(
      ".study-card",
    );
  studyCard?.classList.remove("revealed");
  studyCard?.setAttribute("data-study-card", "question");
  element("study-progress").textContent =
    `Karte ${studyIndex + 1} von ${studyCards.length}`;
  element<HTMLElement>("study-progress-bar").style.width =
    `${Math.round(((studyIndex + 1) / studyCards.length) * 100)}%`;
  const now = new Date();
  const previews = previewRatings(card.payload.state, now);
  element("rating-buttons")
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((ratingButton) => {
      const rating = ratingButton.dataset.rating as ReviewRating;
      const interval = ratingButton.querySelector("small");
      if (interval)
        interval.textContent = formatInterval(previews[rating].due, now);
    });
  element<HTMLButtonElement>("reveal-button").focus();
};

const startStudy = async (
  deck: VersionedLocalEntity<LocalDeckPayload>,
): Promise<void> => {
  studyCards = (await repository.listCards(deck.id)).filter(
    (card) => !card.payload.suspended,
  );
  if (studyCards.length === 0) {
    setStatus("Dieses Deck enthält noch keine lernbare Karte.", true);
    return;
  }
  studyIndex = 0;
  element("study-heading").textContent = deck.payload.title;
  studyDialog.showModal();
  showStudyCard();
};

const editDeck = async (
  deck: VersionedLocalEntity<LocalDeckPayload>,
): Promise<void> => {
  await renderEditor(deck);
  element("editor").scrollIntoView({ behavior: "smooth", block: "start" });
  element<HTMLInputElement>("deck-title-input").focus({ preventScroll: true });
};

const renderAll = async (): Promise<void> => {
  const decks = await repository.listDecks();
  const cards = await repository.listCards();
  const reviews = await repository.listReviews();
  element("deck-empty").hidden = decks.length > 0;
  const list = element("deck-list");
  list.replaceChildren();
  for (const deck of decks) {
    const deckCards = cards.filter((card) => card.payload.deckId === deck.id);
    const deckReviews = reviews.filter(
      (review) => review.payload.deckId === deck.id,
    );
    const row = document.createElement("article");
    row.className = "deck-row";
    const title = document.createElement("h3");
    title.textContent = deck.payload.title;
    const description = document.createElement("p");
    description.className = "deck-meta";
    description.textContent = deck.payload.description || "Keine Beschreibung";
    const meta = document.createElement("p");
    meta.className = "deck-meta";
    meta.textContent = `${deckCards.length} Karten · ${deckReviews.length} Reviews · ${deck.payload.language}`;
    const actions = document.createElement("div");
    actions.className = "row-actions";
    actions.append(
      button("Lernen", () => startStudy(deck), ""),
      button("Bearbeiten", () => editDeck(deck)),
      button(
        "Löschen",
        async () => {
          if (
            !window.confirm(
              `Deck „${deck.payload.title}“ und seine lokalen Karten löschen?`,
            )
          )
            return;
          await repository.deleteDeck(deck);
          resetDeckForm();
          await renderAll();
          setStatus("Deck und abhängige Daten als Tombstones gespeichert.");
        },
        "danger",
      ),
    );
    row.append(title, description, meta, actions);
    list.append(row);
  }
  const settings = await repository.settings();
  if (settings) {
    element<HTMLSelectElement>("theme-input").value = settings.payload.theme;
    setValue("locale-input", settings.payload.locale);
    setValue("daily-goal-input", String(settings.payload.dailyGoal));
    applyTheme(settings.payload.theme);
  }
  await renderOutbox();
};

const attachConnection = (next: DirectConnection): void => {
  connection = next;
  sendButton.disabled = false;
  setStatus("Direkte WebRTC-Verbindung steht. Lokaler Abgleich läuft …");
  void synchronizer
    .start(next)
    .then(() => synchronizer.sendPending(next))
    .then((count) => {
      setStatus(
        count > 0
          ? `${count} lokale Änderungen direkt angeboten.`
          : "Geräte sind direkt verbunden und bereit.",
      );
    })
    .catch((cause) =>
      setStatus(
        cause instanceof Error ? cause.message : "Abgleich fehlgeschlagen.",
        true,
      ),
    );
  next.channel.addEventListener("close", () => {
    sendButton.disabled = true;
    setStatus("Direktverbindung geschlossen. Lokales Arbeiten bleibt möglich.");
  });
};

const qrPath = (input: string): { path: string; size: number } => {
  const modules = toQR(input);
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

const showQrCode = (input: string): void => {
  const qr = qrPath(input);
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

const invitationFromValue = (input: string) => {
  const trimmed = input.trim();
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

element<HTMLFormElement>("deck-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void (async () => {
    const id = value("deck-id");
    const savedId = await repository.saveDeck({
      id: id || undefined,
      version: id ? Number(value("deck-version")) : undefined,
      title: value("deck-title-input"),
      description: value("deck-description-input"),
      language: value("deck-language-input"),
    });
    await renderAll();
    const deck = (await repository.listDecks()).find(
      (candidate) => candidate.id === savedId,
    );
    if (deck) await renderEditor(deck);
    setStatus("Deck dauerhaft lokal gespeichert.");
  })().catch((cause) =>
    setStatus(
      cause instanceof Error
        ? cause.message
        : "Deck konnte nicht gespeichert werden.",
      true,
    ),
  );
});

element<HTMLFormElement>("card-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void (async () => {
    const deckId = value("deck-id");
    if (!deckId) throw new Error("Bitte zuerst ein Deck speichern.");
    const id = value("card-id");
    await repository.saveCard({
      id: id || undefined,
      version: id ? Number(value("card-version")) : undefined,
      deckId,
      front: value("card-front-input"),
      back: value("card-back-input"),
    });
    await renderAll();
    const deck = (await repository.listDecks()).find(
      (candidate) => candidate.id === deckId,
    );
    if (deck) await renderEditor(deck);
    setStatus("Karte dauerhaft lokal gespeichert.");
  })().catch((cause) =>
    setStatus(
      cause instanceof Error
        ? cause.message
        : "Karte konnte nicht gespeichert werden.",
      true,
    ),
  );
});

element<HTMLFormElement>("media-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void (async () => {
    const deckId = value("deck-id");
    const file = element<HTMLInputElement>("media-input").files?.[0];
    if (!deckId || !file) throw new Error("Bitte Deck und Datei auswählen.");
    await repository.addMedia({
      deckId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    element<HTMLInputElement>("media-input").value = "";
    const deck = (await repository.listDecks()).find(
      (candidate) => candidate.id === deckId,
    );
    if (deck) await renderEditor(deck);
    await renderOutbox();
    setStatus(`„${file.name}“ dauerhaft lokal gespeichert.`);
  })().catch((cause) =>
    setStatus(
      cause instanceof Error
        ? cause.message
        : "Medium konnte nicht gespeichert werden.",
      true,
    ),
  );
});

element<HTMLFormElement>("settings-form").addEventListener(
  "submit",
  (event) => {
    event.preventDefault();
    void repository
      .saveSettings({
        theme: element<HTMLSelectElement>("theme-input").value as
          "SYSTEM" | "LIGHT" | "DARK",
        locale: value("locale-input"),
        dailyGoal: Number(value("daily-goal-input")),
      })
      .then(renderAll)
      .then(() => setStatus("Einstellungen dauerhaft lokal gespeichert."))
      .catch((cause) =>
        setStatus(
          cause instanceof Error
            ? cause.message
            : "Einstellungen konnten nicht gespeichert werden.",
          true,
        ),
      );
  },
);

element("new-deck-button").addEventListener("click", () => {
  resetDeckForm();
  element("editor").scrollIntoView({ behavior: "smooth" });
  element<HTMLInputElement>("deck-title-input").focus({ preventScroll: true });
});
element("deck-cancel-button").addEventListener("click", resetDeckForm);
element("card-cancel-button").addEventListener("click", resetCardForm);
element("study-close-button").addEventListener("click", () =>
  studyDialog.close(),
);
element("reveal-button").addEventListener("click", () => {
  element("study-question").hidden = true;
  element("study-answer").hidden = false;
  element("rating-buttons").hidden = false;
  element<HTMLButtonElement>("reveal-button").hidden = true;
  const studyCard = studyDialog.querySelector<HTMLElement>(".study-card");
  studyCard?.classList.add("revealed");
  studyCard?.setAttribute("data-study-card", "answer");
  (
    element("rating-buttons").querySelector(
      "button",
    ) as HTMLButtonElement | null
  )?.focus();
});
element("rating-buttons")
  .querySelectorAll<HTMLButtonElement>("button")
  .forEach((ratingButton) =>
    ratingButton.addEventListener("click", () => {
      void (async () => {
        const card = studyCards[studyIndex];
        if (!card) return;
        await repository.reviewCard(
          card.id,
          ratingButton.dataset.rating as ReviewRating,
        );
        studyIndex += 1;
        await renderAll();
        showStudyCard();
      })().catch((cause) =>
        setStatus(
          cause instanceof Error
            ? cause.message
            : "Review konnte nicht gespeichert werden.",
          true,
        ),
      );
    }),
  );

element("export-button").addEventListener("click", () => {
  void repository
    .exportAll()
    .then((backup) => {
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `flash-n-flip-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus("Vollständiges lokales Backup erstellt.");
    })
    .catch((cause) =>
      setStatus(
        cause instanceof Error ? cause.message : "Export fehlgeschlagen.",
        true,
      ),
    );
});

element<HTMLInputElement>("import-input").addEventListener(
  "change",
  (event) => {
    void (async () => {
      const input = event.currentTarget as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;
      await repository.restoreAll(JSON.parse(await file.text()));
      input.value = "";
      await renderAll();
      setStatus("Backup vollständig geprüft und lokal wiederhergestellt.");
    })().catch((cause) =>
      setStatus(
        cause instanceof Error ? cause.message : "Import fehlgeschlagen.",
        true,
      ),
    );
  },
);

createButton.addEventListener("click", () => {
  void (async () => {
    createButton.disabled = true;
    setStatus("Kurzlebige, kontolose Einladung wird erstellt …");
    const created = await createDirectSyncInvitation(apiOrigin());
    const encoded = encodeDirectSyncInvitation(created.invitation);
    const url = `https://flash-n-flip.com/connect/index.html#rendezvous=${encoded}`;
    invitationInput.value = url;
    showQrCode(url);
    setStatus("QR-Code bereit. Warte auf das zweite Gerät …");
    attachConnection(await created.connect());
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
sendButton.addEventListener("click", () => {
  if (!connection)
    return setStatus("Keine direkte Verbindung vorhanden.", true);
  void synchronizer
    .sendPending(connection)
    .then((count) =>
      setStatus(
        count
          ? `${count} Änderungen direkt gesendet.`
          : "Keine offenen lokalen Änderungen.",
      ),
    )
    .catch((cause) =>
      setStatus(
        cause instanceof Error ? cause.message : "Abgleich fehlgeschlagen.",
        true,
      ),
    );
});

window.addEventListener("beforeunload", () => {
  stopScanner();
  void connection?.close();
});

void (async () => {
  try {
    if (!Capacitor.isNativePlatform() && "serviceWorker" in navigator)
      await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    const identity = await getOrCreateDeviceIdentity();
    repository = new LocalAppRepository(identity.id);
    synchronizer = new LocalPeerSynchronizer(
      repository.authority,
      identity.id,
      renderAll,
      async (candidate) => {
        const legacy = phaseOneSnapshotSchema.safeParse(candidate);
        if (!legacy.success)
          throw new Error("Unbekanntes Direktabgleich-Format.");
        await persistPhaseOneSnapshot(phaseOneStore, legacy.data);
        await repository.migratePhaseOne(legacy.data);
        await renderAll();
      },
    );
    element("device-id").textContent = identity.id;
    element("storage-kind").textContent =
      identity.storage === "KEYCHAIN"
        ? "SQLite + iOS-Keychain"
        : "IndexedDB (Browser)";
    await repository.migratePhaseOne(await phaseOneStore.loadSnapshot());
    await renderAll();
    setStatus("Bereit. Alle Kernabläufe speichern lokal.");
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
