# Lernplanerweiterung: Weiterlernen im Flow

## Status

Umgesetzt und automatisiert verifiziert, Stand 16. August 2026. Die reale
iPhone-/iOS-WebView-Abnahme bleibt gemäß Abschnitt 9 Phase F separat.

Dieses Dokument erweitert die in [`learn-algo.md`](learn-algo.md) festgelegte
Lernstrategie. Die dort beschlossenen Regeln zu FSRS, Tagesplan, Lernplan,
Geschwisterkarten, Skalierung und Energieverbrauch bleiben verbindlich.

## 1. Motivation

Ein Tagesplan mit ungefähr 20 Karten kann besonders am Anfang oder nach einem
zügig abgeschlossenen Tagespensum zu früh enden. Wer gerade konzentriert lernt,
soll ohne Umweg über die Deckverwaltung sinnvoll weiterlernen können.

Der bisherige Abschlusszustand bietet entweder nur **Decks öffnen** oder eine
relativ technische Auswahl anhand der letzten Bewertung. Die Erweiterung soll:

- den Lernfluss nach einem abgeschlossenen Tagesplan erhalten,
- zusätzliche neue Karten in klar begrenzten Batches anbieten,
- die wichtige freiwillige Wiederholung bereits gelernter Karten beibehalten,
- die vorhandene Auswahl nach `Nochmal`, `Schwer`, `Gut` und `Leicht`
  weiterhin ermöglichen,
- freiwilliges Üben strikt vom regulären FSRS-Zeitplan trennen,
- und einen spielerischen Memory-Modus für geeignete Frage-Antwort-Paare
  ergänzen.

## 2. Verbindliche Produktentscheidungen

### 2.1 Ein gemeinsamer Bereich „Weiterlernen“

Dashboard und Abschlussansicht verwenden denselben fachlichen und visuellen
Bereich **Weiterlernen**. Es entstehen keine getrennten Konzepte für
Dashboard, Tagesplan und einzelne Decks.

Der Bereich kann abhängig von den verfügbaren Karten folgende Aktionen zeigen:

1. **20 neue Karten**
2. **20 von _n_ Karten wiederholen** beziehungsweise **_n_ Karten
   wiederholen**, wenn weniger als 20 verfügbar sind
3. **Memory · 6 Paare**
4. **Auswahl anpassen** für die vier vorhandenen Bewertungsfilter
5. **Decks auswählen** als nachgeordneter Link

Nicht verfügbare Aktionen werden ausgeblendet. Deaktivierte Schaltflächen ohne
erklärbaren Nutzen sollen vermieden werden.

### 2.2 Die vier Bewertungsfilter bleiben erhalten

Die Checkboxen `Nochmal`, `Schwer`, `Gut` und `Leicht` bleiben als wichtige
bewusste Auswahl erhalten. Sie bestimmen, **welche bereits bewerteten Karten in
die freiwillige Übungsrunde aufgenommen werden**.

Voreinstellung:

- `Nochmal`: ausgewählt
- `Schwer`: ausgewählt
- `Gut`: ausgewählt
- `Leicht`: nicht ausgewählt

Damit entspricht die Voreinstellung weiterhin „alle nicht zuletzt als leicht
bewerteten Karten“. Die Auswahl ist über **Auswahl anpassen** erreichbar und
zeigt für jede Einstufung die aktuell verfügbare Kartenanzahl.

Die Checkboxen bewerten keine Karte neu und verändern selbst keinen
Lernfortschritt.

### 2.3 Freiwilliges Wiederholen verwendet „Weiter“ statt Bewertungen

Innerhalb einer freiwilligen Wiederholungsrunde gibt es nach dem Aufdecken der
Antwort keine Schaltflächen `Nochmal`, `Schwer`, `Gut` oder `Leicht`.
Stattdessen erscheint genau eine Hauptaktion:

**Weiter**

Der Ablauf lautet:

1. Frage anzeigen.
2. Antwort bewusst erinnern.
3. **Antwort zeigen** betätigen.
4. Antwort prüfen.
5. Mit **Weiter** zur nächsten Karte wechseln.

