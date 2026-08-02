# Flash-n-Flip package `.fnf` – format version 2

## Purpose

`.fnf` is the protected, lossless backup and transfer format for a complete
Flash-n-Flip collection. A single deck is represented as a collection with one
deck node. Version 2 transports:

- the selected root deck and every non-archived descendant, including hierarchy,
  metadata, languages, tags, study order and deck visuals
- notes with all preserved source fields and tags
- note types and safe declarative card-template mappings
- cards with structured multilingual content, positions, linked-card chains,
  explanation kinds and suspension state
- referenced deck and card media with MIME type, byte hash and alternative text

Learning progress, review events, account data, favorites, visibility, archive
state and moderation state are deliberately excluded.

Version 1 and the former `.fnfdeck` extension were removed before user-relevant
exports existed and are intentionally not accepted.

## ZIP before protection

Every export is built in this order:

1. validate the canonical collection manifest and all references;
2. create a ZIP archive containing `manifest.json` and raw `media/<uuid>` files;
3. encrypt the complete ZIP with AES-256-GCM;
4. sign the protected envelope with Ed25519.

Media is stored as raw ZIP entries instead of Base64 inside JSON. The importer
limits entry count, expanded size and compression ratio; rejects undeclared,
duplicate or unsafe paths; and checks declared byte sizes and SHA-256 hashes.

## Binary envelope

```text
8 bytes   ASCII magic FNFPAK02
4 bytes   unsigned big-endian header length
N bytes   UTF-8 JSON envelope header
rest      encrypted ZIP archive
```

The header fixes format version 2, ZIP payload, AES-256-GCM encryption,
HKDF-SHA-256 account key wrapping and an Ed25519 signature. The signature covers
the magic, unsigned header and ciphertext.

## Import integrity

Import verifies the authenticated account binding, trusted signing key,
signature, ciphertext hash and both AES-GCM authentication tags before opening
the ZIP. It then validates the complete hierarchy and all deck, note, template,
card, media and internal card-navigation references before a database
transaction persists new identifiers. Newly written media is removed if that
transaction fails.

Content remains structured data. Packages cannot supply executable HTML,
JavaScript, CSS, add-ons, arbitrary SVG or renderer code.

## Security boundary

Version 2 packages are bound to the exporting account. They are private backups,
not cross-account publications. Production must set and back up a high-entropy
`FNF_DECK_MASTER_SECRET`; losing it makes existing packages unreadable.

An authorized viewer can still capture displayed content. Encryption prevents
casual extraction and unsupported imports, not screenshots or transcription.
