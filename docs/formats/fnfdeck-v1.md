# Flash-n-Flip deck package `.fnfdeck` – format version 1

## Purpose

`.fnfdeck` is the protected, lossless backup and transfer format for private
Flash-n-Flip decks. Version 1 transports:

- deck metadata and tags
- multiple content locales with an explicit default locale
- structured text, formulas, images, audio, video, trusted graphics,
  declarative animations and interactive Europe maps
- internal card-navigation targets
- referenced media with MIME type, byte hash and alternative text

Learning progress, review events, account data and moderation state are
deliberately excluded.

## Binary envelope

```text
8 bytes   ASCII magic FNFDECK1
4 bytes   unsigned big-endian header length
N bytes   UTF-8 JSON envelope header
rest      gzip-compressed manifest encrypted with AES-256-GCM
```

The header names format version 1, package UUID, algorithms, nonces,
authentication tags, wrapped content key, encrypted-payload SHA-256, publisher
public key and Ed25519 signature.

Every export uses a new random 256-bit content key. The API wraps it with an
account-specific key derived using HKDF-SHA-256 from the deployment deck master
secret, package UUID and authenticated user ID. The signature covers the magic,
unsigned header and ciphertext.

The package does not contain the account ID or an unwrapped key. Import verifies
size, magic, schema version, ciphertext hash, trusted publisher key, signature,
account binding, both AES-GCM authentication tags, structured content schemas,
media hashes and navigation references before persistence.

## Locale behavior

`contentLocales` lists available deck languages. `defaultContentLocale` must be
one of them. Web and Mobile persist the selected content locale per deck,
independently of the EN/DE interface locale. On first use:

1. use the UI locale when the deck contains it;
2. otherwise use `defaultContentLocale`;
3. fall back to the first available localized card content.

Switching content locale does not duplicate a card or its learning progress.

## Security boundary and limitations

- Decks contain structured data, never executable HTML, JavaScript, templates
  or raw SVG.
- Maps and animations are app-owned renderers. A package supplies only
  validated data and allowlisted presets.
- Version 1 packages are deliberately bound to the exporting account. They are
  not a cross-account publishing or sales format.
- A recipient who can display content can still capture it using screenshots,
  screen recording, transcription or a modified client. Encryption prevents
  casual extraction and use by unsupported importers; it cannot provide
  absolute copy prevention.
- Production must set a high-entropy `FNF_DECK_MASTER_SECRET` independently of
  `JWT_SECRET` and manage it through the deployment secret store. Losing or
  rotating it without key migration makes existing packages unreadable.

## Compatibility

Readers reject unknown major format versions. Additive fields require a new
schema revision only when older readers cannot safely ignore them. Algorithm or
ownership-model changes require a new envelope format version.
