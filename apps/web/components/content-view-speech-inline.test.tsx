import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ContentView } from "./content-view";
import { I18nProvider } from "./i18n-provider";

vi.mock("./use-text-to-speech", () => ({
  speechVoiceInstallHint: () => "Install a matching voice.",
  useTextToSpeech: () => ({
    canSpeak: true,
    canSpeakChoices: true,
    controlVisible: true,
    mode: "sentence-and-choices",
    speak: vi.fn(),
    speakingText: "",
    stop: vi.fn(),
  }),
}));

describe("ContentView speech control placement", () => {
  it("places the speech control inside the paragraph after its text", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          content={{ blocks: [{ type: "text", text: "Vélo" }] }}
          locale="fr"
          speechEnabled
          speechLocale="fr"
          speechUiLocale="de"
        />
      </I18nProvider>,
    );

    expect(markup).toMatch(
      /<p[^>]*>Vélo<button[^>]*class="card-speech-button"/,
    );
    expect(markup).not.toMatch(/<\/p><button[^>]*card-speech-button/);
    expect(markup).toContain('aria-label="Satz mit Lücken vorlesen"');
  });

  it("places the answer control after rich text content", () => {
    const markup = renderToStaticMarkup(
      <I18nProvider>
        <ContentView
          answer
          content={{
            blocks: [
              {
                type: "markdown",
                revealMode: "ALL",
                source: "**Bike**",
              },
            ],
          }}
          locale="en"
          speechEnabled
          speechLocale="en"
          speechUiLocale="de"
        />
      </I18nProvider>,
    );

    expect(markup).toMatch(
      /<strong>Bike<\/strong><button[^>]*class="card-speech-button"/,
    );
    expect(markup).toContain('aria-label="Vollständige Antwort vorlesen"');
  });
});
