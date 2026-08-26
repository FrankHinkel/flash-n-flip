# Anki-Gap-Analyse und Umstellungsplan

Status: Arbeitsgrundlage fuer die schrittweise Umsetzung
Stand: 19. August 2026

Verwandte Dokumente:

- [Anki-Formelimport](./anki-formula-import.md)
- [Advanced Anki Import V2](./advanced-anki-import-v2-phases.md)
- [ADR 0036: Deterministic local Anki import V2](../architecture/decisions/0036-deterministic-local-anki-import-v2.md)

## 1. Zielbild

Flash-n-Flip soll Anki-Pakete moeglichst vollstaendig lesen, ihre Lerninhalte
originalgetreu und sicher darstellen und jede Abweichung vor dem Import sichtbar
machen. Das Ziel ist nicht, Ankis Ausfuehrungsumgebung nachzubauen. Insbesondere
werden fremdes JavaScript, Add-ons, beliebiges CSS und aktive externe Ressourcen
nicht ausgefuehrt.

„Besser, eleganter und sicherer als Anki“ bedeutet messbar:

- **besser:** Notiztypen, Kartenvarianten, Clozes, Formeln, Medien, Reihenfolge
  und optional Lernhistorie werden nachvollziehbar uebernommen;
- **eleganter:** ein kanonischer Importkern erzeugt fuer Web, iOS/iPadOS und
  spaetere Clients dasselbe Ergebnis;
- **sicherer:** importierter Inhalt bleibt inert, lokal und begrenzt; unsichere
  oder nicht darstellbare Elemente werden blockiert und konkret gemeldet;
- **ehrlicher:** es gibt keinen stillen Datenverlust und keine pauschale
  „erfolgreich“-Meldung bei nur teilweise kompatiblen Karten;
- **robuster:** Wiederimport, Abbruch, Neustart und Peer-Synchronisierung
  duplizieren weder Karten noch Lernfortschritt.

Die Kompatibilitaet wird in drei Klassen ausgewiesen:

1. **Nativ unterstuetzt:** semantisch gleichwertige strukturierte Darstellung.
2. **Sicher transformiert:** bekannte, dokumentierte Abweichung ohne Verlust der
   Lerninformation.
3. **Blockiert oder nicht darstellbar:** keine Ausfuehrung; sichtbarer Befund mit
   betroffenen Notiztypen, Vorlagen und Kartenanzahl.

## 2. Nicht-Ziele

- keine Ausfuehrung von Anki-Add-ons oder Vorlagen-JavaScript;
- kein allgemeiner Browser-in-Browser fuer fremdes HTML/CSS;
- keine automatische Uebernahme von Anki-Faelligkeiten in den
  Flash-n-Flip-Scheduler ohne expliziten, validierten Migrationsmodus;
- keine Speicherung privater APKG-Inhalte oder Medien auf dem VPS;
- keine deck-spezifischen Sonderprofile, wenn die Semantik generisch aus
  Notiztyp und Vorlage rekonstruiert werden kann.

## 3. Verifizierter Ist-Zustand

Bereits vorhanden oder grundsaetzlich angelegt:

- moderne und aeltere APKG-Collection-Varianten;
- Deck-Hierarchien, mehrere Karten pro Notiz, Quellen-IDs, Tags und Suspendierung;
- lokale Bilder und Audios mit Dateinamen-, Groessen- und Inhaltserkennung;
- SVG-Allowlist-Sanitisierung;
- bedingte Vorlagen, `FrontSide`, Cloze-Grundsemantik und haeufige japanische
  Filter in einem begrenzten Renderer;
- stabile Import-Lineage-Felder fuer deterministischen Wiederimport;
- strukturierte Inhaltsbloecke statt ausgefuehrter Anki-Vorlagen.

Die folgenden Befunde sind im aktuellen Code sichtbar:

- `apps/web/lib/local-file-import.ts` wandelt verbleibendes HTML ueber
  `plainText()` um. Dadurch gehen sichere Tabellen, Listen, Links, `ruby`,
  Hoch-/Tiefstellung und andere Formatsemantik verloren.
