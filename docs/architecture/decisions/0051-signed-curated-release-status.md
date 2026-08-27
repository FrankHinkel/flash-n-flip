# ADR 0051: Signed curated release status

- Status: Accepted
- Date: 2026-08-27

## Context

Discover could install and replace curated decks, but the local library did not
retain which catalog release had been installed. Consequently the interface
could not distinguish a current deck from an outdated or legacy installation.
The catalog signature covered the catalog as a whole, but it exposed no stable
content identity per installable deck or collection.

## Decision

1. The signed curated catalog declares one publication timestamp and a SHA-256
   content digest for every installable deck and collection.
2. Installation stores the signed publication timestamp and expected digest in
   the local deck payload in the same transaction as the managed deck content.
3. Discover compares the installed digest with the currently verified catalog:
   a matching digest is current, a differing digest has an update, a missing
   digest is a legacy installation with unknown version, and no local deck is
   not installed.
4. An update action remains available for differing and unknown installations.
   It is disabled only after the installed digest matches the verified catalog.
5. The release metadata is included in authoritative local persistence and in
   portable local-sync payloads. This wire-contract change advances local peer
   protocol generation 20 to 21; peers with different generations remain
   incompatible.
6. Digest and timestamp identify signed curated content. They are not a user
   content trust signal and must not replace package or catalog signature
   verification.

## Consequences

- Discover can show whether the latest signed reference or deck is installed
  without contacting a server or inspecting mutable card contents.
- Existing installations intentionally show an unknown version until updated
  once; they are never incorrectly labelled current.
- Exact managed updates can remove obsolete curated cards while preserving
  user-owned decks and unrelated local content.
- Changing synchronized release metadata requires protocol-generation review,
  just like every other local peer wire-schema change.

## Acceptance

- A regenerated catalog has a valid signature, timestamp and digest for every
  installable deck and collection.
- Install, update, FNF reopen and local persistence retain release metadata.
- Discover exposes all four states without relying on colour alone and keeps
  the update action enabled until the verified digest matches.
- Domain wire-contract, catalog parity and focused repository tests pass.
