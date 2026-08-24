# ADR 0047: Offline LilyPond-to-ABC curation tool

- Status: Accepted
- Date: 2026-08-24

## Context

Open classical-score collections contain useful LilyPond sources, while the
Flash-n-Flip music card deliberately stores a bounded ABC subset. Arbitrary
LilyPond is not a safe card format: `.ly` can contain Scheme, includes and
custom music functions. Running it in Web or Capacitor would introduce an
executable-content path and a platform-specific compiler dependency.

## Decision

The LilyPond conversion tool is a separate Node CLI
under `tools/ly2abc-convert`. It is an offline curation tool and is not imported
by an app or shared runtime package.

The CLI tokenizes LilyPond inertly. It does not evaluate Scheme, invoke
LilyPond, resolve includes, read implicit files or use the network. It expands
only statically recognized music variables within hard source, token,
recursion, score, staff, event and repeat limits. Unknown semantics remain
visible in a versioned JSON report. Strict mode refuses every result with a
warning.

For Mutopia and comparable corpora, a uniquely matched Standard MIDI file is
the musical authority for pitches, onset times, durations, concurrency and
tempo. LilyPond remains the source for metadata and structural diagnostics.
The CLI can find a sibling MIDI file or an exact normalized filename match in
a bounded sibling `*-mids.zip`. It validates MIDI type and size before invoking
the locally installed `midi2abc` executable with `shell: false`, fixed
arguments, a timeout and bounded buffers. ZIP entries with absolute paths or
parent traversal are rejected. No command, path or option is taken from
LilyPond or MIDI content.

`midi2abc` runs with voice splitting enabled. Each resulting monophonic branch
stays an independent ABC voice instead of being folded into changing chord
fragments that retrigger sustained pitches. Up to twelve bounded voices are
grouped by treble or bass clef into the two displayed piano staves.

Numbered sibling movement sources are converted independently and assembled
only after every movement succeeds. The resulting ABC tune book retains one
monotonically numbered `X:` block per movement, matching the existing
Flash-n-Flip tune-book import boundary.

Generated ABC remains derived content. Before curated distribution it must
pass the existing domain ABC validator, the pinned abcjs parser, musical
comparison with a reference MIDI and manual comparison with the source PDF.
The original LilyPond source, its license, source URL, digest and conversion
report remain provenance data; generated ABC alone is not evidence of rights
or musical correctness.

The first stage does not change card schemas, synchronization, persistence or
the local peer protocol. Web and Apple continue to receive only the existing
validated `musicScore` block.

## Consequences

- Downloaded LilyPond sources cannot execute code in Flash-n-Flip.
- The converter can evolve and be tested without increasing app size or iOS
  runtime complexity.
- Complex piano playback no longer depends on lossy reconstruction of
  LilyPond parallel voices when a matching Mutopia MIDI is available.
- Offline curation machines need the trusted local `abcmidi` tools; Web and
  Apple builds do not.
- A parseable result may still be incomplete; diagnostics and later MIDI
  comparison are mandatory release gates for curated music.
- More exact cross-staff engraving, custom Scheme music and exact layout remain
  outside the static parser.
- A future LilyPond-backed extractor requires a separate decision and a
  pinned, networkless, resource-limited worker. It must not be added as a
  silent fallback to this CLI.

## Verification

Unit tests cover comments, Scheme strings, variable expansion, relative and
German pitch names, metadata, voices, chords, repeats, alternatives, tuplets,
grace notes, recursion, active-looking metadata, includes, control characters,
source size and repeat expansion. CLI tests cover explicit output/report paths,
inspection-only mode, misleading extensions, overwrite refusal and strict
Scheme rejection.

The local reference corpus is converted outside the repository output tree.
Every emitted tune is checked with the existing FNF ABC validator and pinned
abcjs parser; warnings in the conversion report remain open musical work rather
than being reclassified as success.