Normale fällige Wiederholungen und neu eingeführte Karten behalten ihre vier
FSRS-Bewertungen. Die Änderung zu **Weiter** gilt ausschließlich für den
freiwilligen Übungsmodus.

### 2.4 Übungsrunden verändern FSRS nicht

Das Betätigen von **Weiter**:

- erzeugt kein reguläres Review-Ereignis,
- verändert weder Fälligkeit noch Stabilität oder Schwierigkeit,
- erhöht weder `reps` noch `lapses`,
- verändert keine Vorschauintervalle,
- erzeugt keine Sync-Outbox-Mutation,
- und verschiebt keine Karte in eine andere FSRS-Phase.

Der Übungsmodus ist damit ein reiner Abruf- und Kontrollmodus. Eine spätere
Statistik über freiwillige Übungen benötigt einen eigenen Ereignistyp und darf
nicht aus regulären Review-Ereignissen abgeleitet werden. Ein solcher
persistenter Übungsverlauf gehört nicht zum ersten Umsetzungsschritt.

### 2.5 Kleine, wiederholbare Batches

Es werden nie alle passenden Karten auf einmal geladen.

- Standard-Batch: maximal 20 Karten
- 1 bis 19 Kandidaten: tatsächliche Zahl anzeigen
- ab 20 Kandidaten und exakt bekanntem Gesamtwert:
  `20 von n Karten wiederholen`
- ist das begrenzte Kandidatenfenster vollständig belegt, ohne die gesamte
  Bibliothek zu scannen: ehrlich `20 Karten wiederholen` statt eines falschen
  Gesamtwerts
- nach Abschluss kann ein weiterer Batch gestartet werden
- kein Button `Alle n Karten`, wenn dadurch eine große Warteschlange entsteht

Diese Begrenzung ist für Bibliotheken mit 100.000 oder mehr Karten sowie für
Speicher-, Laufzeit- und Batterieverbrauch verbindlich.

## 3. Sichtbare Abläufe

### 3.1 Dashboard bei offenem Tagesplan

Solange fällige Karten oder reguläre neue Karten des Tagesplans vorhanden sind,
bleibt **Tagesplan starten** die primäre Aktion. Freiwillige Wiederholungen
dürfen den fälligen Tagesplan nicht verdrängen.

### 3.2 Dashboard nach erledigtem Tagesplan

Anstelle des alleinigen Buttons **Decks öffnen** erscheint:

```text
Für heute geschafft.

Weiterlernen
[ 20 neue Karten ]
[ 20 von 73 Karten wiederholen ]
[ Memory · 6 Paare ]
[ Auswahl anpassen ]

Decks auswählen
```

Sind keine Decks im Lernplan oder keine geeigneten Karten vorhanden, bleibt
**Decks auswählen** als primäre Aktion sichtbar.

### 3.3 Abschluss einer normalen Lernsitzung

Nach einer normalen Tages- oder Decksitzung erscheint derselbe Bereich
**Weiterlernen**. Die Bewertungen der gerade abgeschlossenen Sitzung gelten
sofort für die Kandidatenauswahl, auch wenn eine ältere persistierte Bewertung
vorliegt.

Beispiel: Eine Karte war zuvor `Leicht`, wurde in der aktuellen Sitzung aber
mit `Schwer` bewertet. Sie gehört unmittelbar zum Filter `Schwer`.

### 3.4 Abschluss einer freiwilligen Wiederholungsrunde

Nach einem Übungsbatch zeigt die App:

- Anzahl der angesehenen Karten,
- **Weitere 20 Karten wiederholen**, sofern weitere Kandidaten vorhanden sind,
- **Auswahl anpassen**,
- **Memory spielen**, sofern möglich,
- und **Zur Übersicht**.

Die App behauptet nicht, dadurch seien reguläre Fälligkeiten erledigt oder der
FSRS-Fortschritt verändert worden.