- Derselbe Pfad erkennt MP4-Video, filtert es vor dem Ergebnis aber wieder aus.
- Karten werden mit `ORDER BY c.id` gelesen. Ankis Reihenfolge neuer Karten aus
  `due` wird dadurch nicht bewusst uebernommen.
- Der Import liest nur einen kleinen Teil von Karten-/Notizstatus. Intervalle,
  Ease/Factor, Wiederholungen, Lapses, Lernschritte, Review-Log und FSRS-
  Gedaechtniszustand fehlen.
- `LocalCardPayload.importSource.sourceState` bewahrt derzeit nur `cardType`,
  `queue`, `cardFlag` und `noteFlag`.
- Der Template-Renderer erkennt mehrere Filter, bildet `type:`, `hint:`, TTS,
  `cloze-only`, bedingte Cloze-Felder und Furigana aber noch nicht vollstaendig
  Anki-semantisch ab.
- Tags werden beim Planen auf 30 Eintraege begrenzt. Das kann Quelleninformation
  ohne ausreichend genaue Importmeldung verlieren.
- Formeln mit Anki-/MathJax-Begrenzern wie `\(...\)`, `\[...\]`,
  `[latex]...[/latex]` oder `[mathjax]...[/mathjax]` werden nicht durchgaengig
  als Formelbereiche in die KaTeX-Darstellung ueberfuehrt.
- Image Occlusion besitzt einen Sonderpfad, aber noch kein vollstaendiges Modell
  fuer alle nativen Modi, Maskengruppen, Zusatzfelder und Varianten.
- Parser-, Analyse- und Commit-Verantwortung sind noch nicht in allen Pfaden auf
  einen einzigen Domain-Kern konzentriert.

Diese Liste ist eine Gap-Analyse, kein Nachweis, dass jede seltene Anki-Variante
bereits inventarisiert wurde. Das Referenzkorpus in Phase 0 ist deshalb ein
Release-Gate.

## 4. Kompatibilitaetsmatrix

| Bereich                         | Zielsemantik                                                   | Heute                                           | Prioritaet |
| ------------------------------- | -------------------------------------------------------------- | ----------------------------------------------- | ---------- |
| Basic/Reverse/mehrere Templates | jede in Anki erzeugte Karte einmal                             | weitgehend vorhanden, reale Korpusabnahme offen | P0         |
| Cloze                           | Ordinale, Hinweise, mehrere Luecken, verschachtelte Inhalte    | Grundmodell vorhanden, Randfaelle offen         | P0         |
| Formeln                         | Anki-LaTeX/MathJax sicher nach KaTeX                           | Begrenzersyntax unvollstaendig                  | P0         |
| Sicheres Rich Text              | Abschnitte, Listen, Tabellen, Code, Links, `sub`/`sup`, `ruby` | meist Plaintext-Flattening                      | P0         |
| Template-Bedingungen            | positiv, invers, verschachtelt, Cloze-Feldbedingungen          | teilweise                                       | P0         |
| `FrontSide`/`hr#answer`         | Vorderseite ohne Doppelung korrekt einbetten                   | teilweise                                       | P1         |
| `type:`                         | Eingabevergleich als eigene sichere Lerninteraktion            | Inhalt wird nur vereinfacht                     | P1         |
| `hint:`                         | explizit aufklappbarer Hinweis                                 | keine echte Hint-Interaktion                    | P1         |
| TTS                             | Sprache/Voice interpretieren, sicher auf eigene TTS abbilden   | Anweisung entfernt                              | P1         |
| Furigana/Kana/Kanji             | semantisches `ruby`, zugreifbar und sprechbar                  | textuelle Vereinfachung                         | P1         |
| Bildverdeckung                  | Modi, Masken, Gruppen, Back Extra                              | heuristisch/teilweise                           | P0         |
| Audio                           | mehrere Audios, Reihenfolge, Labels, Autoplay-Entscheidung     | Basis vorhanden                                 | P1         |
| Video                           | lokales Video sicher bewahren und abspielen                    | erkannt, dann ausgelassen                       | P1         |
| Fonts/CSS                       | wesentliche Lesesemantik ohne fremde Laufzeit                  | Metadaten/CSS weitgehend ignoriert              | P2         |
| RTL/Feldmetadaten               | Richtung und Sprachsemantik bewahren                           | unvollstaendig                                  | P1         |
| Deck-Beschreibung/Optionen      | als Metadaten importierbar                                     | unvollstaendig                                  | P2         |
| Flags/marked/leech              | Status transparent abbilden                                    | Rohflags teilweise vorhanden                    | P1         |
| Tags                            | vollstaendig, normalisiert, ohne stilles Abschneiden           | Begrenzung auf 30                               | P0         |
| Neue-Karten-Reihenfolge         | Anki-Position nachvollziehbar bewahren                         | `c.id` statt bewusster `due`-Semantik           | P1         |
| Lernhistorie/Scheduling         | optional und explizit migrieren                                | nicht importiert                                | P1         |
| Wiederimport                    | stabil, idempotent, Fortschritt bleibt erhalten                | Architektur vorhanden, End-to-End-Gates offen   | P0         |
| Add-ons/Skripte                 | niemals ausfuehren; konkret melden                             | sicherheitsorientiert, Reporting ausbauen       | P0         |

