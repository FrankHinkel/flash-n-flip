# ly2abc-convert

Eigenständiger LilyPond-/MIDI-Konverter für die kuratierte
Flash-n-Flip-Musikbibliothek. Das Tool führt weder LilyPond noch Scheme aus und
folgt keinen `\include`-Anweisungen. Für musikalisch verlässliche Mutopia-
Konvertierungen verwendet es `midi2abc` aus dem Paket `abcmidi`.

```sh
brew install abcmidi
```

## Aufruf

Der einfache Projekt-Wrapper erwartet genau eine LilyPond-Datei und schreibt
die ABC-Datei sowie den Diagnosebericht in dasselbe Verzeichnis:

```sh
./ly2abc.sh input.ly
```

Dabei entstehen `input.abc` und `input.ly2abc-report.json`. Vorhandene
Ausgabedateien mit diesen Namen werden ersetzt.

Nummerierte Geschwistersätze mit derselben Papierkennung werden automatisch
als Werk erkannt. Ein Aufruf für `moonlight1-a4.ly` konvertiert deshalb auch
`moonlight2-a4.ly` und `moonlight3-a4.ly` und erzeugt `moonlight.abc`. Jeder
Satz bleibt darin ein eigener `X:`-Block, sodass Flash-n-Flip das Tunebook beim
Import wieder in einzelne Stücke aufteilen kann.

Eine eindeutig passende `.mid`-Datei wird im selben Verzeichnis, im
übergeordneten Verzeichnis oder in einem benachbarten Unterverzeichnis
automatisch erkannt. Passende MIDI-Einträge in Mutopia-Archiven wie
`moonlight-mids.zip` werden ebenfalls direkt gelesen. MIDI liefert Tonhöhen,
Gleichzeitigkeit, Dauern und Tempo; LilyPond liefert Metadaten und
Strukturdiagnosen. `midi2abc` trennt dabei überlappende melodische Linien in
eigene ABC-Stimmen. Flash-n-Flip gruppiert bis zu zwölf dieser Stimmen anhand
ihres Schlüssels wieder auf das obere und untere Klaviersystem. Dadurch werden
gehaltene Töne nicht als schnell wechselnde Akkordstapel neu angeschlagen.

Der direkte CLI-Aufruf bietet zusätzliche Optionen:

```sh
node tools/ly2abc-convert/src/cli.mjs input.ly --output output.abc \
  --report output.report.json
```

Eine Referenz lässt sich auch ausdrücklich vorgeben:

```sh
node tools/ly2abc-convert/src/cli.mjs input.ly \
  --reference-midi input.mid --output output.abc --report output.report.json
```

Nur untersuchen:

```sh
node tools/ly2abc-convert/src/cli.mjs input.ly --inspect
```

Mit `--strict` führen bereits Warnungen zu Exit-Code 2. Ohne `--output` wird
das ABC nach stdout geschrieben. Diagnosemeldungen gehen nach stderr, sodass
die ABC-Ausgabe weitergeleitet werden kann.

## Unterstützte erste Stufe

- `\score`, `PianoStaff`, `Staff`
- benannte Musikvariablen und begrenzte Variablenexpansion
- `\relative` sowie absolute Tonhöhen
- Noten, Pausen, Skips, Dauern, Punktierungen und Akkorde
- Schlüssel, Tonart, Takt, Tempo und Auftakt
- einfache Volta-Wiederholungen, Alternativen und `repeat unfold`
- Tuplets, Vorschläge, Bindebögen, Haltebögen, Dynamik und ausgewählte
  Verzierungen

Nicht unterstützte Befehle werden im Bericht genannt. Parallele benannte
Voices, einfache gleichzeitige Blöcke und `change Staff` werden erkannt. Bei
ungleichen parallelen Dauern ist der statische Fallback nicht verwendbar; eine
passende MIDI-Referenz umgeht diesen Verlust musikalisch korrekt.

## Sicherheitsmodell

Die LilyPond-Eingabe ist auf 1 MiB, 250.000 Tokens, 32 Variablenebenen, acht
`score`-Blöcke, acht Staves je Score und 20.000 Ereignisse je Tune begrenzt.
Scheme erscheint ausschließlich als inerter Token im Bericht. Includes werden
nicht aufgelöst. MIDI-Dateien sind auf 2 MiB und benachbarte MIDI-ZIP-Archive
auf 8 MiB begrenzt. Archivpfade mit Traversal werden verworfen. `unzip` und
`midi2abc` werden ohne Shell, mit festen Argumenten, Zeitlimit und begrenztem
Ausgabepuffer gestartet; aus Quelldaten wird kein Code ausgeführt.