## 4. Auswahl freiwillig zu wiederholender Karten

### 4.1 Gültiger Bereich

Auf dem Dashboard umfasst der Bereich:

- sichtbare, nicht archivierte Decks,
- bereits gelernte Karten aus dem aktiven Lernplan,
- sowie fällige Erhaltungskarten außerhalb des Lernplans nur dann, wenn sie
  bereits im regulären Tagesplan erledigt wurden.

Nach einer gezielten Decksitzung umfasst der Bereich das ausgewählte Deck samt
seinen sichtbaren Unterdecks.

### 4.2 Filterung

Eine Karte ist Kandidat, wenn:

- sie mindestens eine reguläre Bewertung besitzt,
- ihre letzte wirksame Bewertung in einer ausgewählten Checkbox-Kategorie
  liegt,
- sie nicht gelöscht, verborgen oder archiviert ist,
- und sie nicht bereits im aktuellen freiwilligen Übungsbatch enthalten war.

Die Bewertung der gerade beendeten Sitzung überschreibt nur für die Auswahl
des aktuellen Ablaufs die zuvor geladene letzte Bewertung. Die unveränderlichen
Review-Ereignisse selbst bleiben unberührt.

### 4.3 Reihenfolge

Die Kandidatenauswahl ist für denselben Datenstand, dieselbe Filterauswahl und
denselben Batch-Schlüssel deterministisch.

Vorrang innerhalb der ausgewählten Kategorien:

1. `Nochmal`
2. `Schwer`
3. `Gut`
4. `Leicht`

Innerhalb einer Kategorie werden Karten aus Deckgruppen fair gemischt.
Geschwisterkarten werden möglichst getrennt. `linkedToPrevious` und explizit
sequenzielle Inhalte behalten Vorrang vor einer Mischung.

Es wird keine eigene Ersatzformel für FSRS erfunden. FSRS bestimmt weiterhin
nur reguläre Fälligkeiten und Bewertungen; der Übungsfilter verwendet die
gespeicherten Kategorien als vom Nutzer bewusst ausgewähltes Kriterium.

## 5. Zusätzliche neue Karten

### 5.1 Verhalten

**20 neue Karten** startet einen zusätzlichen Batch aus den aktuell aktiven
Lernplan-Decks.

- Die Aktion ist erst primär verfügbar, wenn keine regulären fälligen Karten
  mehr offen sind.
- Sind weniger als 20 neue Karten verfügbar, wird die tatsächliche Anzahl
  angezeigt.
- Die Aktion ändert nicht dauerhaft die Einstellung **Neue Karten pro Tag**.
- Neu eingeführte Karten erhalten `introducedAt` und werden regulär mit den
  vier Bewertungen gelernt.
- Geschwisterregeln und Lernplanhierarchie gelten unverändert.
- Nach dem Batch darf erneut ein weiterer Batch angeboten werden.

### 5.2 Transparenz über Folgelast

Vor oder direkt unter der Aktion steht ein kurzer Hinweis:

> Zusätzliche neue Karten erzeugen in den nächsten Tagen weitere
> Wiederholungen.

Ab dem zweiten zusätzlichen Batch am selben Tag soll die Oberfläche außerdem
die bereits heute zusätzlich eingeführte Zahl nennen. Eine dramatisierende
Bestätigung nach jedem Batch ist nicht erforderlich.

### 5.3 Mehrere Geräte

`introducedAt` bleibt die verbindliche, synchronisierbare Wahrheit. Bei
gleichzeitig offline gestarteten Batches auf mehreren Geräten darf die App
keine exakte globale Obergrenze versprechen. Nach dem nächsten Abgleich müssen
alle eingeführten Karten idempotent zusammengeführt und in späteren
Tageszählungen berücksichtigt werden.

## 6. Memory-Spiel

### 6.1 Zweck und Scheduler-Grenze

Memory ist ein freiwilliger, spielerischer Wiedererkennungsmodus. Es ergänzt
den aktiven Abruf, ersetzt ihn aber nicht.

