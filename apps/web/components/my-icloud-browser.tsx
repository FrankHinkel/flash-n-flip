"use client";

import { CloudCog, RefreshCw, SquareMinus, SquarePlus } from "lucide-react";
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  listLocalProductDeckMetadata,
  type LocalDeckSummary,
} from "../lib/local-product-repository";
import {
  buildMyICloudDeckTree,
  flattenVisibleMyICloudDeckTree,
} from "../lib/my-icloud-deck-tree";
import styles from "./community-browser.module.css";
import { useI18n } from "./i18n-provider";

const copy = {
  de: {
    title: "Meine iCloud",
    description:
      "Hier wird deine lokale Deck-Hierarchie fuer die kuenftige iCloud-Verwaltung abgebildet.",
    stage:
      "Sichere Vorbereitungsstufe: Diese Ansicht liest nur lokale Daten und startet weder Apple-Anmeldung noch Cloud-Anfragen.",
    loading: "Lokale Deck-Hierarchie wird geladen ...",
    empty: "Keine lokalen Decks vorhanden.",
    error:
      "Die lokale Deck-Hierarchie konnte nicht geladen werden. Es wurden keine Cloud-Daten veraendert.",
    localOnly: "Nur lokal",
    cards: (count: number) => `${count} ${count === 1 ? "Karte" : "Karten"}`,
    expand: (title: string) => `Unterdecks von ${title} anzeigen`,
    collapse: (title: string) => `Unterdecks von ${title} ausblenden`,
    withheld: (count: number) =>
      `${count} ${count === 1 ? "Eintrag wurde" : "Eintraege wurden"} wegen einer unvollstaendigen oder zyklischen Hierarchie nicht auf die oberste Ebene verschoben.`,
  },
  en: {
    title: "My iCloud",
    description:
      "Your local deck hierarchy is shown here in preparation for iCloud management.",
    stage:
      "Safe preparation stage: this view reads local data only and starts neither Apple sign-in nor cloud requests.",
    loading: "Loading the local deck hierarchy ...",
    empty: "No local decks available.",
    error:
      "The local deck hierarchy could not be loaded. No cloud data was changed.",
    localOnly: "Local only",
    cards: (count: number) => `${count} ${count === 1 ? "card" : "cards"}`,
    expand: (title: string) => `Show subdecks of ${title}`,
    collapse: (title: string) => `Hide subdecks of ${title}`,
    withheld: (count: number) =>
      `${count} ${count === 1 ? "entry was" : "entries were"} not promoted to the top level because the hierarchy is incomplete or cyclic.`,
  },
  fr: {
    title: "Mon iCloud",
    description:
      "La hierarchie locale de vos paquets est affichee ici en preparation de la gestion iCloud.",
    stage:
      "Etape de preparation sure : cette vue lit uniquement les donnees locales et ne lance ni connexion Apple ni requete cloud.",
    loading: "Chargement de la hierarchie locale des paquets ...",
    empty: "Aucun paquet local disponible.",
    error:
      "La hierarchie locale des paquets n'a pas pu etre chargee. Aucune donnee cloud n'a ete modifiee.",
    localOnly: "Local uniquement",
    cards: (count: number) => `${count} ${count === 1 ? "carte" : "cartes"}`,
    expand: (title: string) => `Afficher les sous-paquets de ${title}`,
    collapse: (title: string) => `Masquer les sous-paquets de ${title}`,
    withheld: (count: number) =>
      `${count} ${count === 1 ? "entree n'a" : "entrees n'ont"} pas ete placee au niveau superieur car la hierarchie est incomplete ou cyclique.`,
  },
  es: {
    title: "Mi iCloud",
    description:
      "La jerarquia local de tus mazos se muestra aqui como preparacion para la gestion de iCloud.",
    stage:
      "Fase de preparacion segura: esta vista solo lee datos locales y no inicia sesion con Apple ni realiza solicitudes a la nube.",
    loading: "Cargando la jerarquia local de mazos ...",
    empty: "No hay mazos locales disponibles.",
    error:
      "No se pudo cargar la jerarquia local de mazos. No se modificaron datos en la nube.",
    localOnly: "Solo local",
    cards: (count: number) => `${count} ${count === 1 ? "tarjeta" : "tarjetas"}`,
    expand: (title: string) => `Mostrar submazos de ${title}`,
    collapse: (title: string) => `Ocultar submazos de ${title}`,
    withheld: (count: number) =>
      `${count} ${count === 1 ? "entrada no se coloco" : "entradas no se colocaron"} en el nivel superior porque la jerarquia esta incompleta o es ciclica.`,
  },
};

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
  const [decks, setDecks] = useState<LocalDeckSummary[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void listLocalProductDeckMetadata()
      .then((localDecks) => {
        if (!active) return;
        setDecks(localDecks);
        setExpanded(new Set());
        setError(false);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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

  return (
    <div aria-busy={loading || undefined}>
      <header className={styles.icloudHeader}>
        <h1>{labels.title}</h1>
        <p>{labels.description}</p>
      </header>

      <p className={styles.stageNotice}>
        <CloudCog aria-hidden="true" />
        <span>{labels.stage}</span>
      </p>

      {loading ? (
        <p className={styles.stateMessage}>{labels.loading}</p>
      ) : error ? (
        <p className={`${styles.stateMessage} ${styles.errorMessage}`} role="alert">
          {labels.error}
        </p>
      ) : rows.length === 0 ? (
        <p className={styles.stateMessage}>{labels.empty}</p>
      ) : (
        <ul className={styles.tree} aria-label={labels.title}>
          {rows.map(({ deck, depth, hasChildren }) => {
            const isExpanded = expanded.has(deck.id);
            const indent = `${Math.min(depth, 8) * 18}px`;
            return (
              <li key={deck.id}>
                <div
                  className={styles.treeRow}
                  style={{ "--icloud-tree-indent": indent } as CSSProperties}
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
                    <span className={styles.treeSpacer} aria-hidden="true" />
                  )}

                  <span className={styles.deckMain}>
                    <span className={styles.deckTitle}>{deck.title}</span>
                    <span className={styles.deckMeta}>
                      {labels.cards(deck.cardCount)}
                    </span>
                  </span>

                  <span
                    className={styles.localStatus}
                    title={`${deck.title}: ${labels.localOnly}`}
                    aria-label={`${deck.title}: ${labels.localOnly}`}
                  >
                    <RefreshCw aria-hidden="true" />
                    <span className={styles.statusText}>{labels.localOnly}</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !error && tree.withheldCount > 0 ? (
        <p className={styles.hierarchyWarning} role="status">
          {labels.withheld(tree.withheldCount)}
        </p>
      ) : null}
    </div>
  );
}
