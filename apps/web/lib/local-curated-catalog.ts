import type {
  ConjugationTemplate,
  CoreLanguageTemplate,
  DeveloperReferenceLibraryTemplate,
  GeographyTemplate,
  IrregularVerbTemplate,
} from "@flashcards/api-client";
import {
  type CuratedCatalog,
  type CuratedCatalogCollection,
} from "@flashcards/domain/curated-catalog";
import {
  numberCollectionTemplate,
  numberCollectionTemplateKey,
} from "@flashcards/domain/number-collection";
import { verifyCuratedCatalog } from "@flashcards/sync/webstack-release";
import type { UiMessageKey } from "@flashcards/i18n";

import type { I18nText } from "../components/i18n-provider";

import {
  installLocalManagedDeckTree,
  LocalManagedDeckInstallLimitError,
  listLocalInstalledTemplateDecks,
  type LocalManagedDeckSeed,
} from "./local-product-repository";

export const localCuratedInstallError = (
  cause: unknown,
  text: I18nText,
  fallbackKey: UiMessageKey,
): string =>
  cause instanceof LocalManagedDeckInstallLimitError
    ? text("catalog.tooLarge")
    : text(fallbackKey);

let catalogPromise: Promise<CuratedCatalog> | null = null;

export const loadLocalCuratedCatalog = async (): Promise<CuratedCatalog> => {
  catalogPromise ??= Promise.all([
    fetch("/curated/catalog.v2.json", {
      cache: "no-cache",
      credentials: "omit",
    }),
    fetch("/curated/catalog.v2.signature.json", {
      cache: "no-cache",
      credentials: "omit",
    }),
    fetch("/trusted-webstack-keys.json", {
      cache: "no-cache",
      credentials: "omit",
    }),
  ]).then(async ([response, signatureResponse, keysResponse]) => {
    if (!response.ok || !signatureResponse.ok || !keysResponse.ok)
      throw new Error("Kuratierter Katalog ist nicht verfügbar.");
    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (declaredSize > 32 * 1024 * 1024) {
      throw new Error("Kuratierter Katalog ist unerwartet groß.");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 32 * 1024 * 1024) {
      throw new Error("Kuratierter Katalog ist unerwartet groß.");
    }
    return verifyCuratedCatalog({
      catalogBytes: bytes,
      signature: await signatureResponse.json(),
      trustedKeys: (await keysResponse.json()) as Record<string, string>,
      supportedGenerations: [2],
    });
  });
  return catalogPromise;
};

const cardCount = (collection: CuratedCatalogCollection) =>
  collection.decks.reduce((sum, deck) => sum + deck.cards.length, 0);

const collectionById = (catalog: CuratedCatalog, id: string) => {
  const collection = catalog.collections.find((item) => item.id === id);
  if (!collection) throw new Error(`Unbekannte kuratierte Collection: ${id}`);
  return collection;
};

const managedDecks = (collection: CuratedCatalogCollection) =>
  collection.decks as LocalManagedDeckSeed[];

export type LocalFnfHelpTemplate = {
  title: string;
  description: string;
  topicCount: number;
  cardCount: number;
  exampleCount: number;
  installedDeckId: string | null;
  referenceDecks: Array<{
    title: string;
    installedDeckId: string | null;
  }>;
};