## 5. Zielarchitektur

### 5.1 Ein kanonisches Anki-Zwischenmodell

Alle Plattformadapter lesen Archive und SQLite, erzeugen aber dasselbe
plattformneutrale Modell in `packages/domain`:

```text
APKG bytes
  -> bounded archive/database reader
  -> AnkiPackageIR
     -> AnkiNoteTypeIR + AnkiTemplateAST
     -> AnkiNoteIR + AnkiCardIR
     -> AnkiContentIR + AnkiMediaIR
     -> optional AnkiReviewHistoryIR
  -> compatibility report + dry run
  -> atomic local commit adapter (IndexedDB or SQLite)
```

Das IR bewahrt mindestens:

- Collection-, Deck-, Notiztyp-, Notiz-, Karten- und Template-Identitaet;
- Feldnamen, Feldreihenfolge, Originalwerte und relevante Feldmetadaten;
- Kartenordinal, Cloze-Ordinal, Anki-Reihenfolge und Deck-Zuordnung;
- Tags, Flags, Suspendierung und nachvollziehbare Spezialzustaende;
- sichere Medienreferenzen mit Hash, erkannter MIME-Art, Groesse und Quellname;
- Template-AST statt mehrfacher String-Ersetzung;
- erkannte Inhaltssegmente fuer Text, Rich Text, Cloze, Formel, Bild, Audio,
  Video, Bildverdeckung und Hinweis;
- optional getrennte Scheduling-/Review-Daten.

Web und Apple duerfen keine eigenen konkurrierenden Regeln fuer Vorlagen,
Cloze, Formeln oder Importidentitaeten besitzen. Plattformcode beschraenkt sich
auf Archiv-/SQLite-I/O, lokale Speicherung, UI und Medienwiedergabe.

### 5.2 Sichere Quellenbewahrung

Originalfelder duerfen fuer Diagnose, Korrektur und spaeter verbesserte
Transformation lokal bewahrt werden, aber nur:

- als inerte, groessenbegrenzte Quelldaten;
- getrennt von der gerenderten strukturierten Darstellung;
- niemals erneut als JavaScript, CSS, HTML-Vorlage oder Markdown ausgefuehrt;
- mit stabiler Quellenidentitaet und Transformationsversion;
- ohne Remote-Nachladen oder Uebertragung an den VPS.

Notiz und Karte bleiben eigenstaendige Entitaeten. Geschwisterkarten verweisen
auf dieselbe Quellnotiz, besitzen aber eigene Template-/Cloze-Identitaet und
eigenen Lernfortschritt.

### 5.3 Inhalts- und Sicherheitsgrenzen

Erlaubt sind ausschliesslich validierte strukturierte Bloecke. Texte werden
standardmaessig escaped. Ein HTML-zu-Struktur-Konverter verwendet eine
Allowlist, beispielsweise fuer Absaetze, Zeilenumbrueche, Ueberschriften,
Listen, Tabellen, Hervorhebungen, sicheren Code, `sub`, `sup`, `ruby` und
explizit erlaubte lokale Links.

