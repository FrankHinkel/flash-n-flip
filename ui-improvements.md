# UI vereinfachen: Prüfung und Vorschläge für den Markteinstieg

Analyse: 26. Oktober 2026. Umsetzung: 27. Oktober 2026, siehe Abschnitt 10. Weitere Prüfung und Apple-Buildvorbereitung: 29. Oktober 2026, siehe Abschnitt 12. Die Abschnitte 1–9 dokumentieren den damaligen Befund; ihre Quellzeilen beziehen sich auf diesen Ausgangsstand.

## 1. Empfehlung

Flash-n-Flip sollte im Alltag drei Fragen beantworten: **Was lerne ich heute? Wo sind meine Decks? Wie erstelle ich eine Karte?** Die aktuelle Oberfläche verlangt an mehreren Stellen schon vorher Kenntnisse über Lernpläne, Sprachrichtungen, Kartenarten, Hierarchien und technische Verarbeitung.

Die wichtigste Verbesserung ist deshalb eine kleinere Standardoberfläche mit klaren nächsten Schritten. Zusätzliche Funktionen brauchen einen begründeten Platz. Manche sollten aus der normalen Oberfläche vollständig verschwinden. Ein allgemeiner Schalter „Einfach / Experte“ würde dagegen eine weitere Entscheidung einführen und das Problem nur verlagern.

Meine prioritären Empfehlungen:

1. Den Deck- und Karteneditor auf dem Telefon auf volle Breite umstellen. Die aktuelle schmale Seitenspalte behindert bereits die Grundeingabe.
2. Neue Nutzer zur ersten Karte oder zu einem fertigen Deck führen. Ein leerer Lernplan darf nicht wie ein abgeschlossener Lerntag aussehen.
3. Deckverwaltung und Zusammenstellung eines Lernplans als unterschiedliche Aufgaben erkennbar machen. Das Schloss und die dadurch wechselnde Bedeutung eines Deck-Tipps entfallen.
4. Den normalen Lernablauf auf Starten → Nachdenken → Antwort → Bewertung → Abschluss reduzieren. Sondermodi und Feineinstellungen gehören außerhalb dieses Ablaufs.
5. Die Audiooptimierung als eigenständigen Bedienbereich aus den normalen Einstellungen entfernen. Technische Prozesspflege ist keine sinnvolle Standardaufgabe für Lernende.
6. Private iCloud-Verwaltung aus „Entdecken“ herausnehmen. Unter „Entdecken“ werden neue Inhalte erwartet; iCloud gehört zu den eigenen Daten.
7. Prüfsummen, Anfragezähler, technische Importdetails und Entwicklerreferenzen aus dem Einsteigerpfad entfernen. Validierung und Diagnosemöglichkeiten bleiben intern erhalten.
8. Hilfreiche Anpassungen und Datensicherheit bewahren: Textgröße, verständliche Sprachausgabe, Export, Wiederherstellung, explizite iCloud-Aktivierung und klare Löschfolgen.

**Bewertung:** Für einen breiten Markteinstieg ist die Bedienung nach dieser Prüfung noch zu anspruchsvoll. Die größten Hürden liegen in Aufgabenstruktur, Eingabe und Orientierung. Eine rein visuelle Überarbeitung würde diese Hürden nicht ausreichend lösen.

## 2. Prüfumfang und belastbare Grenzen

Die Hinweise des Produktverantwortlichen sind Ausgangspunkte. Betrachtet wurde die gesamte aktuelle Lernenden-App: Navigation, Start, Bibliothek, Erstellung und Bearbeitung, Lernpläne, Lernen, Zusatzübungen, Katalog, Import, iCloud, Einstellungen, Audio, Hilfe sowie Daten- und Fehlerzustände.

Grundlagen:

- Aktueller Arbeitsbaum einschließlich bereits vorhandener, nicht zu dieser Prüfung gehörender Änderungen.
- Laufende Apple-App auf dem Mac: Startseite, Bibliothek, Neuerstellung, Einstellungen und vorhandene Referenzansicht.
- Bereits vorhandener App-Build in einer getrennten lokalen Browseransicht: leere Bibliothek, Startseite, neuer Editor, Lernstrategie, Import und Entdecken einschließlich iCloud-Ansicht.
- Mobile Darstellung mit **gemessenen 390 CSS-Pixeln Breite und 844 CSS-Pixeln Höhe**. Der Editor wurde in heller und dunkler Darstellung geprüft. Die tatsächliche Breite wurde über den gerenderten DOM gemessen; die Größenangabe des Browserwerkzeugs allein wurde nicht als Beleg verwendet.
- Quellprüfung der nicht vollständig durchgespielten Zustände, insbesondere Bewertung, Kartenbearbeitung, Memory, Zahlengenerator, native iCloud-Verwaltung und Wiederherstellung.
- Projektinterne UX- und Lesbarkeits-Checklisten. Der vorhandene Lesbarkeitsscanner meldete **0 statische Fehler und 325 manuell zu prüfende Stellen** über seine Scanbereiche einschließlich Admin. Das ist kein Nachweis bestandener Kontraste.

Belegarten in diesem Dokument:

- **V:** in der gerenderten Oberfläche beobachtet.
- **Q:** im aktuellen Quelltext nachvollzogen.
- **H:** begründete UX-Hypothese; mit Erstnutzern zu prüfen.

| Bereich                              | Abdeckung dieser Prüfung                                           | Grenze                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Start und Navigation                 | V + Q, Apple-App und mobile Browseransicht                         | Keine vollständige Geräte- und Sprachmatrix                                             |
| Bibliothek und Planleiste            | V + Q, leer und mit vorhandenen Referenzdecks                      | Große persönliche Bibliotheken nicht praktisch durchgespielt                            |
| Neuer Deckeditor                     | V + Q, Desktop und mobil, hell/dunkel                              | Kein vollständiger Erstellungsdurchlauf auf einem physischen iPhone                     |
| Karteneditor und Speichern           | Q, einschließlich Entwürfen, Medien und Vorschau                   | Kein erfolgreicher neuer Kartenbestand im isolierten Browser erzeugt                    |
| Lernstrategie                        | V + Q, aufgeklappte Einstellungen                                  | Wirkung auf echte Langzeitnutzung nicht gemessen                                        |
| Reguläre Lernsitzung und Bewertungen | Q; Referenzdarstellung zusätzlich V                                | Reguläre Sitzung bis zur dauerhaft gespeicherten Bewertung nicht Ende zu Ende geprüft   |
| Freies Üben, Memory, Zahlen          | Q; Einstieg in Zusatzübungen und Zahlen im Katalog V               | Kein Nutzenbeleg aus Nutzungsdaten oder Vergleichstest                                  |
| Katalog und Import                   | V + Q                                                              | Kein vollständiger APKG-/CSV-/FNF-Import und kein Update bestehender Imports ausgeführt |
| iCloud                               | V für Browseransicht, Q für native und alternative Implementierung | Kein Upload, keine Aktivierung, kein Lösch- oder Mehrgerätetest                         |
| Einstellungen und Audio              | V + Q                                                              | Keine Messung von Akku, Laufzeit, Speichergewinn oder Klangqualität                     |
| Hilfe, Backup und Wiederherstellung  | Q; Einstellungen mit Zugängen V                                    | Keine Wiederherstellung und keine destruktiven Aktionen ausgeführt                      |

Die lokale Browseransicht verwendet vorhandene Dateien des installierten Builds. Ihre Übereinstimmung mit jedem Detail des aktuellen Arbeitsbaums ist nicht bewiesen. Die wesentlichen Editorregeln und beschriebenen Steuerelemente wurden zusätzlich im aktuellen Quelltext gefunden. Ein Speicherversuch mit einem ausschließlich lokalen Testtitel scheiterte in dieser Ansicht. Daraus wird **kein Fehler des regulären Web- oder Apple-Speicherpfads abgeleitet**; dieser Aufbau ersetzt keinen korrekt konfigurierten Produktbetrieb. Der Testtitel wurde anschließend geleert. In der echten Apple-Bibliothek wurden keine Decks oder Bewertungen angelegt, gelöscht oder verändert.

Nicht Gegenstand sind das separate Produkt Pianoforte, Betreiber-Administration und die unveränderte Legacy-Anwendung. Vorhandene Login-/Registrierungsdateien werden nicht allein wegen ihrer Existenz als aktueller Erstnutzerpfad behandelt. Die derzeitige öffentliche Weiterleitung zu Pianoforte ist eine gesonderte Produktentscheidung.

Dies ist eine abgeschlossene Analyse mit ausdrücklich benannten Prüflücken, **keine Barrierefreiheits-, Synchronisations- oder Release-Freigabe**. Physisches iPhone/iPad, iOS-Tastatur, VoiceOver, 200-Prozent-Zoom und größte unterstützte Textgröße bleiben praktische Abnahmen einer späteren Umsetzung.

## 3. Kleineres Grundmodell der App

### 3.1 Navigation

Vier bestehende Hauptbereiche reichen aus. Ihre Benennung sollte die Aufgabe ausdrücken:

| Zielbereich       | Inhalt                                                                            | Aus der obersten Ebene herausnehmen                                            |
| ----------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Heute**         | Heutige Aufgabe, eindeutiger Start, sinnvoll fortsetzen, ehrlicher Abschluss      | Strategiekonsole, allgemeine Bestandszahlen, technische Statusanzeigen         |
| **Meine Decks**   | Eigene und hinzugefügte Inhalte, Karten bearbeiten, Suche, übersichtliche Ordnung | Dauerhaft vorgeschaltete Planbearbeitung, zweiter kompletter Cloud-Deckbaum    |
| **Entdecken**     | Kuratierte Inhalte ansehen und hinzufügen                                         | Private iCloud-Verwaltung, technische Referenzbibliothek als Einsteigerangebot |
| **Einstellungen** | Lernen, Darstellung/Bedienung, Daten/iCloud, Hilfe/Informationen                  | Audio-Wartung, routinemäßige Diagnosezähler                                    |

„Lokal“ beschreibt eine technische Eigenschaft. Es erklärt nicht, dass dort Sprache, Textgröße und Datensicherung liegen. „Einstellungen“ wäre hier eindeutiger. Das nur als Logo sichtbare mobile Startziel sollte zusätzlich „Heute“ heißen. Die Beschriftung muss in nativer Navigation und Webnavigation dieselbe Aufgabe bezeichnen.

Ein eigener Haupttab „Lernpläne“ ist für den Einstieg nicht erforderlich. Die Planwahl kann bei „Heute“ stehen, sobald tatsächlich mehrere Pläne existieren. „Plan bearbeiten“ führt zu einer klar begrenzten Auswahlaufgabe.

### 3.2 Begriffe und Zuständigkeiten

| Begriff       | Bedeutung für Lernende                                                          |
| ------------- | ------------------------------------------------------------------------------- |
| Deck          | Karten zu einem Thema                                                           |
| Lernplan      | Welche Decks regelmäßig gelernt werden und mit welchem Umfang                   |
| Heutige Runde | Die jetzt vorgesehene Auswahl daraus                                            |
| Frei üben     | Zusätzliche Übung mit ausdrücklich erklärter Auswirkung auf den Lernfortschritt |
| Nachschlagen  | Inhalte lesen, ohne daraus automatisch eine bewertete Lernsitzung zu machen     |

Diese Begriffe brauchen keine vorgelagerte Einführung. Ihre Bedeutung muss sich aus dem jeweiligen Bildschirm ergeben. Ein Deck ist auch ohne Planzuordnung auffindbar und direkt nutzbar. Ein Lernplan ist eine Hilfe für regelmäßiges Lernen, keine Zugangsvoraussetzung zur ersten Karte.

## 4. Wichtigste Feststellungen und konkrete Änderungen

