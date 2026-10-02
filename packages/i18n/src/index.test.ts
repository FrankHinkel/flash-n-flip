import { describe, expect, it } from "vitest";

import {
  defaultLocale,
  isLocale,
  product,
  supportedLocales,
  translate,
  translateUiMessage,
  uiMessages,
} from "./index.js";

describe("translations", () => {
  it("provides matching core keys in all four UI languages", () => {
    expect(translate("de", "study", "reveal")).toBe("Antwort zeigen");
    expect(translate("en", "study", "reveal")).toBe("Show answer");
    expect(translate("es", "study", "reveal")).toBe("Mostrar respuesta");
    expect(translate("fr", "study", "reveal")).toBe("Afficher la réponse");
  });

  it("uses English as the leading default", () => {
    expect(defaultLocale).toBe("en");
    expect(translateUiMessage(defaultLocale, "navigation.decks")).toBe("Decks");
  });

  it("publishes the canonical product identity and supported locales", () => {
    expect(product).toEqual({
      name: "Flash-n-Flip",
      domain: "flash-n-flip.com",
      motto: "Flash, Flip and Remember",
    });
    expect(supportedLocales).toEqual(["en", "de", "es", "fr"]);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("de")).toBe(true);
    expect(isLocale("es")).toBe(true);
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("it")).toBe(false);
  });

  it("keeps every UI message complete and placeholder-compatible", () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{(\d+)\}/g)].map((match) => match[1]).sort();

    for (const message of Object.values(uiMessages)) {
      for (const locale of supportedLocales) {
        expect(message[locale].trim()).not.toBe("");
        expect(placeholders(message[locale])).toEqual(placeholders(message.en));
      }
    }
  });

  it("inserts dynamic values without evaluating translated text", () => {
    expect(translateUiMessage("es", "content.cloze.blankHint", ["verbo"])).toBe(
      "Hueco, pista: verbo",
    );
  });

  it.each([
    [
      "en",
      "1 review completed.",
      "2 reviews completed.",
      "0 reviews completed.",
    ],
    [
      "de",
      "1 Wiederholung ist erledigt.",
      "2 Wiederholungen sind erledigt.",
      "0 Wiederholungen sind erledigt.",
    ],
    [
      "es",
      "1 repetición completada.",
      "2 repeticiones completadas.",
      "0 repeticiones completadas.",
    ],
    [
      "fr",
      "1 répétition terminée.",
      "2 répétitions terminées.",
      "0 répétition terminée.",
    ],
  ] as const)(
    "uses the %s cardinal rules for completed reviews",
    (locale, one, two, zero) => {
      expect(translateUiMessage(locale, "legacy.cae01aaedb70", [1])).toBe(one);
      expect(translateUiMessage(locale, "legacy.cae01aaedb70", [2])).toBe(two);
      expect(translateUiMessage(locale, "legacy.cae01aaedb70", [0])).toBe(zero);
    },
  );

  it("uses singular card copy without changing dynamic values or custom plan names", () => {
    expect(translateUiMessage("en", "legacy.bfdddeb40282", [1])).toBe(
      "1 card to review",
    );
    expect(translateUiMessage("en", "legacy.bfdddeb40282", [2])).toBe(
      "2 cards to review",
    );
    expect(translateUiMessage("fr", "legacy.45297cca17d5", [1, 1, 100])).toBe(
      "1 carte · 1 révisée · 100%",
    );
    expect(translateUiMessage("fr", "legacy.45297cca17d5", [2, 1, 50])).toBe(
      "2 cartes · 1 révisée · 50%",
    );
    expect(translateUiMessage("en", "studyPlan.defaultTitle")).toBe(
      "My learning plan",
    );
  });
  it.each([
    ["en", "1 card", "2 cards"],
    ["de", "1 Karte", "2 Karten"],
    ["es", "1 tarjeta", "2 tarjetas"],
    ["fr", "1 carte", "2 cartes"],
  ] as const)(
    "agrees with deck picker counts in %s",
    (locale, singular, plural) => {
      expect(translateUiMessage(locale, "deck.cardCount", [1])).toBe(singular);
      expect(translateUiMessage(locale, "deck.cardCount", [2])).toBe(plural);
    },
  );

  it.each([
    ["fr", 2, 1, "2 cartes · 1 révisée · 50%"],
    ["fr", 1, 2, "1 carte · 2 révisées · 50%"],
    ["es", 2, 1, "2 tarjetas · 1 repasada · 50%"],
    ["es", 1, 2, "1 tarjeta · 2 repasadas · 50%"],
  ] as const)(
    "agrees independently with card and review counts in %s (%i/%i)",
    (locale, cards, reviews, expected) => {
      expect(
        translateUiMessage(locale, "legacy.45297cca17d5", [cards, reviews, 50]),
      ).toBe(expected);
    },
  );
});
