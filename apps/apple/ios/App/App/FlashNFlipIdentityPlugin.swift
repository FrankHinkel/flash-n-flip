import Capacitor
import CryptoKit
import Foundation
import Security

private struct StoredDeviceIdentity: Codable {
    let id: String
    let privateKey: String
}

@objc(FlashNFlipIdentityPlugin)
public final class FlashNFlipIdentityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FlashNFlipIdentityPlugin"
    public let jsName = "FlashNFlipIdentity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getOrCreateIdentity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sign", returnType: CAPPluginReturnPromise)
    ]

    private let service = "com.flash-n-flip.device-identity.v1"
    private let account = "current-device"

    @objc public func getOrCreateIdentity(_ call: CAPPluginCall) {
        do {
            let identity = try loadOrCreateIdentity()
            let privateKey = try signingKey(identity)
            call.resolve([
                "id": identity.id,
                "publicKey": privateKey.publicKey.derRepresentation.base64EncodedString(),
                "storage": "KEYCHAIN"
            ])
        } catch {
            NSLog("FlashNFlipIdentity getOrCreateIdentity failed: %@", error.localizedDescription)
            call.reject("Die Keychain-Geräteidentität konnte nicht geladen werden.", nil, error)
        }
    }

    @objc public func sign(_ call: CAPPluginCall) {
        guard let challenge = call.getString("challenge"),
              let data = challenge.data(using: .utf8),
              data.count <= 8_192 else {
            call.reject("Die Signaturanforderung ist ungültig.")
            return
        }
        do {
            let signature = try signingKey(loadOrCreateIdentity()).signature(for: data)
            call.resolve(["signature": signature.derRepresentation.base64EncodedString()])
        } catch {
            NSLog("FlashNFlipIdentity sign failed: %@", error.localizedDescription)
            call.reject("Die Geräteidentität konnte nicht signieren.", nil, error)
        }
    }

    private func signingKey(_ identity: StoredDeviceIdentity) throws -> P256.Signing.PrivateKey {
        guard let raw = Data(base64Encoded: identity.privateKey) else {
            throw NSError(domain: "FlashNFlipIdentity", code: 1)
        }
        return try P256.Signing.PrivateKey(rawRepresentation: raw)
    }

    private func loadOrCreateIdentity() throws -> StoredDeviceIdentity {
        do {
            if let stored = try loadIdentity() {
                _ = try signingKey(stored)
                return stored
            }
        } catch let error as NSError where error.domain == "FlashNFlipIdentity" || error.domain == NSCocoaErrorDomain {
            // A partially written or no longer decodable record must never make the
            // app unusable. It contains no user data and can safely be replaced.
            try deleteIdentity()
        }
        let key = P256.Signing.PrivateKey()
        let identity = StoredDeviceIdentity(
            id: UUID().uuidString.lowercased(),
            privateKey: key.rawRepresentation.base64EncodedString()
        )
        try storeIdentity(identity)
        return identity
    }

    private func keychainQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }

    private func loadIdentity() throws -> StoredDeviceIdentity? {
        var query = keychainQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }
        return try JSONDecoder().decode(StoredDeviceIdentity.self, from: data)
    }

    private func storeIdentity(_ identity: StoredDeviceIdentity) throws {
        let encoded = try JSONEncoder().encode(identity)
        var query = keychainQuery()
        query[kSecValueData as String] = encoded
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        var status = SecItemAdd(query as CFDictionary, nil)
        if status == errSecDuplicateItem {
            let updates: [String: Any] = [
                kSecValueData as String: encoded,
                kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            ]
            status = SecItemUpdate(keychainQuery() as CFDictionary, updates as CFDictionary)
        }
        guard status == errSecSuccess else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }
    }

    private func deleteIdentity() throws {
        let status = SecItemDelete(keychainQuery() as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }
    }
}