Immer blockiert werden:

- `script`, Event-Handler, `iframe`, `object`, `embed`, Formulare und Preloads;
- `javascript:`, `file:`, gefaehrliche `data:`-URLs, Trackingpixel und externe
  Bilder, Audios, Videos oder Fonts;
- beliebiges Vorlagen-JavaScript, Add-on-Code und nicht erlaubte CSS-Regeln;
- unsicheres SVG; zulaessiges SVG muss die gemeinsame Sanitisierung bestehen;
- LaTeX-Befehle ausserhalb der definierten KaTeX-Kompatibilitaet;
- Pfadtraversal, irrefuehrende Endungen/MIME-Typen und unbeschraenkte Archive.

KaTeX laeuft mit `trust: false`, ohne HTML-Erweiterungen und mit Zeit-, Tiefen-
und Laengenlimits. Archivanzahl, dekomprimierte Gesamtgroesse, einzelne Medien,
SQLite-Groesse, Feldlaenge, Template-Tiefe und erzeugte Kartenzahl erhalten
harte Grenzen. Ueberschreitungen brechen kontrolliert ab oder isolieren das
betroffene Element; sie fuehren nie zu teilaktivierten Decks.

## 6. Umstellungsplan

### Phase 0: Korpus und Wahrheitstabelle

1. Ein rechtlich nutzbares, strukturell diverses APKG-Testkorpus definieren.
2. Pro Paket erwartete Decks, Notiztypen, Templates, Notizen, Karten, Clozes,
   Medien und Warnungen versioniert festhalten.
3. Seltene Strukturen gezielt generieren: Conditions, `type:`, `hint:`, TTS,
   Ruby, RTL, Tabellen, MathJax/LaTeX, `mhchem`, Bildverdeckung, mehrere Audios,
   Video, Flags, Leech, Scheduler- und Review-Daten.
4. Reale Beispielpakete bleiben ausserhalb von Git; reproduzierbare kleine
   Fixtures duerfen ins Testkorpus.
5. Fuer jedes Paket eine Anki-Referenzdarstellung und erwartete
   Kompatibilitaetsklasse dokumentieren.

**Gate:** Keine Prozentangabe zur Kompatibilitaet ohne dieses Korpus.

### Phase 1: Parser auf einen Domain-Kern zusammenfuehren

1. `AnkiPackageIR` und seine Teilmodelle in `packages/domain` definieren.
2. Legacy- und moderne Schemaadapter auf dasselbe IR abbilden.
3. Web-/API-Duplikate durch gemeinsame reine Analyse-, Render- und
   Planungsfunktionen ersetzen.
4. Parser-Version und Transformationen im Dry Run ausweisen.
5. Bestehende Karten-IDs und Reimport-Semantik unveraendert halten.

**Gate:** identische Fixture-Hashes und Importplaene in Browser- und
Apple-Adaptern.

### Phase 2: Sicheres Rich Text statt Plaintext-Verlust

1. HTML in ein eigenes begrenztes AST parsen, nicht per Regex „bereinigen“.
2. Nur erlaubte Elemente/Attribute in gemeinsame Content-Bloecke uebersetzen.
3. Links als sichtbare, validierte Ziele behandeln; externe Medien nie laden.
4. Tabellen, Listen, Code, `sub`, `sup`, `ruby`, Zeilenumbrueche und sichere
   Inline-Formatierung erhalten.
5. Unbekannte Elemente mit genauer Anzahl und Fundstelle melden.

**Gate:** Boesartige HTML-/URL-/SVG-Fixtures bleiben inert; sichere Formatierung
bleibt im real gerenderten Lernpfad erhalten.

### Phase 3: Template-Semantik vervollstaendigen

1. Vorlagen einmal in `AnkiTemplateAST` kompilieren.
2. Positive/inverse und verschachtelte Conditions sowie Cloze-Feldbedingungen
   Anki-kompatibel auswerten.
