# Music / abcjs – Umsetzungsplan für Flash-n-Flip

## Status und Zielbild

abcjs wird als lokal ausgeführter Notensatz-Renderer für Flash-n-Flip
eingeführt. Karten speichern eine begrenzte, validierte Teilmenge der
ABC-Notationssprache und zeigen daraus responsiven Notensatz auf Web, iPhone und
iPad. Lokale Klavierwiedergabe, Abspielcursor und die synchronisierte
88-Tasten-Klaviatur sind umgesetzt; weitere Instrumente bleiben eigene,
separat zu lizenzierende Klang- und Lernansichten.

Das Produktziel ist kein allgemeiner Noteneditor, sondern ein sicherer
Musik-Lernbaustein für:

- Noten- und Pausenerkennung
- Tonarten, Vorzeichen und Taktarten
- Intervalle, Tonleitern und Akkorde
- Rhythmuslesen und Rhythmusdiktat
- Melodieanalyse
- mehrstimmige Beispiele
- Verbindung von Notenbild, Klang und Fachbegriff

Die sichtbare Kartenfrage bleibt knapp. Ausführliche Musiktheorie, Herleitungen,
Spielhinweise und typische Fehler erscheinen über `(i)` als
`supplementalContent`.

## Lizenz und kommerzielle Nutzung

- abcjs wird unter der MIT-Lizenz veröffentlicht.
- Die MIT-Lizenz erlaubt Nutzung, Änderung und Verteilung, einschließlich
  kommerzieller Nutzung.
- Copyright- und Lizenztext müssen mit ausgelieferten Kopien bzw. wesentlichen
  Teilen der Software erhalten bleiben.
- Die abcjs-Version wird exakt gepinnt; Lockfile, ausgelieferte Dateien und
  transitive Lizenzen werden vor Release erneut geprüft.
- `docs/THIRD_PARTY_NOTICES.md` wird um abcjs, Copyright-Angabe,
  Lizenzbezeichnung und Upstream-URL ergänzt.
- Die Lizenzbewertung ersetzt keine anwaltliche Freigabe. Vor öffentlicher
  Store- oder Web-Distribution bleibt eine qualifizierte Abschlussprüfung
  sinnvoll.

Offizielle Quellen:

- <https://github.com/paulrosen/abcjs>
- <https://github.com/paulrosen/abcjs/blob/main/LICENSE.md>
- <https://docs.abcjs.net/>

### Separate Lizenzgrenze für Instrumentklänge

abcjs kann Noten über WebAudio und Soundfonts wiedergeben. Die MIT-Lizenz von
abcjs erteilt jedoch nicht automatisch Rechte an einem externen Soundfont oder
den darin enthaltenen Instrument-Samples.

Deshalb gilt:

- Phase 1 liefert ausschließlich Notensatz und benötigt keinen Soundfont.
- Phase 2 startet erst, wenn ein konkreter Soundfont technisch, urheberrechtlich
  und lizenzseitig geprüft ist.
- Soundfont, Einzeldateien, Urheber, Lizenz, Änderungen und Quelle werden in den
  Third-Party Notices dokumentiert.
- Alle benötigten Samples werden lokal mit der Web-/Capacitor-App ausgeliefert;
  der abcjs-Standardpfad zu externen Soundfont-URLs wird nicht verwendet.
- Unklare oder inkompatible Sample-Rechte sind ein Release-Blocker für
  Wiedergabe, nicht für den reinen Notensatz.

## Produktphasen

### Phase 1: Notensatz

- einstimmige Melodien
- Violin- und Bassschlüssel
- Tonart und Taktart
- Noten, Pausen, Punktierungen und Bindungen
- Vorzeichen
- Akkordsymbole
- einfache Liedtexte
- begrenzte Mehrstimmigkeit
- responsive Darstellung und Druck-/Export-Fallback

### Phase 2: lokale Klavierwiedergabe (umgesetzt)

- Zum Anfang, Takt/Note zurück, Start/Stopp sowie Note/Takt vor
- sichtbarer Abspielcursor
- synchronisierte 88-Tasten-Klaviatur mit mehreren aktiven Tönen
- vollständig lokale, CC0-lizenzierte Klavier-Samples