### UI-01 — Mobiler Editor verteilt den Platz falsch

**Priorität: P0 / Release-Blocker für den geprüften mobilen Erstellungsweg. Beleg: V + Q.**

Bei 390 CSS-Pixeln erhält der geöffnete Grundlagenbereich rund **121 Pixel**, die rechte Arbeitsfläche rund **257 Pixel**. Das eigentliche Formular bleibt links, während rechts zunächst lediglich „Name your deck first“ steht. Titel, Beschreibung und Sprachen werden stark zusammengedrückt. Im Formular entsteht zusätzlich horizontales Scrollen. Derselbe Befund besteht hell und dunkel. Ursache ist die auch mobil beibehaltene Zweispaltenregel mit einer linken Breite von ungefähr 32 Prozent. [E1, E2]

**Vorschlag:** Auf dem Telefon jeweils eine Aufgabe über die volle Breite darstellen: Deck benennen, Karte bearbeiten oder Kartenliste ansehen. Deckoptionen in einen eigenen Bereich verschieben. Auf breiten Geräten darf eine Seitenleiste bleiben, sofern Eingabefelder ausreichend Platz erhalten. Kein zusätzliches dauerhaftes Panel auf dem Telefon.

**Abnahme:** Titel, Frage, Antwort und Speichern sind ohne horizontales Scrollen erreichbar. Mit eingeblendeter iOS-Tastatur und vergrößertem Text bleibt eine sinnvolle Bearbeitungsfläche. Der Browserbefund ist auf iOS zu reproduzieren und anschließend dort zu beheben; die physische Geräteabnahme ist noch offen.

### UI-02 — Der erste Karteninhalt kommt zu spät

**Priorität: P0. Beleg: V + Q; Abbruchrisiko H.**

Vor der ersten Karte zeigt die Neuerstellung Titel, Beschreibung, Tags, zwei Sprachen, übergeordnetes Deck, Reihenfolge, Referenzmodus und Deckbild. Nur der Titel ist zwingend, aber die Oberfläche erklärt diese Gewichtung kaum. „PROGRESS“ und „CARDS“ sind zunächst deaktiviert. Erst ein allgemeines Speichern erzeugt das Deck und öffnet den Kartenbereich. [E1]

**Vorschlag:** Zuerst nur „Wie heißt dein Deck?“ und die Aktion „Erste Karte erstellen“. Danach Frage und Antwort. Beschreibung, Tags, Bild, Hierarchie, Reihenfolge und Referenzsammlung verschwinden aus diesem ersten Schritt. Sie bleiben später bei „Deckoptionen“ erreichbar. Sprachrichtungen werden erst bei Bedarf für Sprachlernen oder Vorlesen relevant; keine verpflichtende Kartentyp- oder Fachauswahl davor.

Ein leeres Deck darf weiterhin gezielt erstellt werden, etwa als Sammlung. Es sollte den häufigsten Einstieg nicht bestimmen.

### UI-03 — Die Startseite verwechselt „noch nicht angefangen“ mit „fertig“

**Priorität: P0. Beleg: V + Q.**

In der Apple-App mit leerem aktivem Plan und in der getrennten Browseransicht ohne eigene Decks erschien „All done for today“. Daneben wurden weitere Übungen angeboten; diese endeten bei „No matching cards“. Die aufgeklappte Tempoanzeige meldete sogar einen Zielkorridor und ein Abschlussdatum bei null Karten. Die Startseite unterscheidet die notwendigen Ausgangslagen nicht ausreichend. [E3, E4]

**Vorschlag:** Vier eindeutige Hauptzustände:

| Zustand                                  | Hauptaussage                                | Nächste Aktion                                             |
| ---------------------------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| Noch keine nutzbaren Lerndecks           | „Womit möchtest du anfangen?“               | „Deck entdecken“, daneben „Eigenes Deck erstellen“         |
| Decks vorhanden, Plan leer               | „Wähle deine Decks für regelmäßiges Lernen“ | „Decks auswählen“; vorhandene Decks bleiben direkt nutzbar |
| Heute Karten vorgesehen                  | „Heute: 12 Karten · etwa 5 Minuten“         | „Jetzt lernen“                                             |
| Heute tatsächlich nichts mehr vorgesehen | „Für heute fertig“                          | „Fertig“, daneben zurückhaltend „Frei üben“                |

Laden, Ladefehler und fehlende Daten sind eigene Zustände. Sie dürfen weder als null Karten noch als Lernerfolg erscheinen. Bei unzureichender Datengrundlage keine positive Tempoaussage und kein scheinbar aussagekräftiges Abschlussdatum anzeigen.

### UI-04 — Die Bibliothek hat zwei schwer erkennbare Bedienmodi

**Priorität: P0. Beleg: V + Q; Verwechslungsrisiko H.**

Die Deckseite fordert zur Planwahl auf und beginnt mit Planselector, Schloss und Planfortschritt. Bei geschlossenem Schloss öffnet eine Deckzeile Inhalte; nach Entsperren verändert derselbe Tipp die Planmitgliedschaft. Der Zustand ändert damit die Bedeutung einer großen Fläche. [E5]

**Vorschlag:** Eine Deckzeile öffnet immer dasselbe Deck. „Decks im Lernplan bearbeiten“ öffnet eine eigenständige Auswahl mit sichtbaren Auswahlfeldern und einem eindeutigen Abschluss. Das Schloss entfällt vollständig. Planmitgliedschaft außerhalb dieses Auswahlbildschirms mit Text kennzeichnen, etwa „In deinem Lernplan“.

Die Auswahlansicht braucht eine klare Speicherregel. Empfehlung: ausdrückliches „Übernehmen“ mit Verlassen ohne Übernahme; nicht erst einzelne Zuordnungen sofort persistieren und anschließend einen scheinbaren Abbrechen-Knopf anbieten. Die konkrete Transaktion muss eine spätere Implementierung festlegen.

### UI-05 — Unterdecks und Sammelauswahl brauchen einen sichtbaren Umfang

**Priorität: P1. Beleg: Q; Erwartungsproblem H.**

Der aktuelle Zuordnungspfad ermittelt zum ausgewählten Deck auch Nachfahren und verändert deren Mitgliedschaft. Der sichtbare einzelne Deckname erklärt diesen Umfang nicht ausreichend. Ein Hierarchieelement, ein Ordner und ein tatsächlich lernbares Deck sind zudem nicht immer auf den ersten Blick unterscheidbar. [E5, E6]

**Vorschlag:** Als Standard eine Auswahl je Deck. Eine Gruppenaktion separat als „Alle 8 Unterdecks hinzufügen“ anbieten. Bei gemischter Auswahl einen ausdrücklichen Teilzustand zeigen. Einklappen, Öffnen und Auswählen dürfen nicht dieselbe Aktion sein.

Das ist ein Änderungsvorschlag für die Interaktion, keine Freigabe zur stillen Umdeutung bestehender Pläne. Vor Umsetzung aktuelle Produktsemantik und vorhandene Zuordnungen abgleichen. Bestehende Deck-IDs, Hierarchie und Planmitgliedschaften bleiben erhalten, bis eine bewusste Änderung bestätigt wird.

### UI-06 — Speichern und die nächste Karte sind nicht deutlich genug getrennt

**Priorität: P1. Beleg: V + Q; Verständlichkeitsproblem H.**

Der Editor verwendet ein übergeordnetes „Save“ für Deck und Kartenentwurf. „New“ beginnt den nächsten Entwurf und kann eine Rückfrage zum Verwerfen auslösen. Auf dem Telefon blendet CSS die Beschriftungen der oberen Aktionen aus; sichtbar bleiben Symbole. Die beim Tippen wechselnde Gegenseiten-Vorschau fügt einen weiteren Zustand hinzu. Die vorhandene Entwurfs- und Transaktionslogik ist wichtig, erklärt aber nicht automatisch die Bedienung. [E1, E2, E7]

**Vorschlag:** Für die häufigste Aufgabe explizit „Karte speichern“ und „Speichern & nächste“. „Fertig“ beendet die Bearbeitung. Eine kleine Meldung bestätigt „Karte 3 gespeichert“. Vorschau als bewusst aufgerufene Aktion; während der Eingabe keine überraschende Umwandlung des anderen Eingabefelds.

Zunächst explizites Speichern beibehalten. Automatisches Speichern wäre ein eigener Entwurfs- und Wiederherstellungsauftrag. Eine unvollständige Frage darf als Entwurf überleben, aber keine ungültige Lernkarte werden. Erst nach dauerhafter lokaler Speicherung Erfolg melden.

### UI-07 — Spezialfähigkeiten prägen den normalen Karteneditor zu stark

**Priorität: P1. Beleg: Q; Erstnutzerwirkung H.**

Markdown, Medienreferenzen, Kartenverknüpfung, „ohne Bewertung“, Referenz-/Erklärungsmodus und spezialisierte Inhalte teilen sich den Arbeitsbereich. Eine mächtige Inhaltssprache erleichtert die interne Verarbeitung, ist aber kein gutes Einstiegsmodell. [E7]

**Vorschlag:** Standard sind zwei verständlich beschriftete Felder „Frage“ und „Antwort“. Ein ergänzender Einstieg „Inhalt hinzufügen“ bietet Bild, Kamera und Audio. Seltene Inhalte wie Notensatz, Formeln oder andere strukturierte Blöcke folgen erst nach bewusster Auswahl. Kartenarten, Verknüpfungen, Rohsyntax und Bewertungsoptionen in „Weitere Kartenoptionen“ verschieben.

Bestehende reichhaltige Karten müssen vollständig erhalten und bearbeitbar bleiben. Keine automatische Vereinfachung durch verlustreiche Konvertierung nach Plain Text. Referenzkarten, Karten mit Lücken und Erklärungsfolgen werden weiterhin korrekt erkannt.

### UI-08 — Ein Lernplan muss nicht sofort eine Strategiekonfiguration sein

**Priorität: P1. Beleg: V + Q.**

Die Strategie ist hinter einer nicht ausgeschriebenen Tempoanzeige und einem weiteren Aufklappen erreichbar. Danach erscheinen fünf Vorgaben und neun Felder: Datum, Minuten, Lerntage, neue Karten, Reihenfolge, Wiederholungsserie, Problemkarten, Toleranzkorridor und Festigungstage. Der Einstieg ist schwer auffindbar, die gefundene Konfiguration gleichzeitig zu umfangreich. [E4]

**Vorschlag:** Eine bestehende sinnvolle Standardstrategie nutzen und die meisten Nutzer gar nicht konfigurieren lassen. Bei Bedarf zuerst nur „Wie viel möchtest du täglich lernen?“ anzeigen. Ein Prüfungstermin bleibt optional. „Lernumfang ändern“ ist ein beschrifteter Einstieg. Toleranzkorridor, Problemkartenquote, Wiederholungsserien und Festigungstage entfallen aus der normalen UI.

Die bereits bestehende Strategie bleibt intern zunächst unverändert. Eine neue Beschriftung wie „10 Minuten“ darf nicht als garantiertes Zeitlimit verkauft werden, wenn die vorhandene Planung das nicht zuverlässig durchsetzt. Eine Änderung der Planungsregeln ist ein eigener fachlicher Auftrag.

### UI-09 — Mehrere Einstellungen konkurrieren um den Lernumfang

**Priorität: P1. Beleg: V + Q.**

„Neue Karten pro Tag“ gibt es in den allgemeinen Einstellungen und innerhalb der Lernstrategie. Zeitbudget, Lerntage und automatisch ermittelte Werte kommen hinzu. Der Nutzer muss verstehen, was global, gerätebezogen, Standard oder planbezogen gilt. Daraus wird hier kein bewiesener Berechnungsfehler abgeleitet. Die Reichweite der Bedienung ist aber unnötig schwer nachvollziehbar. [E4, E8]

