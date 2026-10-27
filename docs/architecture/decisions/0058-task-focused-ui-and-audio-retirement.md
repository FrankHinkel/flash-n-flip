# ADR 0058: Task-focused learning UI and retirement of audio optimization

Status: Accepted for implementation, 2026-10-27. Physical device acceptance remains open.

## Decision

The product owner requested implementation of the complete UI review, starting
with the mobile editor and misleading completion for empty learning plans.
The scheduler and synchronization logic must remain unchanged. Audio
optimization is retired completely, including import-time processing, background
workers, their persistent job adapter and the native encoding plugin.

The learner UI has four destinations: Today, My decks, Discover and Settings.
Phone authoring presents one full-width task at a time. Explicit card saves keep
the existing durable commit receipts. Empty, loading, failed, due and completed
learning states are distinct. Four existing review values and their scheduling
remain intact; free practice and reference browsing name their effects.

Plan editing uses an isolated selection draft. A row checkbox selects that deck
only; adding descendants is a separate labelled action. Apply writes one
versioned named-plan mutation through the existing durable repository. Cancel
writes nothing. The captured base version rejects competing edits; recovery
requires an explicit reload of the current selection. Existing plans, hierarchy,
review history and strategy values are not reinterpreted.

Settings owns explicit iCloud access and activation. Opening Discover no longer
mounts private-cloud management; opening Settings mounts it only on request.
This changes presentation, not CloudKit ownership, consent, synchronization or
conflict policy. Backup, recovery and signed catalog validation remain available.

## Audio compatibility

New imports retain their validated input audio; there is no optimizer, encoder,
automatic job creation, battery/thermal optimizer observer or optimization UI.
Playback, microphone recording, text to speech and optional player gain remain.
The API runtime image and local startup no longer require FFmpeg/FFprobe.
The separate offline soundfont-generation tool is unrelated and retains its
explicit FFmpeg tooling requirement.

Existing media must remain readable, including installations in which a prior
release already removed an original after retaining its derivative. The
`legacy-audio-derivatives` domain module therefore retains only the validated
metadata codec, routing and deterministic selection used by existing media.
Generic derivative persistence, transfer, playback and orphan cleanup retain
their previous semantics. They contain no processor and start no jobs.

Old IndexedDB/SQLite job tables are left inert. Removing them would require an
unnecessary destructive schema migration. No job-store adapter or runtime
consumer remains. This is compatibility for existing data, not a hidden
continuation of optimization. No automatic media deletion or re-encoding is
introduced. The former audio plan is historical and superseded by this decision.

## Consequences and validation

UI-only metadata guards do not change queue generation, review commits, stable
review IDs, FSRS, due dates or synchronization adapters. Separate regression
suites cover scheduler, sync, local persistence and existing derivative replay.
Rendered browser evidence and the implementation status are recorded in
`ui-improvements.md` and the dated UI review. A successful simulator build is
not a physical-device, VoiceOver or multi-device release approval.
