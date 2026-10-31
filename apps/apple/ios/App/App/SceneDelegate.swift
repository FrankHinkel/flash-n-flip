import UIKit
import WebKit
import Capacitor
import CloudKit

private let nativeNavigationContractVersion = 1
private let nativeTabIds = ["overview", "decks", "discover", "local"]

@objc(FlashNFlipClipboardPlugin)
private final class FlashNFlipClipboardPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "FlashNFlipClipboardPlugin"
    let jsName = "FlashNFlipClipboard"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "writeText", returnType: CAPPluginReturnPromise)
    ]

    @objc func writeText(_ call: CAPPluginCall) {
        guard let text = call.getString("text") else {
            call.reject("Missing clipboard text")
            return
        }
        DispatchQueue.main.async {
            UIPasteboard.general.string = text
            call.resolve()
        }
    }
}

// Receives the resolved central CSS caption role; no second native size policy.
@objc(FlashNFlipTypographyPlugin)
private final class FlashNFlipTypographyPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "FlashNFlipTypographyPlugin"
    let jsName = "FlashNFlipTypography"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "apply", returnType: CAPPluginReturnPromise)]
    var onApply: ((CGFloat) -> Void)?

    @objc func apply(_ call: CAPPluginCall) {
        guard let size = call.getDouble("captionSize"), size.isFinite, size >= 1, size <= 256 else {
            call.reject("Invalid caption size")
            return
        }
        DispatchQueue.main.async { [weak self] in
            self?.onApply?(CGFloat(size))
            call.resolve()
        }
    }
}

@objc(FlashNFlipCloudInventoryPlugin)
private final class FlashNFlipCloudInventoryPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "FlashNFlipCloudInventoryPlugin"
    let jsName = "FlashNFlipCloudInventory"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "accountStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readRecords", returnType: CAPPluginReturnPromise)
    ]

    // Plugin registration must not initialize CloudKit before availability checks.
    private lazy var container = CKContainer(identifier: "iCloud.com.flash-n-flip")
    private let maximumRecordsPerRequest = 200
    private let desiredKeys = ["schemaVersion", "payload"]

    @objc func accountStatus(_ call: CAPPluginCall) {
        container.accountStatus { status, error in
            guard error == nil else {
                call.reject("System iCloud account status is unavailable")
                return
            }
            let value: String
            switch status {
            case .available: value = "available"
            case .noAccount: value = "noAccount"
            case .restricted: value = "restricted"
            case .couldNotDetermine: value = "couldNotDetermine"
            case .temporarilyUnavailable: value = "temporarilyUnavailable"
            @unknown default: value = "couldNotDetermine"
            }
            call.resolve(["status": value])
        }
    }

    @objc func readRecords(_ call: CAPPluginCall) {
        guard let recordNames = call.getArray("recordNames", String.self),
              !recordNames.isEmpty,
              recordNames.count <= maximumRecordsPerRequest,
              Set(recordNames).count == recordNames.count,
              recordNames.allSatisfy({ Self.validRecordName($0) })
        else {
            call.reject("Invalid CloudKit inventory record request")
            return
        }
        let zoneName = call.getString("zoneName")
        if let zoneName, !Self.validZoneName(zoneName) {
            call.reject("Invalid CloudKit inventory zone")
            return
        }
        let zoneID = zoneName.map {
            CKRecordZone.ID(zoneName: $0, ownerName: CKCurrentUserDefaultName)
        }
        let recordIDs = recordNames.map { name in
            zoneID.map { CKRecord.ID(recordName: name, zoneID: $0) }
                ?? CKRecord.ID(recordName: name)
        }
        let operation = CKFetchRecordsOperation(recordIDs: recordIDs)
        operation.desiredKeys = desiredKeys
        operation.qualityOfService = .userInitiated
        let lock = NSLock()
        var records: [[String: Any]] = []
        var firstError: Error?
        operation.perRecordResultBlock = { _, result in
            lock.lock()
            defer { lock.unlock() }
            switch result {
            case .success(let record):
                guard let payload = record["payload"] as? String else {
                    firstError = firstError ?? NSError(
                        domain: "FlashNFlipCloudInventory",
                        code: 1
                    )
                    return
                }
                records.append([
                    "recordName": record.recordID.recordName,
                    "payload": payload
                ])
            case .failure(let error):
                if let cloudError = error as? CKError,
                   cloudError.code == .unknownItem {
                    return
                }
                firstError = firstError ?? error
            }
        }
        operation.fetchRecordsResultBlock = { result in
            lock.lock()
            let error = firstError
            let resolvedRecords = records.sorted {
                ($0["recordName"] as? String ?? "") <
                    ($1["recordName"] as? String ?? "")
            }
            lock.unlock()
            if error != nil {
                call.reject("CloudKit inventory read failed")
                return
            }
            if case .failure = result {
                call.reject("CloudKit inventory batch failed")
                return
            }
            call.resolve(["records": resolvedRecords])
        }
        container.privateCloudDatabase.add(operation)
    }

    private static func validRecordName(_ value: String) -> Bool {
        !value.isEmpty && value.count <= 255 &&
            value.unicodeScalars.allSatisfy {
                CharacterSet.alphanumerics.contains($0) ||
                    $0 == "." || $0 == "-"
            }
    }

    private static func validZoneName(_ value: String) -> Bool {
        value.hasPrefix("fnf.") && validRecordName(value)
    }
}

