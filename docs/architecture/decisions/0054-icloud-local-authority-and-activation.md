# ADR 0054: iCloud target, local authority and explicit activation

- Status: accepted, explicitly confirmed by the product owner
- Date: 2026-10-02
- Clarifies ADR 0052 and supersedes the old WebRTC-only product instruction and
  the iCloud implementation sequencing of ADR 0049 decisions 5–6.

## Decision

Continue private iCloud library replication. SQLite in installed applications
and IndexedDB in browsers remain authoritative for local operation. The VPS
does not receive private decks, media, progress, settings or backup payloads.
There is one replication policy per linked library; peer WebRTC is parked and
must not become a second live writer. Retain its migration source and tests.

An available Apple account is not consent to upload a local library. Only an
explicit user Sync/Download/Remove/Delete action can initially enable the
runtime policy. Opening My iCloud and observing an account request automatic
work with `explicit: false`; absent or disabled policy stops before bootstrap.
An already enabled library may synchronize after account discovery and after
durable local mutation events. Requests coalesce into one pass, plus at most one
follow-up for changes arriving during the pass. There is no timer, focus or
online polling, and cloud-origin changes do not feed an upload loop.

Account discovery and transfer share a single operation. Automatic work awaits
discovery and rechecks its suspension generation before starting. Explicit user
actions and Stop invalidate deferred automatic work. Background errors become
visible runtime errors rather than unhandled promises or infinite retries.

Persist and validate complete account/environment binding and deletion intent.
Invalid policy fails closed and remains stored for diagnosis; it does not grant
peer writes or permission to reset data. Account/environment changes cannot
overwrite an existing binding. Logout or disabled replication retain the fence.

Append-only reviews keep their IDs and actual review times. Latest actual review
per card wins, with a stable event-ID tie break; upload time is irrelevant.
Immutable content revisions, generation-scoped deletion, verified media and
durable outbox acknowledgements remain as defined in ADR 0052.

## Activation and evidence

Debug builds expose the native transport for device acceptance. Release builds
retain `FNFCloudLibraryEnabled = false` until that acceptance passes. Either
configuration still requires explicit user activation before upload. A native
capability, account check, mocked transport or unsigned simulator build is not
proof of remote durability or multi-device convergence.

Required real-device scenarios: offline review and restart; duplicate delivery;
interrupted upload/download with original media; concurrent reviews/edits;
local removal and recovery; cloud deletion with a stale replica; quota/network
failure; account/environment change. The local library and its pending outbox
must survive every failure case.

Operator and store declarations are work before actual production operation.
Per the owner's explicit instruction they do not block the current local
technical quality work. No operator facts are invented or marked certified.