3. `FrontSide` und `hr#answer` ohne doppelte Inhalte modellieren.
4. `type:` als sichere optionale Eingabe mit normalisiertem Vergleich abbilden.
5. `hint:` als zugreifbaren, explizit aufklappbaren Block umsetzen.
6. TTS-Parameter validieren und auf Flash-n-Flip-TTS abbilden; ungueltige Voices
   sichtbar auf die sichere Standardsprache zurueckfallen lassen.
7. Furigana/Kana/Kanji als semantisches Ruby statt als Flattening ausgeben.
8. Unbekannte Filter niemals ausfuehren und pro Template gruppiert melden.

### Phase 4: Cloze, Formeln, Bildverdeckung und Medien

1. Cloze-Pipeline mit mehreren Ordinalen, Hinweisen, Wiederholungen,
   ueberlappenden/fehlerhaften Markern und Cloze in strukturierten Inhalten
   vervollstaendigen.
2. Formelbereiche vor HTML-/Text-Konvertierung erkennen und gemaess
   [Anki-Formelimport](./anki-formula-import.md) in sichere KaTeX-Bloecke
   ueberfuehren.
3. KaTeX-Inkompatibilitaeten, `mhchem` und Legacy-LaTeX einzeln klassifizieren;
   Quelle lesbar erhalten, nie still als Rohsteuerzeichen anzeigen.
4. Image Occlusion als erstes Klassenmodell fuer Bild, Masken, Gruppen, Modi,
   Back Extra und Kommentare umsetzen.
5. Mehrere Audios in Quellreihenfolge erhalten; Autoplay wird als lokale,
   barrierearme Nutzereinstellung behandelt.
6. Lokales Video nach denselben MIME-, Groessen-, Privacy- und
   Wiedergaberegeln wie Audio integrieren.

### Phase 5: Metadaten, Reihenfolge und Wiederimport

1. Notiz-/Karten-/Template-Beziehungen und alle benoetigten Quellen-IDs
   first-class persistieren.
2. Ankis Position neuer Karten aus `due` getrennt von Zeitfaelligkeiten lesen;
   nicht implizit aus `c.id` ableiten.
3. Tags ohne stilles Abschneiden importieren oder vor Commit eine explizite,
   reversible Normalisierungsentscheidung verlangen.
4. Flags, marked/leech, Suspendierung, RTL, Feldreihenfolge und relevante
   Notiztypmetadaten transparent abbilden.
5. Exakter Wiederimport ist No-op; Update behaelt Karten-IDs und Lernfortschritt;
   „als Kopie“ erzeugt eine neue Lineage.
6. Entfernte Quellkarten werden nicht still geloescht. Dry Run zeigt die
   Auswirkungen; synchronisierte Loeschungen verwenden Tombstones.

### Phase 6: Optionaler Scheduling- und Historienimport

Der Standard bleibt **Inhalte importieren**. Zusaetzlich kann der Nutzer
**Inhalte und Lernhistorie migrieren** waehlen.

1. `revlog`, Kartenstatus, Intervalle, Wiederholungen, Lapses, Lernschritte und
   verfuegbare FSRS-Metadaten in ein getrenntes, versioniertes Quellmodell lesen.
2. Niemals Anki-`due` oder Intervalle blind in Flash-n-Flip kopieren.
3. Review-Ereignisse validieren, chronologisch normalisieren und mit stabilen
   IDs append-only in die lokale Historie ueberfuehren.
4. Den aktuellen Schedulerzustand deterministisch aus den akzeptierten
   Ereignissen und der gewaehlten Flash-n-Flip-Strategie neu berechnen.
5. Zeitzone, Collection-Erstelltag, Tagesgrenze und Zeitabweichungen explizit
   behandeln.
6. Vor Commit Auswirkungen zeigen: neue, faellige, ausgesetzte und geaenderte
   Karten sowie nicht migrierbare Ereignisse.

**Release-Blocker:** Verlust, Doppelung oder nicht reproduzierbare Umdeutung von
Review-Ereignissen.

### Phase 7: Kompatibilitaetsbericht und Korrektur-UX

Vor dem Import zeigt Flash-n-Flip:

