import Foundation
import Capacitor
import UIKit

@objc(FlashNFlipSyncPlugin)
public final class FlashNFlipSyncPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FlashNFlipSyncPlugin"
    public let jsName = "FlashNFlipSync"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "enqueue", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "records", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "inbox", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "acknowledge", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "suppress", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "synchronize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stageAsset", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "asset", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "beginTestReset", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finishTestReset", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "eraseLegacyTestCloud", returnType: CAPPluginReturnPromise)
    ]
    private var foregroundObserver: NSObjectProtocol?
    deinit { if let foregroundObserver { NotificationCenter.default.removeObserver(foregroundObserver) } }
    public override func load() {
        foregroundObserver = NotificationCenter.default.addObserver(forName:UIApplication.didBecomeActiveNotification,object:nil,queue:.main) { _ in
            Task { await FlashNFlipSyncEngine.shared.resumeIfEnabled() }
        }
        Task {
            await FlashNFlipSyncEngine.shared.observe { [weak self] in
                DispatchQueue.main.async { self?.notifyListeners("changed", data: [:]) }
            }
        }
    }
    private func run(_ call: CAPPluginCall, _ action: @escaping () async throws -> [String: Any]) {
        Task {
            do { call.resolve(try await action()) }
            catch {
                let code = FlashNFlipSyncEngine.isExpectedCancellation(error) ? "FNF_SYNC_CANCELLED" : "FNF_SYNC"
                call.reject(error.localizedDescription, code, error)
            }
        }
    }
    @objc public func configure(_ call: CAPPluginCall) {
        run(call) { try await FlashNFlipSyncEngine.shared.configure(enable: call.getBool("enabled")) }
    }
    @objc public func status(_ call: CAPPluginCall) { run(call) { try await FlashNFlipSyncEngine.shared.status() } }
    @objc public func enqueue(_ call: CAPPluginCall) {
        run(call) {
            let data = try JSONSerialization.data(withJSONObject: call.getArray("records", JSObject.self) ?? [])
            let records = try JSONDecoder().decode([FNFEngineRecord].self, from: data)
            try await FlashNFlipSyncEngine.shared.enqueue(records)
            return [:]
        }
    }
    @objc public func records(_ call: CAPPluginCall) { run(call) { ["records": try await FlashNFlipSyncEngine.shared.records()] } }
    @objc public func inbox(_ call: CAPPluginCall) { run(call) { ["records": try await FlashNFlipSyncEngine.shared.inbox()] } }
    @objc public func acknowledge(_ call: CAPPluginCall) { run(call) { try await FlashNFlipSyncEngine.shared.acknowledge(call.getObject("hashes") as? [String:String] ?? [:]); return [:] } }
    @objc public func suppress(_ call: CAPPluginCall) { run(call) { try await FlashNFlipSyncEngine.shared.suppress(call.getArray("deckIds",String.self) ?? [], value: call.getBool("value") ?? true); return [:] } }
    @objc public func synchronize(_ call: CAPPluginCall) { run(call) { try await FlashNFlipSyncEngine.shared.synchronize(); return [:] } }
    @objc public func stageAsset(_ call: CAPPluginCall) { run(call) { try await FlashNFlipSyncEngine.shared.stageAsset(hash: call.getString("hash") ?? "", base64: call.getString("base64")); return [:] } }
    @objc public func asset(_ call: CAPPluginCall) { run(call) { ["base64": try await FlashNFlipSyncEngine.shared.asset(hash: call.getString("hash") ?? "") as Any? ?? NSNull()] } }
    @objc public func beginTestReset(_ call: CAPPluginCall) { run(call) { try await FlashNFlipSyncEngine.shared.beginTestReset(); return [:] } }
    @objc public func finishTestReset(_ call: CAPPluginCall) { run(call) { try await FlashNFlipSyncEngine.shared.finishTestReset(); return [:] } }
    @objc public func eraseLegacyTestCloud(_ call: CAPPluginCall) { run(call) { ["zones": try await FlashNFlipSyncEngine.shared.eraseLegacyTestCloud()] } }
}
