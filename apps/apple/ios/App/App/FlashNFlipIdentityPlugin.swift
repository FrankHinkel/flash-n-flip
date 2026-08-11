import Capacitor
import AVFoundation
import CloudKit
import CryptoKit
import Foundation
import Security

@objc(FlashNFlipAudioPlugin)
public final class FlashNFlipAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FlashNFlipAudioPlugin"
    public let jsName = "FlashNFlipAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "begin", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "appendInput", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "optimizeFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readOutput", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cleanup", returnType: CAPPluginReturnPromise)
    ]

    private let worker = DispatchQueue(label: "com.flash-n-flip.audio-import", qos: .utility)
    private let sampleRate = 24_000.0
    private let targetLoudness = -18.0
    private let maximumPeak = -1.5
    private let maximumInputBytes = 16 * 1024 * 1024

    private struct Metrics {
        var samples = 0
        var squareSum = 0.0
        var peak = 0.0
        var firstAudibleSample: Int?
        var lastAudibleSample: Int?

        var duration: Double { Double(samples) / 24_000.0 }
        var loudness: Double {
            guard samples > 0 else { return -100 }
            return 20 * log10(max(sqrt(squareSum / Double(samples)), 0.000_01))
        }
        var peakDb: Double { 20 * log10(max(peak, 0.000_01)) }
    }

    private func directory(_ jobId: String) -> URL? {
        guard UUID(uuidString: jobId) != nil else { return nil }
        return FileManager.default.temporaryDirectory
            .appendingPathComponent("flash-n-flip-audio-\(jobId)", isDirectory: true)
    }

    @objc public func begin(_ call: CAPPluginCall) {
        guard let jobId = call.getString("jobId"), let directory = directory(jobId) else {
            call.reject("Invalid audio job")
            return
        }
        let fileExtension = call.getString("fileExtension")?.lowercased() ?? "audio"
        guard fileExtension.range(of: "^[a-z0-9]{1,8}$", options: .regularExpression) != nil else {
            call.reject("Invalid audio extension")
            return
        }
        do {
            try? FileManager.default.removeItem(at: directory)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            FileManager.default.createFile(
                atPath: directory.appendingPathComponent("input.\(fileExtension)").path,
                contents: Data()
            )
            call.resolve()
        } catch {
            call.reject("Audio job could not be prepared", nil, error)
        }
    }

    @objc public func appendInput(_ call: CAPPluginCall) {
        guard let jobId = call.getString("jobId"),
              let directory = directory(jobId),
              let encoded = call.getString("dataBase64"),
              encoded.count <= 96 * 1024,
              let bytes = Data(base64Encoded: encoded),
              bytes.count <= 48 * 1024,
              let inputURL = try? FileManager.default.contentsOfDirectory(
                at: directory,
                includingPropertiesForKeys: nil
              ).first(where: { $0.lastPathComponent.hasPrefix("input.") }),
              let handle = try? FileHandle(forWritingTo: inputURL)
        else {
            call.reject("Invalid audio input chunk")
            return
        }
        do {
            try handle.seekToEnd()
            try handle.write(contentsOf: bytes)
            try handle.close()
            let size = (try inputURL.resourceValues(forKeys: [.fileSizeKey])).fileSize ?? 0
            guard size <= maximumInputBytes else {
                throw NSError(domain: "FlashNFlipAudio", code: 20, userInfo: [
                    NSLocalizedDescriptionKey: "Audio exceeds the 16 MiB local policy"
                ])
            }
            call.resolve(["receivedBytes": bytes.count, "totalBytes": size])
        } catch {
            try? handle.close()
            call.reject("Audio input chunk could not be stored", nil, error)
        }
    }

    @objc public func optimizeFile(_ call: CAPPluginCall) {
        guard let jobId = call.getString("jobId"), let directory = directory(jobId) else {
            call.reject("Invalid audio job")
            return
        }
        worker.async { [weak self] in
            guard let self else { return }
            if ProcessInfo.processInfo.isLowPowerModeEnabled || ProcessInfo.processInfo.thermalState.rawValue >= ProcessInfo.ThermalState.serious.rawValue {
                call.reject("Audio optimization is paused to protect battery and temperature")
                return
            }
            do {
                let inputURL = try FileManager.default.contentsOfDirectory(
                    at: directory,
                    includingPropertiesForKeys: nil
                ).first(where: { $0.lastPathComponent.hasPrefix("input.") })!
                let result = try self.transcode(inputURL: inputURL, directory: directory)
                call.resolve(result)
            } catch {
                call.reject("Audio optimization failed", nil, error)
            }
        }
    }

    @objc public func readOutput(_ call: CAPPluginCall) {
        guard let jobId = call.getString("jobId"), let directory = directory(jobId) else {
            call.reject("Invalid audio job")
            return
        }
        let offset = max(0, call.getInt("offset") ?? 0)
        let length = min(48 * 1024, max(1, call.getInt("length") ?? 48 * 1024))
        let outputURL = directory.appendingPathComponent("optimized.m4a")
        do {
            let handle = try FileHandle(forReadingFrom: outputURL)
            try handle.seek(toOffset: UInt64(offset))
            let data = try handle.read(upToCount: length) ?? Data()
            try handle.close()
            call.resolve(["dataBase64": data.base64EncodedString(), "eof": data.count < length])
        } catch {
            call.reject("Optimized audio could not be read", nil, error)
        }
    }

    @objc public func cleanup(_ call: CAPPluginCall) {
        guard let jobId = call.getString("jobId"), let directory = directory(jobId) else {
            call.reject("Invalid audio job")
            return
        }
        try? FileManager.default.removeItem(at: directory)
        call.resolve()
    }

    private func pcmOutput(for track: AVAssetTrack) -> AVAssetReaderTrackOutput {
        AVAssetReaderTrackOutput(track: track, outputSettings: [
            AVFormatIDKey: kAudioFormatLinearPCM,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsNonInterleaved: false,
            AVSampleRateKey: sampleRate,
            AVNumberOfChannelsKey: 1
        ])
    }

    private func samples(in sampleBuffer: CMSampleBuffer, _ operation: (UnsafeMutableBufferPointer<Int16>) -> Void) throws {
        var blockBuffer: CMBlockBuffer?
        var audioBufferList = AudioBufferList()
        let status = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
            sampleBuffer,
            bufferListSizeNeededOut: nil,
            bufferListOut: &audioBufferList,
            bufferListSize: MemoryLayout<AudioBufferList>.size,
            blockBufferAllocator: nil,
            blockBufferMemoryAllocator: nil,
            flags: UInt32(kCMSampleBufferFlag_AudioBufferList_Assure16ByteAlignment),
            blockBufferOut: &blockBuffer
        )
        guard status == noErr, let data = audioBufferList.mBuffers.mData else {
            throw NSError(domain: "FlashNFlipAudio", code: 30, userInfo: [NSLocalizedDescriptionKey: "PCM buffer is unavailable"])
        }
        let count = Int(audioBufferList.mBuffers.mDataByteSize) / MemoryLayout<Int16>.size
        operation(UnsafeMutableBufferPointer(start: data.assumingMemoryBound(to: Int16.self), count: count))
        _ = blockBuffer
    }

    private func scan(asset: AVAsset) throws -> Metrics {
        guard let track = asset.tracks(withMediaType: .audio).first else {
            throw NSError(domain: "FlashNFlipAudio", code: 31, userInfo: [NSLocalizedDescriptionKey: "Audio track is missing"])
        }
        let reader = try AVAssetReader(asset: asset)
        let output = pcmOutput(for: track)
        guard reader.canAdd(output) else { throw NSError(domain: "FlashNFlipAudio", code: 32) }
        reader.add(output)
        guard reader.startReading() else { throw reader.error ?? NSError(domain: "FlashNFlipAudio", code: 33) }
        var metrics = Metrics()
        let audibleThreshold = pow(10.0, -45.0 / 20.0)
        while let sample = output.copyNextSampleBuffer() {
            try samples(in: sample) { values in
                for value in values {
                    let normalized = Double(value) / Double(Int16.max)
                    let absolute = abs(normalized)
                    metrics.squareSum += normalized * normalized
                    metrics.peak = max(metrics.peak, absolute)
                    if absolute >= audibleThreshold {
                        if metrics.firstAudibleSample == nil { metrics.firstAudibleSample = metrics.samples }
                        metrics.lastAudibleSample = metrics.samples
                    }
                    metrics.samples += 1
                }
            }
        }
        guard reader.status == .completed, metrics.samples > 0 else {
            throw reader.error ?? NSError(domain: "FlashNFlipAudio", code: 34)
        }
        return metrics
    }

    private func transcode(inputURL: URL, directory: URL) throws -> [String: Any] {
        let inputSize = (try inputURL.resourceValues(forKeys: [.fileSizeKey])).fileSize ?? 0
        guard inputSize > 0, inputSize <= maximumInputBytes else {
            throw NSError(domain: "FlashNFlipAudio", code: 40, userInfo: [NSLocalizedDescriptionKey: "Audio is empty or too large"])
        }
        let asset = AVURLAsset(url: inputURL)
        let inputMetrics = try scan(asset: asset)
        guard inputMetrics.duration <= 30 * 60 else {
            throw NSError(domain: "FlashNFlipAudio", code: 41, userInfo: [NSLocalizedDescriptionKey: "Audio is longer than 30 minutes"])
        }
        guard let track = asset.tracks(withMediaType: .audio).first else { throw NSError(domain: "FlashNFlipAudio", code: 42) }
        let reader = try AVAssetReader(asset: asset)
        let readerOutput = pcmOutput(for: track)
        reader.add(readerOutput)
        let outputURL = directory.appendingPathComponent("optimized.m4a")
        try? FileManager.default.removeItem(at: outputURL)
        let writer = try AVAssetWriter(outputURL: outputURL, fileType: .m4a)
        let writerInput = AVAssetWriterInput(mediaType: .audio, outputSettings: [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: sampleRate,
            AVNumberOfChannelsKey: 1,
            AVEncoderBitRateKey: 40_000
        ])
        writer.add(writerInput)
        let protectionSamples = Int(sampleRate * 0.15)
        let startSample = max(0, (inputMetrics.firstAudibleSample ?? 0) - protectionSamples)
        let endSample = min(inputMetrics.samples, (inputMetrics.lastAudibleSample ?? inputMetrics.samples - 1) + protectionSamples)
        let start = CMTime(value: CMTimeValue(startSample), timescale: CMTimeScale(sampleRate))
        let duration = CMTime(value: CMTimeValue(max(1, endSample - startSample)), timescale: CMTimeScale(sampleRate))
        reader.timeRange = CMTimeRange(start: start, duration: duration)
        guard writer.startWriting(), reader.startReading() else { throw writer.error ?? reader.error ?? NSError(domain: "FlashNFlipAudio", code: 43) }
        writer.startSession(atSourceTime: start)
        let targetAmplitude = pow(10.0, targetLoudness / 20.0)
        let currentAmplitude = pow(10.0, inputMetrics.loudness / 20.0)
        let gain = min(8.0, max(0.125, targetAmplitude / max(currentAmplitude, 0.000_01)))
        let limiter = pow(10.0, maximumPeak / 20.0)
        let gate = pow(10.0, -50.0 / 20.0)
        var previousInput = 0.0
        var previousOutput = 0.0
        while reader.status == .reading {
            if !writerInput.isReadyForMoreMediaData { Thread.sleep(forTimeInterval: 0.005); continue }
            guard let sample = readerOutput.copyNextSampleBuffer() else { break }
            try samples(in: sample) { values in
                for index in values.indices {
                    let value = Double(values[index]) / Double(Int16.max)
                    let highPassed = value - previousInput + 0.98 * previousOutput
                    previousInput = value
                    previousOutput = highPassed
                    let gated = abs(highPassed) < gate ? highPassed * 0.25 : highPassed
                    let limited = min(limiter, max(-limiter, gated * gain))
                    values[index] = Int16(max(Double(Int16.min), min(Double(Int16.max), limited * Double(Int16.max))))
                }
            }
            guard writerInput.append(sample) else { throw writer.error ?? NSError(domain: "FlashNFlipAudio", code: 44) }
        }
        if reader.status == .failed { throw reader.error ?? NSError(domain: "FlashNFlipAudio", code: 45) }
        writerInput.markAsFinished()
        let semaphore = DispatchSemaphore(value: 0)
        writer.finishWriting { semaphore.signal() }
        semaphore.wait()
        guard writer.status == .completed else { throw writer.error ?? NSError(domain: "FlashNFlipAudio", code: 46) }
        let outputMetrics = try scan(asset: AVURLAsset(url: outputURL))
        let outputSize = (try outputURL.resourceValues(forKeys: [.fileSizeKey])).fileSize ?? 0
        let verified = outputSize > 0 && outputSize < inputSize && abs(outputMetrics.loudness - targetLoudness) <= 2.0 && outputMetrics.peakDb <= -1.0
        return [
            "optimized": verified,
            "mimeType": "audio/mp4",
            "originalBytes": inputSize,
            "optimizedBytes": verified ? outputSize : inputSize,
            "engine": "AVFoundation-PCM-vDSP-compatible",
            "engineVersion": "2",
            "inputMeasurement": [
                "durationSeconds": inputMetrics.duration,
                "integratedLufs": inputMetrics.loudness,
                "truePeakDb": inputMetrics.peakDb,
                "sampleRate": Int(sampleRate),
                "channels": 1
            ],
            "outputMeasurement": [
                "durationSeconds": outputMetrics.duration,
                "integratedLufs": outputMetrics.loudness,
                "truePeakDb": outputMetrics.peakDb,
                "sampleRate": Int(sampleRate),
                "channels": 1
            ]
        ]
    }
}

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
