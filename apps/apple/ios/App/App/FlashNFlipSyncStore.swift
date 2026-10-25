import Foundation
import SQLite3

// A native, durable transport journal. Learner entities remain in the app's
// authoritative SQLite database. Inbox rows survive WebView/process restarts.
final class FlashNFlipSyncStore {
    private var db: OpaquePointer?
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    init() throws {
        let directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let path = directory.appendingPathComponent("fnf-cloud-engine-v4.sqlite").path
        guard sqlite3_open(path, &db) == SQLITE_OK else { throw failure() }
        try execute("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS journal (bucket TEXT NOT NULL, key TEXT NOT NULL, value BLOB NOT NULL, PRIMARY KEY(bucket,key));")
    }
    deinit { sqlite3_close(db) }
    private func failure() -> NSError {
        NSError(domain: "FNFSQLite", code: Int(sqlite3_errcode(db)), userInfo: [NSLocalizedDescriptionKey: String(cString: sqlite3_errmsg(db))])
    }
    func execute(_ sql: String) throws {
        guard sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK else { throw failure() }
    }
    func transaction<T>(_ operation: () throws -> T) throws -> T {
        try execute("BEGIN IMMEDIATE")
        do { let result = try operation(); try execute("COMMIT"); return result }
        catch { try? execute("ROLLBACK"); throw error }
    }
    private func statement(_ sql: String, _ values: [String]) throws -> OpaquePointer {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK, let stmt else { throw failure() }
        for (index, value) in values.enumerated() {
            guard sqlite3_bind_text(stmt, Int32(index + 1), value, -1, transient) == SQLITE_OK else { sqlite3_finalize(stmt); throw failure() }
        }
        return stmt
    }
    func put<T: Encodable>(_ bucket: String, _ key: String, _ value: T) throws {
        let data = try JSONEncoder().encode(value)
        let stmt = try statement("INSERT OR REPLACE INTO journal(bucket,key,value) VALUES(?,?,?)", [bucket,key])
        defer { sqlite3_finalize(stmt) }
        let bound = data.withUnsafeBytes { sqlite3_bind_blob(stmt, 3, $0.baseAddress, Int32(data.count), transient) }
        guard bound == SQLITE_OK, sqlite3_step(stmt) == SQLITE_DONE else { throw failure() }
    }
    func get<T: Decodable>(_ bucket: String, _ key: String, as type: T.Type = T.self) throws -> T? {
        let stmt = try statement("SELECT value FROM journal WHERE bucket=? AND key=?", [bucket,key])
        defer { sqlite3_finalize(stmt) }
        let result = sqlite3_step(stmt)
        if result == SQLITE_DONE { return nil }
        guard result == SQLITE_ROW else { throw failure() }
        let data = Data(bytes: sqlite3_column_blob(stmt, 0), count: Int(sqlite3_column_bytes(stmt, 0)))
        return try JSONDecoder().decode(type, from: data)
    }
    func pendingAssets() throws -> Int {
        let stmt = try statement("SELECT COUNT(*) FROM journal WHERE bucket='assets' AND (json_extract(value,'$.upload')=1 OR json_extract(value,'$.download')=1)", [])
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_step(stmt) == SQLITE_ROW else { throw failure() }
        return Int(sqlite3_column_int64(stmt,0))
    }
    func count(_ bucket: String, lane: String? = nil) throws -> Int {
        let filter = lane == nil ? "" : " AND json_extract(value,'$.lane')=?"
        let stmt = try statement("SELECT COUNT(*) FROM journal WHERE bucket=?" + filter, [bucket] + (lane.map { [$0] } ?? []))
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_step(stmt) == SQLITE_ROW else { throw failure() }
        return Int(sqlite3_column_int64(stmt,0))
    }
    func list<T: Decodable>(_ bucket: String, as type: T.Type = T.self, lane: String? = nil, limit: Int? = nil) throws -> [(String,T)] {
        let filter = lane == nil ? "" : " AND json_extract(value,'$.lane')=?"
        let bounded = limit.map { " LIMIT \(max(0,$0))" } ?? ""
        let stmt = try statement("SELECT key,value FROM journal WHERE bucket=?" + filter + " ORDER BY key" + bounded, [bucket] + (lane.map { [$0] } ?? []))
        defer { sqlite3_finalize(stmt) }
        var result: [(String,T)] = []
        while true {
            let step = sqlite3_step(stmt)
            if step == SQLITE_DONE { return result }
            guard step == SQLITE_ROW else { throw failure() }
            let key = String(cString: sqlite3_column_text(stmt, 0))
            let data = Data(bytes: sqlite3_column_blob(stmt, 1), count: Int(sqlite3_column_bytes(stmt, 1)))
            result.append((key, try JSONDecoder().decode(type, from: data)))
        }
    }
    func remove(_ bucket: String, _ key: String) throws {
        let stmt = try statement("DELETE FROM journal WHERE bucket=? AND key=?", [bucket,key])
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_step(stmt) == SQLITE_DONE else { throw failure() }
    }
}