private protocol FlashNFlipLaunchDelegate: AnyObject {
    func webAppDidBecomeReady()
}

@objc(FlashNFlipLaunchPlugin)
private final class FlashNFlipLaunchPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "FlashNFlipLaunchPlugin"
    let jsName = "FlashNFlipLaunch"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "ready", returnType: CAPPluginReturnPromise)
    ]

    weak var launchDelegate: FlashNFlipLaunchDelegate?

    @objc func ready(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.launchDelegate?.webAppDidBecomeReady()
            call.resolve()
        }
    }
}

private protocol FlashNFlipNavigationDelegate: AnyObject {
    func navigationDidChange(
        tabId: String,
        pathname: String,
        connectionState: String
    )
}

@objc(FlashNFlipNavigationPlugin)
private final class FlashNFlipNavigationPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "FlashNFlipNavigationPlugin"
    let jsName = "FlashNFlipNavigation"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "routeChanged", returnType: CAPPluginReturnPromise)
    ]

    weak var navigationDelegate: FlashNFlipNavigationDelegate?
    private var requestId = 0
    private var lastRouteKey = ""
    private var webIsReady = false
    private var pendingTabId: String?
    private var contentBottomInset = 0

    @objc func getState(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else {
                call.reject("Native navigation is unavailable")
                return
            }
            call.resolve([
                "enabled": true,
                "contractVersion": nativeNavigationContractVersion,
                "contentBottomInset": self.contentBottomInset
            ])
        }
    }

    @objc func routeChanged(_ call: CAPPluginCall) {
        guard call.getInt("contractVersion") == nativeNavigationContractVersion,
              let tabId = call.getString("tabId"),
              nativeTabIds.contains(tabId),
              let pathname = call.getString("pathname"),
              pathname.hasPrefix("/"),
              pathname.count <= 2_048,
              let connectionState = call.getString("connectionState")
        else {
            call.reject("Invalid native navigation state")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self else {
                call.reject("Native navigation is unavailable")
                return
            }

            let routeKey = "\(tabId):\(pathname):\(connectionState)"
            if routeKey != self.lastRouteKey {
                self.lastRouteKey = routeKey
                self.navigationDelegate?.navigationDidChange(
                    tabId: tabId,
                    pathname: pathname,
                    connectionState: connectionState
                )
            }
            self.webIsReady = true
            if let pendingTabId = self.pendingTabId {
                self.pendingTabId = nil
                self.emitNavigationRequest(tabId: pendingTabId)
            }
            call.resolve()
        }
    }

    func requestNavigation(tabId: String) {
        guard nativeTabIds.contains(tabId) else { return }
        guard webIsReady else {
            pendingTabId = tabId
            return
        }
        emitNavigationRequest(tabId: tabId)
    }

    func updateContentBottomInset(_ inset: CGFloat) {
        let roundedInset = max(0, Int(ceil(inset)))
        guard roundedInset != contentBottomInset else { return }
        contentBottomInset = roundedInset
        guard webIsReady else { return }
        notifyListeners("layoutChanged", data: [
            "contentBottomInset": roundedInset
        ])
    }

    private func emitNavigationRequest(tabId: String) {
        requestId += 1
        notifyListeners("navigate", data: [
            "contractVersion": nativeNavigationContractVersion,
            "tabId": tabId,
            "requestId": requestId
        ])
    }
}

private final class FlashNFlipWeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    private weak var delegate: WKScriptMessageHandler?

    init(delegate: WKScriptMessageHandler) {
        self.delegate = delegate
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}

