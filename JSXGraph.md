# JSXGraph – Umsetzungsplan für Flash-n-Flip

## Status und Zielbild

JSXGraph wird als lokale Darstellungs-Engine für interaktive Mathematik-,
Geometrie- und Physik-Lernszenen eingesetzt. Kartendaten enthalten dabei kein
JavaScript. Flash-n-Flip speichert ausschließlich ein streng typisiertes,
deklaratives Szenenmodell; der Web-/Capacitor-Adapter übersetzt dieses Modell in
JSXGraph-Aufrufe.

Das Ziel ist ein echter Lernbaustein: Lernende können Punkte verschieben,
Parameter verändern, Konstruktionen untersuchen und später begrenzte
Interaktionsaufgaben lösen. Die erste Version konzentriert sich auf sichere
Darstellung und Exploration, bevor Interaktionen bewertet werden.

## Lizenz und kommerzielle Nutzung

- JSXGraph wird dual unter MIT und GNU LGPL veröffentlicht.
- Flash-n-Flip verwendet JSXGraph unter der MIT-Lizenzoption.
- Die MIT-Option erlaubt Nutzung, Änderung und Verteilung, einschließlich
  kommerzieller Nutzung.
- Copyright- und Lizenzhinweis müssen mit der ausgelieferten Bibliothek erhalten
  bleiben.
- Die gewählte, exakt gepinnte Paketversion und ihre transitiven Abhängigkeiten
  werden vor Release erneut geprüft.
- `docs/THIRD_PARTY_NOTICES.md` wird um JSXGraph, MIT-Lizenzoption,
  Copyright-Angabe und Upstream-URL ergänzt.
- Die technische Bewertung ersetzt keine anwaltliche Lizenzberatung; vor
  öffentlicher Distribution bleibt eine qualifizierte Abschlussprüfung sinnvoll.

Offizielle Quellen:

- <https://jsxgraph.org/home/>
- <https://github.com/jsxgraph/jsxgraph>
- <https://github.com/jsxgraph/jsxgraph/blob/main/LICENSE.MIT>

## Produktumfang

### Phase 1: sichere interaktive Szenen

1. kartesisches Koordinatensystem
2. Punkte und beschriftete Punkte
3. Geraden, Strahlen und Strecken
4. Vektoren
5. Kreise und Kreisbögen
6. Polygone und Dreiecke
7. Funktionsgraphen
8. diskrete Datenpunkte
9. Schieberegler
10. feste Text-/KaTeX-Beschriftungen

### Phase 2: didaktische Presets

- Funktion und Ableitung
- Sekante und Tangente
- lineare Funktionen mit Steigung und Achsenabschnitt
- quadratische Funktionen mit Scheitelpunkt
- trigonometrischer Einheitskreis
- Vektoraddition und Komponenten
- Dreieckszentren und Satz des Thales
- Transformationen und Symmetrien
- einfache Optik mit Strahlen und Linse
- Weg-, Geschwindigkeits- und Beschleunigungsdiagramme
- Messwert und Ausgleichskurve

### Phase 3: bewertbare Interaktionen

- Punkt an die richtige Position ziehen
- Slider auf einen Zielbereich einstellen
- Objekt auswählen
- Vektor oder Gerade vervollständigen
- geometrische Beziehung herstellen
- Funktion anhand eines Graphen parametrisieren

## Nicht-Ziele

- kein beliebiges JavaScript in Karten
- kein `eval`, `new Function`, dynamischer Modulimport oder Inline-Skript
- keine direkte JSXGraph-API als öffentliches Kartenformat
- kein ungeprüftes JessieCode oder anderer ausführbarer DSL-Quelltext
- keine externen Bilder, Datenquellen oder AJAX-Aufrufe
- keine frei definierbaren Eventhandler oder DOM-Manipulationen
- keine automatisch bewerteten Freihandbeweise
- keine 3D-Oberflächen oder permanente Animationen in Phase 1

## Benutzererlebnis

### Editor

Der Editor bietet zunächst visuelle, typisierte Eingaben statt JavaScript:

