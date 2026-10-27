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
const privacyManifest = readFileSync(
  new URL("../ios/App/App/PrivacyInfo.xcprivacy", import.meta.url),
  "utf8",
);
const fileExportPlugin = readFileSync(
  new URL("../ios/App/App/FlashNFlipFileExportPlugin.swift", import.meta.url),
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
const launchScreen = readFileSync(
  new URL("../ios/App/App/Base.lproj/LaunchScreen.storyboard", import.meta.url),
  "utf8",
);
const splashContents = JSON.parse(
  readFileSync(
    new URL(
      "../ios/App/App/Assets.xcassets/Splash.imageset/Contents.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { images: Array<{ scale: string }> };

describe("native iPhone WebView shell", () => {
  it("declares media capture and the app's elapsed-time API use", () => {
    expect(infoPlist).toContain("NSMicrophoneUsageDescription");
    expect(infoPlist).toContain("Audio für deine Lernkarten");
    expect(infoPlist).toContain("Fotos für deine Lernkarten");
    expect(privacyManifest).toContain(
      "NSPrivacyAccessedAPICategorySystemBootTime",
    );
    expect(privacyManifest).toContain("35F9.1");
    expect(project).toContain("PrivacyInfo.xcprivacy in Resources");
    expect(fileExportPlugin).toContain(
      'case "application/json": allowedExtension = ".json"',
    );
  });
  it("streams FNF packages into the native share sheet with bounded chunks", () => {
    expect(sceneDelegate).toContain(
      "bridge?.registerPluginInstance(FlashNFlipFileExportPlugin())",
    );
    expect(project).toContain("FlashNFlipFileExportPlugin.swift in Sources");
    expect(fileExportPlugin).toContain(
      'public let jsName = "FlashNFlipFileExport"',
    );
    expect(fileExportPlugin).toContain(
      "private let maximumChunkBytes = 256 * 1024",
    );
    expect(fileExportPlugin).toContain(
      "session.writtenBytes == session.expectedBytes",
    );
    expect(fileExportPlugin).toContain("UIActivityViewController(");
    expect(fileExportPlugin).toContain("popoverPresentationController");
    expect(fileExportPlugin).toContain("self.discard(exportId)");
    expect(fileExportPlugin).toContain(
      "try? FileManager.default.removeItem(at: exportRootDirectory)",
    );
  });

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

  it("uses one standard native tab bar on iPhone and iPad with a versioned bidirectional contract", () => {
    expect(sceneDelegate).toContain("private let tabBar = UITabBar()\n");
    expect(sceneDelegate).toContain(
      "private let usesNativeTabBar = !ProcessInfo.processInfo.isiOSAppOnMac",
    );
    expect(sceneDelegate).toContain(
      "bridgeViewController.nativeTabBarEnabled = usesNativeTabBar",
    );
    expect(sceneDelegate).toContain("if usesNativeTabBar {");
    expect(sceneDelegate).toContain(
      'private let nativeTabIds = ["overview", "decks", "discover", "local"]',
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
    expect(sceneDelegate).toContain("nativeNavigationContractVersion = 1");
    expect(sceneDelegate).not.toContain(
      '(localized("Study", "Lernen"), "study"',
    );
    expect(appShell).toContain('addListener("navigate"');
    expect(appShell).toContain('addListener("layoutChanged"');
    expect(appShell).toContain("routeChanged({");
    expect(sceneDelegate).toContain(
      "UIFont.systemFont(ofSize: captionSize, weight: .semibold)",
    );
    expect(sceneDelegate).toContain("setTitleTextAttributes");
  });

  it("passes device profile and Dynamic Type through one native adapter", () => {
    expect(sceneDelegate).toContain("root.dataset.nativeTypographyProfile");
    expect(sceneDelegate).toContain(
      "UIFont.preferredFont(forTextStyle: .body).pointSize / 17.0",
    );
    expect(sceneDelegate).toContain("preferredContentSizeCategory");
    expect(sceneDelegate).not.toContain("expandedAppleInterfaceScale");
    expect(sceneDelegate).not.toContain("'150%'");
    expect(sceneDelegate).toContain("max(49, 24 + captionSize * 2)");
  });

  it("keeps Mac layout while using the shared type system without page zoom", () => {
    expect(sceneDelegate).not.toContain("webView?.pageZoom");
    expect(sceneDelegate).toContain(
      "root.dataset.appleInterfacePlatform = 'mac'",
    );
    expect(webStyles).toContain("grid-template-columns: 330px minmax(0, 1fr)");
    expect(sceneDelegate).toContain(
      "let typographyPlugin = FlashNFlipTypographyPlugin()",
    );
    expect(sceneDelegate).toContain("self.captionSize = size");
  });

  it("hides every Web navigation at all iPad widths when the native tab bar is active", () => {
    expect(sceneDelegate).toContain("nativeTabBarEnabled = false");
    expect(sceneDelegate).toContain("if nativeTabBarEnabled {");
    expect(sceneDelegate).toContain("injectionTime: .atDocumentStart");
    expect(portableIndex).toContain(
      'window.Capacitor.isPluginAvailable("FlashNFlipNavigation")',
    );
    expect(webStyles).toMatch(
      /:root\[data-native-tab-bar="true"\] :is\(\.sidebar, \.study-rail, \.mobile-nav\)\s*\{\s*display: none;/,
    );
    expect(webStyles).toMatch(
      /:root\[data-native-tab-bar="true"\] \.app-layout\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);[^}]*grid-template-rows: minmax\(0, 1fr\);/,
    );
    expect(webStyles).toMatch(
      /:root\[data-native-tab-bar="true"\] \.app-layout > \.app-content\s*\{[^}]*grid-column: 1;[^}]*grid-row: 1;/,
    );
    expect(webStyles).not.toMatch(
      /@media \(max-width: 900px\)\s*\{\s*:root\[data-native-tab-bar="true"\]/,
    );
    expect(appShell).toContain(
      'const usesFixedViewport = usesCompactRail || pathname === "/app/memory"',
    );
    expect(appShell).toContain(
      '${usesFixedViewport ? " fixed-viewport-layout" : ""}',
    );
    expect(webStyles).toMatch(
      /:root\[data-native-tab-bar="true"\] \.app-layout\s*\{[^}]*padding-bottom:\s*0;/s,
    );
    expect(webStyles).toMatch(
      /:root\[data-native-tab-bar="true"\]\s+\.app-layout:not\(\.fixed-viewport-layout\)\s*\{[^}]*padding-top:\s*var\(--safe-area-top\);/s,
    );
    expect(webStyles).toMatch(
      /:root\[data-native-tab-bar="true"\]\s+\.app-layout:not\(\.fixed-viewport-layout\)\s+> \.app-content\s*\{[^}]*padding-top:\s*0;[^}]*padding-bottom:\s*var\(--native-content-bottom-inset\);[^}]*scroll-padding-bottom:\s*var\(--native-content-bottom-inset\);/s,
    );
    expect(webStyles).toMatch(
      /:root\[data-native-tab-bar="true"\] \.app-layout\.fixed-viewport-layout\s*\{[^}]*padding-bottom:\s*var\(--native-content-bottom-inset\);/s,
    );
    expect(webStyles).toMatch(
      /:root\[data-native-tab-bar="true"\]\s+\.app-layout\.fixed-viewport-layout:not\(\.study-layout\)\s+> \.app-content\s*\{[^}]*padding-top:\s*var\(--safe-area-top\);/s,
    );
    expect(webStyles).toMatch(
      /:root\[data-native-tab-bar="true"\] \.study-layout \.study-page\s*\{[^}]*height:\s*calc\(100dvh - var\(--native-content-bottom-inset\)\);[^}]*padding-top:\s*max\(10px, var\(--safe-area-top\)\);/s,
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

  it("shows the canonical launch identity on a fixed black canvas", () => {
    expect(launchScreen).toContain('text="Flash-n-Flip"');
    expect(launchScreen).toContain('text="Flash, Flip and Remember"');
    expect(launchScreen).toContain('image="Splash"');
    expect(launchScreen).toContain(
      '<color key="backgroundColor" white="0.0" alpha="1"',
    );
    expect(launchScreen).toContain(
      '<constraint firstAttribute="width" constant="240"',
    );
    expect(launchScreen).toContain(
      '<constraint firstAttribute="height" constant="240"',
    );
    expect(splashContents.images.map(({ scale }) => scale)).toEqual([
      "1x",
      "2x",
      "3x",
    ]);
    expect(sceneDelegate).toContain("private let launchOverlay = UIView()");
    expect(sceneDelegate).toContain("launchOverlay.backgroundColor = .black");
    expect(sceneDelegate).toContain('titleLabel.text = "Flash-n-Flip"');
    expect(sceneDelegate).toContain(
      'mottoLabel.text = "Flash, Flip and Remember"',
    );
    expect(sceneDelegate).toContain(
      "logoView.widthAnchor.constraint(equalToConstant: 240)",
    );
    expect(sceneDelegate).toContain("dismissLaunchOverlayIfNeeded()");
    expect(sceneDelegate).toContain(
      "bridge?.registerPluginInstance(launchPlugin)",
    );
    expect(sceneDelegate).toContain(
      "bridgeViewController.launchPlugin.launchDelegate = self",
    );
    expect(sceneDelegate).toContain("func webAppDidBecomeReady()");
    expect(nativeNavigation).toContain(
      'registerPlugin<FlashNFlipLaunchPlugin>("FlashNFlipLaunch")',
    );
    expect(appShell).toContain("signalNativeLaunchReady();");
    expect(sceneDelegate).toContain("launchOverlay.removeFromSuperview()");
    expect(sceneDelegate).toContain(
      "private let minimumLaunchOverlayDuration: TimeInterval = 1.2",
    );
    expect(sceneDelegate).toContain(
      "ProcessInfo.processInfo.systemUptime - launchOverlayInstalledAt",
    );
    expect(sceneDelegate).toContain(
      "DispatchQueue.main.asyncAfter(deadline: .now() + remaining)",
    );
    expect(sceneDelegate).not.toContain("Timer(");
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

  it("does not register an audio optimizer or its battery monitoring", () => {
    expect(sceneDelegate).not.toContain("FlashNFlipAudioPlugin");
    expect(identityPlugin).not.toContain("AVAssetReader");
    expect(identityPlugin).not.toContain("vDSP");
    expect(identityPlugin).not.toContain("isBatteryMonitoringEnabled");
  });

  it("rebuilds and copies the local-only Apple bundle before every Xcode build", () => {
    const buildPhase = "A19FE571738E7BD0B0D0BB03";
    expect(
      project.indexOf(`${buildPhase} /* Build bundled Apple app */`),
    ).toBeLessThan(project.indexOf("504EC3001FED79650016851F /* Sources */"));
    expect(project).toContain("alwaysOutOfDate = 1");
    expect(project).toContain(
      'shellScript = "\\\"$SRCROOT/../../scripts/prepare-webstack-for-xcode.sh\\\"\\n";',
    );
    expect(project.match(/ENABLE_USER_SCRIPT_SANDBOXING = NO;/g)).toHaveLength(
      3,
    );
    expect(prepareWebstackScript).toContain(
      "pnpm --filter @flashcards/direct-connect-webstack build:apple-local",
    );
    expect(prepareWebstackScript).toContain(
      "Apple builds must not contain PWA handoff or peer-webstack release assets",
    );
    expect(prepareWebstackScript).toContain("flash-n-flip\\.com");
    expect(prepareWebstackScript).toContain("/rendezvous/v1");
    expect(prepareWebstackScript).toContain("pnpm exec capacitor copy ios");
  });

  it("activates only the bounded read-only CloudKit inventory", () => {
    expect(sceneDelegate).toContain("import CloudKit");
    expect(sceneDelegate).toContain(
      "bridge?.registerPluginInstance(FlashNFlipCloudInventoryPlugin())",
    );
    expect(sceneDelegate).toContain('let jsName = "FlashNFlipCloudInventory"');
    expect(sceneDelegate).toContain('CAPPluginMethod(name: "accountStatus"');
    expect(sceneDelegate).toContain('CAPPluginMethod(name: "readRecords"');
    expect(sceneDelegate).toContain(
      "private let maximumRecordsPerRequest = 200",
    );
    expect(sceneDelegate).toContain("CKFetchRecordsOperation(recordIDs:");
    expect(sceneDelegate).not.toMatch(
      /CKModify|saveRecord|deleteRecord|performQuery/,
    );
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
    expect(entitlements).toContain("iCloud.com.flash-n-flip");
    expect(project).toContain(
      "CODE_SIGN_ENTITLEMENTS = App/App.CloudKit.entitlements;",
    );
    expect(infoPlist).not.toContain("CKSharingSupported");
  });
});