- Deck -> Notiztyp -> Template -> erwartete Kartenanzahl;
- Beispiele aller Kartenvarianten auf Vorder- und Rueckseite;
- nativ unterstuetzte, sicher transformierte und blockierte Merkmale;
- ausgelassene Felder/Medien und den genauen Grund;
- Auswirkungen auf einen bestehenden Import und dessen Lernfortschritt;
- Auswahl „Inhalte“, „Inhalte und Historie“, „bestehenden Import aktualisieren“
  oder „als Kopie“.

Profile sind nur eine gefuehrte Korrektur: Vorschau, Validierung, Duplizieren,
Zuruecksetzen sowie sicherer JSON-Import/-Export. Sie enthalten keine Skripte,
CSS oder allgemeine Ausdruckssprache.

### Phase 8: Migration bereits importierter Decks

1. Bestehende `importSource`-Daten inventarisieren und nach Parser-/Transform-
   Version gruppieren.
2. Neue Darstellung zunaechst als Dry Run neben der alten erzeugen.
3. Inhalt atomar aktualisieren, Karten-ID, Note-ID, Review-Historie und
   Schedulerzustand bewahren.
4. Alte Quelldaten erst entfernen, wenn Darstellung, Neustart und Peer-Sync
   bestaetigt sind.
5. Migration ist wiederaufnehmbar, idempotent und besitzt eine
   versionsgebundene Rueckfallstrategie.

### Phase 9: Verifikation und Freigabe

Erforderlich sind:

- Unit- und Property-Tests fuer Parser, AST, Bounds, Identitaeten und
  Transformationen;
- Fuzzing von Archiv, SQLite-Feldern, HTML, Template-Syntax, Cloze und LaTeX;
- Schadfixtures fuer Script/Handler, URL-Schemes, SVG, MIME-Taeschung,
  Path-Traversal, Zip-Bomben und extreme Verschachtelung;
- Golden Tests gegen die erwartete Anki-Referenzdarstellung;
- echte Import-, Lern-, App-Neustart- und Wiederimport-Flows;
- Abbruch/Prozessende in jeder Stufe ohne sichtbares Teilergebnis;
- Offline-Import, doppelte Peer-Zustellung und Konflikte auf zwei Geraeten;
- Web, iPhone und iPad mit Dark Mode, Zoom, 390-px-Breite und VoiceOver;
- grosse Pakete auf echtem Geraet mit Speicher-, Laufzeit-, Temperatur- und
  Batterie-Messung.

Unit-Tests oder ein erfolgreich geparstes Beispieldeck allein reichen nicht
fuer eine Freigabe.

## 7. Priorisierte Umsetzung

### P0: vor einer belastbaren Anki-Kompatibilitaetsaussage

- Referenzkorpus und automatischer Kompatibilitaetsbericht;
- kanonisches Domain-IR und einheitlicher Parserpfad;
- sicheres Rich Text ohne stilles Flattening;
- Cloze- und Formelkompatibilitaet;
- vollstaendige Template-/Kartenmultiplikation;
- Image-Occlusion-Grundparitaet;
- Tags ohne stillen Verlust;
- idempotenter atomarer Wiederimport mit erhaltenem Lernfortschritt;
- Angriffs-, Abbruch-, Neustart- und reale Render-Tests.

### P1: hohe Lern- und Migrationsqualitaet

- `type:`, `hint:`, TTS, Ruby, RTL und lokale Videos;
- Flags/marked/leech und Anki-Neukartenreihenfolge;
- optionaler validierter Review-Historienimport;
- Migration bereits importierter Decks;
- Profil-Korrektur-UX und portable Profile.

### P2: kontrollierte Langschwanz-Kompatibilitaet

- nicht sicher uebernehmbare CSS-/Font-Wirkungen in Design-Tokens uebersetzen;
- Deckbeschreibungen und relevante Optionsmetadaten;
- weitere Add-on-Strukturen nur nach Korpusbeleg als enge strukturelle Adapter;
- dokumentierte Fallbacks fuer seltene KaTeX-/LaTeX-Erweiterungen.

## 8. Persistenz- und Sync-Invarianten

- Eine Mutation liegt dauerhaft im lokalen Outbox, bevor die UI Erfolg meldet.
- Import-, Notiz-, Karten-, Review- und Medienobjekte besitzen stabile
  clientgenerierte IDs.
