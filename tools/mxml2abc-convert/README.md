# MusicXML to FnF ABC converter

`mxml2abc-convert` is an offline curation tool for converting `.musicxml`,
`.xml`, and compressed `.mxl` scores into the inert ABC subset accepted by
Flash-n-Flip. It is not part of the app runtime and never uploads a score.

## Usage

Build the domain validator and write ABC to stdout:

```sh
pnpm music:mxml2abc -- score.mxl > score.abc
```

Write ABC plus a machine-readable report:

```sh
pnpm music:mxml2abc -- score.mxl --output score.abc --report score.report.json
```

The convenient wrapper writes both files next to the source:

```sh
./mxml2abc.sh score.mxl
```

Use `--strict` in a curation pipeline when any reported conversion warning
must prevent output. The input itself cannot be overwritten. The wrapper also
refuses to replace an existing adjacent ABC or report; an explicit CLI output
path is required when replacement is intentional.

## Preserved content

- notes, rests, chords, voices, staves, keys, meters, tempo, repeats, tuplets,
  grace notes, ties, dynamics, and the safe annotations understood by FnF;
- supported numeric piano fingerings `1` through `5`, including a numeric
  substitution such as `1-2`, as above/below ABC annotations;
- score title, composer, and rights metadata where supplied by MusicXML.

The report counts source, supported, converted, and discarded fingerings.
Fingering is edition metadata: a public-domain composition does not imply that
a modern fingered edition is freely redistributable.

## Deliberate limits

MusicXML is richer than FnF's safe ABC profile. Cross-staff moves, arbitrary
layout directives, unsupported text decorations, some pedal/ottava notation,
non-numeric fingering, and other engraver-specific details can be removed and
reported. A successful conversion is therefore structurally valid, not proof
of musical or engraving equivalence. Review the report, rendered score, voice
alignment, playback, repeats, and a representative set of measures before
publishing a converted deck.

MXL extraction rejects traversal paths, duplicate/encrypted entries, XML
entities and internal DTD subsets, excessive entry counts, and oversized
compressed or expanded content. The pinned Python converter runs with fixed
arguments in a temporary directory; FnF's domain validator checks its output.

## Pinned engine

The tool vendors W.G. Vree's `xml2abc.py` version 177. Provenance and the FnF
fingering patch are documented in
[`docs/licenses/xml2abc-177.md`](../../docs/licenses/xml2abc-177.md). The
reference corpus and its per-file hashes are documented in
[`examples/music/musicxml/SOURCES.md`](../../examples/music/musicxml/SOURCES.md).