- keine FSRS-Bewertung,
- kein Review-Ereignis,
- keine Änderung des Tagesplans,
- keine automatisch erzeugte Rückwärtskarte,
- kein Lernfortschritt allein aufgrund eines gefundenen Paares.

Nach einer abgeschlossenen Runde kann optional **Diese Karten aktiv abfragen**
angeboten werden. Auch diese anschließende Abfrage läuft zunächst als
freiwillige Übung mit **Weiter**, nicht als reguläre FSRS-Wiederholung.

### 6.2 Paaranzahl

Erlaubte Größen:

- 4 Paare
- 6 Paare
- 8 Paare
- 10 Paare
- 12 Paare

Voreinstellung:

- iPhone und schmale Ansichten: 6 Paare
- größere Ansichten: 8 Paare

Die zuletzt gewählte Anzahl kann lokal gespeichert werden. Sie wird nicht als
Lernfortschritt synchronisiert.

Die Zahl erlaubter Fehlversuche wird an die Rundengröße angepasst. Gezählt wird
pro physischer Logo-Karte: Bei einer falschen Kombination erhalten nur die zwei
tatsächlich gewählten Karten jeweils einen Fehlversuch. Die beiden Karten eines
Paares teilen keinen Zähler.

| Paare | Fehlversuche pro Karte bis zur Markierung |
| ----: | ----------------------------------------: |
|     4 |                                         2 |
|   6–8 |                                         3 |
| 10–12 |                                         4 |

Technisch entspricht dies `min(4, ceil(Paaranzahl / 4) + 1)`. Erreicht eine
Logo-Karte diese Grenze, gilt das gesamte zugehörige Paar als fehlgeschlagen und
beide Logo-Karten erhalten das rote X. Die Partnerkarte übernimmt dabei nicht
den Fehlerzähler der auslösenden Karte; bis zur Paarmarkierung sammelt jede
physische Karte ausschließlich eigene Fehlversuche. Dadurch führen zwei
verschiedene Karten desselben Paares mit jeweils einem Fehler nicht vorzeitig
zum Fail-Zustand.

### 6.3 Geeignete Karten

Ein Memory-Paar besteht aus der vorhandenen Frage und der vorhandenen Antwort.
Die Karte muss dafür nicht reversibel sein. Beispielsweise kann
`Was ist 3 × 9?` mit `27` ein gültiges Memory-Paar bilden, ohne dass daraus eine
reguläre Rückwärtskarte entsteht.

Für die erste Ausbaustufe geeignet:

- kurzer Text auf beiden Seiten,
- eine eindeutige Text-Bild- oder Bild-Text-Zuordnung,
- kurze Formeln mit zugänglicher Textalternative.

Zunächst ausgeschlossen:

- mehrere identische Antworten in derselben Runde,
- identische Frage und Antwort,
- reine Erklärungskarten,
- bewusst verknüpfte Mehrkartenfolgen,
- sehr lange Texte, Tabellen oder komplexe interaktive Inhalte,
- mehrdeutige Paare, bei denen mehrere Zuordnungen fachlich richtig wären.

Audio-Paare sind eine spätere Erweiterung. Sie benötigen einen vollständig
zugänglichen Play-/Pause-Zustand und eine verständliche Beschriftung.

### 6.4 Spielablauf

1. Paare auswählen und verdeckt mischen.
2. Erstes Logo wählen; ausschließlich dessen vollständig gerenderte Frage oder
   Antwort erscheint im separaten Inhaltsfeld oberhalb des Spielfelds.
3. Zweites Logo wählen; dessen Inhalt ersetzt den ersten Inhalt. Beide Inhalte
   werden niemals gleichzeitig angezeigt.
4. Bei Übereinstimmung beide als gefunden markieren und aus dem sichtbaren
   Spielfeld ausblenden; ihre Plätze bleiben erhalten, damit das Raster nicht
   springt.
5. Bei Nichtübereinstimmung beide nach einer kurzen, reduzierbaren Verzögerung
   wieder schließen.
