# Flash-n-Flip – Feature-Merkliste

Stand: 26. Juli 2026

Diese Merkliste sammelt Produktideen für Flash-n-Flip. Ein Eintrag ist noch
keine Zusage für eine bestimmte Version. Vor der Umsetzung werden Nutzen,
Bedienbarkeit, Barrierefreiheit, Datenschutz, Lernintegrität und technischer
Aufwand bewertet.

## Status

- `Idee`: aufgenommen, aber noch nicht bewertet
- `Prüfen`: überschneidet sich mit bestehender Funktionalität oder benötigt
  eine genauere Produktentscheidung
- `Geplant`: einer Entwicklungsphase verbindlich zugeordnet
- `Umgesetzt`: implementiert und über den echten Nutzerweg verifiziert

## Ideen

### FF-IDEA-001 – Formeleditor mit Vorschau und PNG-Export

**Status:** Idee

Mathematische Formeln sollen beispielsweise mit LaTeX oder JEX eingegeben,
direkt als Vorschau dargestellt und als PNG exportiert werden können. Vor der
Umsetzung sind Editor beziehungsweise Rendering-Engine, Barrierefreiheit der
Formeln, Schriftqualität, transparente Hintergründe und Exportauflösung
festzulegen.

### FF-IDEA-002 – Eigenes `.fnf`-Format für Export und Import

**Status:** Umgesetzt

Private Collections können verlustfrei als kontogebundene `.fnf`-Pakete
exportiert und wieder importiert werden. ZIP-Inhalt, Hierarchie, Notizfelder,
sichere Vorlagen, mehrsprachige strukturierte Inhalte, Medien, interne
Navigation, Prüfsummen, AES-GCM-Verschlüsselung und Ed25519-Signatur sind in
`docs/formats/fnf-v2.md` dokumentiert. Lernfortschritt bleibt bewusst außerhalb
des Pakets.

### FF-IDEA-003 – Synchronisation des Lernfortschritts

**Status:** Prüfen

Der persönliche Lernfortschritt soll zuverlässig zwischen den eigenen Geräten
synchronisiert werden. Die V1-Planung enthält bereits Offline- und
Synchronisationspfade; zu prüfen sind insbesondere sichtbarer Sync-Status,
Konfliktbehandlung, Wiederholungsereignisse, Gerätewechsel und verständliche
Fehlerbehebung.

### FF-IDEA-004 – Parametrisierbarer Bewertungsmechanismus

**Status:** Idee

Nutzer sollen festlegen können, wie Karten während des Lernens bewertet werden.
Zu klären sind der zulässige Anpassungsumfang, verständliche Bezeichnungen,
Auswirkungen auf FSRS sowie sichere Standardwerte, damit Anpassungen den
Lernerfolg nicht unbemerkt verschlechtern.

### FF-IDEA-005 – Karte auslassen oder als irrelevant markieren

**Status:** Idee

Eine Karte soll während des Lernens übersprungen oder für den eigenen
Lernfortschritt als irrelevant markiert werden können. Das ist besonders bei
abonnierten, nicht selbst erstellten Decks sinnvoll. Temporäres Überspringen,
dauerhaftes Aussetzen und eine spätere Reaktivierung müssen klar getrennt
werden; das öffentliche Deck selbst darf dadurch nicht verändert werden.

### FF-IDEA-006 – Text-to-Speech in der jeweiligen Sprache

**Status:** Idee

Kartentexte sollen mit einer passenden lokal verfügbaren Stimme vorgelesen
werden können. Die Funktion soll nur angebotene beziehungsweise installierte
Sprachen und Stimmen verwenden und verständlich erklären, wenn keine geeignete
Stimme verfügbar ist.

### FF-IDEA-007 – Erinnerungsfunktion

**Status:** Idee

Nutzer sollen freiwillige Erinnerungen für anstehende Lerneinheiten einrichten
können. Benötigt werden frei wählbare Zeiten, Zeitzonen- und
Ruhezeitenverhalten, einfache Deaktivierung sowie zurückhaltende und
datensparsame Benachrichtigungen.

### FF-IDEA-008 – Countdown-Timer für die Lernzeit

**Status:** Idee

Für eine Lerneinheit soll eine gewünschte Lernzeit eingestellt und als
Countdown angezeigt werden können. Zu klären sind Pausieren, Fortsetzen,
Hintergrundverhalten, Sitzungsende und eine barrierearme Alternative zu rein
visuellen oder akustischen Signalen.

### FF-IDEA-009 – Wissenschaftlich fundierte Lernmethoden

**Status:** Idee

Flash-n-Flip soll weitere wissenschaftlich belastbare Methoden berücksichtigen,
die den Lernerfolg verbessern können. Jede Methode benötigt nachvollziehbare
Quellen, ein messbares Lernziel, transparente Wirkungsannahmen und eine
Überprüfung gegen die bestehende FSRS-Planung. Unbelegte Erfolgsversprechen und
manipulative Motivationselemente sind auszuschließen.

## Vorlage für neue Ideen

```text
### FF-IDEA-NNN – Kurzer Titel

Status: Idee

Welches Problem soll gelöst werden?
Für wen ist die Funktion nützlich?
Welche offenen Entscheidungen oder Risiken gibt es?
```
