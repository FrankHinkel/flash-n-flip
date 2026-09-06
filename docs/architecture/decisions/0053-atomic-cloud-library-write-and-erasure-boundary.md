# ADR 0053: Atomic CloudKit writes and resumable physical erasure

Status: implemented transport/domain boundary; application activation pending.

## Decision

Use one custom private CloudKit zone per library generation. Its name derives
from the durable library identity. Ordinary reads and writes must never create
a missing zone/root. Explicit first-link initialization must follow durable
account reservation; the existing default-zone login/bootstrap is not moved or
erased by this change.

Every payload write atomically updates the library root, the deck ledger and,
for new payloads, its ledger page. The catalog and ledger use bounded 64-entry
pages, not queries with asynchronous indexes. A failed write cannot leave an
unregistered payload. A failed guard cannot leave a partial payload write.

Deletion first fences the deck. Progress reset changes its generation and
temporarily suspends all writes while reclamation runs. Every purge commits
physical record removal, the cleared ledger page and its cursor atomically.
After a crash, resume the durable operation ID; never generate another reset ID
for the retry. Retrying a completed reset must not delete new-generation work.
Minimal catalog/ledger tombstones remain; review and content payloads do not.

Payload names include deck/generation ownership in their digest. Identical media
in different decks is stored independently initially. This trades cross-deck
deduplication for safe erasure without an unimplemented reference collector.

Native deletion accepts record IDs rather than compare-and-delete tags. The
shared contract therefore requires a conditional guard save in the same atomic
batch; the Web adapter uses the matching semantics. No unguarded delete API is
exposed by the application service. Root CAS serializes writes initially; larger
throughput optimizations must retain these atomic guarantees.

## Remaining activation gates

The new service is callable, not automatically enabled. Durable pending zone
initialization, user-facing deletion confirmation/outbox, catalog/revision
download orchestration, peer fencing, local application of completed deletion,
native activation and real native/PWA acceptance still need integration.
No live user zone or data is changed by importing this code.

## Sources

- [Apple: atomic requests apply only to custom zones](https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/ModifyRecords.html)
- [Apple: CloudKit JS records batch options](https://developer.apple.com/documentation/cloudkitjs/cloudkit.database/newrecordsbatch)
- [Apple: native atomic modification capability](https://developer.apple.com/documentation/cloudkit/ckmodifyrecordsoperation/isatomic)
