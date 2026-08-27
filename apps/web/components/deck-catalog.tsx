"use client";

import {
  Atom,
  ChartNoAxesCombined,
  ChevronRight,
  CircleCheck,
  Download,
  Hash,
  LibraryBig,
  RefreshCw,
  ShieldCheck,
  Shapes,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type {
  ConjugationTemplate,
  CoreLanguageTemplate,
  CuratedReleaseStatus,
  DeveloperReferenceLibraryTemplate,
  GeographyTemplate,
  IrregularVerbTemplate,
  NumberCollectionTemplate,
  PeriodicTableLearningTemplate,
  StatisticsIntroductionTemplate,
} from "@flashcards/api-client";
import type { UiMessageKey } from "@flashcards/i18n";

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
import type { I18nText } from "./i18n-provider";
import { referenceHrefForDeck } from "./study-navigation";

const localeKey = (locale: string): "en" | "de" | "es" | "fr" => {
  const language = locale.split("-")[0];
  return language === "de" || language === "es" || language === "fr"
    ? language
    : "en";
};

const CatalogRelease = ({
  release,
  locale,
  text,
}: {
  release: CuratedReleaseStatus;
  locale: string;
  text: I18nText;
}) => {
  const statusKey =
    release.status === "CURRENT"
      ? "catalog.release.upToDate"
      : release.status === "UNKNOWN"
        ? "catalog.release.versionUnknown"
        : release.status === "UPDATE_AVAILABLE"
          ? "catalog.release.updateAvailable"
          : null;
  const published = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
  }).format(new Date(release.publishedAt));
  return (
    <span
      className={`catalog-release catalog-release-${release.status.toLowerCase()}`}
      title={release.contentSha256}
    >
      <ShieldCheck size={14} aria-hidden="true" />
      <span>{text("catalog.release.signed", [published])}</span>
      <code>{release.contentSha256.slice(0, 8)}</code>
      {statusKey ? (
        <strong>
          {release.status === "CURRENT" ? (
            <CircleCheck size={14} aria-hidden="true" />
          ) : null}
          {text(statusKey)}
        </strong>
      ) : null}
    </span>
  );
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
  const [statisticsTemplate, setStatisticsTemplate] =
    useState<StatisticsIntroductionTemplate | null>(null);
  const [periodicTableTemplate, setPeriodicTableTemplate] =
    useState<PeriodicTableLearningTemplate | null>(null);
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
      setStatisticsTemplate(result.statisticsIntroduction);
      setPeriodicTableTemplate(result.periodicTableLearning);
      setDeveloperLibraryTemplate(result.developerReference);
      setFnfHelpTemplate(result.fnfHelp);
      setNumberTemplate(result.numberTemplate);
      setError("");
    } catch {
      setError(text("legacy.29628b1c940f"));
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const isInstalling = (id: string) => installing.has(id);

  async function queueInstall(
    id: string,
    operation: () => Promise<unknown>,
    errorKey: UiMessageKey,
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
        setError(localCuratedInstallError(cause, text, errorKey));
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
      "catalog.installGeographyFailed",
    );
  }

  async function installConjugationCollection() {
    await queueInstall(
      "conjugations",
      () => installLocalCuratedCollection("conjugations"),
      "catalog.installConjugationFailed",
    );
  }

  async function installIrregularVerbCollection() {
    await queueInstall(
      "irregular-verbs",
      () => installLocalCuratedCollection("irregular-verbs"),
      "catalog.installIrregularVerbsFailed",
    );
  }

  async function installCoreLanguageDeck() {
    await queueInstall(
      "core-languages",
      () => installLocalCuratedCollection("core-languages"),
      "catalog.installCoreLanguagesFailed",
    );
  }

  async function installStatisticsIntroduction() {
    await queueInstall(
      "statistics-introduction",
      () => installLocalCuratedCollection("statistics-introduction"),
      "catalog.installStatisticsFailed",
    );
  }

  async function installPeriodicTableLearning() {
    await queueInstall(
      "periodic-table-learning",
      () => installLocalCuratedCollection("periodic-table-learning"),
      "catalog.installPeriodicTableFailed",
    );
  }

  async function installDeveloperReferenceLibrary() {
    await queueInstall(
      "developer-reference-library",
      () => installLocalCuratedCollection("developer-reference-library"),
      "catalog.installDeveloperReferenceFailed",
    );
  }

  async function installFnfHelpLibrary() {
    await queueInstall(
      "fnf-help-library",
      () => installLocalCuratedCollection("fnf-help-library"),
      "catalog.installHelpFailed",
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
  const allCurrent =
    allInstalled &&
    templates.every((template) => template.status === "CURRENT");

  return (
    <section
      className="discover-collections"
      aria-labelledby="discover-collections-title"
    >
      <div className="result-heading">
        <div>
          <span className="eyebrow">{text("legacy.d4680deb5db0")}</span>
          <h1 id="discover-collections-title">{text("legacy.0fa8228d0a16")}</h1>
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
            <span className="eyebrow">{text("legacy.0ed278763380")}</span>
            <h2 id="number-generator-catalog-title">
              {text("legacy.9d9809fb87c7")}
            </h2>
            <p>{text("legacy.550a66454fb5")}</p>
          </div>
          <Link className="button button-primary" href="/community/numbers">
            {numberTemplate?.installedDeckId
              ? text("legacy.e2bd5bf49a6f")
              : text("legacy.bf5a3fd955c5")}
          </Link>
        </div>
      </section>

      {statisticsTemplate && (
        <section
          className="geography-catalog language-catalog"
          aria-labelledby="statistics-introduction-catalog-title"
        >
          <div className="geography-catalog-intro">
            <div className="language-catalog-mark" aria-hidden="true">
              <ChartNoAxesCombined size={34} strokeWidth={1.8} />
            </div>
            <div>
              <span className="eyebrow">
                {text("catalog.statistics.eyebrow")}
              </span>
              <h2 id="statistics-introduction-catalog-title">
                {statisticsTemplate.title}
              </h2>
              <p>
                {statisticsTemplate.description} ·{" "}
                {text("catalog.statistics.cards", [
                  statisticsTemplate.cardCount,
                ])}
              </p>
              <CatalogRelease
                release={statisticsTemplate}
                locale={locale}
                text={text}
              />
            </div>
            {statisticsTemplate.installedDeckId ? (
              <div className="language-catalog-actions">
                <Link
                  className="button button-quiet"
                  href={`/app/learn?deckId=${statisticsTemplate.installedDeckId}`}
                >
                  {text("catalog.statistics.open")}
                </Link>
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={
                    isInstalling("statistics-introduction") ||
                    statisticsTemplate.status === "CURRENT"
                  }
                  onClick={() => void installStatisticsIntroduction()}
                >
                  <RefreshCw
                    size={17}
                    aria-hidden="true"
                    className={
                      isInstalling("statistics-introduction")
                        ? "spin"
                        : undefined
                    }
                  />
                  {isInstalling("statistics-introduction")
                    ? text("catalog.statistics.installing")
                    : statisticsTemplate.status === "CURRENT"
                      ? text("catalog.release.upToDate")
                      : text("legacy.963c54856538")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button button-primary"
                disabled={isInstalling("statistics-introduction")}
                onClick={() => void installStatisticsIntroduction()}
              >
                <Download size={17} aria-hidden="true" />
                {isInstalling("statistics-introduction")
                  ? text("catalog.statistics.installing")
                  : text("catalog.statistics.install")}
              </button>
            )}
          </div>
        </section>
      )}

      {periodicTableTemplate && (
        <section
          className="geography-catalog language-catalog"
          aria-labelledby="periodic-table-catalog-title"
        >
          <div className="geography-catalog-intro">
            <div className="language-catalog-mark" aria-hidden="true">
              <Atom size={34} strokeWidth={1.8} />
            </div>
            <div>
              <span className="eyebrow">
                {text("catalog.periodicTable.eyebrow")}
              </span>
              <h2 id="periodic-table-catalog-title">
                {periodicTableTemplate.title}
              </h2>
              <p>
                {periodicTableTemplate.description} ·{" "}
                {text("catalog.periodicTable.cards", [
                  periodicTableTemplate.referenceCardCount,
                  periodicTableTemplate.learningCardCount,
                ])}
              </p>
              <CatalogRelease
                release={periodicTableTemplate}
                locale={locale}
                text={text}
              />
            </div>
            {periodicTableTemplate.installedDeckId ? (
              <div className="language-catalog-actions">
                <Link
                  className="button button-quiet"
                  href={`/app/learn?deckId=${periodicTableTemplate.installedDeckId}`}
                >
                  {text("catalog.periodicTable.open")}
                </Link>
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={
                    isInstalling("periodic-table-learning") ||
                    periodicTableTemplate.status === "CURRENT"
                  }
                  onClick={() => void installPeriodicTableLearning()}
                >
                  <RefreshCw
                    size={17}
                    aria-hidden="true"
                    className={
                      isInstalling("periodic-table-learning")
                        ? "spin"
                        : undefined
                    }
                  />
                  {isInstalling("periodic-table-learning")
                    ? text("catalog.periodicTable.installing")
                    : periodicTableTemplate.status === "CURRENT"
                      ? text("catalog.release.upToDate")
                      : text("legacy.963c54856538")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button button-primary"
                disabled={isInstalling("periodic-table-learning")}
                onClick={() => void installPeriodicTableLearning()}
              >
                <Download size={17} aria-hidden="true" />
                {isInstalling("periodic-table-learning")
                  ? text("catalog.periodicTable.installing")
                  : text("catalog.periodicTable.install")}
              </button>
            )}
          </div>
        </section>
      )}

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
              <span className="eyebrow">{text("legacy.79d5870cabb8")}</span>
              <h2 id="conjugation-catalog-title">
                {conjugationTemplate.title}
              </h2>
              <p>
                {conjugationTemplate.description} ·{" "}
                {conjugationTemplate.verbCount} {text("legacy.b429a9f9e4cb")} ·{" "}
                {conjugationTemplate.cardCount} {text("legacy.69551da67e93")} ·{" "}
                {conjugationTemplate.languages
                  .map((language) => language.code)
                  .join(" · ")}
              </p>
              <CatalogRelease
                release={conjugationTemplate}
                locale={locale}
                text={text}
              />
            </div>
            {conjugationTemplate.installedDeckId ? (
              <div className="language-catalog-actions">
                <Link
                  className="button button-quiet"
                  href={`/app/learn?deckId=${conjugationTemplate.installedDeckId}`}
                >
                  {text("legacy.44eb9ed33e47")}
                </Link>
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={
                    isInstalling("conjugations") ||
                    conjugationTemplate.status === "CURRENT"
                  }
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
                    ? text("legacy.b715aecd60dd")
                    : conjugationTemplate.status === "CURRENT"
                      ? text("catalog.release.upToDate")
                      : text("legacy.963c54856538")}
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
                  ? text("legacy.4b9c0cb20372")
                  : text("legacy.9baf7c41e329")}
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
              <span className="eyebrow">{text("legacy.79d5870cabb8")}</span>
              <h2 id="irregular-verb-catalog-title">
                {irregularVerbTemplate.title}
              </h2>
              <p>
                {irregularVerbTemplate.description} ·{" "}
                {irregularVerbTemplate.verbCount} {text("legacy.b429a9f9e4cb")}{" "}
                · {irregularVerbTemplate.cardCount}{" "}
                {text("legacy.69551da67e93")} ·{" "}
                {irregularVerbTemplate.languages
                  .map((language) => language.code)
                  .join(" · ")}
              </p>
              <CatalogRelease
                release={irregularVerbTemplate}
                locale={locale}
                text={text}
              />
            </div>
            {irregularVerbTemplate.installedDeckId ? (
              <div className="language-catalog-actions">
                <Link
                  className="button button-quiet"
                  href={`/app/learn?deckId=${irregularVerbTemplate.installedDeckId}`}
                >
                  {text("legacy.44eb9ed33e47")}
                </Link>
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={
                    isInstalling("irregular-verbs") ||
                    irregularVerbTemplate.status === "CURRENT"
                  }
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
                    ? text("legacy.b715aecd60dd")
                    : irregularVerbTemplate.status === "CURRENT"
                      ? text("catalog.release.upToDate")
                      : text("legacy.963c54856538")}
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
                  ? text("legacy.4b9c0cb20372")
                  : text("legacy.9baf7c41e329")}
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
              <span className="eyebrow">{text("legacy.79d5870cabb8")}</span>
              <h2 id="core-language-catalog-title">
                {coreLanguageTemplate.title}
              </h2>
              <p>
                {coreLanguageTemplate.description} ·{" "}
                {coreLanguageTemplate.conceptCount}{" "}
                {text("legacy.478af837d491")} ·{" "}
                {text("catalog.supportedLanguageCodes")}
              </p>
              <CatalogRelease
                release={coreLanguageTemplate}
                locale={locale}
                text={text}
              />
            </div>
            {coreLanguageTemplate.installedDeckId ? (
              <div className="language-catalog-actions">
                <Link
                  className="button button-quiet"
                  href={`/app/learn?deckId=${coreLanguageTemplate.installedDeckId}`}
                >
                  {text("legacy.44eb9ed33e47")}
                </Link>
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={
                    isInstalling("core-languages") ||
                    coreLanguageTemplate.status === "CURRENT"
                  }
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
                    ? text("legacy.b715aecd60dd")
                    : coreLanguageTemplate.status === "CURRENT"
                      ? text("catalog.release.upToDate")
                      : text("legacy.963c54856538")}
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
                  ? text("legacy.4b9c0cb20372")
                  : text("legacy.9baf7c41e329")}
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
              <span className="eyebrow">{text("legacy.28d829c64af9")}</span>
              <h2 id="developer-reference-library-catalog-title">
                {text("legacy.41457a371d05")}
              </h2>
              <p>
                {developerLibraryTemplate.description} ·{" "}
                {developerLibraryTemplate.categoryCount}{" "}
                {text("legacy.4701df20910b")} ·{" "}
                {developerLibraryTemplate.technologyCount}{" "}
                {text("legacy.9592bf3a847c")} ·{" "}
                {developerLibraryTemplate.cardCount}{" "}
                {text("legacy.1cec5d1f9906")}
              </p>
              <CatalogRelease
                release={developerLibraryTemplate}
                locale={locale}
                text={text}
              />
            </div>
            {developerLibraryTemplate.installedDeckId ? (
              <div className="language-catalog-actions">
                <Link
                  className="button button-quiet"
                  href={`/app/learn?deckId=${developerLibraryTemplate.installedDeckId}&practice=all`}
                  aria-label={text("legacy.60724b432b48")}
                >
                  {text("legacy.c8170041a849")}
                </Link>
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={
                    isInstalling("developer-reference-library") ||
                    developerLibraryTemplate.status === "CURRENT"
                  }
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
                    ? text("legacy.b715aecd60dd")
                    : developerLibraryTemplate.status === "CURRENT"
                      ? text("catalog.release.upToDate")
                      : text("legacy.6e5dffec1951")}
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
                    ? text("legacy.27e7a86c43e6")
                    : text("legacy.4b9c0cb20372")
                  : developerLibraryTemplate.migrationAvailable
                    ? text("legacy.6ed5c8a2c946")
                    : text("legacy.8e16b0f18f04")}
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
              <span className="eyebrow">{text("legacy.74f9d27eb1d3")}</span>
              <h2 id="fnf-help-library-catalog-title">
                {fnfHelpTemplate.title}
              </h2>
              <p>
                {fnfHelpTemplate.description} · {fnfHelpTemplate.topicCount}{" "}
                {text("legacy.692a52684c03")} · {fnfHelpTemplate.exampleCount}{" "}
                {text("legacy.2c08552848d6")} · {fnfHelpTemplate.cardCount}{" "}
                {text("legacy.c84292fd6409")}
              </p>
              <CatalogRelease
                release={fnfHelpTemplate}
                locale={locale}
                text={text}
              />
            </div>
            {fnfHelpTemplate.installedDeckId ? (
              <div className="language-catalog-actions">
                <Link
                  className="button button-quiet"
                  href={referenceHrefForDeck(fnfHelpTemplate.installedDeckId)}
                  aria-label={text("legacy.a5270722d924")}
                >
                  {text("legacy.c8170041a849")}
                </Link>
                <button
                  type="button"
                  className="button button-quiet"
                  disabled={
                    isInstalling("fnf-help-library") ||
                    fnfHelpTemplate.status === "CURRENT"
                  }
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
                    ? text("legacy.b715aecd60dd")
                    : fnfHelpTemplate.status === "CURRENT"
                      ? text("catalog.release.upToDate")
                      : text("legacy.6e5dffec1951")}
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
                  ? text("legacy.4b9c0cb20372")
                  : text("legacy.f5dec18da878")}
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
              <span className="eyebrow">{text("legacy.91d96d072269")}</span>
              <h2 id="world-catalog-title">{world.titles[language]}</h2>
              <p>{world.descriptions[language]}</p>
              <CatalogRelease release={world} locale={locale} text={text} />
            </div>
            <button
              type="button"
              className="button button-primary"
              disabled={allCurrent || isInstalling("world-all")}
              onClick={() => void install("world", true)}
            >
              <Download size={17} aria-hidden="true" />
              {isInstalling("world-all")
                ? text("legacy.33de3806a9fe")
                : allCurrent
                  ? text("catalog.release.upToDate")
                  : allInstalled
                    ? text("legacy.963c54856538")
                    : text("legacy.731b01c4afd9")}
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
                    {template.regionCount} {text("legacy.2190d3d74755")}
                  </small>
                  <CatalogRelease
                    release={template}
                    locale={locale}
                    text={text}
                  />
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
                  {template.installedDeckId && template.status !== "CURRENT" ? (
                    <button
                      type="button"
                      className="catalog-item-update"
                      disabled={isInstalling(template.id)}
                      onClick={() => void install(template.id, false)}
                    >
                      <RefreshCw
                        size={14}
                        aria-hidden="true"
                        className={
                          isInstalling(template.id) ? "spin" : undefined
                        }
                      />
                      {text("catalog.release.updateAvailable")}
                    </button>
                  ) : null}
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
                      {text("legacy.c940c2a4836c")} ({subregions.length})
                    </button>
                  ) : null}
                  {expanded ? (
                    <div className="catalog-submenu">
                      {subregions.map((subregion) =>
                        subregion.installedDeckId ? (
                          <div
                            className="catalog-subregion-entry"
                            key={subregion.id}
                          >
                            <Link
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
                                  {text("legacy.2190d3d74755")} ·{" "}
                                  {text("legacy.a468526ed5ef")}
                                </small>
                                <CatalogRelease
                                  release={subregion}
                                  locale={locale}
                                  text={text}
                                />
                              </span>
                            </Link>
                            {subregion.status !== "CURRENT" ? (
                              <button
                                type="button"
                                className="catalog-item-update"
                                disabled={isInstalling(subregion.id)}
                                onClick={() =>
                                  void install(subregion.id, false)
                                }
                              >
                                <RefreshCw size={14} aria-hidden="true" />
                                {text("catalog.release.updateAvailable")}
                              </button>
                            ) : null}
                          </div>
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
                                {text("legacy.2190d3d74755")}
                              </small>
                              <CatalogRelease
                                release={subregion}
                                locale={locale}
                                text={text}
                              />
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
