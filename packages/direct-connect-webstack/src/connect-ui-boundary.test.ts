import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const readStatic = (name: string) =>
  readFile(new URL(`../static/${name}`, import.meta.url), "utf8");

const readSource = (name: string) =>
  readFile(new URL(`./${name}`, import.meta.url), "utf8");

const readOriginalUi = (name: string) =>
  readFile(
    new URL(`../../../apps/web/components/${name}`, import.meta.url),
    "utf8",
  );

const readPublishedConnect = (name: string) =>
  readFile(
    new URL(`../../../apps/web/public/connect/${name}`, import.meta.url),
    "utf8",
  );

describe("connect bootstrap product boundary", () => {
  it("ships pairing controls but no parallel product interface", async () => {
    const html = await readStatic("index.html");
    expect(html).toContain("Gerät verbinden");
    expect(html).toContain('id="create-button"');
    expect(html).toContain('id="scan-button"');
    expect(html).toContain('id="join-button"');
    expect(html).toContain('id="connection-state"');
    expect(html).toContain('id="manual-connect"');
    expect(html).toContain('href="/app"');
    expect(html).toContain(
      '<link rel="manifest" href="/manifest.webmanifest" />',
    );
    expect(html).toContain("Kopplung abbrechen");
    expect(html).toMatch(/id="open-app-link"[^>]*[\s\S]*?hidden/);
    expect(html).toContain("Danach läuft alles automatisch");
    expect(html).not.toContain('id="send-button"');
    expect(html).not.toContain("Jetzt abgleichen");

    for (const forbidden of [
      'id="deck-form"',
      'id="card-form"',
      'id="study-dialog"',
      'id="settings-form"',
      'id="media-form"',
      'id="export-button"',
      "Neues Deck",
      "Deck-Editor",
      "Antwort zeigen",
      "Wie gut wusstest du es?",
    ]) {
      expect(html).not.toContain(forbidden);
    }
  });

  it("keeps product mutations out of the pairing controller", async () => {
    const source = await readSource("app.ts");
    for (const forbidden of [
      ".saveDeck(",
      ".saveCard(",
      ".reviewCard(",
      ".saveSettings(",
      ".addMedia(",
      ".exportAll(",
      ".restoreAll(",
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).toContain("createDirectSyncInvitation");
    expect(source).toContain("LocalPeerSynchronizer");
    expect(source).toContain("sendMediaInventory");
    expect(source.indexOf("sendMediaInventory")).toBeLessThan(
      source.indexOf("webstackPeer.start"),
    );
    expect(source).toContain("await navigator.serviceWorker.ready");
    expect(source).toContain("await waitForServiceWorkerControl");
    expect(source).toContain('stylesheet.href = "/app.css"');
    expect(source).toContain('script.src = "/app.js"');
    expect(source).toContain("document.body.replaceChildren(root)");
    expect(source).toContain("synchronizer.sendOutbox(active)");
    expect(source).toContain(
      'window.addEventListener("flash-n-flip:decks-changed"',
    );
    expect(source).toContain("App-Übertragung fehlgeschlagen");
    expect(source).toContain("await createInvitation()");
    expect(source).not.toContain('element<HTMLButtonElement>("send-button")');
  });

  it("retains the established Next UI as product owner", async () => {
    const [editor, study, settings] = await Promise.all([
      readOriginalUi("deck-editor.tsx"),
      readOriginalUi("study-session.tsx"),
      readOriginalUi("settings.tsx"),
    ]);
    expect(editor).toContain('className="card-workspace"');
    expect(study).toContain('"study-card",');
    expect(settings).toContain('href="/connect"');
  });

  it("versions bootstrap assets so old shell caches cannot mix releases", async () => {
    const [html, buildScript, publishedHtml] = await Promise.all([
      readStatic("index.html"),
      readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
      readPublishedConnect("index.html"),
    ]);
    expect(html).toContain("app.js?build=__FNF_BUILD_ID__");
    expect(html).toContain("styles.css?build=__FNF_BUILD_ID__");
    expect(buildScript).toContain("connectAssetIdentity");
    expect(buildScript).toContain("`${buildVersion}-${connectAssetIdentity}`");
    expect(publishedHtml).toMatch(/app\.js\?build=\d+\.\d+\.\d+-[a-f0-9]{16}/);
  });
});
