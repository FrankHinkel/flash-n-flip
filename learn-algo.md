# Lernstrategie für Flash-n-Flip

## Status

Beschlossen und technisch umgesetzt am 15. August 2026. Dieses Dokument
beschreibt die fachliche Zielstrategie und ihre Abnahmekriterien. Die reale
iPhone-/WebView-Abnahme mit einer großen Bibliothek bleibt eine gesonderte
Geräteprüfung.

## Ausgangslage

Flash-n-Flip darf bei sehr großen Bibliotheken nicht wahllos aus allen Karten
lernen. Der Scheduler und die Auswahl der Lerninhalte haben unterschiedliche
Aufgaben:

- FSRS bestimmt, **wann eine bereits gelernte Karte wiederholt werden soll**.
- Der aktive Lernplan bestimmt, **aus welchen Decks fällige und neue Karten
  angeboten werden**.
- Die Lernwarteschlange bestimmt, **in welcher Reihenfolge die jetzt relevanten
  Karten erscheinen**.

Diese drei Aufgaben dürfen nicht vermischt werden. Insbesondere darf das
Ändern des Lernplans weder bestehende FSRS-Zustände noch unveränderliche
Review-Ereignisse, Fälligkeiten oder Lernfortschritte verändern.

## 1. Mehrere benannte Lernpläne statt Favoriten

Die bisherige Favoritenfunktion wird durch benannte Lernpläne ersetzt. Ein Plan
ist eine synchronisierte Auswahl vorhandener Decks, aber weder ein eigenes Deck
noch eine Kopie seiner Karten. Pro Gerät ist genau ein Plan aktiv.

- Das Lucide-Symbol `GraduationCap` kennzeichnet den Lernplan.
- Nutzerseitige Bezeichnung: **Lernen** beziehungsweise **Im Lernplan**.
- Inaktiv bedeutet: Das Deck gehört nicht zum aktuell ausgewählten Plan.
- Aktiv bedeutet: Das Deck ist im aktuell ausgewählten Plan enthalten.
- Die Aktivierung eines übergeordneten Decks schließt seine Unterdecks ein.
- Das Ein- oder Ausschalten eines übergeordneten Decks wird atomar auf seinen
  gesamten Unterbaum angewendet. Einzelne Unterdecks können anschließend
  wieder abweichend eingestellt werden.
- Die Sortierung und Hierarchie der Decks bleiben erhalten.

### Migration bestehender Favoriten

Vorhandene Favoriten werden einmalig als Einträge im Lernplan übernommen,
damit keine bisherige Auswahl verloren geht. Die Migration muss versioniert,
idempotent und zwischen allen unterstützten Clients protokollkompatibel sein.
Alte und neue Geräte dürfen denselben Zustand nicht unterschiedlich deuten.

Die bestehende Eigenschaft `favorite` darf daher nicht stillschweigend mit
neuer Semantik weiterverwendet werden. Ziel ist ein eindeutiges fachliches Feld
wie `learningEnabled` oder `inLearningPlan` sowie eine explizite Migration.

## 2. Fällige Wiederholungen bleiben erhalten und planbezogen erreichbar

Der aktive Lernplan begrenzt fällige und neue Karten. Bereits gelernte Karten
außerhalb des aktiven Plans werden weder gelöscht noch umgeplant; sie erscheinen
wieder unverändert, sobald ihr Plan aktiviert oder ihr Deck gezielt geöffnet
wird.

Das Umschalten oder Löschen eines Plans verändert keine Karte, Fälligkeit und
kein Review-Ereignis. Dieselbe Karte besitzt in allen Plänen genau einen
gemeinsamen FSRS-Zustand.

Ein Deck benötigt für bewusstes vollständiges Pausieren eine eigene, klar
benannte Pausenfunktion. „Nicht im Lernplan“ ist kein Pausieren und kein
Löschen des Lernfortschritts.

## 3. Tagessteuerung

Die App bietet keine konkurrierende Einstellung „Zeit oder Karten“ an.
Stattdessen haben Kartenanzahl und Zeit unterschiedliche Rollen.

### Konfigurierbares Aufnahmelimit