- Review-Ereignisse bleiben append-only; Wiederholung ist idempotent.
- Importaktivierung und Watermark-Fortschritt erfolgen atomar.
- Konflikte werden pro Entitaet geloest, niemals mit blanket last-write-wins.
- Loeschungen verwenden Tombstones; Medienuebertragung bleibt resumierbar und
  getrennt von Metadaten.
- Ein nicht erreichbarer VPS, ein Peer-Abbruch oder App-Neustart darf keine
  lokalen Inhalte oder Lernfortschritte verlieren.

## 9. Definition of Done

Die Umstellung gilt erst als abgeschlossen, wenn:

1. jedes verwendete Template im Dry Run einer nativen, transformierten oder
   blockierten Klasse zugeordnet ist;
2. keine relevanten Felder, Tags oder Medien ohne sichtbaren Befund verschwinden;
3. der definierte Korpus reproduzierbar die vereinbarte Kompatibilitaetsquote
   erreicht;
4. Formeln, Clozes, Bildverdeckung, Rich Text und Medien im echten Lernpfad auf
   Web und Apple visuell sowie zugaenglich abgenommen sind;
5. exakter Wiederimport keine Duplikate erzeugt und Updates den Lernfortschritt
   erhalten;
6. Abbruch, Prozessneustart, Offlinebetrieb und doppelte Peer-Zustellung
   nachweislich sicher sind;
7. importierter aktiver Code in allen Schadfixtures inert bleibt;
8. grosse reale Pakete auf iPhone und iPad innerhalb der festgelegten Speicher-,
   Laufzeit- und Batteriegrenzen bleiben;
9. alte parallele Importpfade erst nach belegter Paritaet entfernt werden.

## 10. Umsetzungsreihenfolge und Rueckfall

Die Phasen werden hinter versionierten Transformationsflags geliefert. Zuerst
laufen alter und neuer Planer im schreibfreien Vergleich. Danach wird der neue
Pfad fuer einzelne Korpusklassen aktiviert. Der alte lokale Importpfad bleibt
bis zur Web- und Apple-Abnahme als kontrollierter Rueckfall verfuegbar, darf
aber keine bereits mit einer neueren Transformationsversion gespeicherten Daten
zurueckkonvertieren.

Jede Phase muss ihren Importplan, ihre Transformationsversion und ihre Warnungen
persistierbar erklaeren. Bei einem Rueckfall bleiben Originalquelle,
Import-Lineage, Medien und Lernfortschritt unangetastet.

## 11. Primaere Arbeitsbereiche

- `packages/domain/src/anki-import-types.ts`
- `packages/domain/src/anki-template-renderer.ts`
- `packages/domain/src/anki-import-plan.ts`
- `packages/domain/src/anki-cloze.ts`
- `packages/domain/src/content.ts`
- `packages/domain/src/markdown.ts`
- `packages/domain/src/local-app-data.ts`
- `packages/domain/src/svg-sanitizer.ts`
- `apps/web/lib/local-file-import.ts`
- lokale IndexedDB-/SQLite-Commit- und Synchronisationsadapter

Konsequenzielle Abweichungen von ADR 0036 werden vor der Implementierung als
neue oder supersedierende Architecture Decision festgehalten.

## 12. Referenzen zur Anki-Semantik

- [Anki Manual: Field Replacements](https://docs.ankiweb.net/templates/fields.html)
- [Anki Manual: Card Styling](https://docs.ankiweb.net/templates/styling.html)
- [Anki Manual: Editing and Image Occlusion](https://docs.ankiweb.net/editing.html#image-occlusion)
- [Anki Manual: Packaged Deck Import](https://docs.ankiweb.net/importing/packaged-decks.html)
- [Anki Manual: Exporting](https://docs.ankiweb.net/exporting.html)
- [Anki Manual: Math and LaTeX](https://docs.ankiweb.net/math.html)
- [Anki card model](https://github.com/ankitects/anki/blob/main/rslib/src/card/mod.rs)
- [Anki schema 11](https://github.com/ankitects/anki/blob/main/rslib/src/storage/schema11.sql)
