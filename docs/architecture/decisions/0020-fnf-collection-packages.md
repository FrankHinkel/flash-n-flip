# ADR 0020: ZIP-based `.fnf` collection packages

## Status

Accepted, 2 August 2026.

## Context

The original private export handled one deck and omitted hierarchy, Anki source
fields, note types, card templates, deck images and suspended cards. Its
`.fnfdeck` name also described neither collection roots nor their descendants.
No user-relevant version-1 exports need migration.

## Decision

Flash-n-Flip uses `.fnf` as the single protected content-package extension. The
selected deck is the package root; every non-archived descendant is included.
A leaf deck is therefore a valid one-node collection package.

The canonical version-2 payload is always a ZIP archive before protection.
`manifest.json` carries validated structured metadata while media remains in
separate raw ZIP entries. The API then encrypts the whole ZIP with AES-256-GCM,
wraps the content key for the authenticated account and signs the envelope with
Ed25519. Import reverses this order only after authenticating each outer layer.

Version 1 and `.fnfdeck` are not supported. Learning progress and UI state stay
outside this content package.

## Consequences

- Collection hierarchy and imported Anki structures round-trip without being
  flattened into card fronts and backs.
- Media avoids Base64 expansion and remains independently hash-verifiable.
- Import must reject archive traversal, undeclared entries, compression bombs,
  missing references and cyclic hierarchies before persistence.
- Future optional signing or encryption can wrap the same ZIP payload without
  changing its internal content model.
