# Lernstrategie für Flash-n-Flip

## Status

Beschlossen am 15. August 2026. Dieses Dokument beschreibt die fachliche
Zielstrategie. Die Umsetzung erfolgt anschließend in getrennten, überprüfbaren
Schritten.

## Ausgangslage

Flash-n-Flip darf bei sehr großen Bibliotheken nicht wahllos aus allen Karten
lernen. Der Scheduler und die Auswahl der Lerninhalte haben unterschiedliche
Aufgaben:

- FSRS bestimmt, **wann eine bereits gelernte Karte wiederholt werden soll**.
- Der Lernplan bestimmt, **aus welchen Decks neue Karten aufgenommen werden**.
- Die Lernwarteschlange bestimmt, **in welcher Reihenfolge die jetzt relevanten
  Karten erscheinen**.

Diese drei Aufgaben dürfen nicht vermischt werden. Insbesondere darf das
Ändern des Lernplans weder bestehende FSRS-Zustände noch unveränderliche
Review-Ereignisse, Fälligkeiten oder Lernfortschritte verändern.

## 1. Ein einziger Lernfokus statt Favoriten und virtueller Decks

Die bisherige Favoritenfunktion wird durch den Lernplan ersetzt. Es gibt in der
Oberfläche keine parallelen Konzepte „Favorit“, „virtuelles Deck“ und
„Lernfokus“.

- Das Lucide-Symbol `GraduationCap` kennzeichnet den Lernplan.
- Nutzerseitige Bezeichnung: **Lernen** beziehungsweise **Im Lernplan**.
- Inaktiv bedeutet: Aus diesem Bereich werden derzeit keine neuen Karten
  aufgenommen.
- Aktiv bedeutet: Das Deck ist eine Quelle für neue Karten.
- Die Aktivierung eines übergeordneten Decks schließt seine Unterdecks ein.
- Die Sortierung und Hierarchie der Decks bleiben erhalten.

### Migration bestehender Favoriten

Vorhandene Favoriten werden einmalig als Einträge im Lernplan übernommen,
damit keine bisherige Auswahl verloren geht. Die Migration muss versioniert,
idempotent und zwischen allen unterstützten Clients protokollkompatibel sein.
Alte und neue Geräte dürfen denselben Zustand nicht unterschiedlich deuten.

Die bestehende Eigenschaft `favorite` darf daher nicht stillschweigend mit
neuer Semantik weiterverwendet werden. Ziel ist ein eindeutiges fachliches Feld
wie `learningEnabled` oder `inLearningPlan` sowie eine explizite Migration.

## 2. Fällige Wiederholungen bleiben erhalten

Der Lernplan begrenzt nur die Aufnahme **neuer** Karten. Bereits gelernte und
fällige Karten bleiben deckübergreifend im Erhaltungsprogramm, auch wenn ihr
Deck momentan nicht im Lernplan liegt.

Dadurch kann eine Änderung des Lernfokus niemals unbemerkt dazu führen, dass
bereits erarbeitetes Wissen aus der Wiederholungsplanung verschwindet.

Ein Deck benötigt für bewusstes vollständiges Pausieren eine eigene, klar
benannte Pausenfunktion. „Nicht im Lernplan“ ist kein Pausieren und kein
Löschen des Lernfortschritts.

## 3. Tagessteuerung

Die App bietet keine konkurrierende Einstellung „Zeit oder Karten“ an.
Stattdessen haben Kartenanzahl und Zeit unterschiedliche Rollen.

### Konfigurierbares Aufnahmelimit

- Es gibt ein konfigurierbares Limit **Neue Karten pro Tag**.
- Der anfängliche Standardwert beträgt 10 neue Karten pro Tag.
- Das Limit gilt über den aktiven Lernplan und ist kein Limit für fällige
  Wiederholungen.
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

- Ohne aktiven Lernplan werden keine neuen Karten aufgenommen; fällige bereits
  gelernte Karten bleiben sichtbar.
- Das Entfernen eines Decks aus dem Lernplan verändert keine Fälligkeit und
  keinen FSRS-Zustand.
- Die Aktivierung eines Oberdecks bezieht seine Unterdecks nachvollziehbar ein.
- Das Tageslimit zählt nur tatsächlich erstmals aufgenommene neue Karten.
- Doppelte Zustellung, Neustart und Geräteabgleich erzeugen weder doppelte noch
  verlorene Review-Ereignisse.
- `Hard` bleibt „mit Mühe erinnert“ und wird niemals wie `Again` behandelt.
- Für identische Daten und Zeit ist die Warteschlange deterministisch.
- Bei Rückständen nennt die Oberfläche die verbleibenden Fälligkeiten korrekt.
- Eine Bewertung wird lokal schnell und dauerhaft bestätigt, ohne auf einen
  Netzwerkabgleich zu warten.
- Eine realistische Bibliothek mit mindestens 100.000 Karten verursacht weder
  vollständige Scans pro Bewertung noch anhaltende Hintergrundaktivität.
- Der reale Ablauf wird auf einem iPhone-großen Viewport und in einer iOS
  WebView einschließlich App-Neustart geprüft.