Flöte, Gitarre, Violine und weitere Instrumente sind keine Darstellungsvarianten
der Klaviatur. Jedes zusätzliche Instrument benötigt einen eigenen geprüften
Soundfont sowie eine passende Lernansicht, etwa Griffbrett, Saiten oder
instrumentenspezifische Griffe.

### Phase 3: Lerninteraktion

- Note oder Pause auswählen
- Intervall markieren
- richtigen Takt auswählen
- fehlende Note aus Antwortalternativen ergänzen
- Akkord oder Tonart bestimmen
- Rhythmusfolge ordnen
- gehörte Phrase einer Notation zuordnen

### Spätere, separat zu prüfende Erweiterungen

- MIDI-Import und -Export
- MusicXML-Konvertierung
- Mikrofon-/Tonhöhenerkennung
- Einspielen über MIDI-Geräte
- freie Noteneingabe im vollständigen Editor
- Mehrspurarrangements und große Partituren

Mikrofon- oder MIDI-Gerätezugriff ist nicht Teil dieses Plans und würde eine
eigene Datenschutz-, Berechtigungs-, Accessibility- und Plattformprüfung
erfordern.

## Nicht-Ziele

- kein allgemeiner DAW- oder Partitureditor
- keine Ausführung beliebiger ABC-Direktiven
- kein externes CDN oder Soundfont-Hosting
- kein MIDI.js-Legacy-Pfad
- keine externen Bilder, PostScript-, SVG- oder HTML-Einbettungen
- kein ungeprüfter MIDI-Download als `data:`-URL
- keine automatische Wiedergabe beim Öffnen einer Karte
- keine Hintergrundwiedergabe nach Kartenwechsel
- keine dauerhafte Animation oder AudioContext-Aktivität im Ruhezustand
- keine Bewertung, die ausschließlich präzises Tippen auf kleine Notenköpfe
  verlangt

## Benutzererlebnis

### Editor

Der Karteneditor erhält einen eigenen Block „Notensatz (ABC)“ mit:

- Quelltextfeld in Monospace-Darstellung
- sicherem Minimalbeispiel
- lokal gerenderter Vorschau
- Pflichtfeldern für Titel und Textalternative
- Auswahl unterstützter Grundoptionen wie Schlüssel, Takt und Standardtempo
- verständlichen Fehlern mit Position, soweit der Parser sie liefert
- verzögerter Vorschau nach einer kurzen Eingabepause
- `(i)`-Syntaxhilfe mit den von FNF unterstützten ABC-Feldern

Die erste Editorversion muss keine grafische Noteneingabe anbieten. Änderungen
werden nur gespeichert, wenn Domain-Schema, ABC-Allowlist und Renderprobe
erfolgreich sind. Ein Fehler überschreibt niemals die zuletzt gespeicherte
gültige Karte.

### Study

- Der Notensatz passt sich der Kartenbreite an.
- Kleine Beispiele bleiben ausreichend groß und werden nicht gequetscht.
- Lange Systeme umbrechen kontrolliert oder scrollen innerhalb eines klaren
  Notenbereichs.
- Notenbereich, `(i)`, Antwort und Ratings überlappen sich nicht.
- Die Karte bietet auf Wunsch eine linearisierte Textansicht.
- Bei Renderfehlern erscheinen Titel, Beschreibung und sichere ABC-Quelle.
- Ein sichtbarer Fokus- bzw. Auswahlzustand ergänzt Farbe durch Kontur und
  Textstatus.

### Wiedergabe

- Wiedergabe beginnt ausschließlich nach Nutzeraktion.
- Es existiert nur eine aktive Musik- oder Karten-Audioquelle gleichzeitig.
- Die sechs Lucide-Steuerungen haben verständliche deutsche und englische
  Labels; ein Fortschrittsbalken entfällt zugunsten des Cursors im Notenbild.
- Die vorhandene globale Leertastensteuerung wird eindeutig integriert, ohne
  Eingabefelder oder andere aktive Medien zu übernehmen.
- Kartenwechsel, Schließen, App-Hintergrund und Prozessunterbrechung stoppen die
  Wiedergabe und den Cursor deterministisch.
