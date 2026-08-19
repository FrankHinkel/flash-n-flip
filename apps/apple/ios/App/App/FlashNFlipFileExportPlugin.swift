import Capacitor
import Foundation
import UIKit

@objc(FlashNFlipFileExportPlugin)
public final class FlashNFlipFileExportPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FlashNFlipFileExportPlugin"
    public let jsName = "FlashNFlipFileExport"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "beginExport", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "appendChunk", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareExport", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "discardExport", returnType: CAPPluginReturnPromise)
    ]

    private struct ExportSession {
        let directoryURL: URL
        let fileURL: URL
        let expectedBytes: Int
        var writtenBytes: Int
    }

    private let maximumExportBytes = 256 * 1024 * 1024
    private let maximumChunkBytes = 256 * 1024
    private var sessions: [String: ExportSession] = [:]

    private var exportRootDirectory: URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("FlashNFlipExports", isDirectory: true)
    }

    public override func load() {
        try? FileManager.default.removeItem(at: exportRootDirectory)
        try? FileManager.default.createDirectory(
            at: exportRootDirectory,
            withIntermediateDirectories: true
        )
    }

    @objc public func beginExport(_ call: CAPPluginCall) {
        guard let fileName = call.getString("fileName"),
              let mimeType = call.getString("mimeType"),
              let byteSize = call.getInt("byteSize"),
              byteSize > 0,
              byteSize <= maximumExportBytes,
              mimeType == "application/vnd.flash-n-flip.package+zip",
              validFileName(fileName)
        else {
            call.reject("Invalid FNF export")
            return
        }
        do {
            let exportId = UUID().uuidString.lowercased()
            let directoryURL = exportRootDirectory
                .appendingPathComponent(exportId, isDirectory: true)
            try FileManager.default.createDirectory(
                at: directoryURL,
                withIntermediateDirectories: true
            )
            let fileURL = directoryURL.appendingPathComponent(fileName)
            guard FileManager.default.createFile(atPath: fileURL.path, contents: nil) else {
                throw ExportError.couldNotCreateFile
            }
            sessions[exportId] = ExportSession(
                directoryURL: directoryURL,
                fileURL: fileURL,
                expectedBytes: byteSize,
                writtenBytes: 0
            )
            call.resolve(["exportId": exportId])
        } catch {
            call.reject("FNF export file could not be created", nil, error)
        }
    }

    @objc public func appendChunk(_ call: CAPPluginCall) {
        guard let exportId = call.getString("exportId"),
              var session = sessions[exportId],
              let encoded = call.getString("dataBase64"),
              let bytes = Data(base64Encoded: encoded),
              !bytes.isEmpty,
              bytes.count <= maximumChunkBytes,
              session.writtenBytes + bytes.count <= session.expectedBytes
        else {
            call.reject("Invalid FNF export chunk")
            return
        }
        do {
            let handle = try FileHandle(forWritingTo: session.fileURL)
            defer { try? handle.close() }
            try handle.seekToEnd()
            try handle.write(contentsOf: bytes)
            session.writtenBytes += bytes.count
            sessions[exportId] = session
            call.resolve()
        } catch {
            discard(exportId)
            call.reject("FNF export chunk could not be written", nil, error)
        }
    }

    @objc public func shareExport(_ call: CAPPluginCall) {
        guard let exportId = call.getString("exportId"),
              let session = sessions[exportId],
              session.writtenBytes == session.expectedBytes,
              let presentingController = bridge?.viewController
        else {
            call.reject("Incomplete FNF export")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self else {
                call.reject("FNF export is unavailable")
                return
            }
            let activity = UIActivityViewController(
                activityItems: [session.fileURL],
                applicationActivities: nil
            )
            if let popover = activity.popoverPresentationController {
                popover.sourceView = presentingController.view
                popover.sourceRect = CGRect(
                    x: presentingController.view.bounds.midX,
                    y: presentingController.view.bounds.midY,
                    width: 1,
                    height: 1
                )
                popover.permittedArrowDirections = []
            }
            activity.completionWithItemsHandler = { _, completed, _, _ in
                self.discard(exportId)
                call.resolve(["completed": completed])
            }
            presentingController.present(activity, animated: true)
        }
    }

    @objc public func discardExport(_ call: CAPPluginCall) {
        guard let exportId = call.getString("exportId") else {
            call.reject("Invalid FNF export ID")
            return
        }
        discard(exportId)
        call.resolve()
    }

    private func validFileName(_ fileName: String) -> Bool {
        fileName.count <= 160 &&
            fileName.lowercased().hasSuffix(".fnf") &&
            (fileName as NSString).lastPathComponent == fileName &&
            !fileName.contains("\\") &&
            !fileName.unicodeScalars.contains(where: { $0.value < 0x20 || $0.value == 0x7f })
    }

    private func discard(_ exportId: String) {
        guard let session = sessions.removeValue(forKey: exportId) else { return }
        try? FileManager.default.removeItem(at: session.directoryURL)
    }

    private enum ExportError: Error {
        case couldNotCreateFile
    }
}
