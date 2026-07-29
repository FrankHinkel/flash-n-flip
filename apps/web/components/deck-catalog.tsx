"use client";

import { ChevronRight, Download, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  CoreLanguageTemplate,
  GeographyTemplate,
  GermanVerbTemplate,
} from "@flashcards/api-client";

import { api } from "../lib/api";
import { DeckVisual } from "./deck-visual";
import { useI18n } from "./i18n-provider";

const localeKey = (locale: string): "en" | "de" | "es" | "fr" => {
  const language = locale.split("-")[0];
  return language === "de" || language === "es" || language === "fr"
    ? language
    : "en";
};

export function DeckCatalog() {
  const { locale, text } = useI18n();
  const [templates, setTemplates] = useState<GeographyTemplate[]>([]);
  const [germanTemplate, setGermanTemplate] =
    useState<GermanVerbTemplate | null>(null);
  const [coreLanguageTemplate, setCoreLanguageTemplate] =
    useState<CoreLanguageTemplate | null>(null);
  const [expandedContinents, setExpandedContinents] = useState<Set<string>>(
    new Set(["europe"]),
  );
  const [installing, setInstalling] = useState("");
  const [error, setError] = useState("");

  async function reload() {
    const [templateResult, germanResult, coreLanguageResult] =
      await Promise.allSettled([
        api.geographyTemplates(),
        api.germanVerbTemplate(),
        api.coreLanguageTemplate(),
      ]);
    if (templateResult.status === "fulfilled") {
      setTemplates(templateResult.value);
      setError("");
    } else {
      setError(
        text(
          "The collection catalog could not be loaded.",
          "Der Sammlungskatalog konnte nicht geladen werden.",
        ),
      );
    }
    if (germanResult.status === "fulfilled") {
      setGermanTemplate(germanResult.value);
    }
    if (coreLanguageResult.status === "fulfilled") {
      setCoreLanguageTemplate(coreLanguageResult.value);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function install(
    templateId: GeographyTemplate["id"],
    includeChildren: boolean,
  ) {
    setInstalling(includeChildren ? "world-all" : templateId);
    setError("");
    try {
      await api.installGeographyDeck(templateId, includeChildren);
      await reload();
    } catch {
      setError(
        text(
          "The geography deck could not be downloaded.",
          "Das Geografie-Lernset konnte nicht heruntergeladen werden.",
        ),
      );
    } finally {
      setInstalling("");
    }
  }

  async function installGermanDeck() {
    setInstalling("german-verbs");
    setError("");
    try {
      await api.installGermanVerbDeck();
      await reload();
    } catch {
      setError(
        text(
          "The German practice collection could not be installed.",
          "Die deutsche Übungssammlung konnte nicht installiert werden.",
        ),
      );
    } finally {
      setInstalling("");
    }
  }

  async function installCoreLanguageDeck() {
    setInstalling("core-languages");
    setError("");
    try {
      await api.installCoreLanguageDeck();
      await reload();
    } catch {
      setError(
        text(
          "The Core Languages collection could not be installed.",
          "Die Core-Languages-Sammlung konnte nicht installiert werden.",
        ),
      );
    } finally {
      setInstalling("");
    }
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
          <h2 id="discover-collections-title">
            {text("Ready to discover", "Bereit zum Entdecken")}
          </h2>
        </div>
      </div>

      {germanTemplate && (
        <section
          className="geography-catalog language-catalog"
          aria-labelledby="german-verb-catalog-title"
        >
          <div className="geography-catalog-intro">
            <div className="language-catalog-mark" aria-hidden="true">
              DE
            </div>
            <div>
              <span className="eyebrow">
                {text("Language collection", "Sprachsammlung")}
              </span>
              <h2 id="german-verb-catalog-title">{germanTemplate.title}</h2>
              <p>
                {germanTemplate.description} · {germanTemplate.verbCount}{" "}
                {text("verbs", "Verben")} · {germanTemplate.cardCount}{" "}
                {text("cards", "Karten")}
              </p>
            </div>
            {germanTemplate.installedDeckId ? (
              <div className="language-catalog-actions">
                <Link
                  className="button button-quiet"
                  href={`/app/learn?deckId=${germanTemplate.installedDeckId}`}
                >
                  {text("Study collection", "Sammlung lernen")}
                </Link>
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={Boolean(installing)}
                  onClick={() => void installGermanDeck()}
                >
                  <RefreshCw
                    size={17}
                    aria-hidden="true"
                    className={
                      installing === "german-verbs" ? "spin" : undefined
                    }
                  />
                  {installing === "german-verbs"
                    ? text("Updating …", "Wird aktualisiert …")
                    : text("Update collection", "Sammlung aktualisieren")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button button-primary"
                disabled={Boolean(installing)}
                onClick={() => void installGermanDeck()}
              >
                <Download size={17} aria-hidden="true" />
                {installing === "german-verbs"
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
                  disabled={Boolean(installing)}
                  onClick={() => void installCoreLanguageDeck()}
                >
                  <RefreshCw
                    size={17}
                    aria-hidden="true"
                    className={
                      installing === "core-languages" ? "spin" : undefined
                    }
                  />
                  {installing === "core-languages"
                    ? text("Updating …", "Wird aktualisiert …")
                    : text("Update collection", "Sammlung aktualisieren")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button button-primary"
                disabled={Boolean(installing)}
                onClick={() => void installCoreLanguageDeck()}
              >
                <Download size={17} aria-hidden="true" />
                {installing === "core-languages"
                  ? text("Installing …", "Wird installiert …")
                  : text("Install collection", "Sammlung installieren")}
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
              disabled={allInstalled || Boolean(installing)}
              onClick={() => void install("world", true)}
            >
              <Download size={17} aria-hidden="true" />
              {allInstalled
                ? text(
                    "Complete collection installed",
                    "Komplette Sammlung installiert",
                  )
                : installing === "world-all"
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
                      disabled={Boolean(installing)}
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
                            disabled={Boolean(installing)}
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
