import Foundation
import Capacitor
import CloudKit

// Registered only after the explicit build activation gate is enabled.
// This transport does not own scheduling, migration, deletion or merge rules.
@objc(FlashNFlipCloudLibraryPlugin)
public final class FlashNFlipCloudLibraryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FlashNFlipCloudLibraryPlugin"
    public let jsName = "FlashNFlipCloudLibrary"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "accountStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "configuration", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readRecord", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "compareAndSwap", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createLibraryZone", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readZoneRecord", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "atomicRecords", returnType: CAPPluginReturnPromise)
    ]

    private let container = CKContainer(identifier: "iCloud.com.flash-n-flip")
    @objc func configuration(_ call: CAPPluginCall) {
        #if DEBUG
        call.resolve(["environment": "development"])
        #else
        call.resolve(["environment": "production"])
        #endif
    }
    private let recordType = "FlashNFlipLibraryV1"
    private let maximumPayloadBytes = 200 * 1024

    private struct TransportError: Error {
        let code: String
    }

    private func account() async throws -> String {
        guard Bundle.main.object(forInfoDictionaryKey: "FNFCloudLibraryEnabled") as? Bool == true else {
            throw TransportError(code: "NOT_CONFIGURED")
        }
        guard try await container.accountStatus() == .available else {
            throw TransportError(code: "AUTHENTICATION_REQUIRED")
        }
        return try await container.userRecordID().recordName
    }

    private func assertAccount(_ expected: String) async throws {
        guard !expected.isEmpty, try await account() == expected else {
            throw TransportError(code: "ACCOUNT_CHANGED")
        }
    }

    private func reject(_ call: CAPPluginCall, _ error: Error) {
        // CloudKit may wrap the single conditional-save failure in a partial
        // failure. Preserve the underlying conflict code for the shared retry.
        if let cloud = error as? CKError, cloud.code == .partialFailure,
           let failures = cloud.partialErrorsByItemID,
           let underlying = failures.values.first(where: { ($0 as? CKError)?.code == .serverRecordChanged })
             ?? failures.values.first(where: { ($0 as? CKError)?.code != .batchRequestFailed }) {
            reject(call, underlying)
            return
        }
        let code: String
        if let transport = error as? TransportError {
            code = transport.code
        } else if let cloud = error as? CKError {
            switch cloud.code {
            case .serverRecordChanged: code = "WRITE_CONFLICT"
            case .notAuthenticated: code = "AUTHENTICATION_REQUIRED"
            case .permissionFailure: code = "ACCESS_DENIED"
            case .quotaExceeded: code = "QUOTA_EXCEEDED"
            case .networkFailure, .networkUnavailable, .serviceUnavailable: code = "SERVICE_UNAVAILABLE"
            case .requestRateLimited, .zoneBusy: code = "RETRY_LATER"
            default: code = "CLOUDKIT_ERROR"
            }
        } else {
            code = "CLOUDKIT_ERROR"
        }
        // Do not log record payloads, account IDs or token-bearing error details.
        call.reject("iCloud library request failed: \(code)", code)
    }

    private func recordName(_ call: CAPPluginCall) throws -> String {
        guard let name = call.getString("recordName"),
              name.range(of: "^[a-zA-Z0-9.-]{1,255}$", options: .regularExpression) != nil else {
            throw TransportError(code: "INVALID_RECORD_NAME")
        }
        return name
    }

    private func fetch(_ name: String) async throws -> CKRecord? {
        do {
            return try await container.privateCloudDatabase.record(for: CKRecord.ID(recordName: name))
        } catch let error as CKError where error.code == .unknownItem {
            return nil
        }
    }

    private func encode(_ record: CKRecord) throws -> JSObject {
        guard record.recordType == recordType,
              let payload = record["payload"] as? String,
              payload.utf8.count <= maximumPayloadBytes,
              (record["schemaVersion"] as? NSNumber)?.intValue == 1,
              let tag = record.recordChangeTag, !tag.isEmpty else {
            throw TransportError(code: "INVALID_REMOTE_RECORD")
        }
        return ["payload": payload, "changeTag": tag]
    }

    @objc public func accountStatus(_ call: CAPPluginCall) {
        Task {
            do { call.resolve(["accountToken": try await account()]) }
            catch { reject(call, error) }
        }
    }

    @objc public func readRecord(_ call: CAPPluginCall) {
        Task {
            do {
                let name = try recordName(call)
                let expected = call.getString("accountToken") ?? ""
                try await assertAccount(expected)
                let record = try await fetch(name)
                try await assertAccount(expected)
                if let record { call.resolve(["record": try encode(record)]) }
                else { call.resolve(["record": NSNull()]) }
            } catch { reject(call, error) }
        }
    }

    @objc public func compareAndSwap(_ call: CAPPluginCall) {
        Task {
            do {
                let name = try recordName(call)
                let expected = call.getString("accountToken") ?? ""
                let expectedTag = call.getString("expectedTag")
                guard let payload = call.getString("payload"), payload.utf8.count <= maximumPayloadBytes,
                      let bytes = payload.data(using: .utf8) else {
                    throw TransportError(code: "INVALID_PAYLOAD")
                }
                _ = try JSONSerialization.jsonObject(with: bytes, options: [.fragmentsAllowed])
                try await assertAccount(expected)
                let existing = try await fetch(name)
                if let existing {
                    guard let expectedTag, !expectedTag.isEmpty, existing.recordChangeTag == expectedTag,
                          existing.recordType == recordType else {
                        throw TransportError(code: "WRITE_CONFLICT")
                    }
                } else if expectedTag != nil {
                    throw TransportError(code: "WRITE_CONFLICT")
                }
                let record = existing ?? CKRecord(recordType: recordType, recordID: CKRecord.ID(recordName: name))
                record["schemaVersion"] = NSNumber(value: 1)
                record["payload"] = payload as NSString
                try await assertAccount(expected)
                let saved: CKRecord = try await withCheckedThrowingContinuation { continuation in
                    let operation = CKModifyRecordsOperation(recordsToSave: [record], recordIDsToDelete: nil)
                    operation.savePolicy = .ifServerRecordUnchanged
                    operation.isAtomic = false
                    operation.modifyRecordsCompletionBlock = { records, _, error in
                        if let error { continuation.resume(throwing: error) }
                        else if let saved = records?.first { continuation.resume(returning: saved) }
                        else { continuation.resume(throwing: TransportError(code: "INCOMPLETE_RESPONSE")) }
                    }
                    self.container.privateCloudDatabase.add(operation)
                }
                try await assertAccount(expected)
                call.resolve(["record": try encode(saved)])
            } catch { reject(call, error) }
        }
    }

    private func libraryZone(_ call: CAPPluginCall) throws -> CKRecordZone.ID {
        guard let name = call.getString("zoneName"),
              name.range(of: "^fnf\\.[0-9a-fA-F-]{36}\\.[0-9a-fA-F-]{36}$", options: .regularExpression) != nil else {
            throw TransportError(code: "INVALID_ZONE")
        }
        return CKRecordZone.ID(zoneName: name, ownerName: CKCurrentUserDefaultName)
    }

    @objc public func createLibraryZone(_ call: CAPPluginCall) {
        Task {
            do {
                let expected = call.getString("accountToken") ?? ""
                let zoneID = try libraryZone(call)
                try await assertAccount(expected)
                let zone = try await container.privateCloudDatabase.save(CKRecordZone(zoneID: zoneID))
                guard zone.zoneID == zoneID, zone.capabilities.contains(.atomic) else {
                    throw TransportError(code: "ATOMIC_ZONE_REQUIRED")
                }
                try await assertAccount(expected)
                call.resolve(["created": true])
            } catch { reject(call, error) }
        }
    }

    @objc public func readZoneRecord(_ call: CAPPluginCall) {
        Task {
            do {
                let expected = call.getString("accountToken") ?? ""
                let id = CKRecord.ID(recordName: try recordName(call), zoneID: try libraryZone(call))
                try await assertAccount(expected)
                let record: CKRecord?
                do { record = try await container.privateCloudDatabase.record(for: id) }
                catch let error as CKError where error.code == .unknownItem { record = nil }
                try await assertAccount(expected)
                if let record { call.resolve(["record": try encode(record)]) }
                else { call.resolve(["record": NSNull()]) }
            } catch { reject(call, error) }
        }
    }

    @objc public func atomicRecords(_ call: CAPPluginCall) {
        Task {
            do {
                let expected = call.getString("accountToken") ?? ""
                let zoneID = try libraryZone(call)
                guard let inputs = call.getArray("operations", JSObject.self), !inputs.isEmpty, inputs.count <= 100 else {
                    throw TransportError(code: "INVALID_BATCH")
                }
                try await assertAccount(expected)
                let zone = try await container.privateCloudDatabase.recordZone(for: zoneID)
                guard zone.capabilities.contains(.atomic) else { throw TransportError(code: "ATOMIC_ZONE_REQUIRED") }
                var names = Set<String>()
                var saves = [CKRecord]()
                var deletes = [CKRecord.ID]()
                var guarded = false
                var totalBytes = 0
                for input in inputs {
                    guard let name = input["name"] as? String,
                          name.range(of: "^[a-zA-Z0-9.-]{1,255}$", options: .regularExpression) != nil,
                          names.insert(name).inserted, let kind = input["kind"] as? String else {
                        throw TransportError(code: "INVALID_BATCH")
                    }
                    let id = CKRecord.ID(recordName: name, zoneID: zoneID)
                    if kind == "delete" { deletes.append(id); continue }
                    guard kind == "save", let payload = input["payload"] as? String,
                          payload.utf8.count <= maximumPayloadBytes, let data = payload.data(using: .utf8) else {
                        throw TransportError(code: "INVALID_PAYLOAD")
                    }
                    totalBytes += data.count
                    guard totalBytes <= 1024 * 1024 else { throw TransportError(code: "INVALID_BATCH") }
                    _ = try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
                    let existing: CKRecord?
                    do { existing = try await container.privateCloudDatabase.record(for: id) }
                    catch let error as CKError where error.code == .unknownItem { existing = nil }
                    let tag = input["expectedTag"] as? String
                    if let existing {
                        guard let tag, !tag.isEmpty, existing.recordChangeTag == tag, existing.recordType == recordType else {
                            throw TransportError(code: "WRITE_CONFLICT")
                        }
                        guarded = true
                    } else if tag != nil { throw TransportError(code: "WRITE_CONFLICT") }
                    let record = existing ?? CKRecord(recordType: recordType, recordID: id)
                    record["schemaVersion"] = NSNumber(value: 1)
                    record["payload"] = payload as NSString
                    saves.append(record)
                }
                guard deletes.isEmpty || guarded else { throw TransportError(code: "UNGUARDED_DELETE") }
                try await assertAccount(expected)
                let saveCount = saves.count, deleteCount = deletes.count
                let _: Void = try await withCheckedThrowingContinuation { continuation in
                    let operation = CKModifyRecordsOperation(recordsToSave: saves, recordIDsToDelete: deletes)
                    operation.savePolicy = .ifServerRecordUnchanged
                    operation.isAtomic = true
                    operation.modifyRecordsCompletionBlock = { saved, deleted, error in
                        if let error { continuation.resume(throwing: error) }
                        else if (saved?.count ?? 0) == saveCount && (deleted?.count ?? 0) == deleteCount {
                            continuation.resume(returning: ())
                        } else { continuation.resume(throwing: TransportError(code: "INCOMPLETE_RESPONSE")) }
                    }
                    self.container.privateCloudDatabase.add(operation)
                }
                try await assertAccount(expected)
                call.resolve(["committed": true])
            } catch { reject(call, error) }
        }
    }
}
