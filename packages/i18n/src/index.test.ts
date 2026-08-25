import { describe, expect, it } from "vitest";

import {
  defaultLocale,
  isLocale,
  product,
  selectTranslation,
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
    expect(selectTranslation(defaultLocale, "Settings", "Einstellungen")).toBe(
      "Settings",
    );
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
});