- Szenentyp oder didaktisches Preset auswählen
- Achsengrenzen, Raster und Seitenverhältnis einstellen
- Elemente aus einer erlaubten Liste hinzufügen
- Eigenschaften in Formularfeldern bearbeiten
- mathematische Ausdrücke mit validierter Grammatik eingeben
- Pflichtbeschreibung für Screenreader
- lokale Live-Vorschau mit Undo/Redo
- verständliche Validierungsfehler am betroffenen Feld

Ein optionaler „Quellmodus“ zeigt später das deklarative FNF-JSON, führt aber
niemals JavaScript aus. Änderungen werden erst nach vollständiger
Schemavalidierung übernommen.

### Study

- Die Szene befindet sich in einem klar abgegrenzten Interaktionsbereich.
- Touch innerhalb der Szene bewegt JSXGraph-Objekte, nicht die gesamte Karte.
- Ein sichtbarer Reset stellt den Ausgangszustand wieder her.
- Eine Tastaturalternative erlaubt Auswahl und Bewegung interaktiver Objekte.
- Werteänderungen werden verständlich angezeigt, ohne permanenten Live-Region-
  Lärm zu erzeugen.
- Antwort anzeigen und Rating bleiben außerhalb der Szene erreichbar.
- Exploration verändert zunächst keinen Lernfortschritt und keine Kartenquelle.
- `(i)` kann Herleitungen, Definitionen und eine statische Wertetabelle zeigen.

## Inhaltsmodell

Das Domain-Paket erhält einen eigenen Block mit versioniertem Szenenmodell:

```ts
type InteractivePlotBlock = {
  type: "interactivePlot";
  version: 1;
  label: string;
  description: string;
  viewport: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    keepAspectRatio: boolean;
    axes: boolean;
    grid: boolean;
  };
  elements: PlotElement[];
};
```

Erlaubte Elemente der ersten Version:

```ts
type PlotElement =
  | PointElement
  | LineElement
  | SegmentElement
  | VectorElement
  | CircleElement
  | ArcElement
  | PolygonElement
  | FunctionGraphElement
  | DataSeriesElement
  | SliderElement
  | MathLabelElement;
```

Jedes Element besitzt:

- stabile, lokal eindeutige ID
- erlaubten Elementtyp
- zugängliches Label
- begrenzte numerische Parameter
- feste Darstellungsoptionen aus FNF-Enums
- optionalen `interactive`-Status
- keine Funktionen, Eventhandler, URLs oder beliebigen Attribute

## Mathematische Ausdrücke

Funktionsgraphen speichern niemals JavaScript. Ein beschränkter Parser wandelt
Autoreneingaben in einen kanonischen Ausdrucksbaum um.

Erlaubte erste Grammatik:

- Variable `x`
- numerische Konstanten
- Konstanten `pi` und `e`
- `+`, `-`, `*`, `/` und ganzzahlige bzw. begrenzte reelle Potenzen
- Klammern
- `sin`, `cos`, `tan`, `sqrt`, `abs`, `exp`, `ln` und `log10`

Beispiel:

```ts
{
  type: "add",
  left: { type: "power", base: { type: "variable", name: "x" }, exponent: 2 },
  right: { type: "number", value: -1 }
}
```

Grenzen:

- höchstens 200 AST-Knoten
- höchstens 32 Verschachtelungsebenen
- keine Bezeichner außerhalb der Allowlist
- keine Zuweisung, Schleife, Rekursion oder Funktionsdefinition
- keine Property-Zugriffe oder globalen Objekte
- nicht endliche Ergebnisse werden als Lücke behandelt
- Auswertung besitzt Abbruch-, Bereichs- und Samplinggrenzen

Die normalisierte AST-Darstellung ist autoritativ. Der lesbare Ausdruck kann als
Editorquelle erhalten bleiben, wird aber vor jedem Speichern erneut gegen den
AST geprüft.

## Szenengrenzen

- höchstens 100 Elemente pro Szene
- höchstens 20 interaktive Elemente
- höchstens 4 Slider
- höchstens 2.000 diskrete Datenpunkte insgesamt
- Achsgrenzen endlich und innerhalb eines festgelegten Wertebereichs
- Breite und Höhe werden von der App bestimmt, nicht aus Kartendaten
- Farbauswahl nur aus kontrastgeprüften FNF-Tokens
- Linienbreiten, Punktgrößen und Schriftgrößen in begrenzten Enums
- keine Bilder, `foreignObject`, frei definierte CSS-Klassen oder HTML-Texte
- keine Szenenreferenz auf andere Karten, Dateien oder Netzressourcen

