"use client";

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Code2,
  FlaskConical,
  Globe2,
  Languages,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  hasCardContent,
  resolveLocalizedCardContent,
} from "@flashcards/domain/content";
import type { CuratedCatalog } from "@flashcards/domain/curated-catalog";

import {
  installLocalCuratedCollection,
  installLocalGeography,
  loadLocalCuratedCatalog,
  localCuratedInstallError,
  localCuratedTemplates,
} from "../lib/local-curated-catalog";
import { ContentView } from "./content-view";
import { createSerialInstallQueue } from "./deck-catalog-install-queue";
import {
  buildDiscoverOffers,
  categoryMessage,
  descendantOffers,
  discoverCategories,
  discoverHref,
  discoverLanguageCodes,
  discoverSamples,
  filterDiscoverOffers,
  type CatalogTemplates,
  type DiscoverCategory,
  type DiscoverOffer,
} from "./discover-catalog-model";
import { useI18n } from "./i18n-provider";
import { resolveQuestionLocale } from "./study-content";
import { studyPlanSelectionHref } from "./study-plan-navigation";
import { referenceHrefForDeck, studyHrefForDeck } from "./study-navigation";

const categoryIcons = {
  languages: Languages,
  geography: Globe2,
  science: FlaskConical,
  programming: Code2,
};