**Vorschlag:** Einen sichtbaren Ort für den Lernumfang schaffen, mit ausdrücklicher Reichweite „Für diesen Lernplan“. Bei einem einzigen Plan genügt die normale Einstellung ohne Planverwaltungssprache. Bestehende Werte übernehmen. Globale Vorgaben nur dann zusätzlich anbieten, wenn deren Nutzen erklärt und ihr Zusammenspiel tatsächlich notwendig ist.

### UI-10 — „Lernen“, „frei üben“ und „nachschlagen“ müssen unterscheidbar sein

**Priorität: P0 für eindeutige Fortschrittswirkung, sonst P1. Beleg: Q; Verständnis H.**

Es bestehen geplante Sitzungen, zusätzliche neue Karten, schedulerneutrale Übung, Referenzansichten, Karten-/Erkunden-Umschaltung und andere Inhaltsoptionen. Die fachliche Unterscheidung ist sinnvoll; ihre Wirkung darf nicht vom Einstieg oder von Symbolkenntnis abhängen. [E9]

**Vorschlag:** „Jetzt lernen“ startet die reguläre Auswahl. „Frei üben“ erklärt einmal knapp „Ohne Änderung deiner Wiederholungstermine“. „Nachschlagen“ bezeichnet ausdrücklich das Lesen. Zusätzliche neue Karten bleiben eine bewusste Entscheidung und dürfen nicht als bloßes freies Üben erscheinen. Der aktuelle Modus bleibt während der Sitzung sichtbar.

Im regulären Ablauf zunächst nur Inhalt, Antwortaktion, sinnvoller Fortschritt und die nötigen Bewertungen zeigen. Deckwechsel, Sprachrichtung, Kartenschwierigkeit und Zusatzinhalte über eine kontextbezogene Aktion erreichbar halten. Inhaltlich notwendige Steuerungen, etwa Kartenzoom oder Audiowiedergabe, dürfen weiterhin direkt am Inhalt liegen.

### UI-11 — Vier Bewertungen erklären, ohne die Lernlogik umzuschreiben

**Priorität: P1. Beleg: Q; bessere Verständlichkeit H.**

Die vier Bewertungen und ihre Intervalle sind bereits fachlich abgebildet. Eine Reduktion auf zwei Knöpfe würde die Verbindung zwischen Nutzerantwort und Scheduler verändern. Das ist für eine UI-Vereinfachung zu weitgehend. [E9]

**Vorschlag:** Vier Werte beibehalten und mit kurzen Erläuterungen testen:

| Bestehender Wert | Mögliche Beschriftung | Bedeutung                                 |
| ---------------- | --------------------- | ----------------------------------------- |
| AGAIN            | „Nicht gewusst“       | Antwort nicht erinnert                    |
| HARD             | „Mit Mühe“            | Richtig, aber nur schwer erinnert         |
| GOOD             | „Gewusst“             | Richtig und mit normalem Aufwand erinnert |
| EASY             | „Sehr leicht“         | Sofort und sicher erinnert                |

Die nächste Wiederholung weiterhin zeigen. Farbe ergänzt die Bedeutung. Gesperrte Bewertungen nach Fehlern müssen kurz erklärt werden. Kein automatisches „Gewusst“, nur weil die Antwort geöffnet wurde. Bestehende Ratingwerte, Wiederholungszeitpunkte, stabile Review-IDs und sichere Speicherung bleiben unangetastet.

### UI-12 — Der Abschluss fordert zu viele nächste Entscheidungen

**Priorität: P1. Beleg: V für den leeren Zustand, Q für den regulären Abschluss.**

Zusätzliche neue Karten, Wiederholen, Bewertungsfilter und Memory können nach dem Tagesziel erscheinen. Auf der Startseite wird der Zusatzbereich sogar ohne passende Karten angeboten. Das kann einen klaren Abschluss in eine weitere Auswahlaufgabe verwandeln. [E3, E10]

**Vorschlag:** Zuerst „Für heute fertig“ mit verständlichem Ergebnis und „Fertig“. Eine zurückhaltende Aktion „Noch üben“ öffnet weitere Möglichkeiten. Nur tatsächlich verfügbare Übungen anzeigen. Bewertungsfilter gehören in die Übungsauswahl, nicht in den Abschluss selbst.

Memory bleibt eine optionale Zusatzübung. Es sollte vorerst aus dem regulären Abschluss verschwinden. Eine vollständige Entfernung ist erst sinnvoll, wenn Nutzen, Wartungskosten und Verwendung bewertet wurden; seine Existenz allein macht den Kernablauf nicht kompliziert, seine prominente Platzierung schon.

### UI-13 — Fortschrittszahlen brauchen eine eindeutige Aussage

**Priorität: P1. Beleg: V + Q.**

Die Planleiste zeigt Karten, bearbeitete Karten und Prozent. Weitere Deckkennzahlen unterscheiden zum Teil Karten und Lernkategorien. Ein Prozentwert ohne klaren Zeitraum und Bedeutungszusatz kann als Beherrschungsgrad gelesen werden. Die Implementierung misst damit nicht automatisch dauerhaftes Wissen. [E5, E11]

**Vorschlag:** Bei „Heute“ nur den heutigen Fortschritt zeigen, etwa „8 von 12 erledigt“. In der Bibliothek Titel, Kartenzahl und eine klar bezeichnete Lerninformation. Langfristigen Bestand nur ausdrücklich benennen, beispielsweise „Schon einmal gelernt“. Speichergrößen in die Deckdetails verschieben. Keine zusätzliche unvalidierte „Mastery“-Kennzahl erfinden.

### UI-14 — Audiooptimierung aus der normalen Oberfläche entfernen

**Priorität: P1. Beleg: V + Q. Klare Empfehlung.**

„Lokale Audiooptimierung“ steht unter „Daten & Datenschutz“ vor Backup und Wiederherstellung. Auch ohne vorhandene Audioaufgaben ist ein Bereich mit „0/0 geprüft · 0 optimiert“ und Startaktion vorhanden. Nutzer sollen zwischen geprüft, optimiert, laufend, pausiert, nicht verfügbar sowie Batterie-/Temperaturzuständen unterscheiden. [E8, E12]

**Entscheidungsvorschlag:** Den eigenständigen Bereich samt Start-/Pauseknopf, Zählern und Routinefehlern aus den normalen Einstellungen entfernen. Eine optionale, technische Verarbeitung sollte keine Voraussetzung für verständliche und funktionierende Audiowiedergabe sein.

Für die zugrunde liegende Funktion sind zwei getrennte Entscheidungen nötig:

1. **UI entfernen:** bereits durch den fehlenden Bedarf im normalen Lernablauf begründet.
2. **Verarbeitung behalten oder entfernen:** zunächst ihren tatsächlichen Speichergewinn, Einfluss auf Übertragungen, Klangqualität, Energieverbrauch und Laufzeit an repräsentativen Decks messen. Ohne nachgewiesenen Nutzen ist das vollständige Streichen der Funktion ein begründeter Kandidat. Die vorliegende Prüfung liefert diese Messung nicht.

Falls die Verarbeitung bleibt, muss sie ohne Bedienpflicht arbeiten und vorhandene Pausen, Geräte- und Temperaturschutz beachten. Einfach den Knopf zu verstecken und dieselbe Arbeit unkontrolliert im Hintergrund auszuführen wäre keine akzeptable Vereinfachung. Die bestehende Unterscheidung zwischen Originalen, Ableitungen und deren Aufräumregeln muss vor einem Ausbau geprüft werden; keine pauschale Löschung oder Zusage, dass alle Originale jederzeit unverändert vorhanden seien.

Audio abspielen, vorlesen und aufnehmen bleiben erhalten. Das sind direkte Lernfunktionen und eine andere Aufgabe als technische Optimierung.

### UI-15 — Einstellungen sind nach Nutzeraufgaben neu zu ordnen

**Priorität: P1. Beleg: V + Q.**

Unter „Darstellung“ liegen auch Sprachausgabe, Audio-Basislautstärke und „Frage mit Antwort anzeigen“. Die Basislautstärke bietet acht Werte von 50 bis 300 Prozent. Der globale Seitenzoom ist eine eigene Einstellung. Die Startseite enthält zusätzlich das separate Strategiemodell. [E8]

**Vorschlag:** Vier kurze Gruppen, weiterführende Seiten nur bei Bedarf:

- **Lernen:** verständlicher Lernumfang; Frage bei Antwort anzeigen; optionaler App-Badge.
- **Darstellung & Bedienung:** Sprache, Schriftgröße und Erscheinungsbild. Sprachausgabe bei Bedarf mit klaren Optionen.
- **Daten & iCloud:** Abgleichstatus, Aktivierung, Backup, Wiederherstellung und Speicherverwaltung.
- **Hilfe & Informationen:** kurze Hilfe, weiterführende Dokumentation, Version und rechtliche Informationen.

Den globalen Audioverstärker aus der Standardliste herausnehmen. Systemlautstärke und normale Wiedergaberegelung reichen zunächst; falls leise Imports einen belegten Bedarf erzeugen, eine gezielte Wiedergabeoption anbieten. Bildschirmzoom nicht blind streichen oder deaktivieren: erst natürliche Bedienung und barrierefreie Vergrößerung von Inhaltszoom trennen. Textgröße und hilfreiche Vorlesefunktionen bleiben sichtbar auffindbar.

### UI-16 — iCloud ist keine Entdeckungsfunktion

**Priorität: P1. Beleg: V + Q.**

„Entdecken“ enthält die Tabs „Entdecken“ und „Meine iCloud“. In iCloud erscheint erneut eine Deckhierarchie. Die alternative Browserimplementierung zeigt Anfragezahlen, Übertragungsreihenfolge und mehrere Betriebsaktionen. Die native Implementierung ist bereits anders aufgebaut, zeigt aber ebenfalls interne Warteschlangen getrennt nach Fortschritt, Inhalt und Medien. [E13]

**Vorschlag:** iCloud nach „Einstellungen → Daten & iCloud“ verlegen. In „Meine Decks“ genügt zunächst eine verständliche Verfügbarkeit wie „Auf diesem Gerät“ sowie eine begrenzte Aktion zum Laden weiterer eigener Decks. Ein zweiter vollständiger Deckmanager ist im Normalfall unnötig.

Im Standardzustand genügt „Nur auf diesem Gerät“, „Abgleich läuft“, „Abgeglichen“ oder eine handlungsrelevante Fehlermeldung. Anfragebudgets, Warteschlangenzahlen und technische Übertragungsstufen aus der normalen Ansicht entfernen. Eine Diagnoseansicht kann sie weiterhin enthalten.

Die initiale Aktivierung bleibt bewusst und ausdrücklich. Ein erkanntes Apple-Konto oder das Öffnen des Bereichs ist keine Einwilligung zum Upload. „Letzter vollständiger Abgleich“ nur nach bestätigtem vollständigem Vorgang melden. Medien, die noch fehlen, dürfen nicht durch ein pauschales Erfolgssymbol verdeckt werden.

### UI-17 — Sicherheitsrelevante Datenaktionen brauchen verständliche Folgen

**Priorität: P0 für Klarheit, besonders bei Löschungen und Zurücksetzen. Beleg: Q.**

Bibliothek, iCloud und Einstellungen haben mehrere Wege zu Entfernen, Löschen, Zurücksetzen und Wiederherstellen. „Lernplanfortschritt zurücksetzen“ betrifft die Karten der enthaltenen Decks; diese können auch in weiteren Plänen vorkommen. Der Plan ist damit keine offensichtlich unabhängige Fortschrittskopie. [E6, E8, E13]

