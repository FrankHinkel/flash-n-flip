"use client";

import { Capacitor } from "@capacitor/core";
import { Cloud, CloudDownload, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cloudSyncView, runCloudSync, runCloudUserAction, startCloudSignIn, subscribeCloudSync,
  type CloudSyncAction } from "../lib/cloud-library-runtime";
import { cloudSignInButtonId, cloudSignOutButtonId } from "../lib/cloud-library-sign-in";
import { useI18n } from "./i18n-provider";

export function CloudDeckBrowser() {
  const {locale} = useI18n();
  const de = locale === "de";
  const view = useSyncExternalStore(subscribeCloudSync, cloudSyncView, cloudSyncView);
  const initialized = useRef(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const busy = view.status === "busy" || view.stopping;
  const decks = view.decks.filter((deck) => !deck.curated && deck.status !== "deleted");
  const conflicts = decks.filter((deck) => deck.status === "conflict");
  const locked = view.stopping || pendingAction !== null;
  useEffect(() => { void startCloudSignIn(); }, []);
  useEffect(() => {
    if (view.accountStatus === "signed-in" && !initialized.current) {
      initialized.current = true;
      void runCloudSync({kind: "sync", explicit: true});
    }
  }, [view.accountStatus]);
  const perform = async (key: string, action: CloudSyncAction, after?: () => void) => {
    if (pendingAction) return;
    setPendingAction(key);
    try { await runCloudUserAction(action); after?.(); }
    finally { setPendingAction(null); }
  };
  const confirm = (title: string, warning: string) => window.confirm(`${title}\n\n${warning}`);
  const removeWarning = de
    ? "Nur Karteninhalte und Medien auf diesem Geraet werden entfernt. Das Deck und der Lernfortschritt bleiben in iCloud erhalten."
    : "Only card content and media on this device are removed. The deck and learning progress remain in iCloud.";
  const eraseWarning = de
    ? "Deck, Karten, Medien und Lernfortschritt werden zuerst bestaetigt aus iCloud geloescht und danach von diesem Geraet entfernt. Andere Geraete uebernehmen die Loeschung beim naechsten Abgleich."
    : "The deck, cards, media and learning progress are first confirmed deleted from iCloud and then removed from this device. Other devices apply the deletion during their next sync.";
  const eraseAll = () => {
    const expected = de ? "ALLE LOESCHEN" : "DELETE ALL";
    const phrase = window.prompt(de
      ? `Alle ${decks.length} angezeigten persoenlichen Decks werden aus iCloud und von allen Geraeten geloescht. Zum Bestaetigen ${expected} eingeben.`
      : `All ${decks.length} displayed personal decks will be deleted from iCloud and every device. Enter ${expected} to confirm.`);
    if (phrase === expected) void perform("delete-all",
      {kind: "command-all", command: "deck", deckIds: decks.map(deck => deck.deckId)});
  };

  return <section className="cloud-deck-library" aria-labelledby="icloud-decks-title">
    <div className="result-heading">
      <div><span className="eyebrow">{de ? "Deine private Bibliothek" : "Your private library"}</span>
        <h1 id="icloud-decks-title">{de ? "Meine iCloud" : "My iCloud"}</h1>
        <p>{de ? "Persoenliche Decks aus iCloud laden oder von deinen Geraeten entfernen. Kuratierte Decks bleiben im Bereich Kuratiert."
          : "Download personal decks from iCloud or remove them from your devices. Curated decks remain under Curated."}</p></div>
      <button className="button button-quiet" type="button" disabled={busy || view.accountStatus !== "signed-in"}
        aria-busy={busy || undefined} onClick={() => void runCloudSync({kind: "sync", explicit: true})}>
        <RefreshCw className={busy ? "spin" : undefined} aria-hidden="true" />
        {de ? "Aktualisieren" : "Refresh"}
      </button>
    </div>

    <div className="cloud-account-state compact" data-state={view.accountStatus} role="status" aria-live="polite">
      {view.accountStatus === "checking" ? <LoaderCircle className="spin" aria-hidden="true" />
        : view.accountStatus === "signed-in" ? <Cloud aria-hidden="true" /> : <CloudDownload aria-hidden="true" />}
      <span><strong>{view.accountStatus === "checking" ? (de ? "Apple-Anmeldung wird geprueft" : "Checking Apple sign-in")
        : view.accountStatus === "signed-in" ? (de ? "Bei Apple und iCloud angemeldet" : "Signed in to Apple and iCloud")
          : view.accountStatus === "signed-out" ? (de ? "Nicht bei Apple angemeldet" : "Not signed in to Apple")
            : (de ? "Apple-Anmeldung nicht erreichbar" : "Apple sign-in unavailable")}</strong>
        <small>{Capacitor.isNativePlatform() ? (de ? "iOS verwendet automatisch deinen System-iCloud-Account." : "iOS automatically uses your system iCloud account.")
          : (de ? "Die Sitzung wird in dieser PWA wiederhergestellt." : "The session is restored in this PWA.")}</small></span>
    </div>
    {!Capacitor.isNativePlatform() && <div className="cloud-account-actions" aria-label={de ? "Apple-Anmeldung und Abmeldung" : "Apple sign-in and sign-out"}>
      <div id={cloudSignInButtonId} /><div id={cloudSignOutButtonId} />
    </div>}

    {view.accountStatus === "signed-out" && <p className="empty-state">{de
      ? "Melde dich mit Apple an, um deine persoenlichen iCloud-Decks anzuzeigen."
      : "Sign in with Apple to view your personal iCloud decks."}</p>}
    {view.accountStatus === "signed-in" && !busy && decks.length === 0 && <p className="empty-state">{de
      ? "Keine persoenlichen Decks in iCloud gefunden." : "No personal decks were found in iCloud."}</p>}
    {view.status === "error" && <p role="alert">{de
      ? "Die iCloud-Bibliothek konnte nicht vollstaendig geladen werden. Lokale Daten wurden nicht verworfen."
      : "The iCloud library could not be loaded completely. Local data was not discarded."}</p>}

    {view.accountStatus === "signed-in" && decks.length > 0 && <section className="cloud-deck-bulk-actions"
      aria-labelledby="icloud-bulk-actions-title" aria-busy={pendingAction !== null || undefined}>
      <div><h2 id="icloud-bulk-actions-title">{de ? `Aktion fuer alle ${decks.length} Eintraege` : `Action for all ${decks.length} entries`}</h2>
        <p>{de ? "Ein laufender automatischer Abgleich wird fuer die gewaehlte Aktion kontrolliert angehalten."
          : "A running automatic synchronization is stopped safely before the selected action."}</p></div>
      <div className="cloud-deck-bulk-buttons">
        {conflicts.some(deck => deck.localAvailable) && <button className="button button-quiet" type="button" disabled={locked}
          onClick={() => void perform("resolve-local", {kind: "sync", explicit: true,
            resolve: conflicts.filter(deck => deck.localAvailable).map(deck => ({deckId: deck.deckId, revisionId: "local"}))})}>
          {de ? "Alle Konflikte: lokal behalten" : "All conflicts: keep local"}</button>}
        {conflicts.some(deck => deck.revisions[0]) && <button className="button button-quiet" type="button" disabled={locked}
          onClick={() => void perform("resolve-cloud", {kind: "sync", explicit: true,
            resolve: conflicts.flatMap(deck => deck.revisions[0] ? [{deckId: deck.deckId, revisionId: deck.revisions[0]}] : [])})}>
          {de ? "Alle Konflikte: iCloud-Fassung 1" : "All conflicts: iCloud version 1"}</button>}
        <button className="button button-danger" type="button" disabled={locked} onClick={eraseAll}>
          <Trash2 aria-hidden="true" />{de ? "Alle aus iCloud und von allen Geraeten loeschen" : "Delete all from iCloud and every device"}</button>
      </div>
      {pendingAction && <p role="status" aria-live="polite">{de ? "Aktion wird ausgefuehrt ..." : "Applying action ..."}</p>}
    </section>}

    <div className="cloud-deck-grid" role="list">
      {decks.map((deck) => {
        const active = busy && view.progress?.deckId === deck.deckId;
        const firstRevision = deck.revisions[0];
        return <article className="cloud-deck-card" key={deck.deckId} role="listitem">
          <div className="cloud-deck-heading">
            <span className="cloud-deck-state" role="img" aria-label={deck.removed
              ? (de ? "In iCloud, nicht auf diesem Geraet" : "In iCloud, not on this device")
              : (de ? "In iCloud und auf diesem Geraet" : "In iCloud and on this device")}>
              {active ? <LoaderCircle className="spin" aria-hidden="true" />
                : deck.removed ? <CloudDownload aria-hidden="true" /> : <Cloud aria-hidden="true" />}
            </span>
            <div><h2>{deck.title}</h2><p>{deck.cardCount.toLocaleString(locale)} {de ? "Karten" : "cards"}
              {deck.parentDeckId ? ` · ${de ? "Unterdeck" : "subdeck"}` : ""}</p></div>
          </div>
          {deck.status === "error" && <p role="alert">{de ? "Noch nicht vollstaendig abgeglichen." : "Not fully synchronized yet."}</p>}
          {deck.status === "conflict" && <div className="cloud-deck-conflict"><p role="alert">{de
            ? "Inhaltskonflikt: Waehle die Fassung, die erhalten bleiben soll. Lernfortschritte bleiben bestehen."
            : "Content conflict: choose the version to retain. Learning progress is preserved."}</p>
            <div className="cloud-deck-conflict-actions">
              {deck.localAvailable && <button className="button button-quiet" type="button" disabled={locked}
                onClick={() => void perform(`local-${deck.deckId}`, {kind: "sync", explicit: true,
                  resolve: {deckId: deck.deckId, revisionId: "local"}})}>{de ? "Lokalen Inhalt behalten" : "Keep local content"}</button>}
              {deck.revisions.map((revision, index) => <button className="button button-quiet" type="button" key={revision} disabled={locked}
                onClick={() => void perform(`cloud-${deck.deckId}-${revision}`, {kind: "sync", explicit: true,
                  resolve: {deckId: deck.deckId, revisionId: revision}})}>
                {de ? "iCloud-Fassung" : "iCloud version"} {index + 1}</button>)}
            </div>
          </div>}
          <div className="cloud-deck-actions">
            {deck.removed ? <button className="button button-primary" type="button" disabled={locked || deck.status !== "synced"}
              onClick={() => void perform(`restore-${deck.deckId}`, {kind: "restore", deckId: deck.deckId})}><CloudDownload aria-hidden="true" />
              {de ? "Auf dieses Geraet laden" : "Download to this device"}</button>
              : <>{deck.localAvailable ? <Link className="button button-quiet" href={`/app/decks/${deck.deckId}`}>{de ? "Oeffnen" : "Open"}</Link>
                : firstRevision && <button className="button button-primary" type="button" disabled={locked}
                  onClick={() => void perform(`open-${deck.deckId}`, {kind: "sync", explicit: true,
                    resolve: {deckId: deck.deckId, revisionId: firstRevision}}, () => {
                      if (cloudSyncView().decks.find(item => item.deckId === deck.deckId)?.status === "synced")
                        window.location.assign(`/app/decks/${deck.deckId}`);
                    })}><CloudDownload aria-hidden="true" />{de ? "Laden und oeffnen" : "Download and open"}</button>}
                <button className="button button-quiet" type="button" disabled={locked || deck.status !== "synced"}
                  onClick={() => { if (confirm(deck.title, removeWarning)) void perform(`remove-${deck.deckId}`,
                    {kind: "command", deckId: deck.deckId, command: "remove"}); }}>
                  <CloudDownload aria-hidden="true" />{de ? "Von diesem Geraet entfernen" : "Remove from this device"}</button></>}
            <button className="button button-danger" type="button" disabled={locked || deck.status === "error"}
              onClick={() => { if (confirm(deck.title, eraseWarning)) void perform(`delete-${deck.deckId}`,
                {kind: "command", deckId: deck.deckId, command: "deck"}); }}>
              <Trash2 aria-hidden="true" />{de ? "Aus iCloud und von allen Geraeten loeschen" : "Delete from iCloud and all devices"}</button>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