private final class FlashNFlipWebView: WKWebView {
    // Suppress WebKit's iPad form toolbar on Mac through UIResponder's public
    // accessory hook. Leave the actual keyboard/input view untouched: replacing
    // it breaks UIKit's Mac input-assistant layout after selection and copying.
    // Text selection, hardware typing and iPhone/iPad accessories stay intact.
    override var inputAccessoryView: UIView? {
        ProcessInfo.processInfo.isiOSAppOnMac ? nil : super.inputAccessoryView
    }
}

private final class FlashNFlipBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {
    private static let textEntryMessageName = "flashNFlipTextEntry"
    // Adapted from Pianoforte's WebKit input-overlay fix (d60bc30 / 202ed1c).
    private static let textEntryBridgeScript = """
    (() => {
      if (window.__flashNFlipSyncTextEntry) {
        window.__flashNFlipSyncTextEntry();
        return;
      }
      const selector = [
        'input:not([type])', 'input[type="text"]', 'input[type="search"]',
        'input[type="number"]', 'input[type="email"]', 'input[type="url"]',
        'input[type="tel"]', 'input[type="password"]', 'select', 'textarea',
        '[contenteditable="true"]', '[contenteditable="plaintext-only"]'
      ].join(',');
      let scheduled = false;
      let previous;
      let previousFocused;
      const editable = element => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return !element.matches(':disabled, [readonly]') &&
          !element.closest('[inert], [aria-hidden="true"]') &&
          rect.width > 0 && rect.height > 0 &&
          style.display !== 'none' && style.visibility !== 'hidden';
      };
      window.__flashNFlipHasFocusedTextEntry = () => {
        const active = document.activeElement;
        return Boolean(active?.matches(selector) && editable(active));
      };
      const sync = () => {
        const enabled = Array.from(document.querySelectorAll(selector)).some(editable);
        const focused = window.__flashNFlipHasFocusedTextEntry();
        const mac = document.documentElement?.dataset.appleInterfacePlatform === 'mac';
        if (enabled === previous && (!mac || focused === previousFocused)) return;
        previous = enabled;
        previousFocused = focused;
        window.webkit?.messageHandlers?.flashNFlipTextEntry?.postMessage(enabled);
      };
      const scheduleSync = () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => { scheduled = false; sync(); });
      };
      window.__flashNFlipSyncTextEntry = scheduleSync;
      const observer = new MutationObserver(scheduleSync);
      observer.observe(document, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'disabled', 'readonly',
          'contenteditable', 'type', 'inert', 'aria-hidden', 'open']
      });
      for (const eventName of ['click', 'transitionend']) {
        document.addEventListener(eventName, scheduleSync, true);
      }
      for (const eventName of ['focusin', 'focusout']) {
        document.addEventListener(eventName, () => {
          if (document.documentElement?.dataset.appleInterfacePlatform === 'mac') sync();
          else scheduleSync();
        }, true);
      }
      window.addEventListener('resize', scheduleSync);
      scheduleSync();
    })();
    """

    private var textEntryMessageHandler: FlashNFlipWeakScriptMessageHandler?
    private var textEntryEnabled: Bool?
    private var textEntryGeneration = 0
    private var macKeyboardCleanupPending = false

    let launchPlugin = FlashNFlipLaunchPlugin()
    let navigationPlugin = FlashNFlipNavigationPlugin()
    let typographyPlugin = FlashNFlipTypographyPlugin()
    var nativeTabBarEnabled = false

