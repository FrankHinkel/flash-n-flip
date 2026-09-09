"use client";

import Link from "next/link";
import {
  Cloud,
  CloudCog,
  CloudDownload,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
  SquareMinus,
  SquarePlus,
  Trash2,
} from "lucide-react";
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  CloudInventoryError,
  cloudInventoryMaximumRequests,
  cloudInventorySignInButtonId,
  cloudInventorySignOutButtonId,
  getCloudInventoryClient,
  mergeCloudInventoryDecks,
  type CloudInventoryAccountState,
  type CloudInventoryDeck,
} from "../lib/cloud-inventory";
import {
  listLocalProductDeckMetadata,
  type LocalDeckSummary,
} from "../lib/local-product-repository";
import {
  buildMyICloudDeckTree,
  flattenVisibleMyICloudDeckTree,
} from "../lib/my-icloud-deck-tree";
import {
  cloudSyncView,
  pauseCloudSync,
  runCloudUserAction,
  subscribeCloudSync,
  type CloudSyncAction,
} from "../lib/cloud-library-runtime";
import styles from "./community-browser.module.css";
import { useI18n } from "./i18n-provider";

const copy = {
  de: {
    title: "Meine iCloud",
    description:
      "Deine lokale und private iCloud-Deck-Hierarchie in einer stabilen Verwaltungsansicht.",
    stage:
      "Phase 1 liest nur Deck-Header. Karten, Medien und Lernfortschritte werden weder geladen noch veraendert.",
    localLoading: "Lokale Deck-Hierarchie wird geladen ...",
    cloudLoading: "iCloud-Bestand wird einmalig und begrenzt gelesen ...",
    empty: "Keine lokalen oder privaten iCloud-Decks vorhanden.",
    localError: "Die lokale Deck-Hierarchie konnte nicht geladen werden.",
    cloudError:
      "Die iCloud-Bibliothek konnte nicht vollstaendig gelesen werden. Lokale Daten wurden nicht verworfen.",
    incomplete:
      "Der iCloud-Bestand ist unvollstaendig. Es wurden keine Cloud-Daten veraendert.",
    signedInWeb:
      "Bei Apple und iCloud angemeldet. Die Anmeldung bleibt im Browser gespeichert.",
    signedOutWeb: "Nicht bei Apple angemeldet.",
    signedInNative:
      "Bei Apple und iCloud angemeldet. Die App verwendet deinen System-iCloud-Account.",
    unavailableNative:
      "Der System-iCloud-Account ist fuer Flash-n-Flip nicht verfuegbar.",
    unavailableWeb: "Die CloudKit-Konfiguration fehlt in diesem Web-Build.",
    accountError: "Der Apple-Anmeldestatus konnte nicht ermittelt werden.",
    checking: "Apple-Anmeldung wird geprueft ...",
    refresh: "iCloud-Bestand aktualisieren",
    requests: (count: number) =>
      `Bestandsanfragen: ${count}/${cloudInventoryMaximumRequests}`,
    localOnly: "Nur lokal",
    cloudOnly: "Nur in iCloud",
    both: "Lokal + iCloud",
    cards: (count: number) =>
      `${count} ${count === 1 ? "Karte" : "Karten"}`,
    expand: (title: string) => `Unterdecks von ${title} anzeigen`,
    collapse: (title: string) => `Unterdecks von ${title} ausblenden`,
    withheld: (count: number) =>
      `${count} ${count === 1 ? "Eintrag wurde" : "Eintraege wurden"} wegen einer unvollstaendigen oder zyklischen Hierarchie nicht auf die oberste Ebene verschoben.`,
  },
  en: {
    title: "My iCloud",
    description:
      "Your local and private iCloud deck hierarchy in one stable management view.",
    stage:
      "Phase 1 reads deck headers only. Cards, media and learning progress are neither loaded nor changed.",
    localLoading: "Loading the local deck hierarchy ...",
    cloudLoading: "Reading the bounded iCloud inventory once ...",
    empty: "No local or private iCloud decks available.",
    localError: "The local deck hierarchy could not be loaded.",
    cloudError:
      "The iCloud library could not be read completely. Local data was preserved.",
    incomplete:
      "The iCloud inventory is incomplete. No cloud data was changed.",
    signedInWeb:
      "Signed in to Apple and iCloud. The browser keeps this sign-in.",
    signedOutWeb: "Not signed in to Apple.",
    signedInNative:
      "Signed in to Apple and iCloud. The app uses your system iCloud account.",
    unavailableNative:
      "The system iCloud account is unavailable to Flash-n-Flip.",
    unavailableWeb: "This web build has no CloudKit configuration.",
    accountError: "The Apple sign-in status could not be determined.",
    checking: "Checking Apple sign-in ...",
    refresh: "Refresh iCloud inventory",
    requests: (count: number) =>
      `Inventory requests: ${count}/${cloudInventoryMaximumRequests}`,
    localOnly: "Local only",
    cloudOnly: "iCloud only",
    both: "Local + iCloud",
    cards: (count: number) =>
      `${count} ${count === 1 ? "card" : "cards"}`,
    expand: (title: string) => `Show subdecks of ${title}`,
    collapse: (title: string) => `Hide subdecks of ${title}`,
    withheld: (count: number) =>
      `${count} ${count === 1 ? "entry was" : "entries were"} not promoted to the top level because the hierarchy is incomplete or cyclic.`,
  },
  fr: {
    title: "Mon iCloud",
    description:
      "Votre hierarchie locale et iCloud privee dans une vue de gestion stable.",
    stage:
      "La phase 1 lit uniquement les en-tetes. Les cartes, medias et progres ne sont ni charges ni modifies.",
    localLoading: "Chargement de la hierarchie locale ...",
    cloudLoading: "Lecture unique et limitee de l'inventaire iCloud ...",
    empty: "Aucun paquet local ou iCloud prive.",
    localError: "La hierarchie locale n'a pas pu etre chargee.",
    cloudError:
      "La bibliotheque iCloud n'a pas pu etre lue completement. Les donnees locales sont conservees.",
    incomplete:
      "L'inventaire iCloud est incomplet. Aucune donnee cloud n'a ete modifiee.",
    signedInWeb:
      "Connecte a Apple et iCloud. Le navigateur conserve la connexion.",
    signedOutWeb: "Non connecte a Apple.",
    signedInNative:
      "Connecte a Apple et iCloud via le compte iCloud du systeme.",
    unavailableNative: "Le compte iCloud du systeme n'est pas disponible.",
    unavailableWeb:
      "La configuration CloudKit manque dans cette version Web.",
    accountError: "Le statut de connexion Apple est indisponible.",
    checking: "Verification de la connexion Apple ...",
    refresh: "Actualiser l'inventaire iCloud",
    requests: (count: number) =>
      `Requetes d'inventaire : ${count}/${cloudInventoryMaximumRequests}`,
    localOnly: "Local uniquement",
    cloudOnly: "iCloud uniquement",
    both: "Local + iCloud",
    cards: (count: number) =>
      `${count} ${count === 1 ? "carte" : "cartes"}`,
    expand: (title: string) =>
      `Afficher les sous-paquets de ${title}`,
    collapse: (title: string) =>
      `Masquer les sous-paquets de ${title}`,
    withheld: (count: number) =>
      `${count} ${count === 1 ? "entree n'a" : "entrees n'ont"} pas ete placee au niveau superieur car la hierarchie est incomplete ou cyclique.`,
  },
  es: {
    title: "Mi iCloud",
    description:
      "Tu jerarquia local y privada de iCloud en una vista de gestion estable.",
    stage:
      "La fase 1 solo lee cabeceras. No carga ni modifica tarjetas, medios ni progreso.",
    localLoading: "Cargando la jerarquia local ...",
    cloudLoading: "Leyendo una vez el inventario limitado de iCloud ...",
    empty: "No hay mazos locales ni privados de iCloud.",
    localError: "No se pudo cargar la jerarquia local.",
    cloudError:
      "No se pudo leer completamente la biblioteca de iCloud. Se conservaron los datos locales.",
    incomplete:
      "El inventario de iCloud esta incompleto. No se modificaron datos en la nube.",
    signedInWeb:
      "Sesion iniciada en Apple y iCloud. El navegador conserva la sesion.",
    signedOutWeb: "No has iniciado sesion en Apple.",
    signedInNative:
      "Sesion iniciada en Apple y iCloud mediante la cuenta del sistema.",
    unavailableNative:
      "La cuenta de iCloud del sistema no esta disponible.",
    unavailableWeb:
      "Esta version web no tiene configuracion de CloudKit.",
    accountError: "No se pudo determinar el estado de Apple.",
    checking: "Comprobando la sesion de Apple ...",
    refresh: "Actualizar inventario de iCloud",
    requests: (count: number) =>
      `Solicitudes de inventario: ${count}/${cloudInventoryMaximumRequests}`,
    localOnly: "Solo local",
    cloudOnly: "Solo en iCloud",
    both: "Local + iCloud",
    cards: (count: number) =>
      `${count} ${count === 1 ? "tarjeta" : "tarjetas"}`,
    expand: (title: string) => `Mostrar submazos de ${title}`,
    collapse: (title: string) => `Ocultar submazos de ${title}`,
    withheld: (count: number) =>
      `${count} ${count === 1 ? "entrada no se coloco" : "entradas no se colocaron"} en el nivel superior porque la jerarquia esta incompleta o es ciclica.`,
  },
};