- Lautstärke-/Gain-Regeln und Peak-Begrenzung werden mit dem bestehenden
  FNF-Audiopfad abgestimmt.

## Inhaltsmodell

abcjs erhält keinen direkten Platz im Domain-Paket. Das Domain-Paket enthält nur
einen versionierten, strukturierten Vertrag:

```ts
type MusicScoreBlock = {
  type: "musicScore";
  version: 1;
  abc: string;
  label: string;
  description: string;
  display: {
    staffScale: "small" | "normal" | "large";
    sizePercent: number; // 50 bis 120
    selectedVoice?: string;
    keyboard: "off" | "keys" | "notes";
    responsive: true;
  };
};
```

Die kompakte Markdown-Schreibweise lautet beispielsweise
`music{size=70% select=RH keyboard=notes}`. ABC-Akkorde wie `[CEG]` erzeugen
mehrere gleichzeitige Töne innerhalb einer Stimme; das Vier-Stimmen-Limit ist
kein Limit für die Zahl gleichzeitig klingender Akkordtöne.

Verbindliche Grenzen:

- `abc`: 1 bis 30.000 Zeichen
- `label`: 1 bis 300 Zeichen
- `description`: 1 bis 5.000 Zeichen
- höchstens 16 Systeme bzw. 128 Takte
- höchstens 4 Stimmen
- höchstens 2.000 musikalische Ereignisse
- höchstens 200 Liedtextsilben
- begrenzte Akkord-, Titel- und Annotationstexte
- keine Steuerzeichen außer erlaubten Leerzeichen, Tabs und Zeilenumbrüchen

Die Grenzen werden nach realer iOS-Profilierung gegebenenfalls enger gesetzt.

## Unterstützte ABC-Teilmenge

### Erlaubte Headerfelder in Phase 1

- `X:` Referenznummer, intern normalisiert
- `T:` kurzer Titel
- `M:` Taktart
- `L:` Standardnotenlänge
- `Q:` Tempoangabe, nur für spätere Wiedergabe bzw. sichtbare Metronomangabe
- `K:` Tonart und Schlüssel
- `V:` begrenzte Stimmenkennung und allowlist-geprüfte Attribute

### Erlaubte musikalische Inhalte

- Noten A–G bzw. a–g
- Pausen
- Oktavzeichen
- Notenlängen und Punktierung
- Taktstriche und Wiederholungszeichen aus der freigegebenen Teilmenge
- Bindebögen und Haltebögen
- Vorzeichen
- Akkordsymbole als begrenzter Text
- Liedtext über `w:` mit reiner Textbehandlung
- einfache Verzierungen nach expliziter Allowlist

### Verbotene Inhalte

- sämtliche unbekannten `%%`-Direktiven
- PostScript-, EPS- oder SVG-Anweisungen
- HTML, Skripte und Eventattribute
- externe Bilder, Fonts, Audio- oder Datenquellen
- URLs und Pfadangaben
- Include-/Importmechanismen
- benutzerdefinierte JavaScript-Funktionen oder Callbacks
- MIDI-Download- oder Soundfont-URLs
- frei definierbare CSS-Klassen und Styles

FNF verwendet keine Blocklist als alleinige Grenze. Phase 1 akzeptiert nur eine
explizite Allowlist. Neuere abcjs-Versionen oder ABC-Standarderweiterungen
werden nicht automatisch freigeschaltet.

## Rendering-Architektur

```text
MusicScoreBlock
  -> Domain-Schema und ABC-Allowlist
  -> kanonische Normalisierung
  -> apps/web abcjs-Adapter
  -> lokaler abcjs-Parser/Renderer
  -> geprüfter app-generierter SVG-DOM
  -> zugänglicher Musikblock
```

- Das Domain-Paket importiert abcjs nicht.
- `apps/web` besitzt den Renderer und lädt abcjs nur bei sichtbarem Musikblock.
- Capacitor nutzt denselben Web-Renderer und dieselbe exakt gepinnte Version.
- Es gibt keinen Server-, CDN- oder VPS-Renderpfad.
- `renderAbc` wird nur mit app-eigenem Zielelement und app-eigener Konfiguration
  aufgerufen.
