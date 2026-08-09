import Capacitor
import CloudKit
import CryptoKit
import Foundation
import Security

private struct StoredDeviceIdentity: Codable {
    let id: String
    let privateKey: String
}

@objc(FlashNFlipAppleCloudPlugin)
public final class FlashNFlipAppleCloudPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FlashNFlipAppleCloudPlugin"
    public let jsName = "FlashNFlipAppleCloud"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "accountStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getOrCreateRecoveryKey", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "uploadEncryptedBackup", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "downloadLatestEncryptedBackup", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteEncryptedBackup", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createFamilyLibrary", returnType: CAPPluginReturnPromise)
    ]

    private let container = CKContainer(identifier: "iCloud.com.flash-n-flip")
    private let zoneID = CKRecordZone.ID(zoneName: "FlashNFlipPrivateBackupV1", ownerName: CKCurrentUserDefaultName)
    private let recoveryService = "com.flash-n-flip.icloud-recovery-key.v1"
    private let recoveryAccount = "private-library"
    private let maximumEncryptedBackupBytes = 512 * 1024 * 1024

    @objc public func accountStatus(_ call: CAPPluginCall) {
        container.accountStatus { status, error in
            if let error {
                call.reject("Der iCloud-Status konnte nicht ermittelt werden.", nil, error)
                return
            }
            let value: String
            switch status {
            case .available: value = "AVAILABLE"
            case .noAccount: value = "NO_ACCOUNT"
            case .restricted: value = "RESTRICTED"
            case .couldNotDetermine: value = "COULD_NOT_DETERMINE"
            case .temporarilyUnavailable: value = "UNAVAILABLE"
            @unknown default: value = "COULD_NOT_DETERMINE"
            }
            guard status == .available else {
                call.resolve(["status": value])
                return
            }
            self.container.fetchUserRecordID { recordID, recordError in
                if let recordError {
                    call.reject("Der iCloud-Account konnte nicht bestätigt werden.", nil, recordError)
                    return
                }
                guard let recordName = recordID?.recordName,
                      let bytes = recordName.data(using: .utf8) else {
                    call.reject("Der iCloud-Account besitzt keine stabile Kennung.")
                    return
                }
                let token = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
                call.resolve(["status": value, "accountToken": token])
            }
        }
    }

    @objc public func getOrCreateRecoveryKey(_ call: CAPPluginCall) {
        do {
            let key = try loadOrCreateRecoveryKey()
            call.resolve(["keyBase64": key.base64EncodedString(), "storage": "ICLOUD_KEYCHAIN"])
        } catch {
            NSLog("FlashNFlipAppleCloud recovery key failed: %@", error.localizedDescription)
            call.reject("Der iCloud-Schlüsselbund ist nicht verfügbar.", nil, error)
        }
    }

    @objc public func uploadEncryptedBackup(_ call: CAPPluginCall) {
        guard let json = call.getString("envelope"),
              let data = json.data(using: .utf8),
              data.count > 0,
              data.count <= maximumEncryptedBackupBytes,
              json.contains("flash-n-flip-encrypted-cloud-backup"),
              !json.contains("flash-n-flip-local-backup") else {
            call.reject("Nur eine gültige verschlüsselte Backup-Hülle darf iCloud erreichen.")
            return
        }
        let temporaryURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("flash-n-flip-\(UUID().uuidString).backup")
        do {
            try data.write(to: temporaryURL, options: [.atomic, .completeFileProtection])
        } catch {
            call.reject("Das verschlüsselte Backup konnte nicht vorbereitet werden.", nil, error)
            return
        }
        ensureZone { [weak self] error in
            guard let self else { return }
            if let error {
                try? FileManager.default.removeItem(at: temporaryURL)
                call.reject("Der private iCloud-Bereich ist nicht verfügbar.", nil, error)
                return
            }
            let recordID = CKRecord.ID(recordName: "latest-encrypted-backup", zoneID: self.zoneID)
            let record = CKRecord(recordType: "EncryptedBackup", recordID: recordID)
            record["payload"] = CKAsset(fileURL: temporaryURL)
            record["updatedAt"] = Date() as CKRecordValue
            record["formatVersion"] = 1 as CKRecordValue
            self.container.privateCloudDatabase.save(record) { saved, error in
                try? FileManager.default.removeItem(at: temporaryURL)
                if let error {
                    call.reject("Das verschlüsselte Backup konnte nicht in iCloud gespeichert werden.", nil, error)
                    return
                }
                call.resolve(["recordName": saved?.recordID.recordName ?? recordID.recordName])
            }
        }
    }

    @objc public func downloadLatestEncryptedBackup(_ call: CAPPluginCall) {
        let recordID = CKRecord.ID(recordName: "latest-encrypted-backup", zoneID: zoneID)
        container.privateCloudDatabase.fetch(withRecordID: recordID) { record, error in
            if let cloudError = error as? CKError, cloudError.code == .unknownItem {
                call.resolve(["envelope": NSNull()])
                return
            }
            guard error == nil,
                  let url = (record?["payload"] as? CKAsset)?.fileURL else {
                call.reject("Das iCloud-Backup konnte nicht geladen werden.", nil, error)
                return
            }
            do {
                let data = try Data(contentsOf: url, options: [.mappedIfSafe])
                guard data.count <= self.maximumEncryptedBackupBytes,
                      let json = String(data: data, encoding: .utf8),
                      json.contains("flash-n-flip-encrypted-cloud-backup"),
                      !json.contains("flash-n-flip-local-backup") else {
                    throw NSError(domain: "FlashNFlipAppleCloud", code: 2)
                }
                call.resolve(["envelope": json])
            } catch {
                call.reject("Das iCloud-Backup ist ungültig oder zu groß.", nil, error)
            }
        }
    }

    @objc public func deleteEncryptedBackup(_ call: CAPPluginCall) {
        let recordID = CKRecord.ID(recordName: "latest-encrypted-backup", zoneID: zoneID)
        container.privateCloudDatabase.delete(withRecordID: recordID) { _, error in
            if let cloudError = error as? CKError, cloudError.code == .unknownItem {
                call.resolve()
            } else if let error {
                call.reject("Das iCloud-Backup konnte nicht gelöscht werden.", nil, error)
            } else {
                call.resolve()
            }
        }
    }

    @objc public func createFamilyLibrary(_ call: CAPPluginCall) {
        let title = call.getString("title")?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !title.isEmpty, title.count <= 120 else {
            call.reject("Der Name der Familienbibliothek ist ungültig.")
            return
        }
        ensureZone { [weak self] error in
            guard let self else { return }
            if let error {
                call.reject("Der private iCloud-Bereich ist nicht verfügbar.", nil, error)
                return
            }
            let libraryId = UUID().uuidString.lowercased()
            let rootID = CKRecord.ID(recordName: "family-library-\(libraryId)", zoneID: self.zoneID)
            let root = CKRecord(recordType: "FamilyLibrary", recordID: rootID)
            root["libraryId"] = libraryId as CKRecordValue
            root["title"] = title as CKRecordValue
            root["formatVersion"] = 1 as CKRecordValue
            let share = CKShare(rootRecord: root)
            share[CKShare.SystemFieldKey.title] = title as CKRecordValue
            share.publicPermission = .none
            let operation = CKModifyRecordsOperation(recordsToSave: [root, share])
            operation.savePolicy = .ifServerRecordUnchanged
            operation.modifyRecordsResultBlock = { result in
                switch result {
                case .success:
                    guard let shareURL = share.url else {
                        call.reject("Der private Familienlink wurde nicht erzeugt.")
                        return
                    }
                    call.resolve([
                        "libraryId": libraryId,
                        "title": title,
                        "role": "OWNER",
                        "permission": "READ_WRITE",
                        "shareUrl": shareURL.absoluteString
                    ])
                case .failure(let error):
                    call.reject("Die Familienbibliothek konnte nicht freigegeben werden.", nil, error)
                }
            }
            self.container.privateCloudDatabase.add(operation)
        }
    }

    private func ensureZone(completion: @escaping (Error?) -> Void) {
        let zone = CKRecordZone(zoneID: zoneID)
        container.privateCloudDatabase.save(zone) { _, error in
            if let cloudError = error as? CKError, cloudError.code == .serverRejectedRequest {
                completion(error)
                return
            }
            completion(error)
        }
    }

    private func recoveryQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: recoveryService,
            kSecAttrAccount as String: recoveryAccount,
            kSecAttrSynchronizable as String: true
        ]
    }

    private func loadOrCreateRecoveryKey() throws -> Data {
        var query = recoveryQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecSuccess, let key = result as? Data, key.count == 32 { return key }
        if status != errSecItemNotFound {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
        }
        var bytes = [UInt8](repeating: 0, count: 32)
        let randomStatus = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard randomStatus == errSecSuccess else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(randomStatus))
        }
        let key = Data(bytes)
        var insert = recoveryQuery()
        insert[kSecValueData as String] = key
        insert[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let insertStatus = SecItemAdd(insert as CFDictionary, nil)
        if insertStatus == errSecDuplicateItem { return try loadOrCreateRecoveryKey() }
        guard insertStatus == errSecSuccess else {
            throw NSError(domain: NSOSStatusErrorDomain, code: Int(insertStatus))
        }
        return key
    }
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