## Rendering-Architektur

```text
InteractivePlotBlock
  -> Domain-Schema und Ausdrucks-AST
  -> reine Validierung
  -> apps/web JSXGraph-Adapter
  -> lokale Board-Instanz
  -> kontrollierte JSXGraph-Elemente
  -> Touch-/Tastatur-/Screenreader-Schicht
```

- Domain-Pakete importieren JSXGraph nicht.
- Die JSXGraph-Abhängigkeit gehört in `apps/web` und wird lazy geladen.
- Capacitor verwendet denselben Adapter und dieselbe gepinnte Version.
- Der Adapter enthält die einzige Zuordnung von FNF-Elementen zu JSXGraph-API-
  Aufrufen.
- Unbekannte Block- oder Elementversionen zeigen einen sicheren Fallback.
- Jede Board-Instanz wird beim Kartenwechsel oder Unmount vollständig freigegeben.
- ResizeObserver, Pointerlistener und Animationen werden deterministisch entfernt.
- Es gibt keine versteckte globale Board-Registry als fachliche Datenquelle.

## Sicherheitsmodell

JSXGraph ist eine JavaScript-Bibliothek und erwartet normalerweise Funktionen
und Eventhandler. FNF darf diese mächtige API nicht direkt an Kartendaten
durchreichen.

Verbindliche Schutzmaßnahmen:

1. ausschließlich typisierte FNF-Szenen akzeptieren
2. keine Ausführung von Kartenstrings als JavaScript
3. mathematische Ausdrücke nur über eigenen begrenzten Parser/AST auswerten
4. JSXGraph-Attribute per Elementtyp allowlisten
5. `image`, `foreignObject`, HTML-Text, Button, Input, Checkbox und unbekannte
   Erweiterungselemente in Phase 1 sperren
6. keine URLs, AJAX-Aufrufe, dynamischen Module oder externen Fonts
7. keine aus Kartendaten erzeugten Eventhandler
8. Rechen-, Sampling-, Element- und Renderzeit begrenzen
9. ungültige Szenen vollständig ablehnen statt teilweise weiterzuverarbeiten
10. sichere Textalternative anzeigen, wenn Initialisierung oder Rendering
    fehlschlägt

Importiertes Anki-JavaScript, JSXGraph-Beispielcode oder `<script>`-Inhalte
werden niemals in einen interaktiven Plot konvertiert. Eine spätere Importhilfe
darf ausschließlich erkannte statische Daten in das deklarative FNF-Schema
überführen.

## Datenschutz und Local-first

- Szenen, Ausgangswerte und Lernziele bleiben in SQLite bzw. IndexedDB.
- Die Bibliothek und alle Assets werden lokal ausgeliefert.
- Darstellung und Ausdrucksauswertung benötigen weder VPS noch CDN.
- Keine Szene, Interaktion oder mathematische Eingabe wird an Dritte übertragen.
- Temporäre Drag-/Sliderzustände bleiben standardmäßig flüchtig.
- Nur ausdrücklich definierte Lernantworten können als normale lokale
  Review-Ereignisse gespeichert werden.
- Sync repliziert Szenenquelle und fachlich definierte Kartenänderungen, nicht
  jeden Pointer- oder Slider-Zwischenstand.
- Es entstehen keine neuen Cookies, Tracker oder externen Empfänger.

## Barrierefreiheit

Interaktive Graphen sind ohne zusätzliche Ebene nicht automatisch zugänglich.
Jede Szene benötigt deshalb:

- verpflichtende Textbeschreibung
- linearisierte Liste aller relevanten Objekte und Beziehungen
- zugängliche Werte-/Koordinatentabelle
- tastaturbedienbare Auswahl interaktiver Objekte
- Pfeiltasten für kleine Schritte, modifizierte Pfeiltasten für größere Schritte
- angesagte aktuelle Koordinate bzw. aktueller Sliderwert
- sichtbaren Fokus und Reset
- alternative numerische Eingabe für Drag-only-Aufgaben
- Bedeutung nicht ausschließlich durch Farbe
- reduzierte Bewegung bei `prefers-reduced-motion`

