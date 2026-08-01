import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import type { DeckSummary, GeographyTemplate } from "@flashcards/api-client";
import {
  deckDescendantIds,
  deckProgressPercent,
  formatByteSize,
  visibleDeckIds as visibleHierarchyDeckIds,
} from "@flashcards/domain";

import {
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Layers,
  Plus,
  Search,
  Star,
  Trash2,
} from "@/components/icons";
import { DeckVisual } from "@/components/deck-visual";
import { LoadError } from "@/components/load-error";
import { Screen } from "@/components/screen";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { removeCachedDueDecks, replaceDueCards } from "@/lib/offline";
import { createThemedStyles, useTheme } from "@/lib/theme";

const localeKey = (locale: string): "en" | "de" | "es" | "fr" => {
  const language = locale.split("-")[0];
  return language === "de" || language === "es" || language === "fr"
    ? language
    : "en";
};

const loadDeckLibrary = () =>
  Promise.allSettled([api.listDecks(true), api.geographyTemplates()]);

export default function DecksScreen() {
  const { locale, text } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [templates, setTemplates] = useState<GeographyTemplate[]>([]);
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [expandedCatalogContinents, setExpandedCatalogContinents] = useState<
    Set<string>
  >(new Set(["europe"]));
  const [installing, setInstalling] = useState("");
  const [templateError, setTemplateError] = useState("");
  const [libraryError, setLibraryError] = useState("");
  const libraryLoadError = text(
    "The deck library could not be loaded.",
    "Die Lernset-Bibliothek konnte nicht geladen werden.",
  );
  const catalogLoadError = text(
    "The geography catalog could not be loaded.",
    "Der Geografie-Katalog konnte nicht geladen werden.",
  );
  const applyLoadedLibrary = useCallback(
    ([deckResult, templateResult]: Awaited<
      ReturnType<typeof loadDeckLibrary>
    >) => {
      if (deckResult.status === "fulfilled") {
        setDecks(deckResult.value);
        setLibraryError("");
      } else {
        setLibraryError(libraryLoadError);
      }
      if (templateResult.status === "fulfilled") {
        setTemplates(templateResult.value);
        setTemplateError("");
      } else {
        setTemplateError(catalogLoadError);
      }
    },
    [catalogLoadError, libraryLoadError],
  );
  const reload = useCallback(async () => {
    const results = await loadDeckLibrary();
    applyLoadedLibrary(results);
    if (results[0].status === "rejected") throw results[0].reason;
  }, [applyLoadedLibrary]);

  useEffect(() => {
    let active = true;
    void loadDeckLibrary()
      .then((results) => {
        if (active) applyLoadedLibrary(results);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [applyLoadedLibrary]);

  const visibleDecks = useMemo(() => {
    const hierarchyIds = showHidden ? null : visibleHierarchyDeckIds(decks);
    const displayed = decks.filter(
      (deck) => showHidden || hierarchyIds?.has(deck.id),
    );
    const normalized = query.trim().toLowerCase();
    const byId = new Map(displayed.map((deck) => [deck.id, deck]));
    const children = new Map<string | null, DeckSummary[]>();
    const known = new Set(byId.keys());
    for (const deck of displayed) {
      const parent =
        deck.parentDeckId && known.has(deck.parentDeckId)
          ? deck.parentDeckId
          : null;
      children.set(parent, [...(children.get(parent) ?? []), deck]);
    }
    const direct = new Set(
      displayed
        .filter(
          (deck) =>
            (!favoritesOnly || deck.favorite) &&
            (!normalized ||
              `${deck.title} ${deck.description} ${deck.tags.join(" ")}`
                .toLowerCase()
                .includes(normalized)),
        )
        .map((deck) => deck.id),
    );
    if (normalized || favoritesOnly) {
      for (const id of [...direct]) {
        let parentId = byId.get(id)?.parentDeckId ?? null;
        while (parentId) {
          direct.add(parentId);
          parentId = byId.get(parentId)?.parentDeckId ?? null;
        }
      }
    } else {
      displayed.forEach((deck) => direct.add(deck.id));
    }
    const rows: { deck: DeckSummary; depth: number }[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const deck of (children.get(parentId) ?? []).sort((left, right) =>
        left.title.localeCompare(right.title),
      )) {
        if (!direct.has(deck.id)) continue;
        rows.push({ deck, depth });
        walk(deck.id, depth + 1);
      }
    };
    walk(null, 0);
    return rows;
  }, [decks, favoritesOnly, query, showHidden]);

  async function install(
    templateId: GeographyTemplate["id"],
    includeChildren: boolean,
  ) {
    setInstalling(includeChildren ? "world-all" : templateId);
    setTemplateError("");
    try {
      await api.installGeographyDeck(templateId, includeChildren);
      await reload();
    } catch {
      setTemplateError(
        text(
          "The geography deck could not be downloaded.",
          "Das Geografie-Lernset konnte nicht heruntergeladen werden.",
        ),
      );
    } finally {
      setInstalling("");
    }
  }

  async function toggleFavorite(deck: DeckSummary) {
    const favorite = !deck.favorite;
    setDecks((current) =>
      current.map((item) =>
        item.id === deck.id ? { ...item, favorite } : item,
      ),
    );
    try {
      await api.setDeckFavorite(deck.id, favorite);
    } catch {
      setDecks((current) =>
        current.map((item) =>
          item.id === deck.id ? { ...item, favorite: deck.favorite } : item,
        ),
      );
    }
  }

  async function toggleHidden(deck: DeckSummary) {
    try {
      const hidden = !deck.hiddenAt;
      const result = await api.setDeckHidden(deck.id, hidden);
      setDecks((current) =>
        current.map((item) =>
          item.id === deck.id ? { ...item, hiddenAt: result.hiddenAt } : item,
        ),
      );
      if (hidden) {
        try {
          await removeCachedDueDecks(deckDescendantIds(decks, deck.id));
        } catch {
          await replaceDueCards([]).catch(() => {});
        }
      }
    } catch {
      Alert.alert(
        text("Visibility failed", "Sichtbarkeit fehlgeschlagen"),
        text(
          "The deck visibility could not be changed.",
          "Die Sichtbarkeit des Lernsets konnte nicht geändert werden.",
        ),
      );
    }
  }

  function confirmDelete(deck: DeckSummary) {
    Alert.alert(
      text(`Delete “${deck.title}”?`, `„${deck.title}“ löschen?`),
      text(
        "The deck or collection and all subdecks will be removed from your library.",
        "Das Lernset oder die Sammlung und alle Unterdecks werden aus deiner Bibliothek entfernt.",
      ),
      [
        { text: text("Cancel", "Abbrechen"), style: "cancel" },
        {
          text: text("Delete", "Löschen"),
          style: "destructive",
          onPress: () => {
            const deletedIds = deckDescendantIds(decks, deck.id);
            void api
              .deleteDeck(deck.id)
              .then(() => {
                setDecks((current) =>
                  current.filter((item) => !deletedIds.has(item.id)),
                );
                setTemplates((current) =>
                  current.map((template) =>
                    template.installedDeckId &&
                    deletedIds.has(template.installedDeckId)
                      ? { ...template, installedDeckId: null }
                      : template,
                  ),
                );
                void reload().catch(() => {});
              })
              .catch(() =>
                Alert.alert(
                  text("Delete failed", "Löschen fehlgeschlagen"),
                  text(
                    "The deck could not be deleted.",
                    "Das Lernset konnte nicht gelöscht werden.",
                  ),
                ),
              );
          },
        },
      ],
    );
  }

  const language = localeKey(locale);
  const world = templates.find((template) => template.id === "world");
  const continents = templates.filter(
    (template) => template.parentId === "world",
  );
  const subregionsByContinent = new Map(
    continents.map((continent) => [
      continent.id,
      templates.filter((template) => template.parentId === continent.id),
    ]),
  );
  const allInstalled =
    templates.length > 0 &&
    templates.every((template) => template.installedDeckId);

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{text("LIBRARY", "BIBLIOTHEK")}</Text>
          <Text style={styles.title}>{text("My decks", "Meine Lernsets")}</Text>
          <Text style={styles.sub}>
            {text(
              "Deck trees and favorites keep large libraries focused.",
              "Deck-Bäume und Favoriten halten große Bibliotheken übersichtlich.",
            )}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={text("New deck", "Neues Lernset")}
          onPress={() => router.push("/create")}
          style={styles.add}
        >
          <Plus size={21} color="#fff" />
        </Pressable>
      </View>

      {world ? (
        <View style={styles.catalog}>
          <View style={styles.catalogTitle}>
            <DeckVisual visual={world.visual} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.deckTitle}>{world.titles[language]}</Text>
              <Text style={styles.deckDesc}>
                {world.descriptions[language]}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={allInstalled || Boolean(installing)}
            onPress={() => void install("world", true)}
            style={styles.downloadAll}
          >
            <Download size={17} color={colors.ink} />
            <Text style={styles.templateText}>
              {allInstalled
                ? text("Complete collection installed", "Sammlung installiert")
                : installing === "world-all"
                  ? text("Downloading …", "Wird geladen …")
                  : text(
                      "Download complete collection",
                      "Komplette Sammlung laden",
                    )}
            </Text>
          </Pressable>
          <View style={styles.continents}>
            {continents.map((template) => {
              const subregions = subregionsByContinent.get(template.id) ?? [];
              const subregionsExpanded = expandedCatalogContinents.has(
                template.id,
              );
              return (
                <View key={template.id} style={styles.continentGroup}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={Boolean(installing)}
                    onPress={() =>
                      template.installedDeckId
                        ? router.push({
                            pathname: "/deck/[id]",
                            params: { id: template.installedDeckId },
                          })
                        : void install(template.id, false)
                    }
                    style={[
                      styles.continent,
                      template.installedDeckId && styles.continentInstalled,
                    ]}
                  >
                    <DeckVisual visual={template.visual} size={36} />
                    <View style={styles.templateCopy}>
                      <Text style={styles.continentTitle}>
                        {template.titles[language]}
                      </Text>
                      <Text style={styles.deckDesc}>
                        {template.regionCount} {text("regions", "Regionen")} ·{" "}
                        {template.installedDeckId
                          ? text("Open", "Öffnen")
                          : text("Download", "Laden")}
                      </Text>
                    </View>
                  </Pressable>
                  {subregions.length ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: subregionsExpanded }}
                      onPress={() =>
                        setExpandedCatalogContinents((current) => {
                          const next = new Set(current);
                          if (next.has(template.id)) next.delete(template.id);
                          else next.add(template.id);
                          return next;
                        })
                      }
                      style={styles.submenuToggle}
                    >
                      <View
                        style={{
                          transform: [
                            { rotate: subregionsExpanded ? "90deg" : "0deg" },
                          ],
                        }}
                      >
                        <ChevronRight size={16} color={colors.muted} />
                      </View>
                      <Text style={styles.submenuText}>
                        {text("Country subdecks", "Länder-Unterdecks")} (
                        {subregions.length})
                      </Text>
                    </Pressable>
                  ) : null}
                  {subregionsExpanded
                    ? subregions.map((subregion) => (
                        <Pressable
                          key={subregion.id}
                          accessibilityRole="button"
                          disabled={Boolean(installing)}
                          onPress={() =>
                            subregion.installedDeckId
                              ? router.push({
                                  pathname: "/deck/[id]",
                                  params: { id: subregion.installedDeckId },
                                })
                              : void install(subregion.id, false)
                          }
                          style={[
                            styles.subregion,
                            subregion.installedDeckId &&
                              styles.continentInstalled,
                          ]}
                        >
                          <Text style={styles.branch}>↳</Text>
                          <DeckVisual visual={subregion.visual} size={32} />
                          <View style={styles.templateCopy}>
                            <Text style={styles.continentTitle}>
                              {subregion.titles[language]}
                            </Text>
                            <Text style={styles.deckDesc}>
                              {subregion.regionCount}{" "}
                              {text("regions", "Regionen")} ·{" "}
                              {subregion.installedDeckId
                                ? text("Open", "Öffnen")
                                : text("Download", "Laden")}
                            </Text>
                          </View>
                        </Pressable>
                      ))
                    : null}
                </View>
              );
            })}
          </View>
          {templateError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {templateError}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.filterRow}>
        <View style={styles.search}>
          <Search size={18} color={colors.muted} />
          <TextInput
            accessibilityLabel={text("Search decks", "Lernsets suchen")}
            style={styles.searchInput}
            placeholder={text("Search …", "Suchen …")}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: favoritesOnly }}
          accessibilityLabel={text("Filter favorites", "Favoriten filtern")}
          onPress={() => setFavoritesOnly((value) => !value)}
          style={[
            styles.favoriteFilter,
            favoritesOnly && styles.favoriteActive,
          ]}
        >
          <Star
            size={19}
            color={favoritesOnly ? colors.ink : colors.muted}
            fill={favoritesOnly ? colors.yellow : "transparent"}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: showHidden }}
          accessibilityLabel={text(
            "Show hidden decks",
            "Ausgeblendete Lernsets anzeigen",
          )}
          onPress={() => setShowHidden((value) => !value)}
          style={[styles.favoriteFilter, showHidden && styles.favoriteActive]}
        >
          {showHidden ? (
            <Eye size={19} color={colors.ink} />
          ) : (
            <EyeOff size={19} color={colors.muted} />
          )}
        </Pressable>
      </View>

      {libraryError ? (
        <LoadError
          title={text("Connection failed", "Verbindung fehlgeschlagen")}
          message={text(
            "Flash-n-Flip could not load your decks from the server.",
            "Flash-n-Flip konnte deine Lernsets nicht vom Server laden.",
          )}
          retryLabel={text("Try again", "Erneut versuchen")}
          onRetry={() => void reload().catch(() => {})}
        />
      ) : null}

      {visibleDecks.map(({ deck, depth }, index) => {
        const progressPercent = deckProgressPercent(
          deck.reviewedCardCount,
          deck.cardCount,
        );
        return (
          <View
            key={deck.id}
            style={[styles.deck, { marginLeft: Math.min(depth, 4) * 18 }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={deck.title}
              onPress={() =>
                router.push({ pathname: "/deck/[id]", params: { id: deck.id } })
              }
              style={styles.deckMain}
            >
              <View
                style={[
                  styles.cover,
                  {
                    backgroundColor: [
                      colors.mint,
                      colors.peach,
                      colors.yellow,
                      colors.rose,
                    ][index % 4],
                  },
                ]}
              >
                {deck.visual ? (
                  <DeckVisual visual={deck.visual} size={40} />
                ) : (
                  <Text style={styles.coverText}>
                    {deck.title.slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deckTitle}>{deck.title}</Text>
                <Text numberOfLines={1} style={styles.deckDesc}>
                  {deck.description ||
                    text("No description", "Keine Beschreibung")}
                </Text>
                <Text style={styles.deckMeta}>
                  {deck.cardCount} {text("cards", "Karten")} ·{" "}
                  {formatByteSize(deck.storageBytes, locale)}
                </Text>
                <View style={styles.progressSummary}>
                  <View
                    accessibilityRole="progressbar"
                    accessibilityLabel={text(
                      `${deck.title}: ${progressPercent}% reviewed`,
                      `${deck.title}: ${progressPercent}% bearbeitet`,
                    )}
                    accessibilityValue={{
                      min: 0,
                      max: 100,
                      now: progressPercent,
                    }}
                    style={styles.deckProgress}
                  >
                    <View
                      style={[
                        styles.deckProgressFill,
                        { width: `${progressPercent}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {deck.reviewedCardCount}/{deck.cardCount} ·{" "}
                    {progressPercent}%
                  </Text>
                </View>
              </View>
              <ChevronRight color={colors.muted} />
            </Pressable>
            <View style={styles.rowActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: deck.favorite }}
                accessibilityLabel={
                  deck.favorite
                    ? text(
                        `Remove ${deck.title} from favorites`,
                        `${deck.title} aus Favoriten entfernen`,
                      )
                    : text(
                        `Add ${deck.title} to favorites`,
                        `${deck.title} zu Favoriten hinzufügen`,
                      )
                }
                onPress={() => void toggleFavorite(deck)}
                style={styles.rowAction}
              >
                <Star
                  size={18}
                  color={deck.favorite ? colors.ink : colors.muted}
                  fill={deck.favorite ? colors.yellow : "transparent"}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  deck.hiddenAt
                    ? text(`Show ${deck.title}`, `${deck.title} einblenden`)
                    : text(`Hide ${deck.title}`, `${deck.title} ausblenden`)
                }
                onPress={() => void toggleHidden(deck)}
                style={styles.rowAction}
              >
                {deck.hiddenAt ? (
                  <Eye size={18} color={colors.muted} />
                ) : (
                  <EyeOff size={18} color={colors.muted} />
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text(
                  `Delete ${deck.title}`,
                  `${deck.title} löschen`,
                )}
                onPress={() => confirmDelete(deck)}
                style={styles.rowAction}
              >
                <Trash2 size={18} color={colors.danger} />
              </Pressable>
            </View>
          </View>
        );
      })}
      {!visibleDecks.length && !libraryError && (
        <View style={styles.empty}>
          <Layers size={34} color={colors.primary} />
          <Text style={styles.deckTitle}>
            {text("No decks found.", "Keine Lernsets gefunden.")}
          </Text>
        </View>
      )}
    </Screen>
  );
}

const useStyles = createThemedStyles((colors) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  add: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
  },
  eyebrow: {
    marginTop: 18,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 7,
    color: colors.ink,
    fontFamily: "serif",
    fontSize: 37,
    fontWeight: "700",
    letterSpacing: -1,
  },
  sub: { marginTop: 5, color: colors.muted, fontSize: 13 },
  catalog: {
    marginTop: 24,
    padding: 14,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  catalogTitle: { flexDirection: "row", alignItems: "center", gap: 10 },
  downloadAll: {
    minHeight: 48,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: colors.yellow,
    borderRadius: 10,
  },
  continents: {
    marginTop: 9,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  continentGroup: { width: "48%", gap: 6 },
  submenuToggle: {
    minHeight: 44,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 9,
  },
  submenuText: {
    flex: 1,
    color: colors.ink,
    fontSize: 12,
    fontWeight: "800",
  },
  continent: {
    width: "100%",
    minHeight: 62,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
  },
  subregion: {
    minHeight: 56,
    marginLeft: 14,
    padding: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
  },
  branch: { color: colors.muted, fontSize: 14 },
  templateCopy: { minWidth: 0, flex: 1 },
  continentInstalled: { backgroundColor: colors.surfaceMuted },
  continentTitle: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  templateText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  error: {
    marginTop: 10,
    padding: 10,
    color: colors.danger,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 9,
  },
  filterRow: {
    marginVertical: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  search: {
    height: 48,
    paddingHorizontal: 14,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  searchInput: { flex: 1, color: colors.ink },
  favoriteFilter: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  favoriteActive: { backgroundColor: colors.yellow },
  deck: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  deckMain: {
    minHeight: 82,
    padding: 10,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  rowActions: {
    width: 132,
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-around",
  },
  rowAction: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cover: {
    width: 44,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  coverText: { fontFamily: "serif", fontSize: 20, fontWeight: "700" },
  deckTitle: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  deckDesc: { marginTop: 3, color: colors.muted, fontSize: 12 },
  deckMeta: {
    marginTop: 7,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  progressSummary: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  deckProgress: {
    height: 5,
    overflow: "hidden",
    flex: 1,
    backgroundColor: colors.neutral,
    borderRadius: 99,
  },
  deckProgressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 99,
  },
  progressText: {
    minWidth: 62,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  empty: { paddingVertical: 70, alignItems: "center", gap: 8 },
}));
