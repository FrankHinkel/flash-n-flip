// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FlashcardsAppleWebrtc",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "FlashcardsAppleWebrtc",
            targets: ["FlashcardsAppleWebrtc"])
    ],
    dependencies: [
        .package(
            url: "https://github.com/ionic-team/capacitor-swift-pm.git",
            exact: "8.0.0"),
        .package(
            url: "https://github.com/stasel/WebRTC.git",
            exact: "150.0.0")
    ],
    targets: [
        .target(
            name: "FlashcardsAppleWebrtc",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "WebRTC", package: "WebRTC")
            ],
            path: "ios/Sources")
    ]
)