**Vorschlag:** Seltene destruktive Aktionen aus den normalen Aktionsreihen herausnehmen und in einen klar benannten Verwaltungsbereich verschieben. Vor der endgültigen Aktion Deckname, betroffene Unterdecks und Reichweite zeigen:

- „Aus dem Lernplan entfernen“ verändert die Auswahl, nicht automatisch den Lernstand oder den Bestand.
- „Von diesem Gerät entfernen“ muss verbleibende Verfügbarkeit und mögliche noch nicht übertragene Änderungen erklären.
- „Auf allen Geräten löschen“ braucht eine eigenständige, ausdrückliche Bestätigung.
- „Lernfortschritt zurücksetzen“ muss die Wirkung auf dieselben Karten in anderen Plänen nennen.

Export und Wiederherstellung dürfen durch Vereinfachung nicht verschwinden. „Backup erstellen“ ist verständlicher als ein unspezifischer Datendownload. Backup, Deckexport, laufende Synchronisation und Wiederherstellung sind unterschiedliche Vorgänge. Bei Wiederherstellung klären, ob ergänzt oder ersetzt wird; keine unbewiesene Zusage darüber.

### UI-18 — Der Katalog verkauft teilweise interne Strukturen

**Priorität: P1. Beleg: V + Q.**

Der Katalog zeigt umfangreiche Sammlungen, hierarchische Geografie, einen konfigurierbaren Zahlengenerator, fachliche Einführungen und Referenzbibliotheken. Veröffentlichungsanzeigen enthalten Signaturdatum und Prüfsummenpräfix. Im mobilen Einstieg steht der konfigurierbare Zahlenbereich weit oben. Das ist eher eine Funktionssammlung als ein geführter erster Erfolg. [E14]

**Vorschlag:** Einfache Kategorien und wenige gut verständliche Einstiegsangebote voranstellen. Pro Angebot zunächst Titel, Thema/Sprache, Umfang und eine Aktion „Ansehen“ oder „Hinzufügen“. Tiefe Strukturen und Auswahl einzelner Unterdecks erst in den Details. Signaturen weiterhin zwingend prüfen, Prüfsummen und Veröffentlichungsdiagnose aus der Standarddarstellung entfernen. „Aktualisierung verfügbar“ bleibt handlungsrelevant.

Zahlengenerator als Spezialangebot in der passenden Kategorie behalten, nicht als allgemeine Einstiegsaufgabe. Eine vorgewählte kleine Übung ist verständlicher als sofort eine große Kombinations- und Bereichskonfiguration. Entwicklerreferenzen und Rich-Content-Syntaxbibliotheken nicht als gleichrangige Lernempfehlungen anbieten. Bestehende installierte Inhalte niemals stillschweigend entfernen.

Nach dem Hinzufügen braucht es einen klaren Abschluss: „Deck hinzugefügt“ mit „Jetzt ansehen/lernen“ und einer verständlichen Möglichkeit, es dem aktiven Lernplan zuzuordnen. Installation ist keine Zustimmung, alle Unterdecks oder alle zukünftigen Updates in jeden Plan aufzunehmen.

### UI-19 — Import vor der Datei schon zu technisch

**Priorität: P1. Beleg: V + Q.**

Vor der Dateiwahl stehen drei Formatvarianten und je nach Format Sprachen. Texte nennen „generation-3“, Eventhandler, Dateisignaturen und entpackte Archivgrößen. Der APKG-Pfad enthält weitere Fachoptionen; positiv ist, dass bereits viele davon eingeklappt sind. [E15]

**Vorschlag:** Primär „Datei auswählen“ für unterstützte Deckdateien. Dateityp erkennen und das Ergebnis verständlich bestätigen. „Text einfügen“ als weiterer Weg für CSV/TSV. Vor dem Import eine kurze Vorschau mit Deckname, Anzahl und verständlichen Problemen. Nur bei tatsächlich mehrdeutiger Zuordnung nachfragen. Bestehende einklappbare APKG-Details für Spezialfälle erhalten; ihre Aufklappung ist kein Pflichtschritt.

„Die Datei bleibt auf diesem Gerät“ genügt als kurze Standardinformation. Technische Sicherheitsdetails in weiterführende Hilfe verschieben. **Die Prüfungen selbst bleiben vollständig erhalten.** Updates, neue Kopien, Feldzuordnung und nicht unterstützte Inhalte dürfen nicht stillschweigend „vereinfacht“ oder übersprungen werden. Der Abschluss führt direkt zum Deck und erklärt die optionale Planzuordnung.

### UI-20 — Hilfe muss den ersten Erfolg unterstützen

**Priorität: P2. Beleg: Q, Referenzbibliothek zusätzlich V.**

Es gibt eine ausführliche Hilfeseite mit Suchfunktion sowie installierbare Referenzinhalte für Format- und Syntaxthemen. Das ist wertvoll für fortgeschrittene Inhalte, aber als Einsteigerhilfe zu groß. [E16]

**Vorschlag:** Drei kurze Einstiege: „Erste Karten erstellen“, „Täglich lernen“, „Daten sichern“. Hilfe an der passenden Aufgabe verlinken. Die vollständige durchsuchbare Dokumentation erhalten, Syntaxreferenzen als weiterführenden Autorenbereich führen. Keine verpflichtende Tour, kein Hilfedeck, das zur normalen Lernaufgabe wird. Hilfe darf schlechte Beschriftung oder widersprüchliche Zustände nicht kompensieren müssen.

### UI-21 — Visuelle Hierarchie und Sprache konsequent reduzieren

**Priorität: P1 für Kernaktionen, sonst P2. Beleg: V + Q.**

Große Titel, zusätzliche Oberzeilen, großflächige dekorative Bereiche, mehrere Kennzahlen und mehrstufige Panels beanspruchen besonders mobil Platz. Im Editor werden wichtige Aktionswörter dagegen entfernt. „BASICS“, „PROGRESS“ und „CARDS“ sind im Quelltext direkt festgelegt und laufen nicht über die normale Übersetzung. [E1, E2, E3]

**Vorschlag:** Eine erkennbare Hauptaktion pro Zustand. Dekorative Oberzeilen und nicht benötigte Zahlen zurücknehmen. Wichtige Verben wie „Speichern“ und „Lernen“ lesbar lassen. Ein einheitliches Muster für Zurück, Menüs, Bestätigungen und Meldungen verwenden. Falls die Editorabschnitte bleiben, vollständig lokalisieren und „Fortschritt zurücksetzen“ aus der normalen Abschnittsnavigation entfernen.

Weniger visuelles Gewicht darf nicht durch schlechteren Kontrast entstehen. Normaler Text benötigt nach Projektregel mindestens 4,5:1, großer Text und relevante Bedienelemente mindestens 3:1. Abstände, Gruppierung und Gewichtung sind der bessere Weg. Die geöffneten Screens wurden visuell beurteilt; für einzelne Farbpaare wurde hier **kein abschließender gerenderter Kontrastnachweis** geführt. Der konkrete Layoutbefund UI-01 bleibt unabhängig davon ein offener Blocker.

### UI-22 — Technische Fehlertexte in eine nächste Handlung übersetzen

**Priorität: P1. Beleg: V + Q.**

Formulierungen zu Cloud-Konfiguration, begrenzten Bestandsanfragen, Verarbeitungsschritten oder „nicht stillschweigend verworfenen“ Daten erklären Systemmechanismen. Sie helfen einem neuen Nutzer nur begrenzt bei der nächsten Entscheidung. Fehler der isolierten Browseransicht sind hier Belege für die gezeigte Sprache, nicht für einen Defekt des korrekt konfigurierten Produkts. [E8, E13, E15]

**Vorschlag:** Jeweils Problem, Auswirkung und konkrete Aktion nennen. Beispielsweise: „iCloud ist gerade nicht erreichbar. Deine gespeicherten Decks kannst du weiter nutzen. Erneut versuchen.“ Das nur anzeigen, wenn lokale Nutzbarkeit tatsächlich geprüft ist. Bei einem Speicherfehler dagegen ausdrücklich „Noch nicht gespeichert“ zeigen und den Entwurf erhalten. Technische Diagnose bei Bedarf aufklappbar anbieten; normale Lade-, Offline- und Fehlerzustände klar auseinanderhalten.

## 5. Was aus der normalen UI heraus sollte

„Entfernen“ meint hier zunächst die bewusste Entfernung aus der gewöhnlichen Produktoberfläche. Wo auch das vollständige Streichen einer Funktion empfohlen oder erwogen wird, steht es ausdrücklich dabei. Bloßes Verstecken laufender Prozesse reduziert deren Kosten nicht.

| Funktion oder Element                                                        | Empfehlung                                    | Begründung / verbleibender Platz                                                                                     |
| ---------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Audiooptimierungsbereich mit Start, Pause und Zählern                        | **Aus Standard-UI entfernen**                 | Verarbeitung separat anhand von Nutzen und Kosten bewerten; gegebenenfalls vollständig streichen                     |
| Globale Audio-Basisverstärkung mit acht Prozentwerten                        | **Aus Standard-UI entfernen**                 | Nur bei belegtem Problem als gezielte Wiedergabeoption                                                               |
| Cloud-Anfragezähler und Anfragebudgets                                       | **Entfernen**                                 | Diagnose, keine Lernentscheidung                                                                                     |
| Warteschlangen getrennt nach Datentyp                                        | **Aus Standard-UI entfernen**                 | Normale Fortschritts-/Fehleranzeige erhalten, Details diagnostisch                                                   |
| Sichtbare Prüfsummen im Katalog                                              | **Entfernen**                                 | Signatur- und Integritätsprüfung intern beibehalten                                                                  |
| Import-Generationen, Signaturen und Sicherheitsmechanik in Einführungstexten | **Entfernen**                                 | Kurzer Datenschutzhinweis; Spezialdetails in Hilfe                                                                   |
| Schloss zur Planbearbeitung                                                  | **Entfernen**                                 | Klare Auswahlaufgabe statt wechselnder Bedeutung derselben Zeile                                                     |
| „Fortschritt zurücksetzen“ als normaler Editorabschnitt                      | **Entfernen / verlagern**                     | Seltene gefährliche Verwaltungsaktion                                                                                |
| Strategietoleranz, Wiederholungsserien, Problemkarten- und Festigungstage    | **Aus Standard-UI entfernen**                 | Bestehende Fachlogik zunächst erhalten; Spezialzugang nur bei belegtem Bedarf                                        |
| Fünf Strategie-Presets beim Einstieg                                         | **Zurücknehmen**                              | Funktionierende Vorgabe; Anpassung erst auf Wunsch                                                                   |
| Deckbestand und Speichergröße auf der Startseite                             | **Entfernen**                                 | Bestand gehört in die Bibliothek, Speicher in Datenverwaltung                                                        |
| Entwicklerreferenzen im allgemeinen Einsteigerkatalog                        | **Entfernen / verlagern**                     | Autorenhilfe; vorhandene Nutzerinhalte erhalten                                                                      |
| „Meine iCloud“ als Tab unter „Entdecken“                                     | **Verlagern**                                 | Einstellungen / eigene Daten                                                                                         |
| Wiederholung eines vollständigen Deckmanagers in iCloud                      | **Reduzieren**                                | Verfügbarkeit und Download im Bibliothekskontext                                                                     |
| Memory direkt im regulären Sitzungsabschluss                                 | **Vorerst herausnehmen**                      | Optionales freies Üben; komplette Streichung noch nicht durch Nutzungsdaten begründet                                |
| Zahlengenerator als prominenter erster Katalogeintrag                        | **Verlagern**                                 | Spezialangebot innerhalb Sprachen/Zahlen                                                                             |
| Roh-Markdown und spezielle Kartenmodi beim ersten Erstellen                  | **Verlagern**                                 | Klarer Frage-/Antworteditor; verlustfreier Spezialzugang bleibt                                                      |
| Beschreibung, Tags, Deckbild und Hierarchie vor der ersten Karte             | **Verlagern**                                 | Spätere Deckoptionen                                                                                                 |
| Speichergrößen und mehrere Prozentwerte in jeder Deckzeile                   | **Reduzieren**                                | Kerninformation Titel, Inhalt und klarer Lernstatus                                                                  |
| Globaler Theme-Schalter auf jedem Bildschirm                                 | **Zurücknehmen**                              | Erscheinungsbild in Einstellungen; einen bewährten schnellen Zugang nur bewusst erhalten                             |
| Zoom-, Textgrößen- und Vorlesefunktionen                                     | **Erhalten, verständlich gruppieren**         | Direkter Nutzen für Bedienbarkeit und Zugang; keine pauschale Entfernung                                             |
| Vier Schedulerbewertungen                                                    | **Erhalten, besser erklären**                 | Reduktion wäre eine fachliche Änderung                                                                               |
| Export, Backup und Wiederherstellung                                         | **Erhalten, klar benennen**                   | Wesentliche Kontrolle über eigene Daten                                                                              |
| Explizite iCloud-Aktivierung und verständliche Fehler                        | **Erhalten**                                  | Datenschutz und nachvollziehbare Verfügbarkeit                                                                       |
| Löschen auf diesem Gerät / auf allen Geräten                                 | **Erhalten, selten und eindeutig platzieren** | Die unterschiedlichen Folgen lassen sich nicht verantwortbar in einem namenlosen Papierkorb verstecken               |
| Debug-Testbestand zurücksetzen                                               | **Nur Entwicklung**                           | Ist im nativen Quellpfad bereits an Entwicklungsstatus gebunden; nicht als erwiesene öffentliche Exposition bewertet |

