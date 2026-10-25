import Foundation
import CloudKit
import CryptoKit

struct FNFEngineRecord: Codable, Sendable {
    let name: String
    let lane: String
    let revision: String
    let hash: String
    let json: String
}
private struct FNFAssetJob: Codable {
    var path: String?
    var upload: Bool
    var download: Bool
}

// Only transport concerns live here. Portable TypeScript owns hashes, entity
// validation, hierarchy, deletion policy and the scheduling projection.
actor FlashNFlipSyncEngine: CKSyncEngineDelegate {
    static let shared = FlashNFlipSyncEngine()
    private let container = CKContainer(identifier: "iCloud.com.flash-n-flip")
    private var store: FlashNFlipSyncStore?
    private var engine: CKSyncEngine?
    private var account: String?
    private var problem: String?
    private var mediaTask: Task<Void, Never>?
    private var mediaRetryTask: Task<Void, Never>?
    private var manualTask: Task<Void, Error>?
    private var resetting = false
    private var changed: (@Sendable () -> Void)?
    private let progressZone = CKRecordZone.ID(zoneName: "FNF4Progress", ownerName: CKCurrentUserDefaultName)
    private let contentZone = CKRecordZone.ID(zoneName: "FNF4Content", ownerName: CKCurrentUserDefaultName)
    private let assetZone = CKRecordZone.ID(zoneName: "FNF4Assets", ownerName: CKCurrentUserDefaultName)
    private var database: CKDatabase { container.privateCloudDatabase }

    private func journal() throws -> FlashNFlipSyncStore {
        if let store { return store }
        let opened = try FlashNFlipSyncStore()
        store = opened
        return opened
    }
    func observe(_ listener: @escaping @Sendable () -> Void) { changed = listener }
    private func notify() { changed?() }
    private func zone(_ lane: String) -> CKRecordZone.ID { lane == "progress" ? progressZone : contentZone }
    private func id(_ record: FNFEngineRecord) -> CKRecord.ID { CKRecord.ID(recordName: record.name, zoneID: zone(record.lane)) }
    private func archive(_ record: CKRecord) throws -> Data {
        let encoder = NSKeyedArchiver(requiringSecureCoding: true)
        record.encodeSystemFields(with: encoder)
        encoder.finishEncoding()
        return encoder.encodedData
    }
    private func ckRecord(_ value: FNFEngineRecord) throws -> CKRecord {
        let saved: Data? = try journal().get("system", value.name)
        let record: CKRecord
        if let saved {
            let decoder = try NSKeyedUnarchiver(forReadingFrom: saved)
            decoder.requiresSecureCoding = true
            guard let decoded = CKRecord(coder: decoder) else { throw issue("Invalid CloudKit system fields") }
            record = decoded
        } else { record = CKRecord(recordType: "FNFEntityV4", recordID: id(value)) }
        record["json"] = value.json as CKRecordValue
        record["hash"] = value.hash as CKRecordValue
        record["revision"] = value.revision as CKRecordValue
        record["lane"] = value.lane as CKRecordValue
        return record
    }
    private func decode(_ record: CKRecord) throws -> FNFEngineRecord {
        guard record.recordType == "FNFEntityV4", let json = record["json"] as? String,
              let hash = record["hash"] as? String, let revision = record["revision"] as? String,
              let lane = record["lane"] as? String, ["content", "progress"].contains(lane),
              record.recordID.zoneID == zone(lane), json.utf8.count <= 900_000 else { throw issue("Invalid CloudKit record") }
        return FNFEngineRecord(name: record.recordID.recordName, lane: lane, revision: revision, hash: hash, json: json)
    }
    private func issue(_ message: String) -> NSError { NSError(domain: "FNFSync", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
    private func accountToken() async throws -> String {
        #if !DEBUG
        let internalTesting = Bundle.main.object(forInfoDictionaryKey:"FNFDistributionChannel") as? String == "testflight-internal"
        guard internalTesting || Bundle.main.object(forInfoDictionaryKey:"FNFCloudLibraryEnabled") as? Bool == true else {
            throw issue("iCloud ist für diesen Release-Build noch nicht freigegeben.")
        }
        #endif
        guard try await container.accountStatus() == .available else { throw issue("Bitte bei iCloud anmelden.") }
        return try await container.userRecordID().recordName
    }
    func configure(enable: Bool?) async throws -> [String: Any] {
        let store = try journal()
        resetting = try store.get("meta","resetting") ?? false
        if resetting && enable != false { return try await status() }
        if enable == false {
            try store.put("meta", "enabled", false)
            await engine?.cancelOperations()
            engine = nil
            mediaTask?.cancel(); mediaTask = nil
            mediaRetryTask?.cancel(); mediaRetryTask = nil
            notify()
            return try await status()
        }
        let bound: String? = try store.get("meta", "account")
        let wasEnabled: Bool = try store.get("meta", "enabled") ?? false
        // Resume offline without turning a network lookup into a prerequisite
        // for the durable local outbox. CKSyncEngine reports account changes.
        let token: String
        if enable == nil, wasEnabled, let bound { token = bound }
        else { token = try await accountToken() }
        account = token
        if let bound, bound != token { throw issue("Anderer iCloud-Account. Bitte die lokale Bibliothek zuerst zurücksetzen.") }
        if enable == true {
            try store.transaction {
                try store.put("meta", "account", token)
                try store.put("meta", "enabled", true)
            }
        }
        let enabled: Bool = try store.get("meta", "enabled") ?? false
        if enabled && engine == nil {
            let state: CKSyncEngine.State.Serialization? = try store.get("meta", "engine-state")
            var config = CKSyncEngine.Configuration(database: database, stateSerialization: state, delegate: self)
            config.automaticallySync = true
            let sync = CKSyncEngine(config)
            engine = sync
            sync.state.add(pendingDatabaseChanges: [progressZone,contentZone,assetZone].map { .saveZone(CKRecordZone(zoneID: $0)) })
            let pending: [(String,FNFEngineRecord)] = try store.list("outbox")
            sync.state.add(pendingRecordZoneChanges: pending.map { .saveRecord(id($0.1)) })
            startMedia()
        }
        notify()
        return try await status()
    }
    func status() async throws -> [String: Any] {
        let store = try journal()
        let enabled: Bool = try store.get("meta", "enabled") ?? false

        let suppressed: [(String,Bool)] = try store.list("suppressed")
        #if DEBUG
        let development = true
        #else
        let development = false
        #endif
        return ["resetting": resetting, "development": development, "linked": (try store.get("meta","account",as:String.self)) != nil, "enabled": enabled, "account": account != nil, "progressPending": try store.count("outbox",lane:"progress"),
                "contentPending": try store.count("outbox",lane:"content"), "mediaPending": try store.pendingAssets(),
                "inboxPending": try store.count("inbox"), "suppressed": suppressed.map { $0.0 }, "problem": problem as Any? ?? NSNull(),
                "lastSuccess": (try store.get("meta", "last-success", as: String.self)) as Any? ?? NSNull()]
    }
    func enqueue(_ records: [FNFEngineRecord]) throws {
        guard !resetting else { throw issue("Testbestand wird zurückgesetzt.") }
        let store = try journal()
        let engine = self.engine
        var pending: [CKSyncEngine.PendingRecordZoneChange] = []
        try store.transaction {
            for record in records {
                guard ["progress","content"].contains(record.lane), record.json.utf8.count <= 900_000 else { throw issue("Record exceeds CloudKit limit") }
                let old: FNFEngineRecord? = try store.get("records", record.name)
                if let old, old.hash == record.hash || old.revision >= record.revision { continue }
                try store.put("records", record.name, record)
                try store.put("outbox", record.name, record)
                pending.append(.saveRecord(id(record)))
            }
        }
        engine?.state.add(pendingRecordZoneChanges: pending)
        notify()
        // Reviews explicitly wake the progress lane even while a content batch is
        // in flight. Content batches are bounded so this wait stays short.
        if let engine, records.contains(where: { $0.lane == "progress" }) {
            Task { do { try await engine.sendChanges(.init(scope: .zoneIDs([progressZone]))) } catch { self.report(error) } }
        }
    }
    func records() throws -> [String] { try journal().list("records", as: FNFEngineRecord.self).map { $0.1.json } }
    func inbox() throws -> [String] { try journal().list("inbox", as: String.self).map { $0.1 } }
    func acknowledge(_ hashes: [String: String]) throws {
        let store = try journal()
        try store.transaction {
            for (name, hash) in hashes {
                let current: FNFEngineRecord? = try store.get("records", name)
                if current?.hash == hash { try store.remove("inbox", name) }
            }
        }
        if !hashes.isEmpty { notify() }
    }
    func suppress(_ ids: [String], value: Bool) throws {
        let store = try journal()
        try store.transaction { for id in ids { if value { try store.put("suppressed",id,true) } else { try store.remove("suppressed",id) } } }
        notify()
    }
    func synchronize() async throws {
        if let manualTask { return try await manualTask.value }
        guard let engine else { return }
        let pending: [(String,FNFEngineRecord)] = try journal().list("outbox")
        engine.state.add(pendingRecordZoneChanges: pending.map { .saveRecord(id($0.1)) })
        let task = Task {
            try await engine.fetchChanges(.init(scope: .zoneIDs([progressZone, contentZone])))
            try await engine.sendChanges(.init(scope: .zoneIDs([progressZone])))
            try await engine.sendChanges(.init(scope: .zoneIDs([contentZone])))
        }
        manualTask = task
        defer { manualTask = nil; notify() }
        do {
            try await task.value
            problem = nil
            try journal().put("meta", "last-success", ISO8601DateFormatter().string(from: Date()))
            startMedia()
        } catch {
            if Self.isExpectedCancellation(error) { return }
            report(error); throw error
        }
    }
    nonisolated static func isExpectedCancellation(_ error: Error) -> Bool {
        if error is CancellationError { return true }
        if let cloud = error as? CKError, cloud.code == .operationCancelled { return true }
        let native = error as NSError
        return native.domain == NSURLErrorDomain && native.code == NSURLErrorCancelled
    }
    private func report(_ error: Error) {
        guard !Self.isExpectedCancellation(error) else { return }
        problem = error.localizedDescription
        notify()
    }

    func nextFetchChangesOptions(_ context: CKSyncEngine.FetchChangesContext, syncEngine: CKSyncEngine) async -> CKSyncEngine.FetchChangesOptions {
        var options = context.options
        options.scope = .zoneIDs([progressZone, contentZone])
        options.prioritizedZoneIDs = [progressZone]
        return options
    }
    func nextRecordZoneChangeBatch(_ context: CKSyncEngine.SendChangesContext, syncEngine: CKSyncEngine) async -> CKSyncEngine.RecordZoneChangeBatch? {
        do {
            let store = try journal()
            let allowsProgress = context.options.scope.contains(CKRecord.ID(recordName:"probe",zoneID:progressZone))
            if !allowsProgress {
                if try store.count("outbox",lane:"progress") > 0 { return nil }
            }
            let progress: [FNFEngineRecord] = allowsProgress ? try store.list("outbox", as:FNFEngineRecord.self,lane:"progress",limit:100).map { $0.1 } : []
            let selected = progress.isEmpty ? try store.list("outbox",as:FNFEngineRecord.self,lane:"content",limit:20).map { $0.1 }.filter { context.options.scope.contains(id($0)) } : progress
            var records: [CKRecord.ID: CKRecord] = [:]
            for value in selected { records[id(value)] = try ckRecord(value) }
            let prepared = records
            return await CKSyncEngine.RecordZoneChangeBatch(pendingChanges: selected.map { .saveRecord(id($0)) }) { prepared[$0] }
        } catch { report(error); return nil }
    }
    func handleEvent(_ event: CKSyncEngine.Event, syncEngine: CKSyncEngine) async {
        guard engine === syncEngine else { return }
        do {
            let store = try journal()
            switch event {
            case .stateUpdate(let update): try store.put("meta", "engine-state", update.stateSerialization)
            case .fetchedRecordZoneChanges(let changes):
                try store.transaction { for change in changes.modifications { try accept(change.record) } }
                // Protocol deletions are tombstones, never physical record deletions.
                if !changes.deletions.isEmpty { throw issue("Cloud-Datensätze wurden extern gelöscht. Bibliothek bitte neu verbinden.") }
            case .sentRecordZoneChanges(let changes):
                var retry: [CKSyncEngine.PendingRecordZoneChange] = []
                try store.transaction {
                    for saved in changes.savedRecords {
                        let sent = try decode(saved)
                        try store.put("system", sent.name, archive(saved))
                        let latest: FNFEngineRecord? = try store.get("outbox", sent.name)
                        if latest?.hash == sent.hash { try store.remove("outbox", sent.name) }
                        else if let latest { retry.append(.saveRecord(id(latest))) }
                    }
                    for failure in changes.failedRecordSaves {
                        if failure.error.code == .serverRecordChanged, let server = failure.error.serverRecord {
                            try accept(server)
                            if let local: FNFEngineRecord = try store.get("outbox",server.recordID.recordName) { retry.append(.saveRecord(id(local))) }
                        }
                        else if failure.error.code == .zoneNotFound {
                            syncEngine.state.add(pendingDatabaseChanges: [.saveZone(CKRecordZone(zoneID: failure.record.recordID.zoneID))])
                            try store.remove("system", failure.record.recordID.recordName)
                            retry.append(.saveRecord(failure.record.recordID))
                        } else if !Self.isExpectedCancellation(failure.error) { problem = failure.error.localizedDescription }
                    }
                }
                // A newer edit may have been queued while this batch was sent.
                syncEngine.state.add(pendingRecordZoneChanges: retry)
            case .accountChange(let change):
                let matchesBinding: Bool
                if case .signIn(let user) = change.changeType {
                    let bound: String? = try store.get("meta", "account")
                    matchesBinding = bound == user.recordName
                } else { matchesBinding = false }
                if !matchesBinding {
                    try store.put("meta", "enabled", false)
                    account = nil
                    problem = "iCloud-Account geändert. Lokale Daten bleiben erhalten."
                    await syncEngine.cancelOperations()
                    engine = nil
                }
            case .fetchedDatabaseChanges(let changes):
                if changes.deletions.contains(where: { [progressZone,contentZone].contains($0.zoneID) }) {
                    throw issue("Die iCloud-Bibliothek wurde zurückgesetzt. Bitte den lokalen Testbestand zurücksetzen.")
                }
            case .didFetchChanges, .didSendChanges: startMedia()
            case .sentDatabaseChanges(let changes):
                if let failure = changes.failedZoneSaves.first(where: { !Self.isExpectedCancellation($0.error) }) { problem = failure.error.localizedDescription }
            default: break
            }
            notify()
        } catch {
            if Self.isExpectedCancellation(error) { return }
            // Never advance an engine token after a failed durable inbox write.
            report(error)
            await syncEngine.cancelOperations()
            engine = nil
        }
    }
    private func accept(_ record: CKRecord) throws {
        let value = try decode(record)
        let store = try journal()
        try store.put("system", value.name, archive(record))
        let local: FNFEngineRecord? = try store.get("records", value.name)
        if let local, local.revision > value.revision {
            try store.put("outbox", local.name, local)
        } else {
            try store.put("records", value.name, value)
            try store.put("inbox", value.name, value.json)
            try store.remove("outbox", value.name)
        }
    }

    private func assetDirectory() throws -> URL {
        let directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("fnf-cloud-assets-v4", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }
    func stageAsset(hash: String, base64: String?) throws {
        guard !resetting else { throw issue("Testbestand wird zurückgesetzt.") }
        guard hash.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { throw issue("Invalid media hash") }
        let store = try journal()
        var job: FNFAssetJob = try store.get("assets",hash) ?? FNFAssetJob(path: nil,upload: false,download: false)
        if let base64 {
            guard let data = Data(base64Encoded: base64), SHA256.hash(data: data).map({ String(format: "%02x", $0) }).joined() == hash else { throw issue("Media hash mismatch") }
            let path = try assetDirectory().appendingPathComponent(hash)
            try data.write(to: path, options: .atomic)
            job.path = path.path
            let uploaded: Bool = try store.get("uploaded-assets", hash) ?? false
            job.upload = !uploaded
            job.download = false
        } else if job.path == nil {
            if job.download { return }
            job.download = true
        }
        try store.put("assets", hash, job)
        startMedia()
    }
    func asset(hash: String) throws -> String? {
        guard let job: FNFAssetJob = try journal().get("assets",hash), let path = job.path else { return nil }
        return try Data(contentsOf: URL(fileURLWithPath:path)).base64EncodedString()
    }
    private func startMedia() {
        guard engine != nil, mediaTask == nil else { return }
        do {
            if let deadline: Date = try journal().get("meta","media-retry-after"), deadline > Date() {
                scheduleMediaRetry(deadline)
                return
            }
        } catch { report(error); return }
        mediaTask = Task {
            defer { mediaTask = nil; notify() }
            do {
                let jobs: [(String,FNFAssetJob)] = try journal().list("assets")
                for (hash,var job) in jobs where job.upload || job.download {
                    try Task.checkCancellation()
                    guard engine != nil else { return }
                    let recordID = CKRecord.ID(recordName: hash, zoneID: assetZone)
                    if job.upload, let path = job.path {
                        let record = CKRecord(recordType: "FNFAssetV4", recordID: recordID)
                        record["asset"] = CKAsset(fileURL: URL(fileURLWithPath: path))
                        record["sha256"] = hash as CKRecordValue
                        // Content-addressed: retrying this immutable blob is safe.
                        let result = try await database.modifyRecords(saving: [record], deleting: [], savePolicy: .allKeys, atomically: false)
                        guard let saved = result.saveResults[recordID] else { throw issue("Incomplete asset upload") }
                        _ = try saved.get()
                        try journal().put("uploaded-assets",hash,true)
                        job.upload = false
                    } else if job.download {
                        let record = try await database.record(for: recordID)
                        guard let asset = record["asset"] as? CKAsset, let url = asset.fileURL else { throw issue("Missing CloudKit asset") }
                        let data = try Data(contentsOf: url)
                        guard SHA256.hash(data: data).map({ String(format: "%02x", $0) }).joined() == hash else { throw issue("Downloaded media hash mismatch") }
                        let target = try assetDirectory().appendingPathComponent(hash)
                        try data.write(to: target, options: .atomic)
                        job.path = target.path; job.download = false
                    }
                    try journal().put("assets",hash,job)
                    problem = nil
                    try journal().put("meta","media-retry-count",0)
                    notify()
                }
            } catch {
                if Self.isExpectedCancellation(error) { return }
                report(error)
                do {
                    let attempt: Int = (try journal().get("meta","media-retry-count") ?? 0) + 1
                    let requested = (error as? CKError)?.retryAfterSeconds ?? 0
                    let delay = max(requested,min(300,pow(2,Double(min(attempt,8)))))
                    let deadline = Date().addingTimeInterval(delay)
                    try journal().put("meta","media-retry-count",attempt)
                    try journal().put("meta","media-retry-after",deadline)
                    scheduleMediaRetry(deadline)
                } catch { report(error) }
            }
        }
    }
    private func scheduleMediaRetry(_ deadline: Date) {
        guard mediaRetryTask == nil else { return }
        mediaRetryTask = Task {
            do { try await Task.sleep(for:.seconds(max(0,deadline.timeIntervalSinceNow))) }
            catch { return }
            mediaRetryTask = nil
            startMedia()
        }
    }

    func resumeIfEnabled() async {
        do {
            let enabled: Bool = try journal().get("meta","enabled") ?? false
            guard enabled else { return }
            _ = try await configure(enable:nil)
            try await synchronize()
        } catch { report(error) }
    }

    func beginTestReset() async throws {
        #if DEBUG
        resetting = true
        try journal().transaction {
            try journal().put("meta","resetting",true)
            try journal().put("meta","enabled",false)
        }
        let previous = engine
        engine = nil
        manualTask?.cancel()
        mediaTask?.cancel()
        mediaRetryTask?.cancel()
        await previous?.cancelOperations()
        if let manualTask { _ = await manualTask.result }
        if let mediaTask { await mediaTask.value }
        manualTask = nil; mediaTask = nil; mediaRetryTask = nil
        problem = nil
        notify()
        #else
        throw issue("Test reset is only available in development builds")
        #endif
    }
    func finishTestReset() throws {
        #if DEBUG
        try journal().transaction {
            try journal().execute("DELETE FROM journal")
            try journal().put("meta","enabled",false)
        }
        let assets = try assetDirectory()
        try FileManager.default.removeItem(at:assets)
        try journal().execute("VACUUM")
        resetting = false; account = nil; problem = nil
        notify()
        #else
        throw issue("Test reset is only available in development builds")
        #endif
    }

    // Development reset is deliberately independent from the old ledger/chunk
    // protocol, which may be broken or incomplete. No migration of test data.
    func eraseLegacyTestCloud() async throws -> [String] {
        #if DEBUG
        try await beginTestReset()
        let token = try await accountToken()
        let zones = try await database.allRecordZones()
        let legacy = zones.filter { $0.zoneID.zoneName.hasPrefix("fnf.") || $0.zoneID.zoneName.hasPrefix("FlashNFlip") || $0.zoneID.zoneName.hasPrefix("FNF4") }
        var removed: [String] = []
        for zone in legacy {
            _ = try await database.deleteRecordZone(withID: zone.zoneID)
            removed.append(zone.zoneID.zoneName)
        }
        // V1 roots/catalog were stored in the default zone. Enumerate only the
        // old FNF record type. The FNF4 test zones are removed above as well.
        var cursor: CKQueryOperation.Cursor?
        repeat {
            let page: (matchResults: [(CKRecord.ID, Result<CKRecord, Error>)], queryCursor: CKQueryOperation.Cursor?)
            if let current = cursor { page = try await database.records(continuingMatchFrom: current, desiredKeys: [], resultsLimit: 200) }
            else { page = try await database.records(matching: CKQuery(recordType: "FlashNFlipLibraryV1", predicate: NSPredicate(value: true)), inZoneWith: CKRecordZone.default().zoneID, desiredKeys: [], resultsLimit: 200) }
            let ids = try page.matchResults.map { id,result in _ = try result.get(); return id }
            if !ids.isEmpty {
                let result = try await database.modifyRecords(saving: [], deleting: ids, atomically: false)
                for id in ids { guard let result = result.deleteResults[id] else { throw issue("Incomplete cloud deletion") }; try result.get() }
            }
            cursor = page.queryCursor
        } while cursor != nil
        guard try await accountToken() == token else { throw issue("iCloud account changed during reset") }
        // Keep the reset fence until the authoritative local database is empty.
        try journal().transaction {
            try journal().execute("DELETE FROM journal")
            try journal().put("meta","resetting",true)
            try journal().put("meta","enabled",false)
        }
        return removed
        #else
        throw issue("Test reset is only available in development builds")
        #endif
    }
}
