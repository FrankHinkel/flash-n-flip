# ADR 0049: Apple-only V1 with a server-independent local runtime

- Status: Accepted
- Date: 2026-08-25
- Supersedes for V1: ADR 0018, ADR 0022, ADR 0026, ADR 0029 and ADR 0030
  wherever they make Web/PWA, rendezvous, STUN, WebRTC or peer Webstack
  delivery part of the Apple V1 runtime

## Context

The direct-connect and PWA handoff path was not reliable enough for the first
public release. It also coupled the installed Apple application to
`flash-n-flip.com`, a rendezvous API, STUN, WebRTC, reconnect timers and a
separately signed peer-delivered Webstack. Flash-n-Flip will start as an Apple
product. The Web/PWA source remains valuable for a later product, but it is not
part of V1 acceptance or distribution.

## Decision

1. Flash-n-Flip V1 targets iPhone and iPad. Apple-silicon Macs may run the
   compatible iPad application. Web/PWA is deferred beyond V1 without deleting
   its source.
2. The Apple application contains a complete local React bundle and starts
   without a remote server. SQLite and local media storage remain authoritative.
3. The Apple bundle must not contain or invoke the Connect shell, rendezvous
   API, STUN, WebRTC peer synchronization, peer-delivered Webstack updates,
   service-worker updates or a production `CAPACITOR_SERVER_URL`.
4. Apple application updates arrive only through Apple distribution. Curated
   starter content and FnF Help are bundled and verified locally.
5. Until iCloud synchronization has been designed and accepted, FNF export and
   restore are the explicit backup and device-transfer paths. Independent edits
   on two devices are not merged automatically.
6. iCloud synchronization and recovery are implemented only after the remaining
   V1 gates. They require one documented conflict, deletion, media, encryption,
   quota, interruption and account-change model before activation.
7. The dormant Web/PWA, rendezvous, STUN and direct-connect implementation may
   remain in the repository for compatibility and later evaluation, but Apple
   build entrypoints must not import it. The public services are retired through
   a separate, reversible operations step after older test builds no longer
   depend on them.
8. `flash-n-flip.com` may remain a static product, support, legal and curated
   download surface. It is not an Apple application runtime or synchronization
   dependency.

## Build boundary

The Apple build uses the portable product entrypoint in local-only mode. Its
build fails when Connect assets, a peer Webstack manifest or the strings
`flash-n-flip.com`, `/rendezvous/v1` or `stun:` occur in the executable
JavaScript bundle. Human-readable offline help may name the service while
explaining that it is not used. Capacitor copies only that checked local output
into Xcode.

The existing `direct-connect-webstack` package temporarily owns both local
persistence adapters and the parked peer implementation. This name is not an
architectural dependency: tree-shaking and the local-only build boundary must
exclude all peer code from Apple. A later extraction may rename the local
runtime without duplicating domain, scheduler, package-format or persistence
rules.

## Consequences

- Apple V1 has no automatic multi-device synchronization until iCloud is ready.
- FNF backup and restore become release-blocking recovery paths.
- Apple privacy and App Store declarations become smaller because the app does
  not contact the Flash-n-Flip rendezvous or STUN services.
- Web/PWA can be resumed later, but it receives a separate scope, threat model,
  release gate and deployment decision.
- A green build or unit test is insufficient: the copied Xcode bundle and a
  physical iPhone/iPad network trace must prove the server-independent runtime.

## Acceptance

- Cold start, create, edit, study, media playback, export, process restart and
  restore work in airplane mode on physical iPhone and iPad.
- The built and copied Apple assets contain no Connect directory, peer Webstack
  release manifest or prohibited endpoint strings.
- The Apple target has no WebRTC package dependency or STUN configuration.
- FNF export from one device restores completely on a fresh second device with
  matching stable IDs and media hashes.
- Help, privacy information, App Store labels and support material describe the
  actual Apple-only data flow.