Nicht jede Nischenfunktion muss gelöscht werden. Ein sinnvoller Maßstab ist: Wenn eine Funktion für alle sichtbar wird, muss sie vielen Nutzern bei der aktuellen Aufgabe helfen. Andernfalls braucht sie einen klaren Kontext oder einen begründeten Ausbauauftrag. Bei der Audio-Wartungsoberfläche reicht dieser Nutzen derzeit nicht aus.

## 6. Drei vereinfachte Sollabläufe

### A. Erste eigene Karten

1. „Meine Decks“ → „Deck erstellen“.
2. Namen eingeben → „Erste Karte erstellen“.
3. Frage und Antwort eingeben → „Speichern & nächste“ oder „Karte speichern“.
4. „Fertig“ → Deck mit klarer Hauptaktion „Jetzt lernen“.
5. Optional „Regelmäßig lernen: Zum Lernplan hinzufügen“. Aktiver Plan und Umfang ausdrücklich nennen; bei einem einzigen Plan keine zusätzliche Planwahl verlangen.

Bis zur ersten Karte werden keine Tags, Bilder, Hierarchien, Strategien, Referenzmodi oder Cloud-Entscheidungen benötigt. Eine spätere Layoutentscheidung kann Name und erste Karte in einem Bildschirm zusammenführen. Sie darf aber weder die ersten Felder erneut verdrängen noch einen umfangreichen Einrichtungsassistenten erzeugen.

### B. Täglich lernen

1. „Heute“ zeigt Umfang, grobe Dauer und „Jetzt lernen“.
2. Frage lesen / Aufgabe bearbeiten.
3. Antwort anzeigen.
4. Erinnerung bewerten; nächstes Intervall verständlich anzeigen.
5. Nach der vorgesehenen Runde Ergebnis und „Fertig“.

Sitzung unterbrechen und wieder aufnehmen, Offlinebetrieb sowie sichere Fehlermeldungen gehören zu diesem Ablauf. Eine konzeptionell einfache Lernrunde darf deshalb nicht ihre tatsächliche Speichersicherheit verlieren. Änderungen an Kartenauswahl, Tagesgrenzen, Wiederholungsereignissen oder Intervallen sind ausdrücklich keine beiläufige UI-Anpassung.

### C. Decks verwalten und einem Lernplan zuordnen

1. Eine Deckzeile öffnet immer das Deck; Bearbeiten ist eindeutig erreichbar.
2. „Heute“ → „Lernplan bearbeiten“ → „Decks auswählen“.
3. Decks mit sichtbaren Auswahlfeldern wählen. Unterdecks werden einzeln oder über eine ausdrücklich benannte Gruppenaktion gewählt.
4. „Übernehmen“ bestätigt den Umfang und kehrt zur Ausgangsaufgabe zurück.

Einen neuen benannten Plan erst über „Weiteren Lernplan erstellen“ anbieten. Der aktuelle erste Plan bleibt intern bestehen. Die Vereinfachung entfernt weder bestehende zusätzliche Pläne noch deren Auswahlmöglichkeiten für Nutzer, die sie bereits verwenden.

## 7. Umsetzung in kleinen, überprüfbaren Schritten

Die Reihenfolge ist ein Vorschlag. Dieses Dokument autorisiert keine Codeänderungen.

| Schritt                                              | Ergebnis                                                                                            | Wichtige Grenze                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1. Mobile Erstellung und ehrliche Startzustände      | Volle Formularbreite; Einstieg ohne unnötige Felder; keine falsche Fertigmeldung                    | Speichern, Entwürfe und Wiederherstellung absichern                            |
| 2. Bibliothek und Planwahl verständlich machen       | Stabile Deckinteraktion; Schloss entfällt; begrenzte Auswahlaufgabe                                 | Auswahlumfang und bestehende Mitgliedschaften bewusst behandeln                |
| 3. Lernstart, Bewertungen und Abschluss vereinfachen | Sichtbarer Modus; konzentrierte Lernrunde; klarer Abschluss                                         | Scheduler und gespeicherte Reviews erhalten                                    |
| 4. App insgesamt entrümpeln                          | Audio-Wartung, Diagnose, technische Katalog-/Importtexte und unnötige Standardoptionen verschwinden | Datenkontrolle, Schutzfunktionen und aussagekräftige Fehler bleiben            |
| 5. iCloud und Datenaktionen ordnen                   | Eigene Daten an einem Ort; verständliche Verfügbarkeit und Löschfolgen                              | Explizite Aktivierung und sichere Synchronisationsregeln erhalten              |
| 6. Spezialfunktionen bewerten                        | Fundierte Entscheidung über Audioverarbeitung, Memory, Generatoren und seltene Einstellungen        | Keine ungeprüfte Löschung von Nutzerinhalten oder unbelegtes Nutzenversprechen |

Nicht gleichzeitig das gesamte Designsystem, den Scheduler, die Persistenz und die Synchronisation neu schreiben. Jeder Schritt sollte einen vollständigen sichtbaren Ablauf verbessern und mit dem bisherigen Verhalten verglichen werden. Größere Inhaltsfähigkeiten können währenddessen bestehen bleiben.

## 8. Abnahmekriterien und Nutzertest

### 8.1 Messbare Produktziele — noch keine gemessenen Ergebnisse

Ein erster moderierter Test mit fünf bis acht Personen ohne Anki-/Flash-n-Flip-Vorwissen sollte Aufgaben ohne Voraberklärung stellen. Als vorläufiges Ziel sollten mindestens vier von fünf Personen die Kernaufgaben ohne Eingriff schaffen. Diese kleine Stichprobe findet grobe Hürden; sie belegt keine breite Marktakzeptanz.

| Aufgabe                                          | Vorläufiges Ziel                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Eigenes Deck mit drei einfachen Karten erstellen | Ohne Hilfe in höchstens drei Minuten, ohne Pflichtbesuch in erweiterten Optionen      |
| Ein fertiges Deck finden und öffnen              | Ohne Kenntnis von Sammlungs-/Importtechnik                                            |
| Ein Deck für regelmäßiges Lernen auswählen       | Nutzer kann anschließend zeigen, was hinzugefügt wurde; keine unerwarteten Unterdecks |
| Reguläre Runde und freies Üben unterscheiden     | Nutzer kann korrekt erklären, welcher Modus Wiederholungstermine beeinflusst          |
| Fünf Karten lernen und Sitzung verlassen         | Ohne nach Hilfe zur Bewertung oder zum Abschluss suchen zu müssen                     |
| Planzuordnung entfernen                          | Nutzer erwartet korrekt, dass dadurch kein Deck und kein Lernstand gelöscht wird      |
| Backup und Wiederherstellung finden              | Nutzer unterscheidet sie von iCloud-Abgleich und Deckexport                           |
| Audio ohne Wartung nutzen                        | Keine Kenntnis von Optimierung, Prozentverstärkung oder Verarbeitungsstatus nötig     |

Erfassen: Zeit bis zur ersten sinnvollen Aktion, Rücksprünge, Fehlentscheidungen, benötigte Hilfen und die vom Nutzer erwartete Wirkung. Keine persönlichen Deckinhalte oder laufende Nutzungsanalyse für diesen Test voraussetzen.

### 8.2 Technische und gestalterische Abnahme der späteren Umsetzung

- Kernabläufe bei 390 CSS-Pixeln und auf einem physischen iPhone im iOS-WebView prüfen; zusätzlich iPad und Desktop. Tastatur, sichere Bildschirmränder, Textvergrößerung und Querformat berücksichtigen.
- Kein horizontales Formularscrollen, keine abgeschnittene Hauptaktion und kein verdeckter Inhalt durch Navigation, Kopfzeile oder Bildschirmtastatur.
- Helle und dunkle Darstellung, 200-Prozent-Zoom und größte unterstützte mobile Textgröße prüfen. Verdächtige Farbpaare einschließlich Zuständen und Transparenz messen.
- Touchziele grundsätzlich mindestens 44 × 44 logische Punkte. Wichtige Funktionen behalten Text, zugängliche Namen und alternative Bedienwege.
- Web per Tastatur, Apple per VoiceOver prüfen. Fokus bei Dialogen, Fehlern und Antwortanzeige sinnvoll führen. Touchbedienung erzeugt keine klebenden Hover- oder Fokuszustände.
- Leer, lädt, fehlgeschlagen, offline, abgeschlossen und unterbrochen getrennt testen. Bei Fehlern keine Erfolgsmeldung und kein Verlust eingegebener Inhalte.
- Änderungen an Lernabläufen mit Offlinebetrieb, Neustart, doppelter Zustellung und unterbrochener Speicherung prüfen. Änderungen an Plan-/Cloud-Daten zusätzlich auf mehreren Geräten mit konkurrierenden Änderungen testen.
- Bestehende Decks, Spezialkarten, Hierarchien, Planmitgliedschaften, Medien und Reviews nach der Umstellung vergleichen. Keine stillen Umwandlungen oder Zurücksetzungen.
- Abgleich und Medienverfügbarkeit nur so vollständig darstellen, wie tatsächlich bestätigt. Ein funktionierender Login oder ein schönes Statussymbol reicht nicht.

### 8.3 Offene Entscheidungen vor dem jeweiligen Ausbau

1. Ein tägliches Zeitbudget oder eine Kartenzahl als vorrangige Einstellung? Empfehlung: eine einfache Vorgabe anbieten und die andere Größe als Schätzung erklären; fachliche Umsetzung separat bestätigen.
2. Exakte Gruppenregel für Planzuordnung? Empfehlung: einzelnes Deck als Standard, Unterdecks nur über sichtbare Gruppenaktion.
3. Audioverarbeitung vollständig streichen oder intern behalten? Empfehlung: Standard-UI entfernen; Entscheidung zur Verarbeitung nach Messung an realistischen Decks.
4. Welche Spezialangebote sind für den Markteinstieg tatsächlich zentral? Empfehlung: gezielt platzieren und in Erstnutzertests prüfen, bevor Funktionen oder Inhalte endgültig entfernt werden.