const actionCopy = {
  de: {
    stage:
      "Der Abgleich startet nur auf deinen ausdruecklichen Befehl: zuerst Lernfortschritte, danach Decks und Karten, Medien zuletzt.",
    sync: "Jetzt synchronisieren",
    stop: "Abgleich anhalten",
    stopping: "Wird angehalten ...",
    open: "Oeffnen",
    download: "Aus iCloud laden",
    removeLocal: "Nur lokal entfernen",
    deleteEverywhere: "Lokal und in iCloud loeschen",
    confirmRemove: (title: string) =>
      `\"${title}\" nur von diesem Geraet entfernen? Lernfortschritte und die iCloud-Fassung bleiben erhalten.`,
    confirmDelete: (title: string) =>
      `\"${title}\" wirklich lokal und aus iCloud loeschen? Diese Loeschung wird auf andere Geraete uebertragen.`,
    requests: (count: number) => `Cloud-Anfragen in diesem Auftrag: ${count}`,
    lastSuccess: (value: string) =>
      `Letzter vollstaendiger Abgleich: ${new Date(value).toLocaleString("de-DE")}`,
    error: "Der Auftrag wurde nicht vollstaendig abgeschlossen. Lokale Daten wurden nicht still verworfen.",
    stages: {
      catalog: "Deck-Header abgleichen",
      activate: "Kuratierte Decks aktivieren",
      prepare: "Inhalte vorbereiten",
      upload: "Inhalte hochladen",
      download: "Inhalte herunterladen",
      reviews: "Lernfortschritte abgleichen",
      apply: "Lokale Daten anwenden",
      delete: "Loeschung uebertragen",
    },
  },
  en: {
    stage:
      "Sync starts only when you request it: learning progress first, then decks and cards, media last.",
    sync: "Sync now",
    stop: "Stop sync",
    stopping: "Stopping ...",
    open: "Open",
    download: "Download from iCloud",
    removeLocal: "Remove from this device",
    deleteEverywhere: "Delete locally and from iCloud",
    confirmRemove: (title: string) =>
      `Remove \"${title}\" from this device only? Progress and the iCloud copy remain.`,
    confirmDelete: (title: string) =>
      `Delete \"${title}\" locally and from iCloud? This deletion will sync to other devices.`,
    requests: (count: number) => `Cloud requests in this operation: ${count}`,
    lastSuccess: (value: string) =>
      `Last complete sync: ${new Date(value).toLocaleString("en")}`,
    error: "The operation did not complete. Local data was not silently discarded.",
    stages: {
      catalog: "Sync deck headers",
      activate: "Activate curated decks",
      prepare: "Prepare content",
      upload: "Upload content",
      download: "Download content",
      reviews: "Sync learning progress",
      apply: "Apply local data",
      delete: "Sync deletion",
    },
  },
} as const;

