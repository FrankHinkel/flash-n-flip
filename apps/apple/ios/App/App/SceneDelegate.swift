import UIKit
import Capacitor

private final class FlashNFlipBridgeViewController: CAPBridgeViewController {
    private let webSurfaceColor = UIColor(
        red: 247.0 / 255.0,
        green: 246.0 / 255.0,
        blue: 242.0 / 255.0,
        alpha: 1.0
    )

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
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = FlashNFlipBridgeViewController()
        window?.makeKeyAndVisible()

    }
}