## 9. Quellbelege

Zeilennummern beziehen sich auf den geprüften Arbeitsbaum und können sich später verschieben. Die Verweise dokumentieren den Befund, nicht bereits umgesetzte Änderungen.

| Beleg | Fundstelle                                                                                                                                                                                                                                                                                                             | Aussage                                                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| E1    | [Deckeditor](/Users/frank/Documents/flash-n-flip/apps/web/components/deck-editor.tsx:869)                                                                                                                                                                                                                              | Oberes Speichern, Grundlagenformular, zunächst deaktivierte Karten-/Fortschrittsbereiche; Neuerstellung ab etwa Zeile 755 |
| E2    | [Editorlayout mobil](/Users/frank/Documents/flash-n-flip/apps/web/app/styles.css:10114)                                                                                                                                                                                                                                | Symbolaktionen und fortgesetzte Zweispaltenaufteilung; Grundlagenpanel und Scrollregeln ab etwa Zeile 2616                |
| E3    | [Startseite](/Users/frank/Documents/flash-n-flip/apps/web/components/dashboard.tsx:120)                                                                                                                                                                                                                                | Zustandswahl, Start/Fortsetzen, Strategie und Zusatzübungen                                                               |
| E4    | [Lernstrategie](/Users/frank/Documents/flash-n-flip/apps/web/components/study-strategy-panel.tsx:184)                                                                                                                                                                                                                  | Planwahl, Tempoanzeige, verschachtelte Konfiguration, fünf Presets und neun Felder                                        |
| E5    | [Deckbibliothek](/Users/frank/Documents/flash-n-flip/apps/web/components/deck-list.tsx:892)                                                                                                                                                                                                                            | Zeile als Auswahl oder Link; Planleiste und Schloss ab etwa Zeile 1134                                                    |
| E6    | [Planzuordnung](/Users/frank/Documents/flash-n-flip/apps/web/lib/local-product-repository.ts:2806) und [Fortschritt zurücksetzen](/Users/frank/Documents/flash-n-flip/apps/web/lib/local-product-repository.ts:3353)                                                                                                   | Nachfahrenauswahl und deck-/kartenbezogene Resetwirkung                                                                   |
| E7    | [Kartenarbeitsbereich](/Users/frank/Documents/flash-n-flip/apps/web/components/deck-editor.tsx:1572), [Markdownfeld](/Users/frank/Documents/flash-n-flip/apps/web/components/markdown-card-editor.tsx:47), [Medieneingabe](/Users/frank/Documents/flash-n-flip/apps/web/components/media-block-editor.tsx:443)         | Kartenarten, Vorschau, Entwürfe, Medien und Spezialoptionen                                                               |
| E8    | [Einstellungen](/Users/frank/Documents/flash-n-flip/apps/web/components/settings.tsx:393) und [Audioverstärkung](/Users/frank/Documents/flash-n-flip/apps/web/components/audio-player-gain-setting.tsx:13)                                                                                                             | Gruppen, Lernumfang, Wiedergabe, Audiooptimierung, Backup und Cloud-Backupaktionen                                        |
| E9    | [Lernsitzung](/Users/frank/Documents/flash-n-flip/apps/web/components/study-session.tsx:1482) und [Bewertungen](/Users/frank/Documents/flash-n-flip/apps/web/components/study-session.tsx:2371)                                                                                                                        | Neutraler Übungsmodus, reguläre Ratings, Kontextsteuerung und Abschluss                                                   |
| E10   | [Weitere Übungen](/Users/frank/Documents/flash-n-flip/apps/web/components/continue-learning-panel.tsx:28), [Memory](/Users/frank/Documents/flash-n-flip/apps/web/components/memory-game.tsx:27), [Zahlen](/Users/frank/Documents/flash-n-flip/apps/web/components/number-generator.tsx:61)                             | Zusatzrunden, Filter und Spezialübungen                                                                                   |
| E11   | [Deckkennzahlen](/Users/frank/Documents/flash-n-flip/apps/web/components/deck-list.tsx:1447)                                                                                                                                                                                                                           | Unterschied zwischen Bestand, Planfortschritt und möglichen Kategorieeinheiten                                            |
| E12   | Historische Optimierung in `apps/web/lib/audio-optimization.ts` und im früheren Einstellungsbereich; inzwischen entfernt. Aktuelle Entscheidung: [ADR 0058](docs/architecture/decisions/0058-task-focused-ui-and-audio-retirement.md).                                                                                 | Frühere UI-/Joblogik; kein verbleibender Optimizer.                                                                       |
| E13   | [Entdecken und iCloud](/Users/frank/Documents/flash-n-flip/apps/web/components/community-browser.tsx:17), [Pfadwahl iCloud](/Users/frank/Documents/flash-n-flip/apps/web/components/my-icloud-browser.tsx:313), [Native iCloud](/Users/frank/Documents/flash-n-flip/apps/web/components/native-icloud-browser.tsx:125) | Private Verwaltung unter Entdecken, alternative Implementierungen, Betriebsanzeigen und Datenaktionen                     |
| E14   | [Katalog](/Users/frank/Documents/flash-n-flip/apps/web/components/deck-catalog.tsx:51)                                                                                                                                                                                                                                 | Prüfsummenanzeige, Sammlungsdarstellung und Spezialangebote                                                               |
| E15   | [Import](/Users/frank/Documents/flash-n-flip/apps/web/components/import-cards.tsx:387)                                                                                                                                                                                                                                 | Formatwahl, technische Einführung, Sprachfelder und nachgelagerte APKG-Optionen                                           |
| E16   | [Hilfeseite](/Users/frank/Documents/flash-n-flip/apps/web/components/online-help.tsx:10)                                                                                                                                                                                                                               | Umfangreiche durchsuchbare Dokumentation                                                                                  |
| E17   | [Webnavigation](/Users/frank/Documents/flash-n-flip/apps/web/components/app-shell.tsx:60), [Native Navigation](/Users/frank/Documents/flash-n-flip/apps/apple/ios/App/App/SceneDelegate.swift:768)                                                                                                                     | Hauptbereiche und Bezeichnung „Lokal“                                                                                     |
| E18   | [Routen der installierten App](/Users/frank/Documents/flash-n-flip/apps/web/portable/routes.ts:1)                                                                                                                                                                                                                      | Abgrenzung der aktuellen Lernenden-App gegenüber vorhandenen anderen Routen                                               |

## 10. Umsetzung vom 27. Oktober 2026

Auftrag: zuerst P0, insbesondere mobiler Deckeditor und falscher Abschluss leerer
Lernpläne; anschließend alle weiteren Befunde verbessern. **Scheduler und
Synchronisationslogik bleiben unverändert. Die Audiooptimierung entfällt
vollständig.** Diese ausdrückliche Produktentscheidung ersetzt die vorsichtigere
Empfehlung zur Verarbeitung in UI-14. Es wurde weder committed noch gepusht oder
deployt. Bereits vorhandene Änderungen anderer Arbeiten wurden bewahrt.

### 10.1 Umgesetzte Lösungen je Befund

„Umgesetzt“ bezeichnet die Änderung im Arbeitsbaum. Geräteabnahme und
Erstnutzerverständnis sind davon getrennt und unten ausdrücklich begrenzt.