6. Erreicht eine der beteiligten Logo-Karten ihre größenabhängige Fehlergrenze,
   wird das Paar als fehlgeschlagen gewertet und beide Partnerkarten werden mit
   einem roten X markiert. Auslöser bleibt der individuelle Zähler genau dieser
   Karte.
7. Nach allen Paaren Zeit, Versuche und gefundene Paare anzeigen.

### 6.5 App-Icon als Kartenmotiv

Alle verdeckten Memory-Karten verwenden das vorhandene Flash-n-Flip-App-Icon.
Es werden keine zusätzlichen oder abweichenden Kartenrückseiten eingeführt.

| Zustand          | Darstellung des App-Icons                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `verdeckt`       | grau beziehungsweise monochrom                                                                   |
| `aufgedeckt`     | vollfarbig; das Logo selbst enthält weiterhin keinen Text                                        |
| `gelöst`         | unsichtbar; der belegte Rasterplatz bleibt erhalten                                              |
| `fehlermarkiert` | graues Icon mit klar erkennbarem rotem X; beide Karten des fehlgeschlagenen Paares sind markiert |

Das rote X ist kein eigenständiger Status nur über Farbe: Der zugängliche Name
lautet zusätzlich beispielsweise
`Paar fehlgeschlagen, nachdem eine Karte drei Fehlversuche erreicht hat`.
Die vollfarbige Darstellung signalisiert das Aufdecken ergänzend zum sichtbaren
Frage- beziehungsweise Antwortinhalt.

Der wechselnde Frage-/Antwortbereich nutzt den verfügbaren oberen Raum. Das
Logo-Raster und die Steuerungsbuttons bilden darunter einen stabilen Dock am
unteren Rand, damit lange oder kurze Inhalte die Bedienelemente nicht auf- und
abschieben. Zwischen Raster und Aktionen bleibt ein klarer Abstand. Nach einer
abgeschlossenen Runde stehen `Noch einmal` und `Zur Übersicht` nebeneinander;
der Abschlussstatus erscheint im oberen Inhaltsbereich.

Die Logo-Karten sind klein, randlos und enthalten ausschließlich das App-Icon.
Frage oder Antwort werden mit demselben sicheren Content-Renderer wie normale
Lernkarten in genau einem separaten Feld oberhalb der Logos dargestellt. Damit
werden Wiki-Syntax, Rich Text, Formeln und zulässige Medien aufgelöst, statt als
Rohtext auf der Logo-Karte zu erscheinen. Beim zweiten gewählten Logo ersetzt
der neue Inhalt den vorherigen. Bei einem Treffer verschwinden beide Logos
sofort; eine spätere Animation oder ein Sound ist nicht Teil dieses Schritts.

Es gibt keine globale Rangliste. Ein optionaler persönlicher Bestwert bleibt
lokal und darf nicht Voraussetzung für den Lernfortschritt sein.

## 7. Bedienbarkeit und Barrierefreiheit

### 7.1 Weiterlernen-Bereich

- Jede Aktion hat eine klare Textbeschriftung; Icons sind nur ergänzend.
- Checkboxen verwenden ein echtes `fieldset` mit verständlicher `legend`.
- Verfügbare Anzahlen werden als Text und für Screenreader ausgegeben.
- Nach dem Start wandert der Fokus auf die Überschrift beziehungsweise erste
  Frage der Sitzung.
- Nach Abschluss kehrt der Fokus auf die Überschrift **Weiterlernen** zurück.
- Touchziele sind mindestens 44 × 44 logische Punkte groß.
- 200 Prozent Browserzoom und große mobile Schrift dürfen keine Hauptaktion
  abschneiden.
- Heller und dunkler Modus verwenden dieselben verständlichen Zustände; Farbe
  ist nie der einzige Bedeutungsträger.

### 7.2 Übungsmodus

- **Weiter** wird erst nach angezeigter oder gelöster Antwort zur Hauptaktion.
- Tastatur: Leertaste beziehungsweise Eingabetaste zeigt die Antwort und führt
  anschließend weiter, ohne Fokusverlust oder Doppelauslösung.