- Es gibt ein konfigurierbares Limit **Neue Karten pro Tag**.
- Der anfängliche Standardwert beträgt 10 neue Karten pro Tag.
- Das Limit gilt über den aktiven Lernplan und ist kein Limit für dessen
  fällige Wiederholungen.
- Der Zeitpunkt der erstmaligen Aufnahme wird als `introducedAt` dauerhaft
  gespeichert. Dadurch bleibt das Tageslimit nach App-Neustart und
  Geräteabgleich erhalten.
- Das Limit steuert die zukünftige Arbeitslast. Es ist kein Maß für Lernerfolg.

### Zeit als Prognose und weicher Abbruchpunkt

- Die App leitet aus dem persönlichen Antworttempo und der aktuellen
  Warteschlange eine ungefähre Dauer ab.
- Beispiel: `Heute: 24 Wiederholungen + bis zu 10 neue · ca. 12 Minuten`.
- Zeit verändert keine FSRS-Fälligkeit und keine Bewertung.
- Lernende dürfen eine Sitzung jederzeit beenden.
- Verbleibende fällige Karten werden ehrlich als Rückstand ausgewiesen.
- Ein erreichtes Zeitbudget darf nicht als „alles erledigt“ dargestellt werden,
  solange fällige Karten übrig sind.
- Es gibt keine vermeintlich wissenschaftliche feste Pomodoro-Dauer.

## 4. Wissenschaftliche Grundlage

Die Forschung liefert keine universelle optimale Tageszahl von Karten und
keine allgemeingültige Sitzungsdauer. Belastbar sind dagegen folgende
Prinzipien:

- Aktiver Abruf verbessert langfristiges Behalten stärker als bloßes erneutes
  Lesen (Roediger & Karpicke, 2006).
- Wiederholter erfolgreicher Abruf über mehrere verteilte Sitzungen fördert
  dauerhaftes Behalten; die dafür benötigte Zeit ist individuell und abhängig
  vom Material (Rawson et al., 2018).
- Sinnvolle Wiederholungsabstände hängen unter anderem vom gewünschten
  Behaltenszeitraum ab (Cepeda et al., 2008).
- Konkrete, aufgabenbezogene Nahziele können Engagement und Leistung fördern;
  daraus folgt jedoch keine universelle Kartenanzahl für Lernapps (Amann &
  Rzepka, 2023).
- Lernende verteilen ihre Lernzeit abhängig von wahrgenommener Beherrschung und
  Schwierigkeit. Eine starre Zeitvorgabe ist deshalb kein ausreichendes
  Lernkriterium (Metcalfe & Kornell, 2005).

Daraus folgt für Flash-n-Flip: Erfolgreiche, verteilte Abrufe und ihre
Fälligkeit steuern das Lernen. Die Zahl neuer Karten steuert nur den Zustrom;
die angezeigte Zeit hilft bei der Alltagsplanung.

### Quellen