| Befund    | Umsetzung                                                                                                                                                                                                                                                                                                           | Nachweis / praktische Grenze                                                                                                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI-01, P0 | Mobiler Editor mit voller Breite; getrennte Bereiche Karte, Kartenliste und Deckoptionen. Formulare scrollen vertikal. Eingaben besitzen keine schmale Seitenleiste mehr.                                                                                                                                           | Browser: Titelfeld 328 px bei 360 px Viewport; Frage und Antwort je 341 px bei 390 px Viewport. Kein horizontales Überlaufen. Native Tastaturabnahme später.                                                                           |
| UI-02, P0 | Neuerstellung beginnt mit Titel und „Erste Karte erstellen“. Weitere Deckfelder sind optional aufgeklappt erreichbar. Deaktivierte Fortschritts-/Kartenpanels sind vor der Erstellung entfernt.                                                                                                                     | Reale Neuerstellung, zwei Karten und Neuladen im isolierten Browser bestanden.                                                                                                                                                         |
| UI-03, P0 | Eigene Zustände für Laden, Fehler, erste Inhalte, leere Planauswahl, fällige Karten und tatsächlichen Abschluss. Keine Strategie-/Zusatzübungsanzeige ohne nutzbaren Plan. Auch ein direkt aufgerufener leerer Lernweg zeigt keinen Lernerfolg.                                                                     | Verhaltenstests für leere Bibliothek, Referenzbestand, leeren Plan, Fehler, fällige und zurückgestellte Karten; reguläre Runde bis zum gespeicherten Abschluss geprüft.                                                                |
| UI-04, P0 | Schloss und wechselnde Bedeutung der Deckzeile entfallen. Zeilen öffnen das Deck. „Lernplan bearbeiten“ führt in eine eigenständige Auswahl mit „Übernehmen“ und „Abbrechen“. Bei einem Plan entfällt die überflüssige Auswahlbox.                                                                                  | Entwurf/Abbrechen ohne Schreibvorgang, ein versionierter Commit bei Übernahme, konkurrierende Planänderung und Fehlererhalt getestet.                                                                                                  |
| UI-05     | Auswahlfelder ändern jeweils genau ein Deck. Eine getrennte, bezifferte Aktion fügt Unterdecks hinzu oder entfernt sie. Bestehende Zuordnungen werden beim Öffnen nicht verändert.                                                                                                                                  | Gruppenaktion und Einzelauswahl getestet; Bestehende auswählbare Zuordnungen bleiben erhalten; Referenzen bleiben gemäß vorhandener Produktregel vom Lernplan ausgeschlossen.                                                          |
| UI-06     | „Karte speichern“, „Speichern & nächste“ und „Fertig“ sind ausgeschrieben. Keine automatische Gegenseiten-Vorschau während der Eingabe. Entwurfswarnung und sichere Commit-Wiederholung bleiben erhalten.                                                                                                           | Bestehende Editor-Verhaltenstests einschließlich Wiederholung, unsicherem Bridge-Ergebnis und Routenwechsel bestehen.                                                                                                                  |
| UI-07     | Frage und Antwort bleiben die Hauptfelder. Medien werden erst auf Wunsch geöffnet. Kartenart, Verknüpfung und Bewertungsoptionen liegen unter weiteren Kartenoptionen. Aufklappbare Bereiche haben erkennbare Pfeile.                                                                                               | Rich Content wird nicht konvertiert; bestehende Content-/Editor-/Medientests bestehen.                                                                                                                                                 |
| UI-08     | Beschrifteter Einstieg „Lernumfang ändern“; zuerst Tagesminuten und optionales Datum. Presets und Feineinstellungen sind nachgeordnet. Kein Tempo-Tier, keine scheinpräzise Zielprognose.                                                                                                                           | Verhaltenstests: sichtbare Grundfelder, vorhandene verdeckte Werte beim Speichern erhalten, Fehler lässt Eingabe bestehen. Minuten ausdrücklich als Schätzung erklärt.                                                                 |
| UI-09     | Globale „Neue Karten pro Tag“-Bedienung aus den Einstellungen entfernt. Ein Link führt zum Lernumfang des aktiven Plans. Gespeicherte globale Werte werden nicht gelöscht.                                                                                                                                          | Reichweite „Für diesen Lernplan“ sichtbar; Planungsregeln unverändert.                                                                                                                                                                 |
| UI-10, P0 | Lernmodus und Fortschritt bleiben sichtbar. Freies Üben erklärt die unveränderten Wiederholungstermine; zusätzliche neue Karten sind ausdrücklich reguläres Lernen. Fortsetzen benennt freie Übung bzw. Nachschlagen.                                                                                               | Reguläre Runde mit vier Ratings sowie freie Runde mit „Weiter“ im Browser geprüft; Queue-/Review-Methoden unverändert.                                                                                                                 |
| UI-11     | Vier bestehende Ratingwerte mit „Nicht gewusst“, „Mit Mühe“, „Gewusst“, „Sehr leicht“, Intervallen und optionaler Erklärung. Auf Telefonen zwei gut erreichbare Reihen.                                                                                                                                             | Alle vier Werte beibehalten; mobile Buttons mindestens 44 px hoch, kein Überlauf. Bewertungsmethode unverändert.                                                                                                                       |
| UI-12     | Abschluss mit Ergebnis und „Fertig“. Zusatzrunden sind eingeklappt; Memory liegt noch eine Ebene darunter. Ohne Kandidaten keine leere Übungsaufforderung.                                                                                                                                                          | Abschluss mit zwei dauerhaft gespeicherten Bewertungen und freies Üben praktisch geprüft.                                                                                                                                              |
| UI-13     | Bestandsstatistiken aus Heute entfernt, Planprozente aus der Planleiste entfernt. Bibliothek benennt „Schon einmal gelernt: x von y“, einschließlich virtueller Sprachdecks. Speichergrößen entfallen aus normalen Zeilen.                                                                                          | Bestehende fachliche Zählung bleibt erhalten; keine Beherrschungskennzahl eingeführt.                                                                                                                                                  |
| UI-14     | Optimierungsbereich, Worker, Jobadapter, Import-Transcoding und native Encoder-/Batteriebeobachtung entfernt. Auch Wiedergabe startet keine Optimierung mehr.                                                                                                                                                       | API-, Domain-, Plattform- und Apple-Tests bestehen. Nur Kompatibilität für bereits vorhandene Audiomedien bleibt; siehe 10.2.                                                                                                          |
| UI-15     | Einstellungen nach Lernen, Darstellung/Bedienung, Daten/iCloud und Hilfe geordnet. Optionale Audioverstärkung unter weiteren Optionen. Textgröße, Vorlesen, Zoom, Backup und Wiederherstellung bleiben erreichbar.                                                                                                  | Helle/dunkle Darstellung und größte App-Schrift im Browser geprüft.                                                                                                                                                                    |
| UI-16     | iCloud aus Entdecken in einen bewusst geöffneten Bereich der Einstellungen verlagert. Alte iCloud-Links führen dorthin. Anfragezähler und Aufteilung der Warteschlangen entfallen.                                                                                                                                  | Keine neue Aktivierung oder Cloudlogik. Cloudverwaltung wird erst beim Aufklappen eingebunden. Vorhandene Detailverwaltung bleibt dort für gezielte Downloads erhalten. Kein Mehrgeräteabgleich ausgeführt.                            |
| UI-17, P0 | Fortschrittsreset aus normaler Editornavigation in „Deck verwalten“. Deck-/Planreset erklärt die Wirkung auf dieselben Karten in anderen Plänen. Lokales Entfernen wird als solches benannt; bestehende getrennte Lösch- und Wiederherstellungswege bleiben erhalten.                                               | Reichweiten im Quelltext und Dialogen geprüft; keine destruktiven Aktionen mit echten Nutzerdaten ausgeführt.                                                                                                                          |
| UI-18     | Signaturdatum und Prüfsummen aus der Katalogdarstellung entfernt; Prüfung bleibt zwingend. Generator und Autorenreferenzen sind nachgeordnete Spezialangebote. Hinzufügen bestätigt Ergebnis und bietet Bibliothek/Planauswahl.                                                                                     | Katalog-/Installations-/Signaturtests bestehen. Keine bereits installierten Inhalte entfernt.                                                                                                                                          |
| UI-19     | Gemeinsame Dateiauswahl erkennt FNF, APKG, CSV und TSV. Text einfügen ist ein eigener verständlicher Einstieg. CSV/TSV zeigt vorab validierte Kartenzahl oder verständlichen Fehler; FNF/APKG behalten die bestehende Vorschau und Spezialoptionen. Technische Einführung und doppelte Sicherheitsblöcke reduziert. | CSV über Dateiauswahl bis zum gespeicherten Deck mit einer Karte und nach Neuladen geprüft; gültige/ungültige Textvorschau automatisiert geprüft. Vollständiger APKG-/FNF-Browserdurchlauf bleibt offen, Parser-/Importtests bestehen. |
| UI-20     | Kurze Hilfseinstiege für erste Karten, tägliches Lernen und Datensicherung. Autorenreferenzen weiterführend; vollständige Suche und Offlinehilfe bleiben erhalten.                                                                                                                                                  | Quell- und bestehende Hilfetests; kein neuer Pflichtdurchlauf.                                                                                                                                                                         |
| UI-21     | „Heute“, „Meine Decks“, „Entdecken“, „Einstellungen“ in Web und nativen Titeln. Editorabschnitte lokalisiert; Aktionswörter bleiben sichtbar. Themewechsel nur in Einstellungen. Große Schrift darf Navigationsnamen umbrechen. Bei niedriger Lernhöhe entfallen dekorative Navigationssymbole.                     | Englisch und Deutsch im Browser, vier Sprachkataloge geprüft. Keine vollständige Sprach-/Gerätematrix.                                                                                                                                 |
| UI-22     | Ladefehler werden nicht als leere Daten ausgegeben. Wiederholen, „Noch nicht gespeichert“, erhaltener Entwurf und technische Details auf Wunsch. Fehler in der Cloudansicht erhalten eine verständliche Hauptaussage.                                                                                               | Fehler-/Konflikt-/Editor-Verhaltenstests bestehen. Kein pauschales „Abgeglichen“ aus bloßer Kontoerkennung abgeleitet.                                                                                                                 |

### 10.2 Vollständiger Ausbau der Audiooptimierung und sichere Altbestände

Die Funktion läuft auch verborgen nicht weiter. Webworker, persistenter
Jobadapter, API-Optimizer und Swift-Encodingplugin samt Registrierung sind
entfernt. Neu importierte, validierte Audiodateien werden nicht neu kodiert.
Wiedergabe, Aufnahme, Vorlesen und optionale Wiedergabelautstärke bleiben.

Ein kleiner ausdrücklich als **Legacy-Kompatibilität** benannter Domainbaustein
liest vorhandene Derivatmetadaten. Vorhandene Derivate bleiben abspielbar und
über die bisherigen Medienwege übertragbar. Das ist nötig, weil ältere Stände
bereits Originale nach geprüfter Ableitung entfernt haben können. Die bisherigen
Persistenz-, Auswahl- und Aufräumregeln wurden nicht umgeschrieben. Es gibt weder
eine neue Löschmigration noch eine Neuverarbeitung alter Medien. Alte Jobtabellen
bleiben unbenutzt liegen; kein Runtime-Adapter liest oder beschreibt sie.

Entscheidung und Folgen: [ADR 0058](docs/architecture/decisions/0058-task-focused-ui-and-audio-retirement.md).

### 10.3 Verifikation und verbleibende Abnahme

Nachweise, Screenshots, gerenderte Rechtecke und Integritätsvergleich liegen im
[Prüfbericht](docs/quality/reviews/2026-10-27/ui-simplification/README.md).

- Web-Verhalten und Regression: **1.035 Tests bestanden**; nach abschließenden kleinen Layout-/Ladezustandskorrekturen zusätzlich gezielte Tests.
- API: **313**, Domain: **276**, Plattformpaket: **219**, Apple-Hülle: **37**, Scheduler: **11**, Sync: **99** Tests bestanden. Zusammen **1.990 unterschiedliche Tests**; Wiederholungen werden nicht addiert.
- TypeScript und UI-Sprachprüfung bestanden. Readability-Scanner: **0 statische Fehler, 326 manuell zu prüfende Stellen** im gesamten Scanbereich. Das ist keine pauschale Kontrastfreigabe.
- Gerenderter Karten-/Abstandscheck bestanden für 390 × 844, 390 × 520 und 1.440 × 900 mit größter App-Schrift. Zusätzliche helle Bewertungsansicht und Editor auf 360/390 px geprüft. Einzelne Farben und Bedienelemente wurden gerendert nachgemessen.
- **56 Scheduler-/Sync-/Cloud-Dateien** stimmen bytegenau mit dem Ausgangsstand überein. Queue, Tageszusammenfassung, Bewertungsmethoden, Fortschrittsreset und Strategie-Update stimmen im AST-Vergleich überein; ebenso native CloudKit-Implementierung hinter dem entfernten Audioplugin.
- Apple-Simulator-Debugbuild bestanden. **Native Bedienprüfung ausdrücklich auf später verschoben** (Rückmeldung des Produktverantwortlichen). Physisches iPhone/iPad, Bildschirmtastatur, VoiceOver, 200-Prozent-Browserzoom und Karten-/Erkunden-Varianten mit Kartenmaterial sind noch offen. Größte App-Schrift ist geprüft, ersetzt diese Abnahmen aber nicht.
- Live-Synchronisation, Cloudaktivierung, destruktive Aktionen und Wiederherstellung wurden mit echten Nutzerdaten nicht ausgeführt. Die vorhandenen Persistenz-/Konflikt-/Neustarttests bleiben grün; dies ist keine neue Synchronisations- oder Releasefreigabe.

Die Umsetzung bearbeitet alle 22 Befunde. Die offenen Punkte oben sind
Abnahmegrenzen und werden nicht als bestanden dargestellt. Erstnutzer-Tests
müssen weiterhin prüfen, ob die reduzierte Oberfläche tatsächlich verständlicher
ist und schneller zur ersten eigenen Karte und zur täglichen Runde führt.

## 11. Weitere Punkte und Abschluss der Bedienabläufe

Stand: 27. Oktober 2026. Die Nachprüfung hat die Aussagen „alle Befunde bearbeitet“
auf konkrete Restlücken geprüft. Ergänzt wurden die vollständigen Übergänge aus
Abschnitt 6 sowie die noch nicht ausreichend reduzierten Standardansichten.

- **UI-04/05, Sollablauf C:** Die Planauswahl lässt sich nach Deckname und
  Hierarchie durchsuchen. Die Auswahl bleibt über Filterwechsel erhalten;
  Unterdeckgruppen zeigen den ausgewählten Umfang. Gruppenaktionen beziehen
  sich ausdrücklich auf alle Unterdecks und nicht nur Suchtreffer. Nicht in
  dieser Ansicht bearbeitbare, bereits vorhandene Zuordnungen bleiben erhalten.
  Die bestehende Regel zum Ausschluss von Referenzen wurde nicht geändert.
- **UI-04/06/19, Sollabläufe A/C:** Übernehmen und Abbrechen kehren zur
  Ausgangsaufgabe zurück, etwa Heute oder zum Abschluss des gerade erstellten
  Decks. Rücksprungziele sind auf diese lokalen App-Routen begrenzt.
- **UI-06/18/19, Sollablauf A:** Nach „Fertig“ oder einem Import erscheint ein
  eigener Deckabschluss mit gespeicherter Kartenzahl, „Jetzt lernen“ und dem
  aktiven Lernplan. Referenzinhalte führen ausdrücklich zum Nachschlagen.
  Bei einem offenen Entwurf heißt die Aktion „Speichern & fertig“. Der Abschluss
  erscheint erst nach bestätigter lokaler Speicherung. Scheitert sie, bleiben
  Entwurf und bisherige Wiederholungsidentität erhalten.