- Der aktuelle Fortschritt wird als `Karte x von y` ausgegeben.
- Interaktive Karten behalten ihre zugänglichen Alternativen.

### 7.3 Memory

- Jedes Feld ist ein echtes Bedienelement mit Position und Zustand.
- Zustände lauten `verdeckt`, `aufgedeckt`, `gelöst` und
  `nach Fehlversuchen markiert`.
- Gefundene Paare werden nicht nur über Farbe oder Position kommuniziert.
- Das rote X der Fehlerauflösung wird durch einen sichtbaren beziehungsweise
  vorgelesenen Statustext ergänzt.
- Vollständige Tastaturbedienung und lineare Screenreader-Reihenfolge sind
  Pflicht.
- Die visuelle Umdrehbewegung respektiert `prefers-reduced-motion`.
- Bei großer Schrift bleibt der Inhalt erreichbar; lange Inhalte werden nicht
  durch winzige Schrift passend gemacht.

## 8. Technische Zielarchitektur

### 8.1 Gemeinsame Web-Quelle

Die Funktion wird im gemeinsamen React-/Web-Quellcode umgesetzt und danach in
die portable PWA sowie per Capacitor in die Apple-App übernommen. Es entsteht
keine eigenständige Xcode-Implementierung der Lernregeln.

Vorgesehene Bausteine:

- gemeinsamer `ContinueLearningPanel` für Dashboard und Abschlussansicht,
- expliziter Sitzungsmodus `SCHEDULED`, `PRACTICE` oder `MEMORY`,
- begrenzte Repository-Abfragen für Zusammenfassung und Batch-Auswahl,
- Wiederverwendung der bestehenden Kartenrenderer,
- getrennte, reine Memory-Rundenlogik ohne Scheduler-Abhängigkeit.

### 8.2 Vorgesehene Repository-Verträge

Die Namen sind Arbeitstitel:

- `localContinuationSummary(scope, ratings)`
- `localContinuationBatch(scope, ratings, limit, batchKey)`
- `localExtraNewBatch(scope, limit, batchKey)`
- `localMemoryCandidates(scope, ratings, pairCount, roundKey)`

Die Zusammenfassung liefert nur Zähler und Verfügbarkeit. Sie baut keine
vollständige Lernwarteschlange auf.

### 8.3 Skalierung

- Zählungen erfolgen über indizierte lokale Abfragen.
- Für einen Batch werden höchstens die tatsächlich benötigten Kandidaten plus
  ein kleiner Mischpuffer geladen.
- Kein vollständiges Laden oder Sortieren aller Karten im Browser.
- Medien werden nur für das aktuelle und wenige folgende Elemente vorgeladen.
- Memory lädt höchstens zwölf Paare und deren erforderliche Medien.
- Keine Polling-Schleife und kein Geräteabgleich als Nebeneffekt von
  **Weiter**.

## 9. Umsetzungsphasen

### Phase A – Verträge und deterministische Auswahl

1. Sitzungsmodi und Scheduler-Grenze festlegen.
2. Begrenzte Zusammenfassungs- und Batch-Abfragen ergänzen.
3. Bewertungsfilter einschließlich aktueller Sitzungsbewertungen abbilden.
4. Fairness, Geschwistertrennung, Hierarchie und Sequenzen testen.
5. 100.000-Karten-Fall ohne vollständigen Scan absichern.

### Phase B – Gemeinsamer Weiterlernen-Bereich

1. `ContinueLearningPanel` für Dashboard und Abschlussansicht erstellen.
2. Dynamische Beschriftungen und Verfügbarkeitszustände umsetzen.
3. Die vier Checkboxen hinter **Auswahl anpassen** beibehalten.
4. **Decks auswählen** als sekundären Weg erhalten.
5. Fokus, Tastatur, Zoom, Dark Mode und große Schrift prüfen.

### Phase C – Freiwilliger Übungsmodus mit „Weiter“

