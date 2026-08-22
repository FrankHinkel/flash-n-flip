import UIKit
import WebKit
import Capacitor

private let nativeNavigationContractVersion = 1
private let nativeTabIds = ["overview", "decks", "discover", "local"]
private let expandedAppleInterfaceScale: CGFloat = 1.5

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

private final class FlashNFlipBridgeViewController: CAPBridgeViewController {
    let launchPlugin = FlashNFlipLaunchPlugin()
    let navigationPlugin = FlashNFlipNavigationPlugin()
    var nativeTabBarEnabled = false

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
        if !ProcessInfo.processInfo.isiOSAppOnMac && UIDevice.current.userInterfaceIdiom == .pad {
            let textScaleBootstrap = """
            (() => {
              const activate = () => {
                if (!document.documentElement || !document.body) return false;
                for (const element of [document.documentElement, document.body]) {
                  element.style.setProperty('-webkit-text-size-adjust', '150%', 'important');
                  element.style.setProperty('text-size-adjust', '150%', 'important');
                }
                document.documentElement.dataset.appleInterfaceScale = 'expanded';
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
                    source: textScaleBootstrap,
                    injectionTime: .atDocumentStart,
                    forMainFrameOnly: true
                )
            )
        }
        return configuration
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(launchPlugin)
        bridge?.registerPluginInstance(FlashNFlipIdentityPlugin())
        bridge?.registerPluginInstance(FlashNFlipAudioPlugin())
        bridge?.registerPluginInstance(FlashNFlipStudyBadgePlugin())
        bridge?.registerPluginInstance(FlashNFlipFileExportPlugin())
        if nativeTabBarEnabled {
            bridge?.registerPluginInstance(navigationPlugin)
        }
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
        if ProcessInfo.processInfo.isiOSAppOnMac {
            webView?.pageZoom = expandedAppleInterfaceScale
        }
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

    private var interfaceScale: CGFloat {
        ProcessInfo.processInfo.isiOSAppOnMac || traitCollection.userInterfaceIdiom == .pad
            ? expandedAppleInterfaceScale
            : 1.0
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

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

        launchOverlay.addSubview(titleLabel)
        launchOverlay.addSubview(logoView)
        launchOverlay.addSubview(mottoLabel)
        launchOverlay.accessibilityLabel = "Flash-n-Flip. Flash, Flip and Remember."
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
            mottoLabel.topAnchor.constraint(equalTo: logoView.bottomAnchor, constant: 32)
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
            (localized("Overview", "Übersicht"), "overview", overviewImage),
            (localized("Decks", "Decks"), "decks", UIImage(systemName: "rectangle.stack")),
            (localized("Discover", "Entdecken"), "discover", UIImage(systemName: "safari")),
            (localized("Local", "Lokal"), "local", UIImage(systemName: "gearshape"))
        ]
        let titleFont = UIFont.systemFont(ofSize: 12 * interfaceScale, weight: .semibold)
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
        let protectedHeight = 49 * interfaceScale + view.safeAreaInsets.bottom
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
