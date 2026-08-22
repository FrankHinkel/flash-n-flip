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
      "UIFont.systemFont(ofSize: 12 * interfaceScale, weight: .semibold)",
    );
    expect(sceneDelegate).toContain("setTitleTextAttributes");
  });

  it("enlarges iPad interface text and its native menu by fifty percent", () => {
    expect(sceneDelegate).toContain(
      "private let expandedAppleInterfaceScale: CGFloat = 1.5",
    );
    expect(sceneDelegate).toContain(
      "ProcessInfo.processInfo.isiOSAppOnMac || traitCollection.userInterfaceIdiom == .pad",
    );
    expect(sceneDelegate).toContain(
      "!ProcessInfo.processInfo.isiOSAppOnMac && UIDevice.current.userInterfaceIdiom == .pad",
    );
    expect(sceneDelegate).toContain(
      "element.style.setProperty('-webkit-text-size-adjust', '150%', 'important')",
    );
    expect(sceneDelegate).toContain(
      "element.style.setProperty('text-size-adjust', '150%', 'important')",
    );
    expect(sceneDelegate).toContain(
      "49 * interfaceScale + view.safeAreaInsets.bottom",
    );
  });

  it("zooms the complete Mac for iPad Web interface by fifty percent", () => {
    expect(sceneDelegate).toMatch(
      /if ProcessInfo\.processInfo\.isiOSAppOnMac \{\s*webView\?\.pageZoom = expandedAppleInterfaceScale\s*\}/,
    );
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

  it("registers the chunked and verified native AAC audio optimizer", () => {
    expect(sceneDelegate).toContain(
      "bridge?.registerPluginInstance(FlashNFlipAudioPlugin())",
    );
    expect(identityPlugin).toContain('public let jsName = "FlashNFlipAudio"');
    expect(identityPlugin).toContain("AVAssetReader");
    expect(identityPlugin).toContain("import Accelerate");
    expect(identityPlugin).toContain("vDSP.Biquad");
    expect(identityPlugin).toContain("vDSP.convertElements");
    expect(identityPlugin).toContain("vDSP.multiply");
    expect(identityPlugin).toContain("vDSP.clip");
    expect(identityPlugin).toContain("AVEncoderBitRateKey: 40_000");
    expect(identityPlugin).toContain("inputMetrics.noiseFloor * 1.5");
    expect(identityPlugin).toContain("maximumNoiseReduction");
    expect(identityPlugin).toContain("noiseSuppressionGain");
    expect(identityPlugin).toContain(
      '"engine": "AVFoundation-vDSP-adaptive-denoise"',
    );
    expect(identityPlugin).toContain('"engineVersion": "4"');
    expect(identityPlugin).toContain("private let targetLoudness = -16.0");
    expect(identityPlugin).not.toContain("highPassed * 0.25");
    expect(identityPlugin).toContain('CAPPluginMethod(name: "appendInput"');
    expect(identityPlugin).toContain(
      "private let maximumChunkBytes = 512 * 1024",
    );
    expect(identityPlugin).toContain(
      "private var inputHandles: [String: FileHandle]",
    );
    expect(identityPlugin).toContain(
      "private var outputHandles: [String: FileHandle]",
    );
    expect(identityPlugin).toContain('"analysisMs": analysisMilliseconds');
    expect(identityPlugin).toContain(
      '"verificationMs": verificationMilliseconds',
    );
    expect(identityPlugin).toContain("let verified = outputSize > 0");
    expect(identityPlugin).toContain("isLowPowerModeEnabled");
    expect(identityPlugin).toContain("device.batteryState == .unplugged");
    expect(identityPlugin).toContain(
      "device.batteryLevel < minimumBatteryLevel",
    );
    expect(identityPlugin).toContain(
      "private let minimumBatteryLevel = Float(0.60)",
    );
    expect(identityPlugin).toContain("ThermalState.fair.rawValue");
    expect(identityPlugin).toContain("try enforceDeviceProtection()");
    expect(identityPlugin).toContain(
      "UIDevice.batteryStateDidChangeNotification",
    );
    expect(identityPlugin).toContain(
      "UIDevice.batteryLevelDidChangeNotification",
    );
    expect(identityPlugin).toContain(".NSProcessInfoPowerStateDidChange");
    expect(identityPlugin).toContain(
      "ProcessInfo.thermalStateDidChangeNotification",
    );
    expect(identityPlugin).toContain(
      'notifyListeners("protectionStateChanged"',
    );
    expect(identityPlugin).toContain('domain: "FlashNFlipAudioProtection"');
    expect(identityPlugin).toContain(
      "DEFERRED_THERMAL: Audio optimization is paused while the device cools down",
    );
    expect(identityPlugin).toContain(
      "DEFERRED_BATTERY: Audio optimization is paused to protect the battery",
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
      "getProtectionState",
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
