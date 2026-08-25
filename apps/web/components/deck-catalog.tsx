"use client";

import {
  ChevronRight,
  Download,
  Hash,
  LibraryBig,
  RefreshCw,
  Shapes,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  ConjugationTemplate,
  CoreLanguageTemplate,
  DeveloperReferenceLibraryTemplate,
  GeographyTemplate,
  IrregularVerbTemplate,
  NumberCollectionTemplate,
} from "@flashcards/api-client";

import {
  installLocalCuratedCollection,
  installLocalGeography,
  type LocalFnfHelpTemplate,
  localCuratedInstallError,
  localCuratedTemplates,
} from "../lib/local-curated-catalog";
import { createSerialInstallQueue } from "./deck-catalog-install-queue";
import { createInitialExpandedContinents } from "./deck-catalog-state";
import { DeckVisual } from "./deck-visual";
import { useI18n } from "./i18n-provider";
import { referenceHrefForDeck } from "./study-navigation";

const localeKey = (locale: string): "en" | "de" | "es" | "fr" => {
  const language = locale.split("-")[0];
  return language === "de" || language === "es" || language === "fr"
    ? language
    : "en";
};

export function DeckCatalog() {
  const { locale, text } = useI18n();
  const [templates, setTemplates] = useState<GeographyTemplate[]>([]);
  const [conjugationTemplate, setConjugationTemplate] =
    useState<ConjugationTemplate | null>(null);
  const [irregularVerbTemplate, setIrregularVerbTemplate] =
    useState<IrregularVerbTemplate | null>(null);
  const [coreLanguageTemplate, setCoreLanguageTemplate] =
    useState<CoreLanguageTemplate | null>(null);
  const [developerLibraryTemplate, setDeveloperLibraryTemplate] =
    useState<DeveloperReferenceLibraryTemplate | null>(null);
  const [fnfHelpTemplate, setFnfHelpTemplate] =
    useState<LocalFnfHelpTemplate | null>(null);
  const [numberTemplate, setNumberTemplate] =
    useState<NumberCollectionTemplate | null>(null);
  const [expandedContinents, setExpandedContinents] = useState<Set<string>>(
    createInitialExpandedContinents,
  );
  const [installing, setInstalling] = useState<Set<string>>(() => new Set());
  const pendingInstallIds = useRef(new Set<string>());
  const installQueue = useRef(createSerialInstallQueue());
  const [error, setError] = useState("");

  async function reload() {
    try {
      const result = await localCuratedTemplates();
      setTemplates(result.geography);
      setConjugationTemplate(result.conjugations);
      setIrregularVerbTemplate(result.irregularVerbs);
      setCoreLanguageTemplate(result.coreLanguages);
      setDeveloperLibraryTemplate(result.developerReference);
      setFnfHelpTemplate(result.fnfHelp);
      setNumberTemplate(result.numberTemplate);
      setError("");
    } catch {
      setError(
        text(
          "The collection catalog could not be loaded.",
          "Der Sammlungskatalog konnte nicht geladen werden.",
        ),
      );
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const isInstalling = (id: string) => installing.has(id);

  async function queueInstall(
    id: string,
    operation: () => Promise<unknown>,
    englishError: string,
    germanError: string,
  ) {
    if (pendingInstallIds.current.has(id)) return;
    pendingInstallIds.current.add(id);
    setInstalling(new Set(pendingInstallIds.current));
    setError("");
    await installQueue.current.enqueue(async () => {
      try {
        await operation();
        await reload();
      } catch (cause) {
        setError(
          localCuratedInstallError(cause, text, englishError, germanError),
        );
      } finally {
        pendingInstallIds.current.delete(id);
        setInstalling(new Set(pendingInstallIds.current));
      }
    });
  }

  async function install(
    templateId: GeographyTemplate["id"],
    includeChildren: boolean,
  ) {
    await queueInstall(
      includeChildren ? "world-all" : templateId,
      () => installLocalGeography(templateId, includeChildren),
      "The geography deck could not be downloaded.",
      "Das Geografie-Lernset konnte nicht heruntergeladen werden.",
    );
  }

  async function installConjugationCollection() {
    await queueInstall(
      "conjugations",
      () => installLocalCuratedCollection("conjugations"),
      "The conjugation collection could not be installed.",
      "Die Konjugationssammlung konnte nicht installiert werden.",
    );
  }

  async function installIrregularVerbCollection() {
    await queueInstall(
      "irregular-verbs",
      () => installLocalCuratedCollection("irregular-verbs"),
      "The irregular-verbs collection could not be installed.",
      "Die Irregular-Verbs-Sammlung konnte nicht installiert werden.",
    );
  }

  async function installCoreLanguageDeck() {
    await queueInstall(
      "core-languages",
      () => installLocalCuratedCollection("core-languages"),
      "The Core Languages collection could not be installed.",
      "Die Core-Languages-Sammlung konnte nicht installiert werden.",
    );
  }

  async function installDeveloperReferenceLibrary() {
    await queueInstall(
      "developer-reference-library",
      () => installLocalCuratedCollection("developer-reference-library"),
      "The Developer Reference Library could not be installed.",
      "Die Developer Reference Library konnte nicht installiert werden.",
    );
  }

  async function installFnfHelpLibrary() {
    await queueInstall(
      "fnf-help-library",
      () => installLocalCuratedCollection("fnf-help-library"),
      "The Flash-n-Flip Help library could not be installed.",
      "Die Flash-n-Flip-Help-Bibliothek konnte nicht installiert werden.",
    );
  }

  const world = templates.find((template) => template.id === "world");
  const continents = templates.filter(
    (template) => template.parentId === "world",
  );
  const subregionsByContinent = useMemo(
    () =>
      new Map(
        continents.map((continent) => [
          continent.id,
          templates.filter((template) => template.parentId === continent.id),
        ]),
      ),
    [continents, templates],
  );
  const language = localeKey(locale);
  const allInstalled =
    templates.length > 0 &&
    templates.every((template) => template.installedDeckId);

  return (
    <section
      className="discover-collections"
      aria-labelledby="discover-collections-title"
    >
      <div className="result-heading">
        <div>
          <span className="eyebrow">
            {text("Curated collections", "Kuratierte Sammlungen")}
          </span>
          <h1 id="discover-collections-title">
            {text("Ready to discover", "Bereit zum Entdecken")}
          </h1>
        </div>
      </div>

      <section
        className="geography-catalog language-catalog"
        aria-labelledby="number-generator-catalog-title"
      >
        <div className="geography-catalog-intro">
          <div
            className="language-catalog-mark language-catalog-mark-multi"
            aria-hidden="true"
          >
            <Hash size={34} strokeWidth={1.8} />
          </div>
          <div>
            <span className="eyebrow">
              {text("Virtual collection", "Virtuelle Collection")}
            </span>
            <h2 id="number-generator-catalog-title">
              {text("Numbers across languages", "Zahlen in vielen Sprachen")}
            </h2>
            <p>
              {text(
                "Practice selectable number spaces from 1 to 1,000,000 locally and combine the available main languages freely.",
                "Übe wählbare Zahlenräume von 1 bis 1.000.000 lokal und kombiniere die verfügbaren Hauptsprachen frei.",
              )}
            </p>
          </div>
          <Link className="button button-primary" href="/community/numbers">
            {numberTemplate?.installedDeckId
              ? text("Manage collection", "Collection verwalten")
              : text("Configure & install", "Konfigurieren & installieren")}
          </Link>
        </div>
      </section>

      {conjugationTemplate && (
        <section
          className="geography-catalog language-catalog"
          aria-labelledby="conjugation-catalog-title"
        >
          <div className="geography-catalog-intro">
            <div
              className="language-catalog-mark language-catalog-mark-multi"
              aria-hidden="true"
            >
              4×
            </div>
            <div>
              <span className="eyebrow">
                {text("Language collection", "Sprachsammlung")}
              </span>
              <h2 id="conjugation-catalog-title">
                {conjugationTemplate.title}
              </h2>
              <p>
                {conjugationTemplate.description} ·{" "}
                {conjugationTemplate.verbCount} {text("verbs", "Verben")} ·{" "}
                {conjugationTemplate.cardCount} {text("cards", "Karten")} ·{" "}
                {conjugationTemplate.languages
                  .map((language) => language.code)
                  .join(" · ")}
              </p>
            </div>
            {conjugationTemplate.installedDeckId ? (
              <div className="language-catalog-actions">
                <Link
                  className="button button-quiet"
                  href={`/app/learn?deckId=${conjugationTemplate.installedDeckId}`}
                >
                  {text("Study collection", "Sammlung lernen")}
                </Link>
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={isInstalling("conjugations")}
                  onClick={() => void installConjugationCollection()}
                >
                  <RefreshCw
                    size={17}
                    aria-hidden="true"
                    className={
                      isInstalling("conjugations") ? "spin" : undefined
                    }
                  />
                  {isInstalling("conjugations")
                    ? text("Updating …", "Wird aktualisiert …")
                    : text("Update collection", "Sammlung aktualisieren")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button button-primary"
                disabled={isInstalling("conjugations")}
                onClick={() => void installConjugationCollection()}
              >
                <Download size={17} aria-hidden="true" />
                {isInstalling("conjugations")
                  ? text("Installing …", "Wird installiert …")
                  : text("Install collection", "Sammlung installieren")}
              </button>
            )}
          </div>
        </section>
      )}

      {irregularVerbTemplate && (
        <section
          className="geography-catalog language-catalog"
          aria-labelledby="irregular-verb-catalog-title"
        >
          <div className="geography-catalog-intro">
            <div
              className="language-catalog-mark language-catalog-mark-multi"
              aria-hidden="true"
            >
              4×
            </div>
            <div>
              <span className="eyebrow">
                {text("Language collection", "Sprachsammlung")}
              </span>
              <h2 id="irregular-verb-catalog-title">
                {irregularVerbTemplate.title}
              </h2>
              <p>
                {irregularVerbTemplate.description} ·{" "}
                {irregularVerbTemplate.verbCount} {text("verbs", "Verben")} ·{" "}
                {irregularVerbTemplate.cardCount} {text("cards", "Karten")} ·{" "}
                {irregularVerbTemplate.languages
                  .map((language) => language.code)
                  .join(" · ")}
              </p>
            </div>
            {irregularVerbTemplate.installedDeckId ? (
              <div className="language-catalog-actions">
                <Link
                  className="button button-quiet"
                  href={`/app/learn?deckId=${irregularVerbTemplate.installedDeckId}`}
                >
                  {text("Study collection", "Sammlung lernen")}
                </Link>
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={isInstalling("irregular-verbs")}
                  onClick={() => void installIrregularVerbCollection()}
                >
                  <RefreshCw
                    size={17}
                    aria-hidden="true"
                    className={
                      isInstalling("irregular-verbs") ? "spin" : undefined
                    }
                  />
                  {isInstalling("irregular-verbs")
                    ? text("Updating …", "Wird aktualisiert …")
                    : text("Update collection", "Sammlung aktualisieren")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button button-primary"
                disabled={isInstalling("irregular-verbs")}
                onClick={() => void installIrregularVerbCollection()}
              >
                <Download size={17} aria-hidden="true" />
                {isInstalling("irregular-verbs")
                  ? text("Installing …", "Wird installiert …")
                  : text("Install collection", "Sammlung installieren")}
              </button>
            )}
          </div>
        </section>
      )}

      {coreLanguageTemplate && (
        <section
          className="geography-catalog language-catalog"
          aria-labelledby="core-language-catalog-title"
        >
          <div className="geography-catalog-intro">
            <div
              className="language-catalog-mark language-catalog-mark-multi"
              aria-hidden="true"
            >
              4×
            </div>
            <div>
              <span className="eyebrow">
                {text("Language collection", "Sprachsammlung")}
              </span>
              <h2 id="core-language-catalog-title">
                {coreLanguageTemplate.title}
              </h2>
              <p>
                {coreLanguageTemplate.description} ·{" "}
                {coreLanguageTemplate.conceptCount}{" "}
                {text("concepts", "Begriffe und Sätze")} · EN · DE · FR · ES
              </p>
            </div>
            {coreLanguageTemplate.installedDeckId ? (
              <div className="language-catalog-actions">
                <Link
                  className="button button-quiet"
                  href={`/app/learn?deckId=${coreLanguageTemplate.installedDeckId}`}
                >
                  {text("Study collection", "Sammlung lernen")}
                </Link>
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={isInstalling("core-languages")}
                  onClick={() => void installCoreLanguageDeck()}
                >
                  <RefreshCw
                    size={17}
                    aria-hidden="true"
                    className={
                      isInstalling("core-languages") ? "spin" : undefined
                    }
                  />
                  {isInstalling("core-languages")
                    ? text("Updating …", "Wird aktualisiert …")
                    : text("Update collection", "Sammlung aktualisieren")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button button-primary"
                disabled={isInstalling("core-languages")}
                onClick={() => void installCoreLanguageDeck()}
              >
                <Download size={17} aria-hidden="true" />
                {isInstalling("core-languages")
                  ? text("Installing …", "Wird installiert …")
                  : text("Install collection", "Sammlung installieren")}
              </button>
            )}
          </div>
        </section>
      )}

      {developerLibraryTemplate && (
        <section
          className="geography-catalog language-catalog"
          aria-labelledby="developer-reference-library-catalog-title"
        >
          <div className="geography-catalog-intro">
            <div className="language-catalog-mark" aria-hidden="true">
              <LibraryBig size={34} strokeWidth={1.8} />
            </div>
            <div>
              <span className="eyebrow">
                {text("Developer library", "Entwickler-Bibliothek")}
              </span>
              <h2 id="developer-reference-library-catalog-title">
                {text("Developer Reference", "Entwickler-Referenz")}
              </h2>
              <p>
                {developerLibraryTemplate.description} ·{" "}
                {developerLibraryTemplate.categoryCount}{" "}
                {text("categories", "Kategorien")} ·{" "}
                {developerLibraryTemplate.technologyCount}{" "}
                {text("technologies", "Technologien")} ·{" "}
                {developerLibraryTemplate.cardCount}{" "}
                {text("reference cards", "Referenzkarten")}
              </p>
            </div>
            {developerLibraryTemplate.installedDeckId ? (
              <div className="language-catalog-actions">
                <Link
                  className="button button-quiet"
                  href={`/app/learn?deckId=${developerLibraryTemplate.installedDeckId}&practice=all`}
                  aria-label={text(
                    "Open Developer Reference",
                    "Entwickler-Referenz öffnen",
                  )}
                >
                  {text("Open reference", "Referenz öffnen")}
                </Link>
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={isInstalling("developer-reference-library")}
                  onClick={() => void installDeveloperReferenceLibrary()}
                >
                  <RefreshCw
                    size={17}
                    aria-hidden="true"
                    className={
                      isInstalling("developer-reference-library")
                        ? "spin"
                        : undefined
                    }
                  />
                  {isInstalling("developer-reference-library")
                    ? text("Updating …", "Wird aktualisiert …")
                    : text("Update reference", "Referenz aktualisieren")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button button-primary"
                disabled={isInstalling("developer-reference-library")}
                onClick={() => void installDeveloperReferenceLibrary()}
              >
                <Download size={17} aria-hidden="true" />
                {isInstalling("developer-reference-library")
                  ? developerLibraryTemplate.migrationAvailable
                    ? text("Merging …", "Wird zusammengeführt …")
                    : text("Installing …", "Wird installiert …")
                  : developerLibraryTemplate.migrationAvailable
                    ? text("Merge library", "Bibliothek zusammenführen")
                    : text("Install library", "Bibliothek installieren")}
              </button>
            )}
          </div>
        </section>
      )}

      {fnfHelpTemplate && (
        <section
          className="geography-catalog language-catalog"
          aria-labelledby="fnf-help-library-catalog-title"
        >
          <div className="geography-catalog-intro">
            <div className="language-catalog-mark" aria-hidden="true">
              <Shapes size={34} strokeWidth={1.8} />
            </div>
            <div>
              <span className="eyebrow">
                {text("Flash-n-Flip reference", "Flash-n-Flip-Referenz")}
              </span>
              <h2 id="fnf-help-library-catalog-title">
                {fnfHelpTemplate.title}
              </h2>
              <p>
                {fnfHelpTemplate.description} · {fnfHelpTemplate.topicCount}{" "}
                {text("topic decks", "Themen-Decks")} ·{" "}
                {fnfHelpTemplate.exampleCount} {text("examples", "Beispiele")} ·{" "}
                {fnfHelpTemplate.cardCount}{" "}
                {text("reference pages", "Referenzseiten")}
              </p>
            </div>
            {fnfHelpTemplate.installedDeckId ? (
              <div className="language-catalog-actions">
                <Link
                  className="button button-quiet"
                  href={referenceHrefForDeck(fnfHelpTemplate.installedDeckId)}
                  aria-label={text(
                    "Open Flash-n-Flip Help reference",
                    "Flash-n-Flip-Help-Referenz öffnen",
                  )}
                >
                  {text("Open reference", "Referenz öffnen")}
                </Link>
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={isInstalling("fnf-help-library")}
                  onClick={() => void installFnfHelpLibrary()}
                >
                  <RefreshCw
                    size={17}
                    aria-hidden="true"
                    className={
                      isInstalling("fnf-help-library") ? "spin" : undefined
                    }
                  />
                  {isInstalling("fnf-help-library")
                    ? text("Updating …", "Wird aktualisiert …")
                    : text("Update reference", "Referenz aktualisieren")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button button-primary"
                disabled={isInstalling("fnf-help-library")}
                onClick={() => void installFnfHelpLibrary()}
              >
                <Download size={17} aria-hidden="true" />
                {isInstalling("fnf-help-library")
                  ? text("Installing …", "Wird installiert …")
                  : text("Install reference", "Referenz installieren")}
              </button>
            )}
          </div>
        </section>
      )}

      {world && (
        <section
          className="geography-catalog"
          aria-labelledby="world-catalog-title"
        >
          <div className="geography-catalog-intro">
            <DeckVisual visual={world.visual} title={world.titles[language]} />
            <div>
              <span className="eyebrow">
                {text("Geography collection", "Geografie-Sammlung")}
              </span>
              <h2 id="world-catalog-title">{world.titles[language]}</h2>
              <p>{world.descriptions[language]}</p>
            </div>
            <button
              type="button"
              className="button button-primary"
              disabled={allInstalled || isInstalling("world-all")}
              onClick={() => void install("world", true)}
            >
              <Download size={17} aria-hidden="true" />
              {allInstalled
                ? text(
                    "Complete collection installed",
                    "Komplette Sammlung installiert",
                  )
                : isInstalling("world-all")
                  ? text("Downloading …", "Wird heruntergeladen …")
                  : text("Download all", "Alles herunterladen")}
            </button>
          </div>
          <div className="continent-downloads">
            {continents.map((template) => {
              const subregions = subregionsByContinent.get(template.id) ?? [];
              const expanded = expandedContinents.has(template.id);
              const templateContent = (
                <>
                  <DeckVisual
                    visual={template.visual}
                    title={template.titles[language]}
                  />
                  <strong>{template.titles[language]}</strong>
                  <small>
                    {template.installedDeckId ? null : (
                      <Download size={14} aria-hidden="true" />
                    )}{" "}
                    {template.regionCount} {text("regions", "Regionen")}
                  </small>
                </>
              );
              return (
                <div className="continent-download-group" key={template.id}>
                  {template.installedDeckId ? (
                    <Link
                      href={`/app/learn?deckId=${template.installedDeckId}`}
                      className="continent-download installed"
                    >
                      {templateContent}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="continent-download"
                      disabled={isInstalling(template.id)}
                      onClick={() => void install(template.id, false)}
                    >
                      {templateContent}
                    </button>
                  )}
                  {subregions.length ? (
                    <button
                      type="button"
                      className="catalog-submenu-toggle"
                      aria-expanded={expanded}
                      onClick={() =>
                        setExpandedContinents((current) => {
                          const next = new Set(current);
                          if (next.has(template.id)) next.delete(template.id);
                          else next.add(template.id);
                          return next;
                        })
                      }
                    >
                      <ChevronRight aria-hidden="true" />
                      {text("Country subdecks", "Länder-Unterdecks")} (
                      {subregions.length})
                    </button>
                  ) : null}
                  {expanded ? (
                    <div className="catalog-submenu">
                      {subregions.map((subregion) =>
                        subregion.installedDeckId ? (
                          <Link
                            key={subregion.id}
                            href={`/app/learn?deckId=${subregion.installedDeckId}`}
                            className="subregion-download installed"
                          >
                            <DeckVisual
                              visual={subregion.visual}
                              title={subregion.titles[language]}
                            />
                            <span>
                              <strong>{subregion.titles[language]}</strong>
                              <small>
                                {subregion.regionCount}{" "}
                                {text("regions", "Regionen")} ·{" "}
                                {text("Study", "Lernen")}
                              </small>
                            </span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            key={subregion.id}
                            className="subregion-download"
                            disabled={isInstalling(subregion.id)}
                            onClick={() => void install(subregion.id, false)}
                          >
                            <DeckVisual
                              visual={subregion.visual}
                              title={subregion.titles[language]}
                            />
                            <span>
                              <strong>{subregion.titles[language]}</strong>
                              <small>
                                <Download size={13} aria-hidden="true" />{" "}
                                {subregion.regionCount}{" "}
                                {text("regions", "Regionen")}
                              </small>
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