- Kartendaten dürfen keine Rendereroptionen überschreiben.
- Die ABC-Quelle bleibt autoritativ; Notengrafik und Audio-Buffer sind
  jederzeit neu erzeugbare Ableitungen.
- Ein Cache verwendet nur lokalen Quellhash und wird bei Decklöschung bzw.
  Inhaltsänderung invalidiert.

## SVG- und Content-Sicherheit

abcjs erzeugt Notensatz als SVG. Die aktuelle Content-Policy verbietet
SVG-Markup in Karteninhalten; daran ändert sich nichts. Ein ADR muss vor
Umsetzung festlegen, dass ausschließlich der app-eigene abcjs-Adapter
flüchtigen, allowlist-geprüften SVG-DOM erzeugen darf.

Verbindliche Maßnahmen:

1. ABC-Quelle vor dem Renderer mit kanonischem Parser/Allowlist validieren
2. keine ABC-Quelle per `innerHTML` einsetzen
3. abcjs ausschließlich lokal und mit fester Konfiguration aufrufen
4. erzeugten DOM auf erlaubte SVG-Elemente und Attribute prüfen
5. `script`, `foreignObject`, Eventattribute, Links, externe Referenzen,
   `style`-Blöcke, `url(...)`, unbekannte Namespaces und eingebettete Daten
   vollständig verwerfen
6. keine unbekannte abcjs-Ausgabe teilweise anzeigen
7. Rendering zeitlich und mengenmäßig begrenzen
8. Fehler als sichere Textalternative statt Renderer-HTML darstellen

Ungeprüftes SVG, externe Referenzen oder ausführbarer Inhalt sind
Release-Blocker.

## Audioarchitektur für Phase 2

abcjs erzeugt über WebAudio einen Audio-Buffer für ein Musikstück. Die
offizielle Dokumentation weist darauf hin, dass Dauer, Instrumentvielfalt und
einzigartige Tonhöhen Speicher und Rechenzeit erhöhen. Deshalb gelten:

- maximal 120 Sekunden Wiedergabedauer pro Karte
- zunächst genau ein geprüftes Instrument
- begrenzte Polyphonie und Stimmenzahl
- AudioContext erst nach ausdrücklicher Nutzeraktion erstellen oder fortsetzen
- Buffererzeugung abbrechbar und nicht parallel für unsichtbare Karten
- höchstens ein aktiver Synth-/AudioContext-Pfad pro App
- Buffer und Soundfont-Samples nicht über Direct Sync replizieren
- Audio bei Kartenwechsel, App-Hintergrund oder Unmount stoppen
- AudioContext danach suspendieren oder schließen, wenn er nicht wiederverwendet
  wird
- keine Wiederholungsschleife als Standard
- lokale Soundfont-Fehler führen zu Notensatz ohne Wiedergabe, nicht zu
  Kartenverlust

Die vorhandene Audio-Gain- und Peak-Limitierung wird wiederverwendet oder in
einer gemeinsamen app-eigenen Audioausgabe abstrahiert. abcjs darf keinen
zweiten unkoordinierten globalen Audiopfad etablieren.

## Datenschutz und Local-first

- ABC-Quelle, Beschreibung und Lernziele bleiben in IndexedDB bzw. SQLite.
- abcjs, CSS, optionale Soundfonts und sonstige Assets werden lokal ausgeliefert.
- Kein Notentext wird an abcjs-Demos, CDN, Soundfont-Server oder VPS übertragen.
- Es entstehen keine Cookies, Tracker, Telemetrieereignisse oder neuen externen
  Empfänger.
- Sync repliziert den strukturierten Musikblock, nicht generiertes SVG,
  Audio-Buffer oder laufende Abspielpositionen.
- Abspielposition und temporäre Auswahlzustände bleiben flüchtig, sofern nicht
  später ausdrücklich ein lokales Übungsfeature definiert wird.
- Mikrofon- und MIDI-Gerätedaten sind außerhalb des Scopes.

## Urheberrecht an Musikinhalt

Die freie abcjs-Lizenz bedeutet nicht, dass jede damit dargestellte Komposition,
Bearbeitung, Notenausgabe, Liedtextaufnahme oder Instrumentprobe frei genutzt
werden darf.