function formatBytes(bytes: number, locale: string) {
  if (bytes <= 0) return "0 MB";
  return `${(bytes / 1024 / 1024).toLocaleString(locale, {
    maximumFractionDigits: 1,
  })} MB`;
}

export function MyICloudBrowser() {
  const { locale } = useI18n();
  const language = locale.split("-")[0];
  const labels =
    language === "de"
      ? copy.de
      : language === "fr"
        ? copy.fr
        : language === "es"
          ? copy.es
          : copy.en;
  const actions = language === "de" ? actionCopy.de : actionCopy.en;
  const syncView = useSyncExternalStore(
    subscribeCloudSync,
    cloudSyncView,
    cloudSyncView,
  );
  const [localDecks, setLocalDecks] = useState<LocalDeckSummary[]>([]);
  const [cloudDecks, setCloudDecks] = useState<CloudInventoryDeck[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [localLoading, setLocalLoading] = useState(true);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [localError, setLocalError] = useState(false);
  const [cloudError, setCloudError] = useState(false);
  const [incomplete, setIncomplete] = useState(false);
  const [requestCount, setRequestCount] = useState(0);
  const [actionPending, setActionPending] = useState(false);
  const [account, setAccount] = useState<CloudInventoryAccountState>({
    platform: "web",
    status: "checking",
  });
  const clientRef = useRef<
    Awaited<ReturnType<typeof getCloudInventoryClient>> | null
  >(null);
  const runRef = useRef(0);
  const autoLoadedRef = useRef(false);

  async function loadLocalDecks() {
    setLocalLoading(true);
    try {
      setLocalDecks(await listLocalProductDeckMetadata());
      setLocalError(false);
    } catch {
      setLocalError(true);
    } finally {
      setLocalLoading(false);
    }
  }

  async function loadCloudInventory(client = clientRef.current) {
    if (!client) return;
    const run = ++runRef.current;
    setCloudLoading(true);
    setCloudError(false);
    try {
      const snapshot = await client.readInventory();
      if (run !== runRef.current) return;
      setCloudDecks(snapshot.decks);
      setIncomplete(snapshot.incomplete);
      setRequestCount(snapshot.requestCount);
      setExpanded(new Set());
    } catch (cause) {
      if (run !== runRef.current) return;
      setCloudError(true);
      setIncomplete(false);
      setRequestCount(
        cause instanceof CloudInventoryError ? cause.requestCount : 0,
      );
    } finally {
      if (run === runRef.current) setCloudLoading(false);
    }
  }

  useEffect(() => {
    void loadLocalDecks();
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;
    void getCloudInventoryClient()
      .then((client) => {
        if (!active) return;
        clientRef.current = client;
        unsubscribe = client.subscribe((next) => {
          if (!active) return;
          setAccount(next);
          if (next.status !== "signed-in") {
            runRef.current += 1;
            setCloudLoading(false);
            setCloudDecks([]);
            setRequestCount(0);
            autoLoadedRef.current = false;
          } else if (!autoLoadedRef.current) {
            autoLoadedRef.current = true;
            void loadCloudInventory(client);
          }
        });
      })
      .catch(() => {
        if (active) {
          setAccount({ platform: "web", status: "error" });
        }
      });
    return () => {
      active = false;
      runRef.current += 1;
      unsubscribe();
    };
  }, []);

  const decks = useMemo(
    () => mergeCloudInventoryDecks(localDecks, cloudDecks),
    [cloudDecks, localDecks],
  );
  const tree = useMemo(() => buildMyICloudDeckTree(decks), [decks]);
  const rows = useMemo(
    () => flattenVisibleMyICloudDeckTree(tree.roots, expanded),
    [expanded, tree.roots],
  );

  function toggle(deckId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(deckId)) next.delete(deckId);
      else next.add(deckId);
      return next;
    });
  }

  async function performAction(action: CloudSyncAction) {
    setActionPending(true);
    try {
      await runCloudUserAction(action);
      await loadLocalDecks();
      await loadCloudInventory();
    } finally {
      setActionPending(false);
    }
  }

  async function removeLocally(deckId: string, title: string) {
    if (!window.confirm(actions.confirmRemove(title))) return;
    await performAction({ kind: "command", deckId, command: "remove" });
  }

  async function deleteEverywhere(deckId: string, title: string) {
    if (!window.confirm(actions.confirmDelete(title))) return;
    await performAction({ kind: "command", deckId, command: "deck" });
  }

  const syncBusy =
    actionPending || syncView.status === "busy" || syncView.stopping;
  const overallPercent = syncView.progress
    ? Math.min(
        100,
        Math.round(
          (syncView.progress.overallCurrent /
            Math.max(1, syncView.progress.overallTotal)) *
            100,
        ),
      )
    : 0;

  const accountText =
    account.status === "checking"
      ? labels.checking
      : account.status === "signed-in"
        ? account.platform === "native"
          ? labels.signedInNative
          : labels.signedInWeb
        : account.status === "signed-out"
          ? labels.signedOutWeb
          : account.status === "unavailable"
            ? account.platform === "native"
              ? labels.unavailableNative
              : labels.unavailableWeb
            : labels.accountError;

  return (
    <div aria-busy={localLoading || cloudLoading || syncBusy || undefined}>
      <header className={styles.icloudHeader}>
        <h1>{labels.title}</h1>
        <p>{labels.description}</p>
      </header>

      <section className={styles.accountPanel} aria-live="polite">
        <div className={styles.accountSummary}>
          <CloudCog aria-hidden="true" />
          <strong>{accountText}</strong>
        </div>
        {account.platform === "web" ? (
          <div className={styles.appleAccountActions}>
            <div
              id={cloudInventorySignInButtonId}
              className={
                account.status === "signed-in"
                  ? styles.appleButtonHidden
                  : styles.appleButtonSlot
              }
            />
            <div
              id={cloudInventorySignOutButtonId}
              className={
                account.status === "signed-in"
                  ? styles.appleButtonSlot
                  : styles.appleButtonHidden
              }
            />
          </div>
        ) : null}
      </section>

      <p className={styles.stageNotice}>
        <CloudCog aria-hidden="true" />
        <span>{actions.stage}</span>
      </p>

      <div className={styles.inventoryToolbar}>
        <button
          type="button"
          className={styles.primaryCloudButton}
          disabled={account.status !== "signed-in" || syncBusy}
          onClick={() =>
            void performAction({ kind: "sync", explicit: true })
          }
        >
          {syncBusy ? (
            <LoaderCircle aria-hidden="true" className={styles.refreshing} />
          ) : (
            <Play aria-hidden="true" />
          )}
          <span>{actions.sync}</span>
        </button>
        {syncBusy ? (
          <button
            type="button"
            className={styles.refreshButton}
            disabled={syncView.stopping}
            onClick={() => void pauseCloudSync()}
          >
            <Pause aria-hidden="true" />
            <span>{syncView.stopping ? actions.stopping : actions.stop}</span>
          </button>
        ) : null}
        <button
          type="button"
          className={styles.refreshButton}
          disabled={account.status !== "signed-in" || cloudLoading}
          onClick={() => void loadCloudInventory()}
        >
          <RefreshCw
            aria-hidden="true"
            className={cloudLoading ? styles.refreshing : undefined}
          />
          <span>{labels.refresh}</span>
        </button>
        <span className={styles.inventoryStats}>
          {labels.requests(requestCount)} · {actions.requests(syncView.requests)}
        </span>
      </div>

      {syncView.progress ? (
        <section className={styles.syncProgress} aria-live="polite">
          <div className={styles.syncProgressHeader}>
            <strong>
              {actions.stages[syncView.progress.stage]}
              {syncView.progress.deckTitle
                ? `: ${syncView.progress.deckTitle}`
                : ""}
            </strong>
            <span>{overallPercent}%</span>
          </div>
          <progress value={overallPercent} max={100} />
          <span>
            {syncView.progress.overallCurrent}/{syncView.progress.overallTotal}
            {" · "}
            {formatBytes(syncView.progress.completedBytes, locale)}/
            {formatBytes(syncView.progress.totalBytes, locale)}
          </span>
        </section>
      ) : null}
      {syncView.status === "error" ? (
        <p className={`${styles.inventoryNotice} ${styles.errorMessage}`} role="alert">
          {actions.error}
        </p>
      ) : null}
      {syncView.lastSuccess && syncView.status !== "busy" ? (
        <p className={styles.inventoryNotice} role="status">
          {actions.lastSuccess(syncView.lastSuccess)}
        </p>
      ) : null}

      {cloudLoading ? (
        <p className={styles.inventoryNotice} role="status">
          {labels.cloudLoading}
        </p>
      ) : null}
      {cloudError ? (
        <p
          className={`${styles.inventoryNotice} ${styles.errorMessage}`}
          role="alert"
        >
          {labels.cloudError}
        </p>
      ) : null}
      {!cloudError && incomplete ? (
        <p className={styles.inventoryNotice} role="status">
          {labels.incomplete}
        </p>
      ) : null}

      {localLoading ? (
        <p className={styles.stateMessage}>{labels.localLoading}</p>
      ) : localError ? (
        <p
          className={`${styles.stateMessage} ${styles.errorMessage}`}
          role="alert"
        >
          {labels.localError}
        </p>
      ) : rows.length === 0 && !cloudLoading ? (
        <p className={styles.stateMessage}>{labels.empty}</p>
      ) : (
        <ul className={styles.tree} aria-label={labels.title}>
          {rows.map(({ deck, depth, hasChildren }) => {
            const isExpanded = expanded.has(deck.id);
            const statusLabel =
              deck.availability === "local"
                ? labels.localOnly
                : deck.availability === "cloud"
                  ? labels.cloudOnly
                  : labels.both;
            const StatusIcon =
              deck.availability === "local"
                ? RefreshCw
                : deck.availability === "cloud"
                  ? CloudDownload
                  : Cloud;
            return (
              <li key={deck.id}>
                <div
                  className={styles.treeRow}
                  style={
                    {
                      "--icloud-tree-indent": `${Math.min(depth, 8) * 18}px`,
                    } as CSSProperties
                  }
                >
                  {hasChildren ? (
                    <button
                      className={styles.treeToggle}
                      type="button"
                      aria-expanded={isExpanded}
                      aria-label={
                        isExpanded
                          ? labels.collapse(deck.title)
                          : labels.expand(deck.title)
                      }
                      onClick={() => toggle(deck.id)}
                    >
                      {isExpanded ? (
                        <SquareMinus aria-hidden="true" />
                      ) : (
                        <SquarePlus aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    <span
                      className={styles.treeSpacer}
                      aria-hidden="true"
                    />
                  )}
                  <span className={styles.deckMain}>
                    <span className={styles.deckTitle}>{deck.title}</span>
                    <span className={styles.deckMeta}>
                      {labels.cards(deck.cardCount)}
                    </span>
                  </span>
                  <span
                    className={styles.localStatus}
                    title={`${deck.title}: ${statusLabel}`}
                    aria-label={`${deck.title}: ${statusLabel}`}
                  >
                    <StatusIcon aria-hidden="true" />
                    <span className={styles.statusText}>
                      {statusLabel}
                    </span>
                  </span>
                  <span className={styles.deckCloudActions}>
                    {deck.availability !== "cloud" ? (
                      <Link
                        className={styles.deckCloudAction}
                        href={`/app/decks/${deck.id}`}
                      >
                        {actions.open}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={styles.deckCloudAction}
                        disabled={syncBusy}
                        onClick={() =>
                          void performAction({ kind: "restore", deckId: deck.id })
                        }
                      >
                        <CloudDownload aria-hidden="true" />
                        {actions.download}
                      </button>
                    )}
                    {deck.availability !== "cloud" ? (
                      <button
                        type="button"
                        className={styles.deckCloudAction}
                        disabled={syncBusy}
                        onClick={() => void removeLocally(deck.id, deck.title)}
                      >
                        {actions.removeLocal}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={`${styles.deckCloudAction} ${styles.dangerCloudAction}`}
                      disabled={syncBusy}
                      onClick={() => void deleteEverywhere(deck.id, deck.title)}
                    >
                      <Trash2 aria-hidden="true" />
                      {actions.deleteEverywhere}
                    </button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!localLoading && !localError && tree.withheldCount > 0 ? (
        <p className={styles.hierarchyWarning} role="status">
          {labels.withheld(tree.withheldCount)}
        </p>
      ) : null}
    </div>
  );
}
