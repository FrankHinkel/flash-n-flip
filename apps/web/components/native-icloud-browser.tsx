"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Cloud, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import {
  cloudSyncView,
  subscribeCloudSync,
} from "../lib/cloud-library-runtime";
import {
  configureNativeEngine,
  nativeEngineStatus,
  subscribeNativeEngine,
  runNativeEngineAction,
  resetLegacyNativeTestData,
} from "../lib/native-engine-runtime";
import { useI18n } from "./i18n-provider";
import styles from "./native-icloud-browser.module.css";

export function NativeICloudBrowser() {
  const { locale, text } = useI18n();
  const de = locale.startsWith("de");
  const sync = useSyncExternalStore(
    subscribeCloudSync,
    cloudSyncView,
    cloudSyncView,
  );
  const state = useSyncExternalStore(
    subscribeNativeEngine,
    nativeEngineStatus,
    nativeEngineStatus,
  );
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState("");
  const [problem, setProblem] = useState("");
  const [remove, setRemove] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [reset, setReset] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const dialogOpen = !!remove || reset;
  useEffect(() => {
    if (!dialogOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() =>
      dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus(),
    );
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        setRemove(null);
        setReset(false);
      }
      if (event.key !== "Tab") return;
      const buttons = [
        ...(dialogRef.current?.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        ) ?? []),
      ];
      const first = buttons[0],
        last = buttons.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keys);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keys);
      previous?.focus();
    };
  }, [dialogOpen]);
  const action = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setProblem("");
    setNotice("");
    try {
      await fn();
      setRemove(null);
      setReset(false);
    } catch (error) {
      if ((error as { code?: string })?.code === "FNF_SYNC_CANCELLED") return;
      const native = error as { errorMessage?: string; message?: string };
      setProblem(
        native?.errorMessage ||
          native?.message ||
          String(error) ||
          (de ? "Vorgang fehlgeschlagen." : "Operation failed."),
      );
      setRemove(null);
      setReset(false);
    } finally {
      setBusy(false);
    }
  };
  const deckById = new Map(sync.decks.map((deck) => [deck.deckId, deck]));
  const ordered: Array<(typeof sync.decks)[number] & { depth: number }> = [];
  const visit = (parent: string | null, depth: number) => {
    for (const deck of sync.decks
      .filter(
        (deck) =>
          (deck.parentDeckId && deckById.has(deck.parentDeckId)
            ? deck.parentDeckId
            : null) === parent,
      )
      .sort((a, b) => a.title.localeCompare(b.title))) {
      ordered.push({ ...deck, depth });
      if (expanded.has(deck.deckId)) visit(deck.deckId, depth + 1);
    }
  };
  visit(null, 0);
  return (
    <section className={styles.page} aria-labelledby="native-cloud-title">
      <h1 id="native-cloud-title">
        <Cloud aria-hidden="true" /> {de ? "Meine iCloud" : "My iCloud"}
      </h1>
      <p>{text("ui.icloudHint")}</p>
      <p role="status">
        {state.enabled
          ? de
            ? "Automatischer Abgleich aktiv"
            : "Automatic sync enabled"
          : de
            ? "iCloud-Abgleich pausiert"
            : "iCloud sync paused"}
      </p>
      <div className={styles.actions}>
        <button
          className="button"
          disabled={busy || state.resetting}
          onClick={() =>
            void action(() => configureNativeEngine(!state.enabled))
          }
        >
          {state.enabled
            ? de
              ? "Pausieren"
              : "Pause"
            : de
              ? "iCloud-Abgleich aktivieren"
              : "Enable iCloud sync"}
        </button>
        <button
          className="button button-quiet"
          disabled={busy || !state.enabled}
          onClick={() =>
            void action(() => runNativeEngineAction({ kind: "sync" }))
          }
        >
          {de ? "Jetzt abgleichen" : "Sync now"}
        </button>
      </div>
      {busy && <p role="status">{de ? "Vorgang läuft …" : "Working …"}</p>}
      {(problem || state.problem) && (
        <div role="alert">
          <p>{text("ui.cloudError")}</p>
          <details>
            <summary>{text("ui.details")}</summary>
            <p>{problem || state.problem}</p>
          </details>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      <ul className={styles.decks}>
        {ordered.map((deck) => (
          <li
            key={deck.deckId}
            style={{ paddingInlineStart: `${Math.min(deck.depth, 4)}rem` }}
          >
            {sync.decks.some((child) => child.parentDeckId === deck.deckId) && (
              <button
                className="button button-quiet"
                aria-expanded={expanded.has(deck.deckId)}
                aria-label={`${de ? "Unterdecks" : "Subdecks"}: ${deck.title}`}
                onClick={() =>
                  setExpanded((current) => {
                    const next = new Set(current);
                    if (next.has(deck.deckId)) next.delete(deck.deckId);
                    else next.add(deck.deckId);
                    return next;
                  })
                }
              >
                {expanded.has(deck.deckId) ? (
                  <ChevronDown aria-hidden="true" />
                ) : (
                  <ChevronRight aria-hidden="true" />
                )}
              </button>
            )}
            <span>
              <strong>{deck.title}</strong>
              <small>
                {deck.cardCount} {de ? "Karten" : "cards"} ·{" "}
                {deck.localAvailable
                  ? de
                    ? "Lokal verfügbar"
                    : "Available locally"
                  : "iCloud"}
              </small>
            </span>
            {!deck.localAvailable && (
              <button
                className="button button-quiet"
                disabled={busy}
                onClick={() =>
                  void action(() =>
                    runNativeEngineAction({
                      kind: "restore",
                      deckId: deck.deckId,
                    }),
                  )
                }
              >
                {de ? "Laden" : "Download"}
              </button>
            )}
            <button
              className="button button-quiet"
              disabled={busy}
              aria-label={`${de ? "Löschen" : "Delete"}: ${deck.title}`}
              onClick={() => setRemove({ id: deck.deckId, title: deck.title })}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {state.development && (
        <button
          className="button button-quiet"
          disabled={busy}
          onClick={() => setReset(true)}
        >
          {de
            ? "Testbestand vollständig zurücksetzen"
            : "Reset entire test library"}
        </button>
      )}
      {(remove || reset) && (
        <div className="reset-dialog-backdrop">
          <section
            ref={dialogRef}
            className="reset-dialog"
            role="alertdialog"
            aria-busy={busy}
            aria-modal="true"
            aria-labelledby="native-cloud-delete-title"
          >
            <h2 id="native-cloud-delete-title">
              {reset
                ? de
                  ? "Testbestand vollständig löschen?"
                  : "Delete entire test library?"
                : remove?.title}
            </h2>
            <p>
              {reset
                ? de
                  ? "Löscht den gesamten FNF-iCloud-Testbestand sowie die lokalen Decks, Medien und Lernstände auf diesem Gerät. Auch Sync-Cache und Warteschlangen werden geleert."
                  : "Deletes the entire FNF iCloud test library and this device’s local decks, media and progress. Also clears sync caches and queues."
                : de
                  ? "Nur die Kopie auf diesem Gerät oder das Deck mit Subdecks auf allen Geräten löschen?"
                  : "Delete this device’s copy, or the deck and its subdecks on every device?"}
            </p>
            <div className="reset-dialog-actions">
              <button
                className="button button-quiet"
                disabled={busy}
                autoFocus
                onClick={() => {
                  setRemove(null);
                  setReset(false);
                }}
              >
                {de ? "Abbrechen" : "Cancel"}
              </button>
              {reset ? (
                <button
                  className="button button-danger"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      const zones = await resetLegacyNativeTestData();
                      setNotice(
                        de
                          ? `Alter Testbestand gelöscht (${zones.length} Cloud-Bereiche).`
                          : `Old test library deleted (${zones.length} cloud zones).`,
                      );
                    })
                  }
                >
                  {de ? "Testbestand löschen" : "Delete test library"}
                </button>
              ) : (
                <>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() =>
                      void action(() =>
                        runNativeEngineAction({
                          kind: "command",
                          deckId: remove!.id,
                          command: "remove",
                        }),
                      )
                    }
                  >
                    {de
                      ? "Von diesem Gerät entfernen"
                      : "Remove from this device"}
                  </button>
                  <button
                    className="button button-danger"
                    disabled={busy}
                    onClick={() =>
                      void action(() =>
                        runNativeEngineAction({
                          kind: "command",
                          deckId: remove!.id,
                          command: "deck",
                        }),
                      )
                    }
                  >
                    {de ? "Überall löschen" : "Delete everywhere"}
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
