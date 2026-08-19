# Anki import coverage

## Target and repeatable check

The local APKG importer must reach at least 99% card-level structural coverage on the available compatibility corpus. Run:

```bash
pnpm anki:coverage
```

An individual package or directory can be supplied as an argument. The check fails if a package cannot be parsed or aggregate coverage is below 99%.

The corpus under `examples/` is local audit input and is not committed. The gate recursively finds APKG files and checks the actual import result rather than only archive/database parsing.

## Card-level criteria

A card is counted as structurally covered only when:

- question and answer contain meaningful text or media;
- no generated “unsupported Anki content” placeholder remains;
- no raw `{{...}}` template token or template-rendered `TAGS:` metadata leaks into learning content;
- the question is not repeated as an answer prefix;
- every safe local image/audio reference in the source fields resolves to imported media of the expected kind.

Warnings are summarized separately. Safe removal of executable template code and CSS, automatic reverse-card suspension, and retained malformed formula text do not by themselves mark a card as structurally broken.

## 2026-08-19 result

- 95 APKG packages parsed successfully
- 105,343 cards audited
- 104,975 cards passed every strict criterion
- strict coverage: **99.6507%**
- importer-produced empty sides, raw template tokens, metadata leakage, repeated questions, and unsupported placeholders: **0**
- 368 cards reference media absent or unusable in their source package: 366 images and 2 audio references

The largest source-data gap is 364 missing stroke-order GIF references in the Mandarin Xefjord package. `Allgemeinwissen_II` contains one missing proxy image referenced by both card directions, and the French package contains one JSON file referenced twice through Anki's sound syntax. These files are not present as usable media in the packages, so the importer cannot reconstruct them.

This metric demonstrates structural compatibility for the audited corpus. It does not claim pixel-identical Anki CSS, execution of third-party JavaScript/add-ons, or universal coverage of every Anki extension. Template JavaScript remains disabled by design; supported add-on structures must be converted into safe Flash-n-Flip content instead.
