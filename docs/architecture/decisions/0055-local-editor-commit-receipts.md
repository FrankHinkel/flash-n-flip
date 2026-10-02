# ADR 0055: Durable local editor commit receipts

Status: Accepted, 2026-10-02.

SQLite/IndexedDB remain authoritative, as specified in ADR 0054. A bridge can
reject a promise after the underlying transaction has committed. A failed
promise therefore does not prove a rollback.

Editor requests carry stable deck/card/note identities and a stable mutation
identity across retries. The local authority writes a receipt containing the
request hash and committed mutation IDs in the same transaction as entities,
mutation journal, outbox, origin sequence and watermarks. The first journal
mutation uses the client request identity. Repeating the same serialized request
returns the current local page without another write. Reusing its identity for
different content fails explicitly.

Receipts belong to the local platform adapter: IndexedDB uses namespaced keys in
the existing metadata store, SQLite adds an independent table with `CREATE TABLE
IF NOT EXISTS`. The portable transaction interface makes receipt support optional
for older adapters; requesting idempotency on an adapter without support fails
explicitly. Existing calls without an idempotency request retain their contract.
Receipts are local retry state; they are not an additional replication authority
and are not exported as learner content or synchronized to iCloud.

Media bytes are staged before metadata publication. Failure before publication
can clean up bytes written by that attempt. Once publication starts, verified
staging is retained even if the promise rejects, because the transaction may
already reference it. A real rollback can safely reuse staging on retry. This
deliberately prefers retained staging to deletion of potentially committed media;
orphan collection requires separately proven absence of live references.

Before overwriting an existing media slot with a different hash, the adapter
durably retains both previous and replacement bytes under private,
hash-addressed staging keys. A concurrent reader can therefore repair the
old slot before publication without losing the future winning bytes.
After interruption, reads consult the authoritative media reference and repair
the original slot from matching staging bytes, validating type, size and SHA-256.
Cleanup repairs a still-required original before deleting its staging copy and
keeps the copy if recovery cannot be proven. Both backup exporters include
authoritative media references only; these private recovery copies are excluded.

Evidence: regression tests first reproduced editor retry rejection and missing
media after a real file-backed SQLite COMMIT. Final tests cover rollback, lost
reply, reopen, identical replay, mismatched identities and unchanged outbox.
Mounted React tests cover stable creation identities, repeated submissions,
denied preference cache and stale navigation responses. These tests do not replace
Capacitor bridge and multi-device acceptance on actual Apple hardware.

Package publication, media reads and cleanup share a local work lock. Browsers
use Web Locks across tabs; native runtimes use a process-wide Promise chain.
Cleanup calls the internal reader within its held lock, avoiding re-entrancy.
An interleaving test pauses publication, starts read and cleanup concurrently,
then verifies the winning bytes after commit, reopen and export.