Für kuratierte oder später öffentlich eingereichte Musikdecks gilt:

- Quelle, Urheber, Bearbeitung und Lizenz jeder Komposition dokumentieren
- Gemeinfreiheit nicht allein aus dem Alter der ursprünglichen Komposition
  ableiten; moderne Bearbeitung und konkrete Notenausgabe getrennt prüfen
- Liedtexte und Arrangements eigenständig lizenzieren
- Audioaufnahmen und Soundfonts separat nachweisen
- Lizenzangaben mit jeder öffentlichen Revision erhalten
- ungeklärte Rechte blockieren Veröffentlichung, nicht private lokale Nutzung

Diese Bewertung ist vor einer öffentlichen Musikbibliothek anwaltlich zu
prüfen.

## Barrierefreiheit

Notenschrift ist primär visuell. abcjs-SVG allein bildet daher keinen
gleichwertigen Zugang. Jeder Musikblock benötigt:

- verpflichtenden Titel und verständliche Textbeschreibung
- Tonart, Taktart, Schlüssel und Stimmenzahl als zugängliche Metadaten
- linearisierte Takt-/Ereignisansicht
- optional eine kompakte, zugängliche Noten- und Rhythmustabelle
- Tastaturnavigation nach System, Takt und musikalischem Ereignis
- sichtbaren Fokus und angesagte aktuelle Auswahl
- alternative Auswahl über Liste oder Antwortschaltflächen
- Textalternative für jede visuelle Markierung
- Wiedergabesteuerung mit Rolle, Name, Zustand, Position und Dauer
- keine automatische Wiedergabe

Jede Touchgeste erhält eine Schaltflächen- oder Tastaturalternative. Notenköpfe
allein müssen kein 44×44-Punkte-Ziel sein, wenn eine gleichwertige, mindestens
44×44 große Ereignisnavigation vorhanden ist.

## Lesbarkeit und Kontrast

- Notenköpfe, Pausen, Linien und bedeutungstragende Markierungen erreichen
  mindestens 3:1 zum Hintergrund.
- normaler Text erreicht mindestens 4,5:1; große Überschriften mindestens 3:1.
- Fokus, Auswahl, Abspielcursor und Fehlerzustand erreichen mindestens 3:1 zu
  angrenzenden Farben.
- Auswahl und richtiger/falscher Zustand werden nie nur durch Farbe vermittelt.
- Dark Mode verwendet geprüfte FNF-Tokens; keine bloße CSS-Invertierung des
  gesamten Notenblatts.
- Hilfslinien und Vorzeichen dürfen bei hoher Textskalierung nicht verschwinden.
- 200 % Browserzoom und größte mobile Textgröße erhalten Titel,
  Wiedergabesteuerung und Antwortaktionen.
- lange Partituren scrollen im Notenbereich, ohne die gesamte Study-Seite
  horizontal zu verschieben.

## Lerninteraktionen

### Phase 1: Frage und Aufdeckung

Beispiele:

- „Wie heißt diese Note?“
- „Welche Taktart ist notiert?“
- „Welches Intervall siehst du?“
- „Wo liegt der rhythmische Fehler?“
- „Welcher Akkord wird dargestellt?“

Die Antwortseite kann denselben Notensatz mit app-eigener Markierung zeigen.
Ausführliche Theorie steht in `(i)`.

### Phase 2: Hören und Zuordnen

- Notation vorhersagen, dann Phrase abspielen
- zwei Rhythmen vergleichen
- Intervall oder Akkord hören und aus begrenzten Antworten auswählen
- Wiedergabetempo reduzieren, ohne Tonhöhe zu verändern

### Phase 3: strukturierte Ziele

```ts
type MusicTarget = {
  id: string;
  sourceRange: { start: number; end: number };
  kind: "note" | "rest" | "measure" | "chord" | "key" | "meter";
  prompt: string;
};
```

Mögliche Aufgaben:

- genau eine Note oder Pause auswählen
- alle Noten eines Intervalls markieren
- einen Takt mit falschem Notenwert finden
- passende Antwortnote aus sicheren Optionen einsetzen