- Roediger, H. L. & Karpicke, J. D. (2006):
  [Test-enhanced learning](https://pubmed.ncbi.nlm.nih.gov/16507066/)
- Rawson, K. A., Vaughn, K. E., Walsh, M. & Dunlosky, J. (2018):
  [Investigating and explaining the effects of successive relearning](https://pubmed.ncbi.nlm.nih.gov/29431462/)
- Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T. & Pashler, H. (2008):
  [Spacing effects in learning](https://pubmed.ncbi.nlm.nih.gov/19076480/)
- Amann, E. & Rzepka, S. (2023):
  [The effect of goal-setting prompts in a blended learning environment](https://doi.org/10.1016/j.econedurev.2022.102331)
- Metcalfe, J. & Kornell, N. (2005):
  [A Region of Proximal Learning model of study time allocation](https://doi.org/10.1016/j.jml.2004.12.001)

## 5. Deterministische Warteschlange

FSRS und die aktuelle Uhr bestimmen weiterhin, welche Karten fällig sind. Für
dieselbe lokale Datenlage, denselben Lernzeitpunkt und dieselben Einstellungen
muss die Warteschlange reproduzierbar sein.

Die Priorität lautet:

1. innerhalb des Tages fällige Lern- und Wiederlern-Schritte,
2. überfällige Wiederholungen, priorisiert nach Erinnerungsrisiko,
3. heute fällige Wiederholungen,
4. neue Karten aus dem aktiven Lernplan bis zum Tageslimit.

Innerhalb einer Prioritätsstufe werden Deckgruppen fair und deterministisch
gemischt. Ein großes Deck darf kleinere aktive Decks nicht verdrängen.
Explizit sequenzielle Inhalte, miteinander verknüpfte Karten und Erklärungen
bleiben zusammen und behalten ihre fachlich erforderliche Reihenfolge.

### Geschwister- und Richtungskarten

Mehrere Karten mit derselben `noteId` sind Geschwister. Das betrifft zum
Beispiel die ausdrücklich angelegten Richtungen „Willkommen → Hello“ und
„Hello → Willkommen“. Beide Richtungen behalten vollständig getrennte
FSRS-Zustände, Fälligkeiten und Review-Ereignisse.

- Von neuen, nicht miteinander verknüpften Geschwisterkarten wird pro
  Kalendertag höchstens eine in den Lernplan aufgenommen. Die nächste Richtung
  kann frühestens am Folgetag neu eingeführt werden.
- Sind mehrere Geschwister bereits gelernt und heute fällig, bleiben alle
  fällig. Die Warteschlange versucht deterministisch mindestens fünf andere
  Karten zwischen ihnen zu platzieren. Ist die Warteschlange kürzer, wird der
  größtmögliche Abstand verwendet; eine fällige Karte wird dafür nie
  ausgeblendet oder auf einen anderen Tag verschoben.
- `linkedToPrevious` hat Vorrang vor der Geschwistertrennung. Bewusst
  verknüpfte Erklärungen, Kontexte oder Folgefragen bleiben unmittelbar
  zusammen.
- Explizit sequenzielle Decks behalten ihre fachlich festgelegte Reihenfolge;
  die Geschwistermischung verändert sie nicht.

Flash-n-Flip erzeugt keine Rückwärtskarte allein deshalb, weil eine Karte eine
Vorder- und Rückseite besitzt. Reversibilität ist ausschließlich explizit:

- durch eine vorhandene Rückwärtsvorlage in der Anki-Quelldatei,
- durch eine bewusst konfigurierte zweite Ausgabe im Importprofil, etwa
  `TARGET_TO_SOURCE`, oder
- durch eine bewusst zusätzlich angelegte Karte im Editor.

Damit bleibt „Was ist 3 × 9? → 27“ eine einzelne Karte, solange keine
Rückwärtskarte ausdrücklich definiert wurde. Bereits in Anki vorhandene
Richtungskarten werden nicht verworfen oder zusammengelegt.

Diese Regeln ergänzen
[`docs/architecture/decisions/0012-interleaved-study-queues.md`](docs/architecture/decisions/0012-interleaved-study-queues.md).

## 6. Verhalten bei Rückständen

- Ein großer Rückstand erzeugt keine zufällige Auswahl aus der gesamten
  Bibliothek.
- Die Warteschlange bearbeitet zuerst das höchste Erinnerungsrisiko und mischt
  dabei fair zwischen relevanten Deckgruppen.
- Neue Karten können reduziert oder für den Tag ausgesetzt werden, solange ein
  erheblicher Wiederholungsrückstand besteht.
- Die Oberfläche unterscheidet klar zwischen erreichtem Neu-Karten-Ziel,
  beendetem Zeitbudget und vollständig erledigten Fälligkeiten.
- Ausgeblendete Karten dürfen nicht zu einer falschen Erfolgsmeldung führen.

## 7. Leistungs- und Batterieanforderungen

Eine Bibliothek mit 100.000 oder mehr Karten darf nicht für jede Anzeige oder
Bewertung vollständig geladen, im Arbeitsspeicher gefiltert und neu sortiert
werden.

- Zählungen, Fälligkeiten und Seitenauswahl erfolgen über indizierte lokale
  Datenbankabfragen.
- Dashboard-Zähler verwenden eigene Aggregatabfragen und bauen keine komplette
  Lernwarteschlange auf.
- Die Warteschlange wird begrenzt und seitenweise beziehungsweise in kleinen
  Batches nachgeladen.
- Nach dem letzten Eintrag eines Batches wird der nächste fällige Batch
  automatisch geladen; eine Batchgrenze darf nicht als erledigter Tagesplan
  erscheinen.
- Nach einer Bewertung wird nur der betroffene Zustand dauerhaft gespeichert
  und der notwendige Ausschnitt der Warteschlange aktualisiert.
- Es gibt kein Polling und keinen Geräteabgleich als Nebeneffekt einer lokalen
  Bewertung.
- Synchronisation bleibt outbox-basiert und darf die Bestätigung einer lokal
  dauerhaft gespeicherten Bewertung nicht unnötig blockieren.

## 8. Umsetzung in Phasen

### Phase A – Modell und Migration

- eindeutiges Lernplan-Feld im gemeinsamen Domainmodell einführen,
- bestehende Favoriten idempotent migrieren,
- Schema-, Export- und Synchronisationsprotokoll gemeinsam versionieren,
- Mischbetrieb alter und neuer Clients mit expliziten Kompatibilitätsregeln
  testen.

### Phase B – Oberfläche

- Stern durch Lucide `GraduationCap` ersetzen,
- verständliche Zustände „Lernen“ und „Im Lernplan“ bereitstellen,
- Hierarchievererbung sichtbar und zugänglich umsetzen,
- Favoritenfilter und doppelte Lernkonzepte entfernen.

### Phase C – Warteschlange und Tagessteuerung

- Erhaltungs- und Neuaufnahmebereich trennen,
- Prioritäten und faire deterministische Mischung umsetzen,
- Limit für neue Karten pro Tag anwenden,
- persönliche Zeitprognose und wahrheitsgemäße Rückstandsanzeige ergänzen.

### Phase D – Skalierung und Energieverbrauch

- vollständige Bibliotheksscans aus Dashboard und Lernablauf entfernen,
- Abfragen, Indizes und Batchgrößen für große Bibliotheken optimieren,
- Speicherdauer einer Bewertung vom Geräteabgleich entkoppeln,
- reale Messungen mit großen Bibliotheken auf iPhone und Web durchführen.

## 9. Abnahmekriterien

- Ohne Decks im aktiven Lernplan werden im Tagesplan weder neue noch fällige
  Karten angeboten; gezieltes Lernen eines Decks bleibt möglich.
- Das Entfernen eines Decks aus dem Lernplan verändert keine Fälligkeit und
  keinen FSRS-Zustand.
- Die Aktivierung eines Oberdecks bezieht seine Unterdecks nachvollziehbar ein.
- Das Tageslimit zählt nur tatsächlich erstmals aufgenommene neue Karten.
- Doppelte Zustellung, Neustart und Geräteabgleich erzeugen weder doppelte noch
  verlorene Review-Ereignisse.
- `Hard` bleibt „mit Mühe erinnert“ und wird niemals wie `Again` behandelt.
- Für identische Daten und Zeit ist die Warteschlange deterministisch.
- Neue, nicht verknüpfte Geschwister derselben `noteId` werden an
  unterschiedlichen Tagen eingeführt.
- Bereits fällige Geschwister bleiben beide fällig und werden bei ausreichender
  Warteschlangenlänge durch mindestens fünf andere Karten getrennt.
- Eine nicht ausdrücklich reversible Karte erzeugt keine synthetische
  Rückwärtskarte.
- Explizite `linkedToPrevious`-Folgen bleiben trotz gemeinsamer `noteId`
  unmittelbar zusammen.
- Bei Rückständen nennt die Oberfläche die verbleibenden Fälligkeiten korrekt.
- Eine Bewertung wird lokal schnell und dauerhaft bestätigt, ohne auf einen
  Netzwerkabgleich zu warten.
- Eine realistische Bibliothek mit mindestens 100.000 Karten verursacht weder
  vollständige Scans pro Bewertung noch anhaltende Hintergrundaktivität.
- Der reale Ablauf wird auf einem iPhone-großen Viewport und in einer iOS
  WebView einschließlich App-Neustart geprüft.