1. Übungsbatch mit maximal 20 Karten starten.
2. Reguläre Bewertungsleiste im Modus `PRACTICE` vollständig ausblenden.
3. **Antwort zeigen** und anschließend **Weiter** verwenden.
4. Sicherstellen, dass keine Review-, Scheduler- oder Sync-Mutation entsteht.
5. Weitere Batches ohne Wiederholung desselben aktuellen Batches anbieten.

### Phase D – Zusätzliche neue Karten

1. Zusätzlichen 20er-Batch aus dem aktiven Lernplan anbieten.
2. Normalen FSRS-Ablauf und `introducedAt` verwenden.
3. Tageshinweis und kumulierte Zusatzanzahl darstellen.
4. Gleichzeitige Offline-Einführung auf mehreren Geräten testen.

### Phase E – Memory-Grundversion

1. Eignungsprüfung und eindeutige Paarbildung umsetzen.
2. 4 bis 12 Paare sowie responsive Voreinstellung anbieten.
3. App-Icon-Zustände und größenabhängige Fehlerauflösung implementieren.
4. Touch-, Tastatur- und Screenreader-Ablauf implementieren.
5. Reduced Motion, Dark Mode und große Schrift abnehmen.
6. Optionalen Anschluss **Diese Karten aktiv abfragen** ergänzen.

### Phase F – Reale Abnahme

1. Dashboard und Abschlussfluss im Browser testen.
2. Installierte PWA einschließlich Neustart testen.
3. iPhone-WebView und Xcode-Build auf einem realen Gerät testen.
4. Review-Zustand vor und nach freiwilliger Übung vergleichen.
5. Geräteabgleich nach normaler Bewertung und nach reiner Übung prüfen.
6. Laufzeit, Speicher und Erwärmung mit großer Bibliothek messen.

## 10. Test- und Abnahmekriterien

### Lernintegrität

- Normale fällige und neue Karten besitzen unverändert vier Bewertungen.
- `Hard` bleibt erfolgreiches Erinnern mit Mühe und wird nie als Vergessen
  behandelt.
- **Weiter** erzeugt kein Review-Ereignis und keine Outbox-Mutation.
- Fälligkeit, Stabilität, Schwierigkeit, `reps` und `lapses` sind vor und nach
  einer freiwilligen Runde identisch.
- Neustart und Geräteabgleich verändern diese Aussage nicht.
- Zusätzliche neue Karten werden normal eingeführt und später regulär fällig.
- Doppelte Zustellung erzeugt keine doppelten Review-Ereignisse.

### Auswahl und Zähler

- Standardmäßig sind `Nochmal`, `Schwer` und `Gut` aktiv.
- Jede Checkbox zeigt den korrekten verfügbaren Zähler.
- Der Button zeigt bei 73 Kandidaten `20 von 73 Karten wiederholen`.
- Der Button zeigt bei 13 Kandidaten `13 Karten wiederholen`.
- Ein Batch enthält höchstens 20 eindeutige Karten.
- Der nächste Batch wiederholt keine Karte des unmittelbar vorherigen Batches,
  solange genügend andere Kandidaten existieren.
- Versteckte, archivierte und gelöschte Karten erscheinen nicht.

### Memory

- Es werden nur 4, 6, 8, 10 oder 12 Paare angeboten.
- Keine Runde enthält mehrdeutige oder doppelte Zuordnungen.
- Ein Treffer verändert keinen FSRS-Zustand.
- Alle Felder sind per Tastatur und Screenreader bedienbar.
- Gefundene Paare sind ohne Farbe erkennbar.
- Verdeckte Karten zeigen das monochrome, aufgedeckte Karten das farbige
  App-Icon; gelöste Karten sind unsichtbar, ohne das Raster zu verschieben.
- Logo-Karten sind klein und randlos; sie enthalten weder Wiki-Rohtext noch
  Frage- oder Antwortinhalt.
- Das einzelne Inhaltsfeld oberhalb der Logos zeigt immer nur den Inhalt der
  zuletzt gewählten Karte und verwendet den normalen sicheren Kartenrenderer.