- **UI-15/16/21:** „Frage zusammen mit Antwort zeigen“ steht unter Lernen;
  Rechtsinformationen stehen bei Hilfe. Die Wiederherstellung hat genau eine
  sichtbare Aktion. Ältere iCloud-Zusatzfunktionen sind nachgeordnet erreichbar.
  Große Überschriften in Auswahl und Abschluss wurden verkleinert, lange
  Hilfstexte gekürzt und Hinweise auf Gruppenaktionen nur im passenden Kontext
  angezeigt.
- **UI-22:** Bibliothek und Deckeditor bieten bei Ladefehlern eine erneute
  Abfrage an. Der Deckeditor benennt seinen Ladezustand als Deckladen. Ein
  Fehler beim Lesen der Planzuordnung im Abschluss ändert die bestätigte
  Deckspeicherung nicht in einen scheinbaren Speicherfehler.

Der angeforderte Commit fasst diese Nacharbeiten und die zuvor uncommittete
UI-Vereinfachung zusammen. Bereits vorhandene Hilfe-, Musik-, Zwischenablage-
und andere Änderungen außerhalb dieses Auftrags bleiben uncommittet.
Version gemäß Repository-Hook: **0.5.1**, Apple-Uploadzähler **4**.

Aktuelle Prüfergebnisse und offene Grenzen:
[Nachprüfung](docs/quality/reviews/2026-10-27/ui-followup/README.md).
Native Bedienprüfung bleibt entsprechend der früheren Rückmeldung auf später
verschoben. Reale Erstnutzertests und Geräteabnahme sind weiterhin keine
abgeschlossenen Aufgaben dieser Codeänderung.

## 12. Weitere Vereinfachung und vorbereiteter iOS-Stand

Stand: 29. Oktober 2026. Die 22 Befunde sind implementiert; die noch offenen
Geräte- und Erstnutzerabnahmen werden dadurch nicht als bestanden gewertet.
Die erneute Prüfung des vollständigen Arbeitsbaums ergänzt folgende Punkte:

- **UI-02/06/10:** Ein Deck ohne gespeicherte Karten bietet im Editor noch
  keinen Lernstart an. Bei vorhandenen Referenzinhalten heißt der Einstieg
  „Nachschlagen“ und verwendet ausdrücklich den Referenzmodus.
- **UI-03/21:** Bei einem leeren Lernplan bleibt genau ein Einstieg zur
  Deckauswahl. Die zweite, identische Aktion „Lernplan bearbeiten“ entfällt
  in diesem Zustand. Bestehende Pläne behalten ihre Bearbeitung.
- **UI-01/21:** Mobile Editorabschnitte umbrechen auch lange deutsche Wörter
  bei größter App-Schrift. Die Editorhöhe berücksichtigt die tatsächliche,
  mit der Schrift mitwachsende Webnavigation; „Fertig“ bleibt auch bei
  390 × 520 CSS-Pixeln vollständig darüber erreichbar. Die native
  Reservierung der Tableiste wird nicht verändert.
- Die bereits offenen Änderungen am Notensatz, vollständigen Kopiervorlagen,
  automatischen Aktualisieren installierter Hilfe und nativen Kopieren werden
  im Rahmen des ausdrücklich angeforderten `!!!*` mitgeprüft und mitcommittet.
  Dokumentation dieser Arbeiten: Prüfberichte vom 25. und 26. Oktober.

Ein vollständiger Browserdurchlauf bestätigt Erstellen, Speichern, Abschluss,
explizite Planauswahl mit Abbrechen/Übernehmen, reguläres Lernen, Bewertung und
erhaltenen Tagesabschluss nach Neuladen. Eine anschließende leere Auswahl
zeigt wieder die Auswahlhilfe und keine Fertigmeldung. Die Bibliothek dafür
ist eine getrennte lokale Prüfbibliothek.

**Apple-Vorbereitung:** Produktversion **0.5.2**, Apple-Build **5**. Der
lokale Bundle ist neu gebaut und ins Xcode-Projekt kopiert. Der iOS-Gerätebuild
wird ohne Signierung geprüft; die Installation und Verteilung über Xcode
übernimmt der Produktverantwortliche selbst. Keine automatische Installation,
kein Upload und kein VPS-Deploy. Der frühere installierte Mac-Stand wird nicht
mit einem bloß vorbereiteten Build gleichgesetzt.

Aktuelle Prüfergebnisse, Bundlevergleich und verbleibende Abnahmen:
[Abschlussprüfung](docs/quality/reviews/2026-10-29/ui-final/README.md).
Scheduler und Synchronisationslogik bleiben unverändert. Die verbleibenden
Schritte des Plans sind praktische Geräteabnahme und moderierte Erstnutzertests,
keine pauschale Neugestaltung bereits funktionierender Abläufe.

## 13. Entdecken mit Kategorien und Vorschau

Stand: 29.–30. Oktober 2026. Konkretisierung von UI-18 nach dem zusätzlichen
Nutzerfeedback zum unübersichtlichen Entdecken-Bereich.

- Der Einstieg zeigt nur Suche und vier Kategorien: **Sprachen**, **Geografie**,
  **Mathematik & Naturwissenschaften**, **Programmieren**.
- Kategorien führen zu kompakten Angeboten mit Titel, Kurzbeschreibung,
  Sprache/Umfang und einer Aktion **Ansehen**. Suche findet auch Länder,
  Regionen und Themen innerhalb der Entwickler-Referenz. Suchbegriff und
  Sprachfilter bleiben beim Zurückgehen erhalten.
- Erst die Detailseite zeigt echte Beispielkarten, enthaltene Decks und
  **Hinzufügen**. Bereits installierte Angebote bieten **Öffnen**. Überflüssige
  deaktivierte „Aktuell“-Buttons entfallen. Updates bleiben ausdrücklich
  ausführbare Aktionen; die bestehenden Installations-/Updatewege bleiben.
- Geografie beginnt mit Welt und Kontinenten. Länder und Regionen folgen
  innerhalb des jeweiligen Angebots oder über die Suche. Das Einbeziehen
  weiterer Unterdecks erfordert eine sichtbare Umfangsauswahl.
- Nur Sprachen zeigt einen Sprachfilter. **Zahlen üben** ist dort eingeordnet;
  seine Einrichtung öffnet erst nach Auswahl. Gefilterte Sprachen verändern
  nicht stillschweigend den Umfang einer vollständigen Sammlung.
- Technische FNF-/JSXGraph-/Mermaid-/ABC-Beispiele stehen unter
  **Hilfe & Informationen → Autorenreferenz**. Die Entwickler-Referenz bleibt
  bei Programmieren. Alte Autorenlinks werden zur Hilfe weitergeleitet.
- Vorschauen verwenden ausschließlich den signaturgeprüften Katalog und die
  vorhandenen sicheren Renderer, schreiben keinen Lernfortschritt und zeigen
  passende Sprachpaare bzw. Referenzinhalte. Nach erfolgreicher Installation
  werden Öffnen und der bestehende Einstieg zur Planauswahl angeboten.
- Erfolgsmeldungen gehören zur abgeschlossenen Detailaufgabe und werden beim
  Wechsel zur Übersicht entfernt. Ladefehler zeigen Wiederholen und werden
  nicht als leerer Katalog ausgegeben. Die veraltete Audio-Neukodierungszusage
  in der Hilfe ist entfernt.

Nachweis: [Prüfbericht mit Screenshots und Build-Audit](docs/quality/reviews/2026-10-29/discover-categories/README.md).
1.076 Web-Tests sind abgedeckt, die 41 gezielten Abschlusstests bestehen; ein
Worker-Starttimeout im Gesamtlauf wurde mit den drei betroffenen Tests separat
geprüft. Web-Produktion und unsignierter iOS-Gerätebuild bestehen. Alle 160
Bundle-Dateien stimmen zwischen portablem Build, Xcode-Projekt und gebauter
App überein; der kompilierte Iconkatalog besteht die Prüfung. Scheduler,
Synchronisation und signierter Katalog bleiben unverändert.

Die native Bedienabnahme bleibt wie zuvor ausdrücklich auf später verschoben.
Gerätebuild und Browserprüfung ersetzen weder diese Abnahme noch die im
Prüfbericht aufgeführten öffentlichen Release-Gates. Kein Commit und kein Upload.

## 14. Tastaturrest in der kompatiblen Mac-App

Stand: 30. Oktober 2026. Der erneut gemeldete leere Tastaturstreifen wird in
der nativen Apple-Hülle korrigiert. Die Mac-App unterbindet die iPad-Accessory
und beendet erneut geöffnete Eingabesitzungen, wenn kein echtes Textfeld aktiv
ist. DOM-Fokus und native Tastaturereignisse werden dafür gemeinsam geprüft;
echte Eingaben und native Dialoge bleiben geschützt. Textauswahl und Cmd+C
bleiben auch bei Referenzkarten verfügbar. Der iPhone-/iPad-Eingabepfad bleibt.

Der finale Build wurde tatsächlich als **My Mac (Designed for iPad)** gestartet:
Tippen, Kopieren/Einfügen, Rücknavigation und die interaktive Grafik auf der
gemeldeten Referenz 38/43 funktionieren. Die native Tastaturfläche überschneidet
die App nach Suchfeld-Blur sowie nach Grafik- und Textauswahl mit **0 pt**;
im reproduzierten Fehlerzustand betrug die Überschneidung 55 pt.

45 Apple-Tests, Typecheck und der unsignierte iOS-Gerätebuild bestehen.
Alle 160 Bundle-Dateien und der kompilierte Iconkatalog sind geprüft.
Version bleibt 0.5.2 / Apple-Build 5. Kein Commit, Upload oder Deployment.
Die Mac-Abnahme dieses Fehlers ersetzt keine allgemeine iPhone-/iPad- oder
VoiceOver-Abnahme. Details: [Prüfbericht](docs/quality/reviews/2026-10-30/mac-input-accessory/README.md).

## 15. Zahlen üben mit minimalem Grundstock

Stand: 31. Oktober 2026. Die Vorschau entfällt. Entdecken → Sprachen → Zahlen
führt direkt zur Einrichtung mit übernommener Zielsprache, drei kombinierbaren
Bereichen 0–10, 11–100 und 101–1000 sowie **Lernen starten**. Für 11–100 lässt
sich die kompakte Auswahl durch alle 90 Zahlen ersetzen. Ein ohnehin bereits
vollständiger Sprachbestand bietet diesen wirkungslosen Zusatzschalter nicht.

Französisch verwendet exakt die besprochenen **35 Zahlen** für 0–100. Alle 35
angebotenen Zielsprachen besitzen explizite Profile. Eine Karte zeigt vorn die
Ziffer, nach dem Aufdecken Ziffer und Zahlwort. Die Übung wird lokal gespeichert,
unter Meine Decks abgelegt und im normalen Lernablauf mit dessen bestehenden
Tageslimits geöffnet. Letzte Auswahl und gespeicherte Bereiche bleiben erhalten.

Jede Zahl hat eine feste Kartenidentität. Bereichswechsel pausieren ausgeschlossene
Zahlen und erhalten ihre Bewertungen; erneutes Einbeziehen verwendet dieselben
Karten. Die frühere Collection mit wechselnden Zahlen und ihre Historie bleiben
getrennt verfügbar. Scheduler und Synchronisationsverhalten bleiben unverändert.

Web-, Domain-, Persistenz- und Gerätebuild-Prüfungen bestehen. Native Bedienprüfung
des neuen Ablaufs bleibt wegen des gesperrten Macs offen. Produktversion **0.5.3**,
Apple-Build **6**; alle offenen Änderungen dieses Repositories werden mit dem
angeforderten `!!!*` zusammengefasst. Kein Push oder Upload.

Nachweise und Abnahmegrenzen: [Prüfbericht](docs/quality/reviews/2026-10-31/number-practice/README.md),
[ADR 0059](docs/architecture/decisions/0059-fixed-language-number-practice.md).