Eine bewertbare Aufgabe darf niemals ausschließlich präzises Ziehen verlangen.
Es muss eine Tastatur- oder Werteingabealternative geben.

## Lerninteraktionen

### Phase 1: Exploration

Interaktionen verändern nur den flüchtigen Boardzustand. Die Karte wird wie
üblich nach dem Aufdecken der Antwort bewertet.

Beispiele:

- Slider verändert Steigung einer Geraden
- Punkt wandert auf einer Parabel
- Sekante nähert sich einer Tangente
- Dreieck wird verändert, während eine Invariante sichtbar bleibt

### Phase 2: definierte Aufgaben

```ts
type PlotTask =
  | { kind: "selectElement"; targetIds: string[] }
  | {
      kind: "placePoint";
      pointId: string;
      target: [number, number];
      tolerance: number;
    }
  | { kind: "setSlider"; sliderId: string; target: number; tolerance: number }
  | {
      kind: "numericAnswer";
      expressionId: string;
      target: number;
      tolerance: number;
    };
```

- Toleranzen sind explizit und fachlich begründet.
- Erfolg wird lokal deterministisch berechnet.
- Ein Fehlversuch verändert nicht die Kartenquelle.
- Bewertung und FSRS-Ereignis bleiben der vorhandenen Study-Logik vorbehalten.
- Automatische Erfolgsmeldung ersetzt nicht die normale Selbsteinschätzung,
  solange keine separate Lernintegritätsentscheidung getroffen wurde.

## Beispielszene

```json
{
  "type": "interactivePlot",
  "version": 1,
  "label": "Lineare Funktion",
  "description": "Koordinatensystem mit der Geraden y gleich m mal x plus b.",
  "viewport": {
    "xMin": -5,
    "xMax": 5,
    "yMin": -5,
    "yMax": 5,
    "keepAspectRatio": true,
    "axes": true,
    "grid": true
  },
  "elements": [
    {
      "type": "slider",
      "id": "slope",
      "label": "Steigung m",
      "min": -3,
      "max": 3,
      "step": 0.25,
      "initial": 1
    },
    {
      "type": "functionGraph",
      "id": "line",
      "label": "Gerade y gleich m mal x",
      "expression": {
        "type": "multiply",
        "left": { "type": "parameter", "id": "slope" },
        "right": { "type": "variable", "name": "x" }
      }
    }
  ]
}
```

Die tatsächliche Schemaform wird vor Umsetzung als ADR und kanonische Zod-
Definition festgelegt; das Beispiel beschreibt die Produktabsicht.

## Import, Export und Sync

- FNF-Export enthält Szenenversion, AST, Elemente, Labels und Beschreibung.
- Ältere Clients zeigen Beschreibung und strukturierte Wertetabelle als
  Fallback.
- Import akzeptiert nur das FNF-Schema, nicht beliebigen JSXGraph-Code.
- Anki- und HTML-Import behalten unbekannte Skripte deaktiviert als Quellhinweis,
  ohne sie auszuführen.
- Sync behandelt die Szene wie übrigen strukturierten Karteninhalt.
- Änderungen verwenden stabile Element-IDs und normale idempotente Mutationen.
- Der Wire-Fingerprint wird bei Aufnahme des Blocktyps aktualisiert.
- Temporäre Interaktionszustände gelangen nicht in Outbox oder Review-Sync.

## Performance und Batterie

- JSXGraph wird nur bei sichtbarer Szene dynamisch geladen.
- Pro sichtbarem Block existiert genau eine Board-Instanz.
- Kein Polling und keine dauerhafte `requestAnimationFrame`-Schleife im
  Ruhezustand.
- Animationen starten ausschließlich durch Nutzeraktion, besitzen eine
  Höchstdauer und stoppen bei Kartenwechsel, Hintergrund oder Reduced Motion.
- Pointerbewegungen werden auf bildschirmgerechte Frequenz begrenzt.
- Funktionssampling ist begrenzt und wird nicht bei jeder Layoutänderung
  vollständig neu gestartet.
- Offscreen-Szenen pausieren bzw. werden freigegeben.
- Speicher, CPU, Wärme und Akku werden auf realem iPhone und iPad profiliert.

## Umsetzungsschritte

