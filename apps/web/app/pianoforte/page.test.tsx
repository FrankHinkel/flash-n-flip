import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PianoforteLayout from "./layout";
import PianofortePage, { metadata as overviewMetadata } from "./page";
import PianofortePrivacyPage, {
  metadata as privacyMetadata,
} from "./privacy/page";
import PianoforteSupportPage, {
  metadata as supportMetadata,
} from "./support/page";

describe("public Pianoforte pages", () => {
  it("keeps the product self-contained without links to the unfinished app", () => {
    const html = renderToStaticMarkup(
      <PianoforteLayout>
        <PianofortePage />
      </PianoforteLayout>,
    );

    expect(html).toContain("Music first.");
    expect(html).toContain("A better way to practise piano");
    expect(html).not.toContain("A quieter way to practise piano");
    expect(html).toContain("automatically plays the other");
    expect(html).toContain("Follow your play and start playing");
    expect(html).toContain("multiple MIDI inputs and outputs at once");
    expect(html).toContain("MIDI keyboard without speakers");
    expect(html).toContain("url=%2Fpianoforte%2Fpractice-preview.png");
    expect(html).toContain('alt="Pianoforte practice view showing Für Elise');
    expect(html).not.toContain("PIANOFORTE");
    expect(html).not.toContain("♫");
    expect(html).toContain('href="/pianoforte/privacy"');
    expect(html).toContain('href="/pianoforte/support"');
    expect(html).not.toContain('href="/"');
    expect(html).not.toContain("Flash-n-Flip");
    expect(html).toContain("App Store release in preparation");
    expect(html).toContain("Enable private iCloud sync in the Library");
    expect(overviewMetadata.alternates).toEqual({ canonical: "/pianoforte" });
    expect(overviewMetadata.title).toEqual({ absolute: "Pianoforte — piano practice with real sheet music" });
  });

  it("provides a bilingual, product-specific privacy page", () => {
    const html = renderToStaticMarkup(<PianofortePrivacyPage />);

    expect(html).toContain("Friedenstraße 39");
    expect(html).toContain("pianofortel@hi-sys.de");
    expect(html).toContain("private Apple CloudKit database");
    expect(html).toContain("New installations keep imported scores on the device");
    expect(html).toContain("Turning sync off stops new synchronization");
    expect(html).not.toContain("If you choose to store imported scores in iCloud");
    expect(html).toContain("when the request is resolved");
    expect(html).toContain('lang="de"');
    expect(privacyMetadata.alternates).toEqual({
      canonical: "/pianoforte/privacy",
    });
  });

  it("offers a bilingual, contactable support page", () => {
    const html = renderToStaticMarkup(<PianoforteSupportPage />);

    expect(html).toContain('href="mailto:pianofortel@hi-sys.de"');
    expect(html).toContain("Friedenstraße 39");
    expect(html).toContain("Never send your Apple password");
    expect(html).toContain('href="/pianoforte/privacy"');
    expect(supportMetadata.alternates).toEqual({
      canonical: "/pianoforte/support",
    });
  });
});
