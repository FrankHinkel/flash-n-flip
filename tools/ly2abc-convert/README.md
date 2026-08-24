# ly2abc-convert

Eigenständiger, inerter LilyPond-Subset-Konverter für die kuratierte
Flash-n-Flip-Musikbibliothek. Das Tool führt weder LilyPond noch Scheme aus,
folgt keinen `\include`-Anweisungen und besitzt keine Laufzeitabhängigkeiten.

## Aufruf

Der einfache Projekt-Wrapper erwartet genau eine LilyPond-Datei und schreibt
die ABC-Datei sowie den Diagnosebericht in dasselbe Verzeichnis:

```sh
./ly2abc.sh input.ly
```

Dabei entstehen `input.abc` und `input.ly2abc-report.json`. Vorhandene
Ausgabedateien mit diesen Namen werden ersetzt.

Der direkte CLI-Aufruf bietet zusätzliche Optionen:

```sh
node tools/ly2abc-convert/src/cli.mjs input.ly --output output.abc \
  --report output.report.json
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

Nicht unterstützte Befehle werden im Bericht genannt. Mehrere gleichzeitige
Voices innerhalb desselben Staff, `change Staff`, frei programmierte
Musikfunktionen und Layout-Overrides werden noch nicht semantisch übernommen.

## Sicherheitsmodell

Die Eingabe ist auf 1 MiB, 250.000 Tokens, 32 Variablenebenen, acht
`score`-Blöcke, acht Staves je Score und 20.000 Ereignisse je Tune begrenzt.
Scheme erscheint ausschließlich als inerter Token im Bericht. Includes werden
nicht aufgelöst. Das Tool liest nur die als erstes Argument angegebene Datei.