    override func instanceDescriptor() -> InstanceDescriptor {
        let descriptor = super.instanceDescriptor()
        if ProcessInfo.processInfo.isiOSAppOnMac {
            // CAPBridgeViewController otherwise focuses WebKit again in
            // viewDidAppear, after the read-only text-entry policy ran.
            descriptor.hasInitialFocus = false
        }
        return descriptor
    }

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        FlashNFlipWebView(frame: frame, configuration: configuration)
    }

    override var canBecomeFirstResponder: Bool {
        ProcessInfo.processInfo.isiOSAppOnMac || super.canBecomeFirstResponder
    }

    override var keyCommands: [UIKeyCommand]? {
        guard ProcessInfo.processInfo.isiOSAppOnMac, isFirstResponder,
              presentedViewController == nil, parent?.presentedViewController == nil else {
            return super.keyCommands
        }
        let navigationCommands = [
            " ", "\r", UIKeyCommand.inputEscape,
            UIKeyCommand.inputLeftArrow, UIKeyCommand.inputRightArrow,
            UIKeyCommand.inputUpArrow, UIKeyCommand.inputDownArrow,
            UIKeyCommand.inputHome, UIKeyCommand.inputEnd,
            UIKeyCommand.inputPageUp, UIKeyCommand.inputPageDown
        ].map { input in
            let command = UIKeyCommand(input: input, modifierFlags: [], action: #selector(handleMacKeyCommand(_:)))
            command.wantsPriorityOverSystemBehavior = true
            return command
        }
        let copy = UIKeyCommand(input: "c", modifierFlags: .command, action: #selector(copyMacSelection(_:)))
        copy.wantsPriorityOverSystemBehavior = true
        return navigationCommands + [copy]
    }

    private let webSurfaceColor = UIColor(
        red: 247.0 / 255.0,
        green: 246.0 / 255.0,
        blue: 242.0 / 255.0,
        alpha: 1.0
    )

    override func webViewConfiguration(
        for instanceConfiguration: InstanceConfiguration
    ) -> WKWebViewConfiguration {
        let configuration = super.webViewConfiguration(for: instanceConfiguration)
        if nativeTabBarEnabled {
            let capabilityBootstrap = """
            (() => {
              const activate = () => {
                if (!document.documentElement) return false;
                document.documentElement.dataset.nativeTabBar = 'true';
                window.__FLASH_N_FLIP_NATIVE_NAVIGATION__ = Object.freeze({ version: 1 });
                return true;
              };
              if (!activate()) {
                const observer = new MutationObserver(() => {
                  if (activate()) observer.disconnect();
                });
                observer.observe(document, { childList: true, subtree: true });
              }
            })();
            """
            configuration.userContentController.addUserScript(
                WKUserScript(
                    source: capabilityBootstrap,
                    injectionTime: .atDocumentStart,
                    forMainFrameOnly: true
                )
            )
        }
        configuration.userContentController.addUserScript(WKUserScript(
            source: typographyScript(), injectionTime: .atDocumentStart, forMainFrameOnly: true
        ))
        return configuration
    }

    private func typographyScript() -> String {
        let profile = ProcessInfo.processInfo.isiOSAppOnMac ? "desktop"
            : UIDevice.current.userInterfaceIdiom == .pad ? "tablet" : "phone"
        let systemScale = UIFont.preferredFont(forTextStyle: .body).pointSize / 17.0
        return """
        (() => {
          const activate = () => {
            const root = document.documentElement;
            if (!root) return false;
            root.dataset.nativeTypographyProfile = '\(profile)';
            if ('\(profile)' === 'desktop') root.dataset.appleInterfacePlatform = 'mac';
            root.style.setProperty('--system-text-scale', '\(systemScale)');
            window.dispatchEvent(new Event('flash-n-flip:system-typography'));
            return true;
          };
          if (!activate()) {
            const observer = new MutationObserver(() => { if (activate()) observer.disconnect(); });
            observer.observe(document, {childList: true, subtree: true});
          }
        })();
        """
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        if previousTraitCollection?.preferredContentSizeCategory != traitCollection.preferredContentSizeCategory {
            webView?.evaluateJavaScript(typographyScript(), completionHandler: nil)
        }
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(launchPlugin)
        bridge?.registerPluginInstance(typographyPlugin)
        bridge?.registerPluginInstance(FlashNFlipIdentityPlugin())
        bridge?.registerPluginInstance(FlashNFlipCloudInventoryPlugin())
        bridge?.registerPluginInstance(FlashNFlipCloudLibraryPlugin())
        bridge?.registerPluginInstance(FlashNFlipSyncPlugin())
        bridge?.registerPluginInstance(FlashNFlipStudyBadgePlugin())
        bridge?.registerPluginInstance(FlashNFlipFileExportPlugin())
        bridge?.registerPluginInstance(FlashNFlipClipboardPlugin())
        if nativeTabBarEnabled {
            bridge?.registerPluginInstance(navigationPlugin)
        }
        installTextEntryPolicy()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == Self.textEntryMessageName, message.frameInfo.isMainFrame,
              let enabled = message.body as? Bool,
              let webView = bridge?.webView
        else { return }
        let visibilityChanged = textEntryEnabled != enabled
        textEntryEnabled = enabled
        textEntryGeneration &+= 1
        // Mac learners must be able to select and copy read-only card text even
        // when no input is visible. Keep the touch input-overlay policy intact.
        if visibilityChanged {
            webView.configuration.preferences.isTextInteractionEnabled =
                ProcessInfo.processInfo.isiOSAppOnMac || enabled
        }
        if ProcessInfo.processInfo.isiOSAppOnMac {
            if visibilityChanged && !enabled {
                webView.endEditing(true)
                becomeFirstResponder()
            } else {
                requestMacKeyboardCleanup()
            }
            return
        }
        guard visibilityChanged, !enabled else { return }

        // Disabling the preference alone leaves an existing WKContentView input
        // session alive. End it when the last form closes, as in Pianoforte.
        webView.evaluateJavaScript("document.activeElement?.blur?.(); window.focus();") { [weak self, weak webView] _, _ in
            guard let self, let webView, self.textEntryEnabled == false else { return }
            webView.endEditing(true)
            if ProcessInfo.processInfo.isiOSAppOnMac {
                self.becomeFirstResponder()
            }
        }
    }

    private func installTextEntryPolicy() {
        guard textEntryMessageHandler == nil, let webView = bridge?.webView else { return }
        webView.configuration.preferences.isTextInteractionEnabled =
            ProcessInfo.processInfo.isiOSAppOnMac
        webView.inputAssistantItem.leadingBarButtonGroups = []
        webView.inputAssistantItem.trailingBarButtonGroups = []
        let handler = FlashNFlipWeakScriptMessageHandler(delegate: self)
        let controller = webView.configuration.userContentController
        controller.add(handler, name: Self.textEntryMessageName)
        controller.addUserScript(WKUserScript(
            source: Self.textEntryBridgeScript, injectionTime: .atDocumentEnd, forMainFrameOnly: true
        ))
        textEntryMessageHandler = handler
        webView.evaluateJavaScript(Self.textEntryBridgeScript, completionHandler: nil)
        if ProcessInfo.processInfo.isiOSAppOnMac {
            NotificationCenter.default.addObserver(
                self, selector: #selector(macKeyboardDidShow(_:)),
                name: UIResponder.keyboardDidShowNotification, object: nil
            )
            NotificationCenter.default.addObserver(
                self, selector: #selector(macKeyboardDidShow(_:)),
                name: UIResponder.keyboardDidChangeFrameNotification, object: nil
            )
        }
    }

    @objc private func macKeyboardDidShow(_ notification: Notification) {
        requestMacKeyboardCleanup()
    }

    private func containsFirstResponder(_ view: UIView) -> Bool {
        view.isFirstResponder || view.subviews.contains(where: containsFirstResponder)
    }

    private func requestMacKeyboardCleanup() {
        guard ProcessInfo.processInfo.isiOSAppOnMac,
              !isFirstResponder, !macKeyboardCleanupPending,
              view.window?.isKeyWindow == true,
              presentedViewController == nil, parent?.presentedViewController == nil,
              let webView = bridge?.webView, containsFirstResponder(webView) else { return }
        // Selection and graph focus can reopen a UIKit input session without
        // changing the page's form visibility. Recheck DOM focus after UIKit's
        // transition so a newly focused real editor is never dismissed.
        macKeyboardCleanupPending = true
        let generation = textEntryGeneration
        webView.evaluateJavaScript("window.__flashNFlipHasFocusedTextEntry?.() ?? true") { [weak self, weak webView] result, _ in
            guard let self else { return }
            self.macKeyboardCleanupPending = false
            guard generation == self.textEntryGeneration else {
                self.requestMacKeyboardCleanup()
                return
            }
            guard let webView, self.view.window?.isKeyWindow == true,
                  self.presentedViewController == nil, self.parent?.presentedViewController == nil,
                  self.containsFirstResponder(webView),
                  let editing = result as? Bool, !editing else { return }
            // Do not blur the DOM: the selected range must remain copyable.
            webView.endEditing(true)
            self.becomeFirstResponder()
        }
    }

    @objc private func copyMacSelection(_ command: UIKeyCommand) {
        guard ProcessInfo.processInfo.isiOSAppOnMac, isFirstResponder,
              let webView = bridge?.webView else { return }
        // The controller owns keyboard commands while the read-only WebView
        // is out of UIKit's input session. Keep Cmd+C for its DOM selection.
        webView.evaluateJavaScript("window.getSelection()?.toString() ?? ''") { [weak self] result, error in
            guard self?.isFirstResponder == true, error == nil,
                  let text = result as? String, !text.isEmpty else { return }
            UIPasteboard.general.string = text
        }
    }

    @objc private func handleMacKeyCommand(_ command: UIKeyCommand) {
        guard ProcessInfo.processInfo.isiOSAppOnMac, isFirstResponder,
              let input = command.input, let webView = bridge?.webView
        else { return }
        let keys = [
            " ": " ", "\r": "Enter", UIKeyCommand.inputEscape: "Escape",
            UIKeyCommand.inputLeftArrow: "ArrowLeft", UIKeyCommand.inputRightArrow: "ArrowRight",
            UIKeyCommand.inputUpArrow: "ArrowUp", UIKeyCommand.inputDownArrow: "ArrowDown",
            UIKeyCommand.inputHome: "Home", UIKeyCommand.inputEnd: "End",
            UIKeyCommand.inputPageUp: "PageUp", UIKeyCommand.inputPageDown: "PageDown"
        ]
        guard let key = keys[input],
              let data = try? JSONSerialization.data(withJSONObject: ["key": key, "code": key == " " ? "Space" : key, "bubbles": true]),
              let json = String(data: data, encoding: .utf8)
        else { return }
        webView.evaluateJavaScript("""
        (() => {
          const payload = \(json);
          const target = document.activeElement ?? document;
          const event = new KeyboardEvent('keydown', {...payload, cancelable: true});
          if (target.dispatchEvent(event) && [' ', 'Enter'].includes(payload.key) &&
              target.matches?.('button, summary, a[href]')) target.click();
        })();
        """)
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        view.backgroundColor = webSurfaceColor
        webView?.backgroundColor = webSurfaceColor
        webView?.scrollView.backgroundColor = webSurfaceColor
        webView?.scrollView.bounces = false
        webView?.scrollView.alwaysBounceHorizontal = false
        webView?.scrollView.alwaysBounceVertical = false
        webView?.scrollView.showsHorizontalScrollIndicator = false
        webView?.scrollView.showsVerticalScrollIndicator = false
    }

    deinit {
        NotificationCenter.default.removeObserver(self, name: UIResponder.keyboardDidShowNotification, object: nil)
        NotificationCenter.default.removeObserver(self, name: UIResponder.keyboardDidChangeFrameNotification, object: nil)
        bridge?.webView?.configuration.userContentController.removeScriptMessageHandler(forName: Self.textEntryMessageName)
    }
}

private final class FlashNFlipNativeShellViewController: UIViewController,
    UITabBarDelegate,
    FlashNFlipLaunchDelegate,
    FlashNFlipNavigationDelegate
{
    private let bridgeViewController = FlashNFlipBridgeViewController()
    private let tabBar = UITabBar()
    private let usesNativeTabBar = !ProcessInfo.processInfo.isiOSAppOnMac
    private let launchOverlay = UIView()
    private let minimumLaunchOverlayDuration: TimeInterval = 1.2
    private var launchOverlayInstalledAt = ProcessInfo.processInfo.systemUptime
    private var launchOverlayDismissalScheduled = false
    private var tabBarHeightConstraint: NSLayoutConstraint?

    private var captionSize: CGFloat = 12

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        bridgeViewController.typographyPlugin.onApply = { [weak self] size in
            guard let self else { return }
            self.captionSize = size
            let selected = self.tabBar.selectedItem?.tag ?? 0
            self.tabBar.items = self.makeTabItems()
            self.tabBar.selectedItem = self.tabBar.items?.first(where: { $0.tag == selected })
            self.updateTabBarHeight()
        }
        bridgeViewController.launchPlugin.launchDelegate = self
        bridgeViewController.nativeTabBarEnabled = usesNativeTabBar
        if usesNativeTabBar {
            bridgeViewController.navigationPlugin.navigationDelegate = self
        }
        addChild(bridgeViewController)
        bridgeViewController.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bridgeViewController.view)
        bridgeViewController.didMove(toParent: self)

        NSLayoutConstraint.activate([
            bridgeViewController.view.topAnchor.constraint(equalTo: view.topAnchor),
            bridgeViewController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bridgeViewController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bridgeViewController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        if usesNativeTabBar {
            tabBar.translatesAutoresizingMaskIntoConstraints = false
            tabBar.delegate = self
            tabBar.items = makeTabItems()
            tabBar.selectedItem = tabBar.items?.first
            view.addSubview(tabBar)

            let tabBarHeightConstraint = tabBar.heightAnchor.constraint(equalToConstant: 49)
            self.tabBarHeightConstraint = tabBarHeightConstraint
            NSLayoutConstraint.activate([
                tabBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
                tabBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
                tabBar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
                tabBarHeightConstraint
            ])
        }
        installLaunchOverlay()
        updateTabBarHeight()
        updateLocalAccessibilityValue(connectionState: "disconnected")
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        updateTabBarHeight()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        updateTabBarHeight()
    }

    override var childForStatusBarStyle: UIViewController? {
        bridgeViewController
    }

    override var childForStatusBarHidden: UIViewController? {
        bridgeViewController
    }

    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        guard nativeTabIds.indices.contains(item.tag) else { return }
        bridgeViewController.navigationPlugin.requestNavigation(
            tabId: nativeTabIds[item.tag]
        )
    }

    func navigationDidChange(
        tabId: String,
        pathname: String,
        connectionState: String
    ) {
        guard let index = nativeTabIds.firstIndex(of: tabId),
              let item = tabBar.items?[index]
        else { return }
        if tabBar.selectedItem !== item {
            tabBar.selectedItem = item
        }
        dismissLaunchOverlayIfNeeded()
        updateLocalAccessibilityValue(connectionState: connectionState)
    }

    func webAppDidBecomeReady() {
        dismissLaunchOverlayIfNeeded()
    }

    private func installLaunchOverlay() {
        launchOverlayInstalledAt = ProcessInfo.processInfo.systemUptime
        launchOverlayDismissalScheduled = false
        launchOverlay.translatesAutoresizingMaskIntoConstraints = false
        launchOverlay.backgroundColor = .black
        launchOverlay.accessibilityViewIsModal = true
        view.addSubview(launchOverlay)

        let titleLabel = UILabel()
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.text = "Flash-n-Flip"
        titleLabel.textAlignment = .center
        titleLabel.textColor = .white
        titleLabel.font = UIFont.systemFont(ofSize: 40, weight: .bold)
        titleLabel.adjustsFontSizeToFitWidth = true
        titleLabel.minimumScaleFactor = 0.8

        let logoView = UIImageView(image: UIImage(named: "Splash"))
        logoView.translatesAutoresizingMaskIntoConstraints = false
        logoView.contentMode = .scaleAspectFit
        logoView.isAccessibilityElement = false

        let mottoLabel = UILabel()
        mottoLabel.translatesAutoresizingMaskIntoConstraints = false
        mottoLabel.text = "Flash, Flip and Remember"
        mottoLabel.textAlignment = .center
        mottoLabel.textColor = UIColor(
            red: 216.0 / 255.0,
            green: 217.0 / 255.0,
            blue: 221.0 / 255.0,
            alpha: 1.0
        )
        mottoLabel.font = UIFont.systemFont(ofSize: 22, weight: .semibold)
        mottoLabel.numberOfLines = 2
        mottoLabel.adjustsFontSizeToFitWidth = true
        mottoLabel.minimumScaleFactor = 0.8

        let versionLabel = UILabel()
        versionLabel.translatesAutoresizingMaskIntoConstraints = false
        let displayVersion = Bundle.main.object(forInfoDictionaryKey: "FNFDisplayVersion") as? String ?? ""
        versionLabel.text = displayVersion
        versionLabel.textAlignment = .center
        versionLabel.textColor = UIColor(white: 0.65, alpha: 1)
        versionLabel.font = UIFont.systemFont(ofSize: captionSize)

        launchOverlay.addSubview(titleLabel)
        launchOverlay.addSubview(logoView)
        launchOverlay.addSubview(mottoLabel)
        launchOverlay.addSubview(versionLabel)
        launchOverlay.accessibilityLabel = "Flash-n-Flip. Flash, Flip and Remember. Version \(displayVersion)."
        launchOverlay.isAccessibilityElement = true

        let safeArea = launchOverlay.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            launchOverlay.topAnchor.constraint(equalTo: view.topAnchor),
            launchOverlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            launchOverlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            launchOverlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            logoView.widthAnchor.constraint(equalToConstant: 240),
            logoView.heightAnchor.constraint(equalToConstant: 240),
            logoView.centerXAnchor.constraint(equalTo: launchOverlay.centerXAnchor),
            logoView.centerYAnchor.constraint(equalTo: safeArea.centerYAnchor, constant: -40),
            titleLabel.leadingAnchor.constraint(greaterThanOrEqualTo: safeArea.leadingAnchor, constant: 24),
            titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: safeArea.trailingAnchor, constant: -24),
            titleLabel.centerXAnchor.constraint(equalTo: launchOverlay.centerXAnchor),
            logoView.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 32),
            mottoLabel.leadingAnchor.constraint(greaterThanOrEqualTo: safeArea.leadingAnchor, constant: 24),
            mottoLabel.trailingAnchor.constraint(lessThanOrEqualTo: safeArea.trailingAnchor, constant: -24),
            mottoLabel.centerXAnchor.constraint(equalTo: launchOverlay.centerXAnchor),
            mottoLabel.topAnchor.constraint(equalTo: logoView.bottomAnchor, constant: 32),
            versionLabel.centerXAnchor.constraint(equalTo: mottoLabel.centerXAnchor),
            versionLabel.topAnchor.constraint(equalTo: mottoLabel.bottomAnchor, constant: 8)
        ])
    }

    private func dismissLaunchOverlayIfNeeded() {
        guard launchOverlay.superview != nil,
              !launchOverlayDismissalScheduled
        else { return }

        let elapsed = ProcessInfo.processInfo.systemUptime - launchOverlayInstalledAt
        let remaining = minimumLaunchOverlayDuration - elapsed
        guard remaining > 0 else {
            removeLaunchOverlay()
            return
        }

        launchOverlayDismissalScheduled = true
        DispatchQueue.main.asyncAfter(deadline: .now() + remaining) { [weak self] in
            self?.removeLaunchOverlay()
        }
    }

    private func removeLaunchOverlay() {
        guard launchOverlay.superview != nil else { return }
        launchOverlay.removeFromSuperview()
        UIAccessibility.post(notification: .screenChanged, argument: bridgeViewController.view)
    }

    private func makeTabItems() -> [UITabBarItem] {
        let overviewImage = UIImage(named: "OverviewTab")?.withRenderingMode(.alwaysTemplate)
        let definitions: [(String, String, UIImage?)] = [
            (localized("Today", "Heute"), "overview", overviewImage),
            (localized("My decks", "Meine Decks"), "decks", UIImage(systemName: "rectangle.stack")),
            (localized("Discover", "Entdecken"), "discover", UIImage(systemName: "safari")),
            (localized("Settings", "Einstellungen"), "local", UIImage(systemName: "gearshape"))
        ]
        let titleFont = UIFont.systemFont(ofSize: captionSize, weight: .semibold)
        return definitions.enumerated().map { index, definition in
            let item = UITabBarItem(title: definition.0, image: definition.2, tag: index)
            item.setTitleTextAttributes([.font: titleFont], for: .normal)
            item.setTitleTextAttributes([.font: titleFont], for: .selected)
            item.accessibilityIdentifier = "native-tab-\(definition.1)"
            item.accessibilityLabel = definition.0
            return item
        }
    }

    private func localized(_ english: String, _ german: String) -> String {
        Locale.preferredLanguages.first?.lowercased().hasPrefix("de") == true
            ? german
            : english
    }

    private func updateTabBarHeight() {
        guard usesNativeTabBar, view.bounds.width > 0 else { return }
        let fittedHeight = tabBar.sizeThatFits(
            CGSize(width: view.bounds.width, height: .greatestFiniteMagnitude)
        ).height
        let protectedHeight = max(49, 24 + captionSize * 2) + view.safeAreaInsets.bottom
        let height = max(fittedHeight, protectedHeight)
        if tabBarHeightConstraint?.constant != height {
            tabBarHeightConstraint?.constant = height
        }
        bridgeViewController.navigationPlugin.updateContentBottomInset(height)
    }

    private func updateLocalAccessibilityValue(connectionState: String) {
        guard let localIndex = nativeTabIds.firstIndex(of: "local"),
              let localItem = tabBar.items?[localIndex]
        else { return }
        let value: String
        switch connectionState {
        case "synced":
            value = localized("Connected and synchronized", "Verbunden und abgeglichen")
        case "syncing", "transport-connected":
            value = localized("Synchronization in progress", "Abgleich läuft")
        case "error":
            value = localized("Synchronization error", "Abgleichfehler")
        default:
            value = localized("Not connected", "Nicht verbunden")
        }
        localItem.accessibilityValue = value
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = FlashNFlipNativeShellViewController()
        window?.makeKeyAndVisible()
    }
}
