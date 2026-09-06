"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { cloudSyncView, subscribeCloudSync, runCloudSync, startCloudSignIn,
  pauseCloudSync, scheduleCloudSync } from "../lib/cloud-library-runtime";
import { cloudSignInButtonId, cloudSignOutButtonId } from "../lib/cloud-library-sign-in";
import { readCloudPolicy } from "@flashcards/direct-connect-webstack/cloud-library-policy";
import { useI18n } from "./i18n-provider";

const copy = {
  de: {
    title: "iCloud-Synchronisierung", notice: "Persoenliche Decks, Karten, Medien und Lernfortschritte werden in deiner privaten iCloud gespeichert. Bei eingebauten Decks werden nur Aktivierung und Lernfortschritt synchronisiert; die Inhalte stammen aus dem signierten App-Katalog. Pro Karte gewinnt die zeitlich letzte Bewertung, nicht der letzte Upload. Einstellungen und Lernplaene bleiben auf diesem Geraet.",
    privacy: "Apple verwaltet Anmeldung und Cloud-Speicherung. Der Flash-n-Flip-Server erhaelt diese privaten Lerndaten nicht. Abmelden oder Pausieren loescht weder lokale noch iCloud-Daten. Der Direktabgleich bleibt fuer diese Bibliothek gesperrt.",
    signIn: "Apple-Anmeldung starten", sync: "iCloud aktivieren / jetzt synchronisieren", pause: "Automatischen Abgleich pausieren",
    idle: "Noch kein Abgleich bestaetigt.", busy: "Decks, Medien und Lernfortschritte werden abgeglichen. Lokales Lernen bleibt offline moeglich, ausser waehrend eines offenen Loeschauftrags.",
    ready: "Abgleich abgeschlossen. Die Zwei-Geraete-Abnahme muss das Verhalten auf deinen beiden Geraeten noch bestaetigen.",
    paused: "Abgleich pausiert. Lokale Daten und Kontobindung bleiben erhalten.",
    error: "Abgleich nicht vollstaendig. Bitte Verbindung, urspruengliches Apple-Konto und CloudKit-Umgebung pruefen. Bei Loeschauftraegen zuerst Unterdecks entfernen. Lokale Daten werden nicht wegen eines Verbindungsfehlers verworfen. Erneut synchronisieren setzt offene Auftraege fort.",
    restore: "Auf dieses Geraet laden", remove: "Nur auf diesem Geraet entfernen", erase: "Deck ueberall loeschen", reset: "Lernfortschritt ueberall zuruecksetzen",
    conflict: "Inhaltlicher Konflikt: Bitte die zu erhaltende Fassung waehlen. Bewertungen gehen dadurch nicht verloren.", local: "Lokalen Inhalt behalten", revision: "Cloud-Fassung behalten",
    confirm: "Bestaetigen fuer", resetWarning: "Alle bisherigen Bewertungen dieses Decks werden in iCloud und anschliessend auf verbundenen Geraeten geloescht. Offline-Geraete duerfen alte Bewertungen nicht wiederherstellen.",
    eraseWarning: "Deck, Karten, Medien und Bewertungen werden in iCloud und auf verbundenen Geraeten geloescht. Dieser Vorgang ist nicht rueckgaengig zu machen.",
    removeWarning: "Zuerst wird der iCloud-Stand bestaetigt. Danach wird nur die lokale Deck-Kopie entfernt. Bewertungen und iCloud-Daten bleiben erhalten.",
    resolutionWarning: "Der ausgewaehlte Inhalt ersetzt die konkurrierenden Inhalte dieses Decks. Alle Bewertungen bleiben erhalten.",
    last: "Letzter erfolgreicher Abgleich", apple: "Apple-Anmeldung / Abmeldung", pending: "Noch nicht abgeglichen",
  },
  en: {
    title: "iCloud synchronization", notice: "Personal decks, cards, media and learning progress are stored in your private iCloud. Built-in decks synchronize only activation and learning progress; their content comes from the signed app catalog. Each card uses the latest actual review, not the latest upload. Settings and study plans remain on this device.",
    privacy: "Apple manages authentication and cloud storage. The Flash-n-Flip server does not receive this private learning data. Signing out or pausing does not delete data. Direct peer synchronization stays disabled for this library.",
    signIn: "Start Apple sign-in", sync: "Enable iCloud / synchronize now", pause: "Pause automatic synchronization",
    idle: "No synchronization confirmed yet.", busy: "Synchronizing decks, media and learning progress. Offline learning remains available except during an unresolved deletion command.",
    ready: "Synchronization completed. Two-device acceptance still needs to confirm behavior on your devices.", paused: "Synchronization paused. Local data and account binding are retained.",
    error: "Synchronization is incomplete. Check connectivity, the originally linked Apple account and CloudKit environment. Remove child decks before deleting a parent. Connection failures do not discard local data. Synchronize again to resume pending commands.",
    restore: "Download to this device", remove: "Remove only from this device", erase: "Delete deck everywhere", reset: "Reset learning progress everywhere",
    conflict: "Content conflict: choose the version to retain. Reviews are preserved.", local: "Keep local content", revision: "Keep cloud version",
    confirm: "Confirm for", resetWarning: "All prior reviews for this deck will be erased in iCloud and then on linked devices. Offline devices cannot restore old reviews.",
    eraseWarning: "The deck, cards, media and reviews will be erased in iCloud and on linked devices. This cannot be undone.",
    removeWarning: "The iCloud state is confirmed first. Only the local deck copy is then removed. Reviews and iCloud data are retained.",
    resolutionWarning: "The selected content replaces competing content for this deck. All reviews are retained.",
    last: "Last successful synchronization", apple: "Apple sign-in / sign-out", pending: "Not synchronized yet",
  },
};
export function CloudLibrarySyncSetting() {
  const {locale} = useI18n();
  const t = locale === "de" ? copy.de : copy.en;
  const view = useSyncExternalStore(subscribeCloudSync, cloudSyncView, cloudSyncView);
  const busy = view.status === "busy" || view.stopping;
  const progressLabels = locale === "de" ? {
    catalog: "Deck-Verzeichnis abgleichen", activate: "Eingebautes Deck aktivieren", prepare: "Inhalte vorbereiten", upload: "Inhalte hochladen",
    download: "Inhalte herunterladen", reviews: "Bewertungen hochladen", apply: "Lokale Inhalte speichern",
    delete: "Loeschauftrag bearbeiten",
  } : {
    catalog: "Synchronizing deck catalog", activate: "Activating built-in deck", prepare: "Preparing content", upload: "Uploading content",
    download: "Downloading content", reviews: "Uploading reviews", apply: "Saving local content",
    delete: "Processing deletion",
  };
  const problemLabels = locale === "de" ? {
    timeout: "iCloud hat 30 Sekunden lang nicht geantwortet. Bitte erneut synchronisieren; bestaetigte Daten und offene Auftraege bleiben erhalten.",
    account: "Bitte mit dem urspruenglichen Apple-Konto anmelden.",
    quota: "iCloud meldet ein Speicherlimit. Bitte den verfuegbaren iCloud-Speicher pruefen.",
    generation: "Der Cloud-Stand wurde zwischenzeitlich geaendert. Bitte erneut synchronisieren.",
    unavailable: "iCloud ist momentan nicht erreichbar. Bitte Verbindung pruefen und erneut versuchen.",
    unknown: "Der Abgleich ist fehlgeschlagen. Wegen dieses Fehlers wurden keine lokalen Daten verworfen.",
  } : {
    timeout: "iCloud did not answer within 30 seconds. Retry to resume; confirmed data and pending operations are preserved.",
    account: "Please sign in with the original Apple account.",
    quota: "iCloud reported a storage limit. Please check available iCloud storage.",
    generation: "Cloud state changed during synchronization. Please retry.",
    unavailable: "iCloud is currently unavailable. Check your connection and retry.",
    unknown: "Synchronization failed. No local data was discarded because of this error.",
  };
  const confirm = (title: string, warning: string) => window.confirm(`${t.confirm} "${title}"\n\n${warning}`);
  const progressTotal = view.progress?.totalBytes || view.progress?.total || 0;
  const progressDone = view.progress?.totalBytes ? view.progress.completedBytes : (view.progress?.current ?? 0);
  const progressPercent = progressTotal > 0 ? Math.min(100, Math.round(progressDone / progressTotal * 100)) : 0;
  const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString(locale, {maximumFractionDigits: 1})} MB`;
  return <section className="settings-section" aria-labelledby="cloud-library-title">
    <h2 id="cloud-library-title">{t.title}</h2>
    <p>{t.notice}</p><p>{t.privacy}</p>
    <p role={view.status === "error" ? "alert" : "status"} aria-live="polite">
      {view.stopping
        ? (locale === "de" ? "Abgleich wird angehalten; bestaetigte Daten bleiben erhalten." : "Stopping synchronization; confirmed data is preserved.")
        : t[view.status]}
    </p>
    {view.status === "busy" && !view.stopping && <div className="setting-status" role="status" aria-live="polite" aria-atomic="true">
      <p>{view.progress ? progressLabels[view.progress.stage]
        : (locale === "de" ? "Apple-Konto und iCloud-Verbindung pruefen" : "Checking Apple account and iCloud connection")}
      {view.progress?.deckTitle ? `: ${view.progress.deckTitle}` : ""}
      {view.progress && view.progress.totalBytes > 0
        ? ` (${megabytes(view.progress.completedBytes)} / ${megabytes(view.progress.totalBytes)})`
        : view.progress && view.progress.total > 0 ? ` (${view.progress.current}/${view.progress.total})` : ""}</p>
      {progressTotal > 0 && <><progress max={progressTotal} value={progressDone}
        aria-label={locale === "de" ? "Fortschritt des aktuellen Synchronisationsschritts" : "Current synchronization step progress"} />
        <span> {progressPercent}%</span></>}
      <p>{locale === "de" ? "Bestaetigte Cloud-Anfragen" : "Completed cloud requests"}: {view.requests}. {locale === "de"
        ? "Pause ist jederzeit moeglich. Einzelne Cloud-Anfragen warten hoechstens 30 Sekunden."
        : "You can pause at any time. Each cloud request waits at most 30 seconds."}</p>
    </div>}
    {view.status === "error" && view.problem && <p role="alert">{problemLabels[view.problem]}</p>}
    {view.lastSuccess && <p>{t.last}: <time dateTime={view.lastSuccess}>{new Date(view.lastSuccess).toLocaleString(locale)}</time></p>}
    <button className="setting-action" type="button" disabled={busy} onClick={() => void startCloudSignIn()}>{t.signIn}</button>
    <button className="setting-action" type="button" disabled={busy} aria-busy={busy || undefined}
      onClick={() => void runCloudSync({kind: "sync", explicit: true})}>{t.sync}</button>
    <button className="setting-action" type="button" disabled={view.stopping || (!busy && !view.account)}
      onClick={() => void pauseCloudSync()}>{t.pause}</button>
    <ul>
      {view.decks.filter((deck) => deck.status !== "deleted").map((deck) => <li key={deck.deckId}>
        <h3>{deck.title}</h3>
        {deck.status === "error" && <p role="alert">{t.pending}</p>}
        {deck.status === "conflict" && <div><p role="alert">{t.conflict}</p>
          <button className="setting-action" type="button" disabled={busy} onClick={() => {
            if (confirm(deck.title, t.resolutionWarning)) void runCloudSync({kind: "sync", explicit: true,
              resolve: {deckId: deck.deckId, revisionId: "local"}});
          }}>{t.local}</button>
          {deck.revisions.map((revision, index) => <button className="setting-action" type="button" key={revision} disabled={busy}
            onClick={() => { if (confirm(deck.title, t.resolutionWarning)) void runCloudSync({kind: "sync", explicit: true,
              resolve: {deckId: deck.deckId, revisionId: revision}}); }}>{t.revision} {index + 1}</button>)}
        </div>}
        {deck.removed ? <button className="setting-action" type="button" disabled={busy}
          onClick={() => void runCloudSync({kind: "restore", deckId: deck.deckId})}>{t.restore}</button> :
          <button className="setting-action" type="button" disabled={busy || deck.status !== "synced"}
            onClick={() => { if (confirm(deck.title, t.removeWarning)) void runCloudSync({kind: "command", deckId: deck.deckId, command: "remove"}); }}>{t.remove}</button>}
        <button className="setting-action" type="button" disabled={busy || deck.status !== "synced"}
          onClick={() => { if (confirm(deck.title, t.resetWarning)) void runCloudSync({kind: "command", deckId: deck.deckId, command: "progress"}); }}>{t.reset}</button>
        <button className="setting-action" type="button" disabled={busy || deck.status !== "synced"}
          onClick={() => { if (confirm(deck.title, t.eraseWarning)) void runCloudSync({kind: "command", deckId: deck.deckId, command: "deck"}); }}>{t.erase}</button>
      </li>)}
    </ul>
  </section>;
}

// Keep Apple's DOM hosts stable across route/account/transfer state changes.
export function CloudLibraryLifecycle() {
  const pathname = usePathname();
  const {locale} = useI18n();
  const [native, setNative] = useState(true);
  useEffect(() => {
    setNative(Capacitor.isNativePlatform());
    const resume = () => scheduleCloudSync(250);
    const changed = (event: Event) => {
      if ((event as CustomEvent<{source?: string}>).detail?.source !== "cloud-sync") scheduleCloudSync();
    };
    void readCloudPolicy().then((policy) => { if (policy?.enabled) resume(); }).catch(() => undefined);
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("flash-n-flip:decks-changed", changed);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("online", resume); window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume); window.removeEventListener("flash-n-flip:decks-changed", changed);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);
  return <section className="settings-section" hidden={native || !pathname.endsWith("/settings")}
    aria-label={locale === "de" ? copy.de.apple : copy.en.apple}>
    <h2>{locale === "de" ? copy.de.apple : copy.en.apple}</h2>
    <div id={cloudSignInButtonId} /><div id={cloudSignOutButtonId} />
  </section>;
}