Ziele referenzieren kanonische ABC-Quellbereiche bzw. stabile Parserereignisse,
nicht instabile SVG-IDs. Nach einer Quelländerung müssen alle Ziele erneut
validiert werden.

## Import, Export und Sync

- Markdown kann einen expliziten `abc`-Codeblock nach vollständiger Validierung
  in einen `musicScore`-Block konvertieren.
- Unbekannte oder verbotene ABC-Syntax bleibt sicherer Codeblock.
- Anki-HTML, JavaScript und Add-ons werden niemals als abcjs-Code ausgeführt.
- MIDI- oder MusicXML-Import kommt erst nach separater Parser- und
  Content-Security-Prüfung.
- FNF-Export speichert ABC-Quelle, Blockversion, Label, Beschreibung und
  Lernziele.
- Ältere Clients zeigen Textalternative und ABC-Quelle, statt den Inhalt zu
  verlieren.
- Sync behandelt Musikblöcke wie übrigen strukturierten Karteninhalt.
- Wire-Fingerprint und lokale Protokollgeneration werden bei Aufnahme des neuen
  Blocktyps aktualisiert.
- Soundfonts, generierte SVGs und Audio-Buffer sind App-Assets/Ableitungen und
  keine privaten Sync-Entitäten.

## Performance und Batterie

- abcjs wird per Code-Splitting nur bei sichtbarem Musikblock geladen.
- Unsichtbare Karten rendern oder synthetisieren nicht vorab.
- Quellhash verhindert identisches erneutes Rendering.
- Editorvorschau verwendet Debounce und verwirft veraltete Aufträge.
- Abspielcursor läuft nur während aktiver Wiedergabe.
- `requestAnimationFrame`, Timer, AudioNodes und Listener werden beim Stoppen
  vollständig beendet.
- `visibilitychange`, Kartenwechsel und Unmount stoppen Wiedergabe und Cursor.
- Soundfont- und Audio-Buffer besitzen begrenzte, nachvollziehbare Cachegrößen.
- reale iPhone-/iPad-Profile prüfen CPU, Speicher, Wärme und Akku.

## Technische Umsetzungsschritte

1. ADR für deklarative Musikblöcke, ABC-Allowlist, app-generiertes SVG und
   Audio-Lifecycle erstellen.
2. abcjs-Version exakt pinnen und Bibliotheks-/Transitivlizenzen prüfen.
3. `docs/THIRD_PARTY_NOTICES.md` um abcjs ergänzen.
4. Domain-Schema, Größenlimits, Normalisierung und Fallback definieren.
5. ABC-Allowlist-Validator implementieren und gegen den abcjs-Parser testen.
6. lazy geladenen Notensatzadapter in `apps/web` implementieren.
7. erzeugten SVG-DOM prüfen und unsichere Ergebnisse vollständig verwerfen.
8. Editorblock, Vorschau, Syntaxhilfe und Fehlerzustände ergänzen.
9. Study-, `(i)`-, Textalternative- und Ereignislistenansicht ergänzen.
10. Export, Restore, Direct Sync und alten Client-Fallback ergänzen.
11. Web-/iOS-, Accessibility-, Kontrast- und Performance-Abnahme durchführen.
12. Soundfont auswählen und separat lizenzieren, bevor Phase 2 beginnt.
13. gemeinsamen Audio-Lifecycle und lokale Wiedergabe implementieren.
14. erst nach stabiler Darstellung/Wiedergabe bewertbare Lernziele ergänzen.

## Tests

### Domain und Parser

- gültige Beispiele für Schlüssel, Takt, Noten, Pausen, Bindungen und Stimmen
- falsche bzw. fehlende Header
- unbekannte Felder und Direktiven
- Zeichen-, Ereignis-, Stimmen-, Takt- und Verschachtelungsgrenzen
- stabile Normalisierung und Parserereignisse
- Schema-Roundtrip, Export, Import und alter Client-Fallback

### Content Security

- HTML- und Skriptfragmente in Titel, Liedtext, Akkord und Annotation
- `javascript:`, `data:`, `file:`, HTTP(S), Pfade und Include-Versuche
- SVG-, PostScript-, CSS- und unbekannte `%%`-Direktiven
- Eventattribute, Callbacknamen und Soundfont-URLs
- übergroße Partitur, extreme Polyphonie und pathologische Wiederholungen
- unerwartete Elemente oder Attribute im erzeugten SVG
- keine Netzwerkzugriffe bei Rendern oder Wiedergabe

