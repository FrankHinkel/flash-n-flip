import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sceneDelegate = readFileSync(
  new URL("../ios/App/App/SceneDelegate.swift", import.meta.url),
  "utf8",
);
const identityPlugin = readFileSync(
  new URL("../ios/App/App/FlashNFlipIdentityPlugin.swift", import.meta.url),
  "utf8",
);
const appDelegate = readFileSync(
  new URL("../ios/App/App/AppDelegate.swift", import.meta.url),
  "utf8",
);
const entitlements = readFileSync(
  new URL("../ios/App/App/App.CloudKit.entitlements", import.meta.url),
  "utf8",
);
const project = readFileSync(
  new URL("../ios/App/App.xcodeproj/project.pbxproj", import.meta.url),
  "utf8",
);
const infoPlist = readFileSync(
  new URL("../ios/App/App/Info.plist", import.meta.url),
  "utf8",
);
const audioClient = readFileSync(
  new URL("../../web/lib/audio-optimization.ts", import.meta.url),
  "utf8",
);
const applePackage = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts: { build: string } };
const prepareWebstackScript = readFileSync(
  new URL("../scripts/prepare-webstack-for-xcode.sh", import.meta.url),
  "utf8",
);
const nativeNavigation = readFileSync(
  new URL("../../web/lib/native-navigation.ts", import.meta.url),
  "utf8",
);
const appShell = readFileSync(
  new URL("../../web/components/app-shell.tsx", import.meta.url),
  "utf8",
);
const webStyles = readFileSync(
  new URL("../../web/app/styles.css", import.meta.url),
  "utf8",
);
const portableIndex = readFileSync(
  new URL("../../web/portable/index.html", import.meta.url),
  "utf8",
);
const overviewTabContents = readFileSync(
  new URL(
    "../ios/App/App/Assets.xcassets/OverviewTab.imageset/Contents.json",
    import.meta.url,
  ),
  "utf8",
);
const overviewTabSymbol = readFileSync(
  new URL(
    "../ios/App/App/Assets.xcassets/OverviewTab.imageset/OverviewTab.svg",
    import.meta.url,
  ),
  "utf8",
);