function OfferPreview({
  offer,
  previewLocale,
}: {
  offer: DiscoverOffer;
  previewLocale: string;
}) {
  const { locale, text } = useI18n();
  const samples = useMemo(() => {
    const preferred =
      offer.category === "languages"
        ? offer.decks.filter((deck) =>
            deck.contentLocales.includes(previewLocale),
          )
        : offer.decks;
    return discoverSamples(
      preferred.some((deck) => deck.cards.length) ? preferred : offer.decks,
      offer.category === "help",
    );
  }, [offer.decks, offer.category, previewLocale]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState(false);
  const sample = samples[index];
  if (!sample) return null;
  const content = resolveLocalizedCardContent(
    sample.card,
    previewLocale,
    sample.deck.defaultContentLocale,
  );
  const questionLocale =
    offer.id === "core-languages"
      ? resolveQuestionLocale(
          "random",
          content.locale,
          sample.deck.contentLocales,
          0,
        )
      : content.locale;
  const question = resolveLocalizedCardContent(
    sample.card,
    questionLocale,
    sample.deck.defaultContentLocale,
  );
  const reference = Boolean(
    offer.reference ||
    sample.card.usage === "REFERENCE" ||
    sample.card.kind === "EXPLANATION",
  );
  const referenceContent = hasCardContent(content.back)
    ? content.back
    : content.front;
  return (
    <section
      className="discover-preview"
      aria-labelledby="discover-preview-title"
    >
      <h2 id="discover-preview-title">{text("discover.sample")}</h2>
      <p>{text("discover.sampleHint")}</p>
      <div className="discover-preview-position" aria-live="polite">
        {text("discover.samplePosition", [index + 1, samples.length])}
      </div>
      {questionLocale !== content.locale ? (
        <p className="discover-meta">
          {new Intl.DisplayNames([locale], { type: "language" }).of(
            questionLocale,
          )}{" "}
          →{" "}
          {new Intl.DisplayNames([locale], { type: "language" }).of(
            content.locale,
          )}
        </p>
      ) : null}
      <div
        className="discover-preview-content"
        tabIndex={0}
        role="region"
        aria-label={text("discover.samplePosition", [
          index + 1,
          samples.length,
        ])}
      >
        <ContentView
          content={
            reference
              ? referenceContent
              : answer
                ? content.back
                : question.front
          }
          locale={locale}
          answer={reference || answer}
        />
      </div>
      <div className="discover-preview-controls">
        <button
          type="button"
          className="button button-quiet"
          disabled={index === 0}
          aria-label={text("discover.previous")}
          onClick={() => {
            setIndex(index - 1);
            setAnswer(false);
          }}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        {!reference && hasCardContent(content.back) ? (
          <button
            type="button"
            className="button button-quiet discover-preview-answer"
            aria-pressed={answer}
            onClick={() => setAnswer(!answer)}
          >
            {text(answer ? "discover.hideAnswer" : "discover.showAnswer")}
          </button>
        ) : null}
        <button
          type="button"
          className="button button-quiet"
          disabled={index === samples.length - 1}
          aria-label={text("discover.next")}
          onClick={() => {
            setIndex(index + 1);
            setAnswer(false);
          }}
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

export function DeckCatalog({
  helpReferences = false,
}: {
  helpReferences?: boolean;
}) {
  const { locale, text } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const requestedCategory = params.get("category");
  const category = discoverCategories.includes(
    requestedCategory as DiscoverCategory,
  )
    ? (requestedCategory as DiscoverCategory)
    : null;
  const offerId = helpReferences ? "fnf-help-library" : params.get("offer");
  const urlQuery = params.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const language =
    category === "languages" &&
    discoverLanguageCodes.includes(params.get("language") ?? "")
      ? params.get("language")!
      : "";
  const [data, setData] = useState<{
    catalog: CuratedCatalog;
    templates: CatalogTemplates;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [installError, setInstallError] = useState("");
  const [notice, setNotice] = useState<{
    title: string;
    deckId: string;
    reference: boolean;
  } | null>(null);
  const [installed, setInstalled] = useState<Record<string, string>>({});
  const [installing, setInstalling] = useState<Set<string>>(() => new Set());
  const [includeChildren, setIncludeChildren] = useState(false);
  const pending = useRef(new Set<string>());
  const queue = useRef(createSerialInstallQueue());
  const active = useRef(false);
  const revision = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);

  const reload = useCallback(async () => {
    const request = ++revision.current;
    try {
      const [catalog, templates] = await Promise.all([
        loadLocalCuratedCatalog(),
        localCuratedTemplates(),
      ]);
      if (active.current && request === revision.current) {
        setData({ catalog, templates });
        setLoadFailed(false);
        setLoading(false);
      }
    } catch {
      if (active.current && request === revision.current) {
        setLoadFailed(true);
        setLoading(false);
      }
    }
  }, []);
  useEffect(() => {
    active.current = true;
    void reload();
    return () => {
      active.current = false;
      revision.current += 1;
    };
  }, [reload]);
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);
  useEffect(() => {
    setIncludeChildren(false);
    setInstallError("");
    setNotice(null);
    heading.current?.focus({ preventScroll: true });
  }, [category, offerId, helpReferences]);

  const offers = useMemo(
    () =>
      data
        ? buildDiscoverOffers(data.catalog, data.templates, locale, text)
        : [],
    [data, locale, text],
  );
  const offer = offers.find(
    (item) =>
      item.id === offerId &&
      (helpReferences ? item.category === "help" : item.category !== "help"),
  );
  const results = filterDiscoverOffers(offers, { category, query, language });
  const descendants = offer?.geographyId
    ? descendantOffers(offers, offer.id)
    : [];
  const scopeDecks = offer
    ? [
        ...offer.decks,
        ...(includeChildren ? descendants.flatMap((child) => child.decks) : []),
      ]
    : [];
  const cardCount = (decks: DiscoverOffer["decks"]) =>
    decks.reduce((count, deck) => count + deck.cards.length, 0);
  const languageNames = (locales: readonly string[]) => {
    const names = new Intl.DisplayNames([locale], { type: "language" });
    return locales.map((item) => names.of(item) ?? item).join(", ");
  };
  const href = (
    next: {
      category?: DiscoverCategory | null;
      offer?: string | null;
      language?: string;
      query?: string;
    } = {},
  ) =>
    discoverHref({ category, query, language, ...next, help: helpReferences });
  const openHref = (item: DiscoverOffer, deckId: string) =>
    item.reference ? referenceHrefForDeck(deckId) : studyHrefForDeck(deckId);
  const installedId = offer
    ? (installed[offer.id] ?? offer.installedDeckId)
    : null;
  const current =
    offer && (Boolean(installed[offer.id]) || offer.status === "CURRENT");
  const childrenNeedInstall =
    includeChildren &&
    descendants.some(
      (child) => !child.installedDeckId || child.status !== "CURRENT",
    );

  async function install(item: DiscoverOffer) {
    if (pending.current.has(item.id)) return;
    const withChildren = includeChildren;
    pending.current.add(item.id);
    setInstalling(new Set(pending.current));
    setInstallError("");
    setNotice(null);
    await queue.current.enqueue(async () => {
      try {
        const result = item.geographyId
          ? await installLocalGeography(item.geographyId, withChildren)
          : await installLocalCuratedCollection(item.id);
        const deckId = result.idsByKey.get(item.rootKey);
        if (active.current) {
          if (deckId) {
            setInstalled((previous) => ({ ...previous, [item.id]: deckId }));
            setNotice({
              title: item.title,
              deckId,
              reference: Boolean(item.reference),
            });
          }
          await reload();
        }
      } catch (cause) {
        if (active.current)
          setInstallError(
            localCuratedInstallError(cause, text, "discover.installError"),
          );
      } finally {
        pending.current.delete(item.id);
        if (active.current) setInstalling(new Set(pending.current));
      }
    });
  }

  const renderOffer = (item: DiscoverOffer) => (
    <li key={item.id} className="discover-offer">
      <div className="discover-offer-copy">
        <h2>{item.title}</h2>
        <p>{item.description}</p>
        <p className="discover-meta">
          {item.generator
            ? text("discover.generatorHint")
            : `${languageNames(item.locales)} · ${text("discover.cards", [cardCount(item.decks)])}`}
        </p>
        {item.installedDeckId || installed[item.id] ? (
          <span className="discover-installed">
            {text("discover.installed")}
            {item.status === "UPDATE_AVAILABLE"
              ? ` · ${text("catalog.release.updateAvailable")}`
              : ""}
          </span>
        ) : null}
      </div>
      <Link
        className="button button-quiet"
        href={
          item.generator
            ? `/community/numbers${language ? `?language=${encodeURIComponent(language)}` : ""}`
            : href({ offer: item.id })
        }
        aria-label={`${text(item.generator ? "discover.configure" : "discover.view")}: ${item.title}`}
      >
        {text(item.generator ? "discover.configure" : "discover.view")}
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </li>
  );

  return (
    <section
      className="discover-collections discover-catalog"
      aria-labelledby="discover-collections-title"
    >
      <header className="discover-heading">
        {offerId || category || helpReferences ? (
          <Link
            className="discover-back"
            href={
              helpReferences
                ? "/app/help"
                : offerId
                  ? href({ offer: null })
                  : discoverHref()
            }
          >
            <ArrowLeft size={19} aria-hidden="true" />
            {helpReferences
              ? text("discover.helpBack")
              : offerId && category
                ? text(categoryMessage(category))
                : text(
                    offerId && query.trim()
                      ? "discover.backResults"
                      : "discover.allCategories",
                  )}
          </Link>
        ) : null}
        <h1 id="discover-collections-title" tabIndex={-1} ref={heading}>
          {offer?.title ??
            (category
              ? text(categoryMessage(category))
              : text(
                  helpReferences
                    ? "discover.offer.fnf-help-library"
                    : "discover.title",
                ))}
        </h1>
        <p>
          {offer?.description ??
            (category
              ? text(`discover.hint.${category}`)
              : text("discover.intro"))}
        </p>
      </header>

      {loadFailed ? (
        <div className="discover-feedback form-error" role="alert">
          <p>{text("discover.loadError")}</p>
          <button
            type="button"
            className="button button-quiet"
            onClick={() => {
              setLoading(true);
              void reload();
            }}
            disabled={loading}
          >
            {text("discover.retry")}
          </button>
        </div>
      ) : null}
      {installError ? (
        <p className="discover-feedback form-error" role="alert">
          {installError}
        </p>
      ) : null}
      {notice ? (
        <div className="discover-feedback discover-success" role="status">
          <p>{text("discover.added", [notice.title])}</p>
          <Link className="button button-quiet" href="/app/decks">
            {text("ui.myDecks")}
          </Link>
          {!notice.reference ? (
            <Link
              className="button button-quiet"
              href={studyPlanSelectionHref("/app/decks")}
            >
              {text("ui.addToPlan")}
            </Link>
          ) : null}
        </div>
      ) : null}
      {loading && !data ? (
        <p role="status">{text("discover.loading")}</p>
      ) : null}

      {offer ? (
        <div className="discover-detail" key={offer.id}>
          {offer.generator ? (
            <section className="discover-detail-summary">
              <p>{text("discover.generatorHint")}</p>
              <Link
                className="button button-primary"
                href={`/community/numbers${language ? `?language=${encodeURIComponent(language)}` : ""}`}
              >
                {text("discover.configure")}
              </Link>
              {installedId ? (
                <Link
                  className="button button-quiet"
                  href={openHref(offer, installedId)}
                >
                  {text("discover.open")}
                </Link>
              ) : null}
            </section>
          ) : (
            <>
              <section
                className="discover-detail-summary"
                aria-labelledby="discover-scope-title"
              >
                <h2 id="discover-scope-title">{text("discover.scope")}</h2>
                <p className="discover-meta">
                  {text("discover.cards", [cardCount(scopeDecks)])} ·{" "}
                  {text(
                    scopeDecks.length === 1
                      ? "discover.deck"
                      : "discover.decks",
                    [scopeDecks.length],
                  )}
                </p>
                <p>
                  {text("discover.availableLanguages", [
                    languageNames(offer.locales),
                  ])}
                </p>
                {offer.reference ? (
                  <p>{text("discover.referenceHint")}</p>
                ) : null}
                {offer.geographyId && offer.parentId ? (
                  <p>{text("discover.parentHint")}</p>
                ) : null}
                {descendants.length ? (
                  <label className="discover-include">
                    <input
                      type="checkbox"
                      checked={includeChildren}
                      disabled={installing.has(offer.id)}
                      onChange={(event) =>
                        setIncludeChildren(event.target.checked)
                      }
                    />
                    {text("discover.includeChildren", [descendants.length])}
                  </label>
                ) : null}
                <div className="discover-detail-actions">
                  {installedId ? (
                    <Link
                      className="button button-primary"
                      href={openHref(offer, installedId)}
                    >
                      {text("discover.open")}
                    </Link>
                  ) : null}
                  {!installedId || !current || childrenNeedInstall ? (
                    <button
                      type="button"
                      className={`button ${installedId ? "button-quiet" : "button-primary"}`}
                      disabled={installing.has(offer.id)}
                      onClick={() => void install(offer)}
                    >
                      {text(
                        installing.has(offer.id)
                          ? "discover.updating"
                          : installedId && !childrenNeedInstall
                            ? "discover.update"
                            : "discover.add",
                      )}
                    </button>
                  ) : null}
                </div>
              </section>
              <OfferPreview
                key={`${offer.id}:${language || locale}`}
                offer={offer}
                previewLocale={language || locale}
              />
              {offer.geographyId ? (
                offers.some((item) => item.parentId === offer.id) ? (
                  <section className="discover-regions">
                    <h2>{text("discover.subregions")}</h2>
                    <ul className="discover-offers">
                      {offers
                        .filter((item) => item.parentId === offer.id)
                        .map(renderOffer)}
                    </ul>
                  </section>
                ) : null
              ) : offer.decks.length > 1 ? (
                <details className="discover-included-decks">
                  <summary>
                    {text("discover.scope")} ·{" "}
                    {text("discover.decks", [offer.decks.length])}
                  </summary>
                  <ul>
                    {offer.decks
                      .filter((deck) => deck.parentKey === offer.rootKey)
                      .map((deck) => (
                        <li key={deck.key}>{deck.title}</li>
                      ))}
                  </ul>
                </details>
              ) : null}
            </>
          )}
        </div>
      ) : offerId && data ? (
        <p className="discover-feedback" role="status">
          {text("discover.notFound")}
        </p>
      ) : !helpReferences ? (
        <>
          <div className="discover-search" role="search">
            <label htmlFor="discover-search">
              {text(category ? "discover.searchCategory" : "discover.search")}
            </label>
            <div className="discover-search-control">
              <Search size={20} aria-hidden="true" />
              <input
                id="discover-search"
                type="search"
                autoComplete="off"
                value={query}
                placeholder={text("discover.searchHint")}
                onChange={(event) => {
                  setQuery(event.target.value);
                  router.replace(
                    discoverHref({
                      category,
                      query: event.target.value,
                      language,
                    }),
                  );
                }}
              />
            </div>
          </div>
          {category === "languages" ? (
            <div className="discover-language">
              <label htmlFor="discover-language">
                {text("discover.language")}
              </label>
              <select
                id="discover-language"
                value={language}
                onChange={(event) => {
                  router.replace(href({ language: event.target.value }));
                }}
              >
                <option value="">{text("discover.allLanguages")}</option>
                {discoverLanguageCodes.map((value) => (
                  <option key={value} value={value}>
                    {languageNames([value])}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {!category && !query.trim() ? (
            <nav
              className="discover-categories"
              aria-label={text("discover.categories")}
            >
              {discoverCategories.map((id) => {
                const Icon = categoryIcons[id];
                return (
                  <Link
                    href={discoverHref({ category: id })}
                    key={id}
                    className="discover-category"
                  >
                    <Icon size={28} aria-hidden="true" />
                    <span>
                      <strong>{text(categoryMessage(id))}</strong>
                      <span>{text(`discover.hint.${id}`)}</span>
                    </span>
                    <ChevronRight size={20} aria-hidden="true" />
                  </Link>
                );
              })}
            </nav>
          ) : data ? (
            <>
              <p className="discover-result-count" role="status">
                {text("discover.results", [results.length])}
              </p>
              {results.length ? (
                <ul className="discover-offers">{results.map(renderOffer)}</ul>
              ) : (
                <p>{text("discover.noResults")}</p>
              )}
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