export async function localCuratedTemplates() {
  const [catalog, installedDecks] = await Promise.all([
    loadLocalCuratedCatalog(),
    listLocalInstalledTemplateDecks(),
  ]);
  const installedByTemplate = new Map(
    installedDecks
      .filter((deck) => deck.sourceTemplateKey)
      .map((deck) => [deck.sourceTemplateKey!, deck.id]),
  );
  const conjugations = collectionById(catalog, "conjugations");
  const irregular = collectionById(catalog, "irregular-verbs");
  const core = collectionById(catalog, "core-languages");
  const developer = collectionById(catalog, "developer-reference-library");
  const fnfHelp = collectionById(catalog, "fnf-help-library");
  const fnfHelpReferenceDecks = fnfHelp.decks.filter(
    (deck) => deck.parentKey === fnfHelp.rootKey && deck.cards.length > 0,
  );
  const geography = collectionById(catalog, "geography");
  const geographyDeckByKey = new Map(
    geography.decks.map((deck) => [deck.key, deck]),
  );

  const languageTemplate = (
    collection: CuratedCatalogCollection,
  ): ConjugationTemplate => ({
    title: collection.title,
    description: collection.description,
    languageCount: collection.languages.length,
    verbCount: collection.stats.verbCount ?? 0,
    cardCount: cardCount(collection),
    deckCount: collection.decks.length,
    locales: collection.languages.map((language) => language.locale),
    languages: collection.languages.map((language) => ({
      locale: language.locale,
      code: language.code,
      title: language.title,
      verbCount: language.itemCount,
    })),
    installedDeckId: installedByTemplate.get(collection.rootKey) ?? null,
  });

  return {
    geography: catalog.geographyTemplates.map((template) => {
      const deck = geographyDeckByKey.get(template.deckKey)!;
      return {
        id: template.id,
        parentId: template.parentId,
        titles: template.titles,
        descriptions: template.descriptions,
        visual: deck.visual!,
        regionCount: Math.max(0, deck.cards.length - 1),
        installedDeckId: installedByTemplate.get(template.deckKey) ?? null,
      } as GeographyTemplate;
    }),
    conjugations: languageTemplate(conjugations),
    irregularVerbs: languageTemplate(irregular) as IrregularVerbTemplate,
    coreLanguages: {
      title: core.title,
      description: core.description,
      conceptCount: core.stats.conceptCount ?? 0,
      cardCount: cardCount(core),
      locales: ["en", "de", "fr", "es"],
      installedDeckId: installedByTemplate.get(core.rootKey) ?? null,
    } satisfies CoreLanguageTemplate,
    developerReference: {
      title: developer.title,
      description: developer.description,
      categoryCount: developer.stats.categoryCount ?? 0,
      technologyCount: developer.stats.technologyCount ?? 0,
      deckCount: developer.decks.length,
      cardCount: cardCount(developer),
      installedDeckId: installedByTemplate.get(developer.rootKey) ?? null,
      migrationAvailable: false,
    } satisfies DeveloperReferenceLibraryTemplate,
    fnfHelp: {
      title: fnfHelp.title,
      description: fnfHelp.description,
      topicCount: fnfHelp.stats.topicCount ?? 0,
      cardCount: cardCount(fnfHelp),
      exampleCount: fnfHelp.stats.exampleCount ?? 0,
      installedDeckId: installedByTemplate.get(fnfHelp.rootKey) ?? null,
      referenceDecks: fnfHelpReferenceDecks.map((deck) => ({
        title: deck.title.split(" · ")[0] ?? deck.title,
        installedDeckId: installedByTemplate.get(deck.key) ?? null,
      })),
    } satisfies LocalFnfHelpTemplate,
    numberTemplate: {
      ...numberCollectionTemplate,
      installedDeckId:
        installedByTemplate.get(numberCollectionTemplateKey) ?? null,
    },
  };
}

export async function installLocalCuratedCollection(id: string) {
  const catalog = await loadLocalCuratedCatalog();
  const collection = collectionById(catalog, id);
  // A catalog retraction prevents new installations but must not silently
  // delete an already installed deck or its personal learning state.
  // FNF Help is an entirely managed, non-study reference tree. Its update must
  // remove retired reference cards instead of leaving stale notices behind.
  const result = await installLocalManagedDeckTree(
    managedDecks(collection),
    id === "fnf-help-library"
      ? { exactScopePrefix: collection.rootKey }
      : undefined,
  );
  window.dispatchEvent(new CustomEvent("flash-n-flip:decks-changed"));
  return result;
}

export async function installLocalGeography(
  templateId: string,
  includeChildren: boolean,
) {
  const catalog = await loadLocalCuratedCatalog();
  const collection = collectionById(catalog, "geography");
  const templateById = new Map(
    catalog.geographyTemplates.map((template) => [template.id, template]),
  );
  if (!templateById.has(templateId)) {
    throw new Error("Unbekanntes Geografie-Lernset.");
  }
  const included = new Set<string>();
  let current: string | null = templateId;
  while (current) {
    included.add(current);
    current = templateById.get(current)?.parentId ?? null;
  }
  if (includeChildren) {
    const pending = [templateId];
    while (pending.length) {
      const parent = pending.shift()!;
      for (const template of catalog.geographyTemplates) {
        if (template.parentId !== parent || included.has(template.id)) continue;
        included.add(template.id);
        pending.push(template.id);
      }
    }
  }
  const keys = new Set(
    [...included].map((id) => templateById.get(id)!.deckKey),
  );
  const result = await installLocalManagedDeckTree(
    managedDecks(collection).filter((deck) => keys.has(deck.key)),
  );
  window.dispatchEvent(new CustomEvent("flash-n-flip:decks-changed"));
  return result;
}