describe("native iPhone WebView shell", () => {
  it("keeps the WebView surface neutral without native edge bounce", () => {
    expect(sceneDelegate).toContain(
      "window?.rootViewController = FlashNFlipNativeShellViewController()",
    );
    expect(
      sceneDelegate.match(/FlashNFlipBridgeViewController\(\)/g),
    ).toHaveLength(1);
    expect(sceneDelegate).toContain(
      "bridgeViewController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)",
    );
    expect(sceneDelegate).toContain("webView?.scrollView.bounces = false");
    expect(sceneDelegate).toContain(
      "webView?.scrollView.alwaysBounceVertical = false",
    );
    expect(sceneDelegate).toContain(
      "webView?.scrollView.backgroundColor = webSurfaceColor",
    );
    expect(sceneDelegate).toContain(
      "webView?.scrollView.showsHorizontalScrollIndicator = false",
    );
    expect(sceneDelegate).toContain(
      "webView?.scrollView.showsVerticalScrollIndicator = false",
    );
  });

  it("uses one standard native tab bar with a versioned bidirectional contract", () => {
    expect(sceneDelegate).toContain("private let tabBar = UITabBar()\n");
    expect(sceneDelegate).toContain(
      'private let nativeTabIds = ["overview", "decks", "study", "discover", "local"]',
    );
    expect(sceneDelegate).toContain(
      'public let jsName = "FlashNFlipNavigation"'.replace("public ", ""),
    );
    expect(sceneDelegate).toContain(
      "bridge?.registerPluginInstance(navigationPlugin)",
    );
    expect(sceneDelegate).toContain('notifyListeners("navigate"');
    expect(sceneDelegate).toContain("pendingTabId = tabId");
    expect(sceneDelegate).toContain("webIsReady = true");
    expect(sceneDelegate).toContain("@objc func routeChanged");
    expect(sceneDelegate).toContain(
      "DispatchQueue.main.async { [weak self] in",
    );
    expect(sceneDelegate).toContain('notifyListeners("layoutChanged"');
    expect(sceneDelegate).toContain(
      "bridgeViewController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)",
    );
    expect(sceneDelegate).not.toContain(
      "bridgeViewController.view.bottomAnchor.constraint(equalTo: tabBar.topAnchor)",
    );
    expect(sceneDelegate).not.toContain("Timer(");
    expect(nativeNavigation).toMatch(
      /registerPlugin<FlashNFlipNavigationPlugin>\(\s*"FlashNFlipNavigation",?\s*\)/,
    );
    expect(nativeNavigation).toContain("nativeNavigationContractVersion = 1");
    expect(appShell).toContain('addListener("navigate"');
    expect(appShell).toContain('addListener("layoutChanged"');
    expect(appShell).toContain("routeChanged({");
  });

  it("hides only the mobile Web navigation after explicit shell confirmation", () => {
    expect(sceneDelegate).toContain("nativeShellEnabled = false");
    expect(sceneDelegate).toContain("injectionTime: .atDocumentStart");
    expect(portableIndex).toContain(
      'window.Capacitor.isPluginAvailable("FlashNFlipNavigation")',
    );
    expect(webStyles).toMatch(
      /:root\[data-native-tab-bar="true"\] \.mobile-nav\s*\{\s*display: none;/,
    );
    expect(webStyles).toContain(
      "padding-bottom: var(--native-content-bottom-inset)",
    );
  });

  it("derives a template overview symbol from the shared brand geometry", () => {
    const contents = JSON.parse(overviewTabContents) as {
      properties: Record<string, unknown>;
    };
    expect(contents.properties["template-rendering-intent"]).toBe("template");
    expect(contents.properties["preserves-vector-representation"]).toBe(true);
    expect(overviewTabSymbol).not.toContain("<rect");
    expect(overviewTabSymbol.match(/<path\b/g)).toHaveLength(2);
    expect(sceneDelegate).toContain('UIImage(named: "OverviewTab")');
    expect(sceneDelegate).toContain("withRenderingMode(.alwaysTemplate)");
    expect(sceneDelegate).not.toContain('UIImage(systemName: "bolt.fill")');
  });

  it("registers a device-bound Keychain identity plugin", () => {
    expect(sceneDelegate).toContain(
      "bridge?.registerPluginInstance(FlashNFlipIdentityPlugin())",
    );
    expect(identityPlugin).toContain(
      "kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly",
    );
    expect(identityPlugin).toContain("P256.Signing.PrivateKey");
    expect(identityPlugin).toContain(
      'public let jsName = "FlashNFlipIdentity"',
    );
  });

  it("registers the chunked and verified native AAC audio optimizer", () => {
    expect(sceneDelegate).toContain(
      "bridge?.registerPluginInstance(FlashNFlipAudioPlugin())",
    );
    expect(identityPlugin).toContain('public let jsName = "FlashNFlipAudio"');
    expect(identityPlugin).toContain("AVAssetReader");
    expect(identityPlugin).toContain("AVEncoderBitRateKey: 40_000");
    expect(identityPlugin).toContain("inputMetrics.noiseFloor * 1.5");
    expect(identityPlugin).toContain("maximumNoiseReduction");
    expect(identityPlugin).toContain("noiseSuppressionGain");
    expect(identityPlugin).toContain(
      '"engine": "AVFoundation-adaptive-denoise"',
    );
    expect(identityPlugin).toContain('"engineVersion": "4"');
    expect(identityPlugin).toContain("private let targetLoudness = -16.0");
    expect(identityPlugin).not.toContain("highPassed * 0.25");
    expect(identityPlugin).toContain('CAPPluginMethod(name: "appendInput"');
    expect(identityPlugin).toContain("let verified = outputSize > 0");
    expect(identityPlugin).toContain("isLowPowerModeEnabled");
    expect(identityPlugin).toContain("device.batteryState == .charging");
    expect(identityPlugin).toContain("ThermalState.fair.rawValue");
    expect(identityPlugin).toContain(
      "DEFERRED: Audio optimization is paused until the device is charging and cool",
    );
    expect(identityPlugin).toContain(
      "UNSUPPORTED: Audio has no decodable audio track",
    );
    for (const method of [
      "begin",
      "appendInput",
      "optimizeFile",
      "readOutput",
      "cleanup",
    ]) {
      expect(audioClient).toContain(`${method}(`);
      expect(identityPlugin).toContain(`CAPPluginMethod(name: "${method}"`);
    }
    expect(applePackage.scripts.build).toMatch(
      /direct-connect-webstack build.*capacitor sync ios/,
    );
  });

  it("rebuilds and copies the current signed Webstack before every Xcode build", () => {
    const buildPhase = "A19FE571738E7BD0B0D0BB03";
    expect(
      project.indexOf(`${buildPhase} /* Build current signed Webstack */`),
    ).toBeLessThan(project.indexOf("504EC3001FED79650016851F /* Sources */"));
    expect(project).toContain("alwaysOutOfDate = 1");
    expect(project).toContain(
      'shellScript = "\\\"$SRCROOT/../../scripts/prepare-webstack-for-xcode.sh\\\"\\n";',
    );
    expect(project.match(/ENABLE_USER_SCRIPT_SANDBOXING = NO;/g)).toHaveLength(
      2,
    );
    expect(prepareWebstackScript).toContain(
      "pnpm --filter @flashcards/direct-connect-webstack build",
    );
    expect(prepareWebstackScript).toContain(
      "Signed webstack-release.json is missing",
    );
    expect(prepareWebstackScript).toContain("pnpm exec capacitor copy ios");
  });

  it("keeps CloudKit dormant until a paid Developer Team is available", () => {
    expect(sceneDelegate).not.toContain(
      "bridge?.registerPluginInstance(FlashNFlipAppleCloudPlugin())",
    );
    expect(identityPlugin).toContain(
      'public let jsName = "FlashNFlipAppleCloud"',
    );
    expect(identityPlugin).toContain("kSecAttrSynchronizable as String: true");
    expect(identityPlugin).toContain("fetchUserRecordID");
    expect(identityPlugin).toContain("flash-n-flip-encrypted-cloud-backup");
    expect(identityPlugin).toContain("CKShare(rootRecord: root)");
    expect(identityPlugin).not.toContain(
      'json.contains("flash-n-flip-local-backup") else {\n            call.resolve',
    );
    expect(appDelegate).not.toContain("userDidAcceptCloudKitShareWith");
    expect(appDelegate).not.toContain("import CloudKit");
    expect(entitlements).toContain("iCloud.com.flash-n-flip");
    expect(project).not.toContain("CODE_SIGN_ENTITLEMENTS");
    expect(infoPlist).not.toContain("CKSharingSupported");
  });
});