1. ADR für deklarative interaktive Lernszenen und Ausdrucks-AST erstellen.
2. MIT-Lizenzoption und transitive Lizenzen der gepinnten JSXGraph-Version
   prüfen; Third-Party Notices ergänzen.
3. Domain-Schema, Limits und versionierten Fallback definieren.
4. sicheren Ausdrucksparser und deterministischen Evaluator implementieren.
5. JSXGraph-Adapter für Phase-1-Elemente implementieren.
6. Lifecycle, Lazy Loading, Resize und Ressourcenfreigabe absichern.
7. Editorformulare und Vorschau ergänzen.
8. Study- und `(i)`-Darstellung mit Touch-/Tastaturgrenzen integrieren.
9. Export, Restore, Sync und alter Client-Fallback ergänzen.
10. Accessibility-Alternative und linearisierte Wertetabelle implementieren.
11. Sicherheits-, Performance- und Real-Device-Abnahme abschließen.
12. Erst danach bewertbare Phase-2-Aufgaben freigeben.

## Tests

### Domain und Mathematik

- gültige und ungültige Szenen pro Elementtyp
- doppelte oder ungültige IDs
- numerische Grenzen, NaN und Unendlichkeit
- AST-Operatoren, Funktionsallowlist und Verschachtelungslimits
- Division durch null und Definitionslücken
- deterministische Auswertung und Rundung
- Schema-Roundtrip, Export, Import und Fallback

### Security

- JavaScript-Ausdrücke, Zuweisungen und Property-Zugriffe
- `constructor`, `prototype`, globale Objekte und Funktionsdefinitionen
- URLs, externe Bilder, HTML, SVG-Fragmente und Eventhandler
- unbekannte JSXGraph-Attribute und Erweiterungen
- übergroße Datenreihen und pathologische Funktionen
- kein Netzwerkzugriff während Initialisierung und Interaktion
- importiertes Anki-Skript bleibt inaktiv

### UI und Accessibility

- Punkt-, Slider- und Resetbedienung per Touch und Tastatur
- alternative numerische Eingabe
- VoiceOver-Reihenfolge und verständliche Wertansagen
- iPhone, iPad, große Schrift, 200 % Zoom und beide Themes
- keine Überlappung mit Karten-, `(i)`- oder Ratingsteuerung
- reduzierte Bewegung
- sichere Fehler- und Fallbackdarstellung

### Performance und Persistenz

- Lazy Loading und erstes Öffnen
- schneller Kartenwechsel während Interaktion
- mehrere Szenen in langem `(i)`-Inhalt
- Hintergrund/Vordergrund und Prozessneustart
- keine persistierenden Timer, Observer oder Board-Instanzen
- Offlinebetrieb ohne CDN/VPS
- Export/Restore und direkter Geräteabgleich

## Abnahmekriterien

- alle Szenen rendern lokal und offline in Web und iOS-WebView
- Kartendaten enthalten und starten kein JavaScript
- Funktionsausdrücke werden ausschließlich über den begrenzten AST ausgewertet
- keine externe Datenübertragung oder Ressource ist erforderlich
- Touch, Tastatur und Screenreader erhalten gleichwertige Lernwege
- Kartenwechsel und Hintergrund stoppen jede aktive Arbeit
- ungültige Szene führt zu verständlichem Fallback ohne Datenverlust
- Export, Restore, Sync und ältere Clients bewahren den Inhalt
- Lizenz- und Copyright-Hinweise entsprechen der ausgelieferten Version

## Reviewstatus vor Implementierung

- **erfüllt:** Die MIT-Option erlaubt die geplante lokale und kommerzielle
  Nutzung von JSXGraph.
- **erfüllt:** Der bestehende strukturierte Content-Ansatz ermöglicht ein
  deklaratives Szenenschema ohne Plattformabhängigkeit im Domain-Paket.
- **offen:** Ausdrucksparser, Adapter, Lifecycle, Accessibility und iOS-
  Profilierung müssen implementiert und verifiziert werden.
- **Release-Blocker:** beliebiges JavaScript/JessieCode, direkte JSXGraph-API in
  Kartendaten, externe URLs oder unbereinigte HTML-/SVG-Inhalte.
- **anwaltlich prüfen:** finale MIT-Lizenzwahl, Copyright-Notice und transitive
  Lizenzen der tatsächlich ausgelieferten JSXGraph-Version.
