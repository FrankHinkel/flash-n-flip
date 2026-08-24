# JSXGraph in Flash-n-Flip

## Status

Die 2D-Umsetzung ist abgeschlossen. 3D ist bewusst nicht aktiviert und bleibt
eine spätere, getrennt zu prüfende Erweiterung.

## Schreibweise

Ein Graph steht direkt im normalen Frage- oder Antwortfeld:

````markdown
```jsxgraph{w=90% h=70% bg=#18212f80}
title "Dreieck"
describe "Drei bewegliche Punkte bilden ein Dreieck und seinen Umkreis."
board x=-6..6 y=-4..5 axes grid aspect=1
A = point(-3, -1, drag=true, color=blue)
B = point(3, -1, drag=true, color=yellow)
C = point(0, 3, drag=true, color=red)
polygon(A, B, C, alpha=0.2)
c = circumcircle(A, B, C, color=purple)
```
````

`describe` ist für die zugängliche Beschreibung Pflicht. `title` ist optional.
`w`, `h` und `bg` entsprechen der kurzen Mermaid-Schreibweise. Die Vorschau
erscheint auf der Gegenseite; es gibt keinen Zusatzeditor.

## Umgesetzter 2D-Umfang

- Zeichenfläche mit Achsen, Raster, Seitenverhältnis und begrenztem Ausschnitt
- Punkte, Geraden, Strecken, Strahlen, Pfeile, Kreise, Polygone, regelmäßige
  Polygone, Winkel, Bögen und Sektoren
- Mittelpunkte, Schnittpunkte, Parallelen, Senkrechten, Winkelhalbierende,
  Tangenten, Normalen, Gleiter, Spiegelungen sowie Ellipsen, Parabeln und
  Hyperbeln
- frei definierte Funktionen und mathematische Ausdrücke einschließlich
  trigonometrischer, logarithmischer und hyperbolischer Funktionen,
  Fallunterscheidung, numerischer Ableitung und numerischem Integral
- Funktionsgraphen, Parameter- und Polarkurven, implizite Kurven,
  Ungleichungsbereiche, Integralflächen, Riemann-Summen, Vektor- und
  Richtungsfelder
- Schieberegler und bewegliche Punkte mit automatisch nachgeführten abhängigen
  Objekten
- lokale SVG-Darstellung, responsive Größe, Maus/Trackpad/Touch-Pan und -Zoom,
  Tastaturbedienung sowie eine eingeklappte Info-/Bedienhilfe

Die vollständigen kopierbaren Beispiele liegen in `examples/jsxgraph` und in
der App-Hilfe.

## Sicherheitsmodell

Die Notation ist kein JavaScript. Flash-n-Flip zerlegt sie in einen eigenen AST
und führt ausschließlich bekannte Objekte, Funktionen, Eigenschaften und
Stilwerte aus. HTML, CSS, URLs, externe Daten, Bilder, Ereignisbehandler,
JSXGraph-JavaScript/JessieCode und 3D bleiben harmloser Quelltext. Grenzen für
Quelltext, Anweisungen, Objekte, Slider und Ausdruckskomplexität verhindern
unbegrenzte Konstruktionen. Private Inhalte verlassen das Gerät nicht.

Der strukturierte Inhaltstyp ist Teil des lokalen Daten- und Sync-Schemas. Dafür
wird die lokale Peer-Protokollgeneration 17 verwendet; inkompatible Geräte
fordern ein Update statt Daten zu verlieren.

## Architektur

- `packages/domain/src/jsx-graph.ts`: Sprache, AST, Validator, Schema, Limits
- `apps/web/lib/jsx-graph-renderer.ts`: expliziter AST-zu-JSXGraph-Adapter
- `apps/web/components/jsx-graph.tsx`: responsive und zugängliche Oberfläche
- Markdown/Rich-Text/Editor: direkte Fence-Erkennung und unveränderte Quelle
- Hilfe/Beispiele: kopierbare Geometrie-, Funktions- und Feldkonstruktionen

Die Architekturentscheidung steht in
`docs/architecture/decisions/0046-local-safe-jsxgraph-2d.md`.

## Spätere 3D-Erweiterung

3D erhält, falls umgesetzt, eine eigene Fence-Sprache (`jsxgraph3d`) und eine
neue Schemaversion. Geplant werden getrennt:

- `view3d`/Kamera, Punkte, Geraden, Kurven, Ebenen und Flächen
- harte Grenzen für Flächenauflösung, Samples, Objekte und Speicher
- explizite Gesten für Drehen, Verschieben und Zoomen ohne Konflikt mit dem
  Scrollen der Lernkarte
- verständliche Textalternative, Tastatursteuerung, reduzierbare Bewegung und
  Kontrastregeln
- echte Performance- und Speicherprüfung in iPhone-/iPad-WebViews

Bis diese Punkte umgesetzt und auf Apple-Geräten abgenommen sind, weist der
2D-Parser jedes `*3D`-Objekt ausdrücklich zurück.