### Rendering und Layout

- Violin-/Bassschlüssel, Vorzeichen, Taktwechsel und Mehrstimmigkeit
- iPhone-Breite, iPad, 200 % Zoom und große Schrift
- Vorderseite, Rückseite und `(i)`
- lange Systeme, Umbruch und interner Scrollbereich
- Hell-/Dunkelmodus und hoher Kontrast
- keine Überlappung mit Study- und Audio-Steuerung

### Accessibility

- vollständige Tastaturbedienung
- VoiceOver auf realem iPhone/iPad
- Titel, Beschreibung, Metadaten und Ereignisliste
- Fokus nach Rendern, Fehler, Reset und Antwortaufdeckung
- Ereignisauswahl ohne präzise Touchgeste
- Wiedergabezustand und Fortschritt verständlich angesagt
- reduzierte Bewegung und kein blinkender Cursor

### Audio und Betrieb

- AudioContext startet nur nach Nutzeraktion
- lokaler Soundfont ohne Netzwerk
- Start, Pause, Neustart, Seek und Tempo
- gleichzeitige Kartenmedien werden koordiniert
- Kartenwechsel und Hintergrund stoppen Audio
- fehlender Soundfont lässt Notensatz nutzbar
- Prozessneustart und Offlinebetrieb
- keine persistenten Timer, AudioNodes oder Animationen

### Recht und Lizenzen

- abcjs-Copyright und MIT-Text in Third-Party Notices
- gepinnte Paketversion entspricht geprüftem Artefakt
- transitive Lizenzen dokumentiert
- Soundfont besitzt separate, kompatible Lizenz und Attribution
- kuratierte Stücke besitzen Quelle und Nutzungsrecht
- keine Veröffentlichung bei ungeklärter Kompositions-, Arrangement-, Text-,
  Aufnahme- oder Samplelizenz

## Abnahmekriterien

- abcjs ist mit MIT-Hinweis vollständig dokumentiert.
- Notensatz rendert vollständig lokal und offline.
- Kartendaten enthalten kein HTML, SVG, JavaScript oder externe URLs.
- unbekannte ABC-Syntax wird nicht ausgeführt und fällt sicher zurück.
- Web und iOS-WebView zeigen denselben musikalischen Inhalt.
- Noten, Texte, Fokus und Auswahl bestehen Kontrast- und Zoomprüfung.
- Screenreader und Tastatur erhalten einen gleichwertigen Lernweg.
- Export, Restore, Sync und ältere Clients verlieren keine ABC-Quelle.
- Phase 2 startet erst mit lokalem, separat lizenziertem Soundfont.
- Wiedergabe stoppt zuverlässig bei Kartenwechsel, Hintergrund und App-Neustart.

## Reviewstatus vor Implementierung

- **erfüllt:** abcjs steht unter MIT und darf im geplanten Umfang auch
  kommerziell lokal genutzt werden.
- **erfüllt:** Die bestehende strukturierte Content-Architektur kann einen
  typisierten `musicScore`-Block aufnehmen.
- **offen:** ABC-Allowlist, SVG-Prüfung, Editor, Textalternative, Lifecycle und
  reale iOS-Abnahme müssen implementiert werden.
- **offen:** Notensatz in Dark Mode und bei 200 % Zoom muss gerendert vermessen
  werden; der Plan allein ist keine bestandene Kontrastprüfung.
- **Release-Blocker:** beliebige ABC-Direktiven, ungeprüftes SVG, externe
  Soundfonts, automatische Wiedergabe oder nicht stoppbarer AudioContext.
- **Release-Blocker:** öffentliche Musikdecks ohne belastbare Rechte an
  Komposition, Bearbeitung, Liedtext, Aufnahme und verwendeten Samples.
- **anwaltlich prüfen:** finale abcjs-/Transitivlizenzprüfung, Soundfontlizenz und
  Rechtekette kuratierter bzw. öffentlich eingereichter Musikstücke.