- Bei einem Treffer verschwinden beide Logos ohne Verzögerung.
- Nach 2, 3 beziehungsweise 4 eigenen Fehlversuchen einer physischen
  Logo-Karte wird das zugehörige Paar passend zur Rundengröße als fehlgeschlagen
  gewertet. Beide Partnerkarten erhalten das graue Icon, rote X und den
  Textstatus; ihre individuellen Fehlerzähler werden nicht zusammengelegt.
- Die Runde funktioniert bei 200 Prozent Zoom und großer iPhone-Schrift.

### Leistung und Energie

- Dashboard-Zähler laden keine vollständige Kartenbibliothek.
- Ein Übungsbatch materialisiert höchstens die benötigte begrenzte Auswahl.
- **Weiter** löst keinen Netzabgleich und keine vollständige Neuplanung aus.
- Bei 100.000 Karten gibt es keine anhaltende Hintergrundaktivität.
- Auf dem realen iPhone entsteht durch eine längere Übungsrunde keine
  auffällige Erwärmung gegenüber der normalen Lernsitzung.

## 11. Spätere Erweiterungen, nicht Teil der ersten Umsetzung

- **10-Minuten-Flow** anhand des persönlichen Antworttempos
- **Fehler der letzten 7 Tage** als gespeicherte Filtervorgabe
- **10er-Serie** als aktives Abrufspiel
- Audio-Memory mit zugänglicher Wiedergabesteuerung
- lokale persönliche Memory-Bestwerte
- eigener persistenter, vom FSRS getrennter Übungsverlauf
- bewusstes **Fälligkeiten vorziehen** als klar gekennzeichnete erweiterte
  Funktion

Diese Optionen werden erst ergänzt, wenn der gemeinsame Weiterlernen-Bereich
stabil ist. Sie dürfen nicht als zusätzliche konkurrierende Lernkonzepte in der
Hauptnavigation erscheinen.

## 12. Risiken und Freigabestatus

### Release-Blocker

- Freiwillige **Weiter**-Runden erzeugen normale FSRS-Review-Ereignisse.
- Eine Übung verändert Fälligkeiten oder Lernfortschritt stillschweigend.
- Dashboard-Zähler scannen bei jeder Anzeige die vollständige Bibliothek.
- Memory-Erfolge werden als reguläres Erinnern gewertet.
- Hauptaktionen sind bei großer Schrift, Tastatur- oder Screenreader-Nutzung
  nicht erreichbar.

### Bestätigte Voreinstellungen

Für die Umsetzung gelten folgende bestätigte Voreinstellungen:

1. 20 Karten pro zusätzlichem Batch
2. `Nochmal`, `Schwer` und `Gut` vorausgewählt
3. freiwillige Wiederholung ausschließlich mit **Weiter**
4. Memory mit 6 Paaren auf dem iPhone und 8 Paaren auf größeren Ansichten
5. Memory verwendet denselben Deckbereich und dieselbe Bewertungsfilterung wie
   die freiwillige Wiederholung
6. Memory verwendet das vorhandene App-Icon und die größenabhängige
   Fehlerauflösung aus Abschnitt 6.2 und 6.5

## 13. Referenzen

- [Anki: Filtered Decks & Cramming](https://docs.ankiweb.net/filtered-decks.html)
- [Anki: Deck Options](https://docs.ankiweb.net/deck-options.html)
- Rawson, K. A. & Zamary, A. (2019):
  [Why is free recall practice more effective than recognition practice?](https://www.sciencedirect.com/science/article/pii/S0749596X19300026)
- Sailer, M. & Homner, L. (2020):
  [The Gamification of Learning: a Meta-analysis](https://link.springer.com/article/10.1007/s10648-019-09498-w)
- Rawson, K. A., Vaughn, K. E., Walsh, M. & Dunlosky, J. (2018):
  [Successive relearning and long-term retention](https://pubmed.ncbi.nlm.nih.gov/29431462/)
