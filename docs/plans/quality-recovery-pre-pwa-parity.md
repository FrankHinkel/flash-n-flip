# Qualitätswiederherstellung: Parität zum Stand vor der iPhone-PWA-Umstellung

> Status: **Freigegeben – R0 abgeschlossen, R1 begonnen**
>
> Stand: **11. August 2026**
>
> Funktionale Referenz: `62db38e`
>
> Technischer Wiederherstellungsstart: `35709be`
>
> Arbeitsbranch: `codex/accountless-rendezvous`

## 1. Ziel und verbindliche Grenze

Flash-n-Flip erhält die sichtbare und fachliche Qualität des letzten Standes
vor der kontolosen Local-first-Umstellung zurück. Geändert werden dürfen die
Speicher-, Transport- und Plattformadapter. Decklogik, Kartendarstellung,
Editor, Lernen, Imports, Sprachlogik, kuratierte Inhalte und Bedienabläufe
werden nicht neu erfunden.

Der Referenzstand `62db38e` ist die ausführbare Spezifikation für das bisherige
Produktverhalten. Abweichungen sind nur zulässig, wenn sie technisch notwendig,
dokumentiert und ausdrücklich vom Benutzer freigegeben wurden.

Die Wiederherstellung bringt keine VPS-Benutzerverwaltung und keine private
VPS-Speicherung zurück. Funktionierende Fachlogik aus dem alten API-Pfad wird
in plattformneutrale Pakete extrahiert und hinter der bestehenden React-
Oberfläche mit SQLite beziehungsweise IndexedDB verwendet.

### Nicht Teil dieser Wiederherstellung

- iCloud-, CloudKit- und Family-Funktionen bleiben deaktiviert.
- Native Android- und Windows-Anwendungen bleiben zurückgestellt.
- Community-Publishing, Moderation und Kontofunktionen werden nicht reaktiviert.
- Die alte Anwendung unter `/Users/frank/Documents/FlashCards` bleibt
  unverändert und read-only.
- Es entsteht keine parallele Produktoberfläche unter `/connect`.
- Das bestehende Kartendesign wird nicht ersetzt oder neu gestaltet.

## 2. Arbeitsregeln

- [x] Neue Produktfunktionen bis zur Qualitätsabnahme einfrieren.
- [x] Weitere VPS-Minimierung bis zur Qualitätsabnahme einfrieren.
- [x] Referenzstand und Wiederherstellungsstart unveränderlich benennen.
- [x] Bestehende Local-first-Infrastruktur nicht pauschal zurückrollen.
- [x] Jeden Benutzerfluss vertikal von UI bis Persistenz und Peer-Sync prüfen.
- [x] Vorhandene Fachlogik extrahieren und wiederverwenden statt duplizieren.
- [x] Entfernte fachliche Tests lokal wiederherstellen, nicht ersatzlos löschen.
- [ ] Jede sichtbare Abweichung zur Referenz einzeln dokumentieren und
      freigeben.
- [ ] Einen Punkt erst nach automatisierter Prüfung und realem Benutzerpfad als
      erledigt markieren.
- [ ] Nach jedem Wiederherstellungspaket einen kurzen Benutzertest mit
      erwartetem Ergebnis bereitstellen.

## 3. Reviewstatus zum Wiederherstellungsstart

| Reviewbereich        | Status              | Befund                                                                                                                                                                          |
| -------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architektur          | **offen**           | Die Produktoberfläche ist weiterhin React/Next.js, aber Import- und Fachlogik wurden beim Cutover teilweise in vereinfachten lokalen Pfaden dupliziert.                         |
| Content und Import   | **Release-Blocker** | Der lokale APKG-Pfad verwendet die vorhandene Xefjord-Erkennung, Feldprofile und Sprachmarkerbereinigung nicht.                                                                 |
| Offline-Sync         | **Release-Blocker** | Contract-Tests bestehen, der reale Browser-iPhone-Abgleich funktioniert laut aktuellem Benutzertest nicht zuverlässig.                                                          |
| Release-Bereitschaft | **Release-Blocker** | Kritische Import- und Sync-Flows besitzen keine bestätigte Produktparität; zusätzlich meldet der allgemeine Release-Check noch offene Betreiber-/Hosting-/Aufbewahrungsangaben. |

Strukturelle Grenzprüfungen zum Start:

- [x] Content-Security-Grenzprüfung besteht.
- [x] Offline-Sync-Integritätsgrenzprüfung besteht.
- [x] Release-Readiness-Prüfung ausgeführt; sie stoppt erwartungsgemäß zusätzlich
      an offenen Betreiber-, Hosting-, Aufbewahrungs- oder Kontaktangaben.
- [x] Diese strukturellen Prüfungen werden ausdrücklich nicht als Ersatz für
      Golden Master und reale Mehrgeräteabnahme gewertet.

## 4. R0 – Entwicklungsstopp und Referenz

### 4.1 Referenzpunkte

- [x] `62db38e` als letzten Stand unmittelbar vor der accountlosen Migration
      festlegen.
- [x] `35709be` als technischen Startpunkt der Qualitätswiederherstellung
      festlegen.
- [x] `docs/architecture/decisions/0031-single-product-ui-during-local-first-migration.md`
      als verbindliche UI-Grenze bestätigen.
- [x] Private Bestandsdaten als ersetzbar behandeln, Produktverhalten dagegen
      ausdrücklich nicht.
- [ ] Referenzstand isoliert starten und die wichtigsten Abläufe gemeinsam mit
      dem Benutzer bestätigen.

### 4.2 Schutz des Arbeitsbestands

- [x] Unabhängige Xefjord-APKG-Dateien unter `examples/Xefjord's/` bleiben
      außerhalb von Git und Deployment-Artefakten.
- [x] Bereits vorhandene fremde Änderungen in `pnpm-lock.yaml` bleiben
      außerhalb der Wiederherstellungs-Commits.
- [ ] Vor dem ersten Fachlogik-Commit einen sauberen Diff gegen `62db38e` und
      gegen den Wiederherstellungsstart dokumentieren.
- [ ] Kein Deployment während R0 bis R7, sofern es nicht separat mit `!!!!!`
      freigegeben wird.

### R0-Abnahme

R0 ist mit dieser Checkliste dokumentarisch abgeschlossen. Der Referenzlauf
und die Benutzerbestätigung werden als erster Teil von R1 ausgeführt.

## 5. R1 – Golden Master und vollständige Paritätsmatrix

### 5.1 Bereits bestätigte Befunde

- [x] Der lokale APKG-Parser rendert Anki-Vorlagen generisch.
- [x] Der lokale Import übernimmt derzeit eine einzige manuell ausgewählte
      Quell-/Zielsprache für das Paket.
- [x] Der lokale Import verwendet die vorhandene Xefjord-Preset-Erkennung und
      die Sprachrichtung pro Karte nicht.
- [x] Reine Xefjord-Sprachmarker wie `German` können deshalb als sichtbarer
      Karteninhalt erhalten bleiben.
- [x] Beim harten Cutover wurden relevante Import-, Editor-, Collection- und
      Sync-Flowtests entfernt.
- [x] Die bestehenden Contract-Tests beweisen Adaptereigenschaften, aber keine
      vollständige Produktparität.

### 5.2 Golden-Master-Fixtures

Für jedes Fixture werden Hierarchie, Kartenanzahl, Reihenfolge, Inhalte,
Sprachen, Medien, Tags und Warnungen aus dem Referenzstand erfasst.

- [ ] Xefjord German
- [ ] Xefjord Arabic
- [ ] Xefjord Mandarin/Chinese
- [ ] Xefjord Japanese
- [ ] Xefjord Korean
- [ ] normales klassisches APKG mit Unterdecks
- [ ] aktuelles APKG mit moderner Anki-Datenbank
- [ ] Cloze-Notiztyp
- [ ] Image Occlusion beziehungsweise bewahrtes Layout
- [ ] FNF-Paket mit Bild und Audio
- [ ] CSV und TSV mit Anführungszeichen, Zeilenumbrüchen und Unicode
- [ ] kuratierte Maps-Collection
- [ ] kuratierte Numbers-Collection
- [ ] normales Deck mit Markdown, Wiki-Tabelle, KaTeX und Medien

Reale urheberrechtlich geschützte Pakete bleiben lokal. In Git gelangen nur
kleine künstliche Fixtures, Hashes und erwartete strukturelle Ergebnisse.

### 5.3 Paritätsmatrix

Statuswerte: `erfüllt`, `offen`, `Release-Blocker`, `bewusst später`.

| Benutzerfluss               | Referenzverhalten                              | Aktueller R1-Status | Erforderlicher Nachweis                               |
| --------------------------- | ---------------------------------------------- | ------------------- | ----------------------------------------------------- |
| App-Start                   | bekannte Produktoberfläche ohne parallele UI   | offen               | iPhone, Browser und Mac zeigen denselben Produktstack |
| Dashboard                   | Bestände, Fälligkeiten und Navigation korrekt  | offen               | Referenzvergleich nach Reload und Neustart            |
| Deckhierarchie              | Collections und Unterdecks stabil              | offen               | Anlegen, Verschieben, Reload, Sync                    |
| Deckeditor                  | atomisches Erstellen, Ändern und Löschen       | offen               | Save/Reopen, Konflikt und Kartenreihenfolge           |
| Kartendarstellung           | bisheriges Design und alle Inhaltstypen        | offen               | visueller und struktureller Golden Master             |
| Normales Lernen             | FSRS und Bewertungen deterministisch           | offen               | Reviewlog, Schedulerzustand, Neustart                 |
| Map-Lernen                  | bisherige Karte, Gesten und Sprache            | offen               | physisches iPhone und kleiner Browserviewport         |
| TTS                         | Sprachseite, Klammerauslassung und Zeilenpause | offen               | feste Sprach-/Text-Fixtures und realer Audiotest      |
| Einstellungen               | lokal dauerhaft und synchronisierbar           | offen               | zwei Geräte, gleichzeitige Änderung                   |
| CSV/TSV                     | bisherige Formate ohne Inhaltsverlust          | offen               | Golden Master und Fehlerfälle                         |
| allgemeines APKG            | Vorschau, Unterdecks, Felder und Medien        | **Release-Blocker** | vollständiger Referenzvergleich                       |
| Xefjord APKG                | Profil, Markerbereinigung und Sprachrichtung   | **Release-Blocker** | German plus Spezialsprachen                           |
| FNF-Import/Export           | portable vollständige Deckpakete               | offen               | Export, Löschen, Restore, Hashvergleich               |
| Originalmedien              | unverändert, sofort verwendbar                 | offen               | Hashvergleich und Wiedergabe auf beiden Geräten       |
| Audiooptimierung            | asynchron, fortsetzbar, Original bleibt        | offen               | Abbruch, Neustart, Einsparanzeige                     |
| kuratierte Inhalte          | Installieren, Aktualisieren und Löschen        | offen               | Maps, Numbers und mindestens eine Sprachsammlung      |
| Peer-Sync Metadaten         | bidirektional und idempotent                   | **Release-Blocker** | reale Zwei-Geräte-Matrix                              |
| Peer-Sync Medien            | resumierbar und abspielbar                     | **Release-Blocker** | großes APKG mit Audio/Bildern                         |
| Peer-Sync Reviews           | append-only ohne Duplikate                     | **Release-Blocker** | Review auf beiden Geräten plus Neustart               |
| Peer-Löschung               | Tombstones ohne Wiederauftauchen               | **Release-Blocker** | Löschen, Reconnect, doppelte Zustellung               |
| Webstack-Handoff            | automatisch, signiert und rollbackfähig        | offen               | Safari und Chrome nach Cache-Löschung                 |
| Mac Designed for iPad       | native WebRTC-Brücke                           | offen               | realer Mac-App-Lauf und Pairing                       |
| lokaler Export/Restore      | vollständige Wiederherstellung                 | offen               | frische Datenbank, Entitäten und Medienhashes         |
| iCloud/Family               | automatische Apple-Wiederherstellung           | bewusst später      | kostenpflichtiger Apple Developer Account             |
| native Android-/Windows-App | gemeinsame Fachformate                         | bewusst später      | spätere Plattformphase                                |

### 5.4 Wiederherzustellende Testaussagen

Die folgenden beim Cutover entfernten Tests werden nicht als Serverflows
zurückgebracht. Ihre Fachregeln werden in lokale Contract- oder Produktflowtests
überführt:

- [ ] `card-order-flow`: stabile Kartenreihenfolge und atomischer Editor-Commit
- [ ] `deck-editor-commit-flow`: Erstellen, Ändern, Löschen und Konflikte
- [ ] `deck-language-flow`: Sprache und Richtung pro Deck/Karte
- [ ] `markdown-roundtrip-flow`: strukturierter Inhalt ohne Formatverlust
- [ ] `katex-reference-template-flow`: Formeln und Referenzen
- [ ] `fnf-collection-flow`: Paketstruktur, Medien und Hierarchie
- [ ] `number-collection-flow`: Installation, Generation und Löschung
- [ ] `core-language-template-flow`: kuratierte Sprachsammlungen
- [ ] `developer-reference-library-flow`: kuratierte Referenzen
- [ ] `german-verb-template-flow` und `irregular-verb-template-flow`
- [ ] `review-sync-flow`: append-only Reviews und Schedulerzustand
- [ ] `xefjord-cross-language-flow`: virtuelle Sprachpaare und Fortschritt
- [ ] `anki-subdeck-import`: Unterdeckauswahl und Feldhierarchie
- [ ] `import-progress`: großer Import und sichtbarer Fortschritt
- [ ] `xefjord-import-preset`: Erkennung, Vorauswahl und Markerbereinigung

Diese Altpfade bleiben bewusst entfernt und werden nicht wiederhergestellt:

- [x] Registrierung, Login und Passwortwiederherstellung
- [x] Admin-Benutzerverwaltung
- [x] kontoabhängiges Deck-Sharing
- [x] alte authentifizierte Gerätekopplung

### 5.5 R1-Abnahme

- [ ] Referenzstand und aktueller Stand wurden mit identischen Fixtures
      ausgeführt.
- [ ] Für jeden kritischen Benutzerfluss liegt ein erwartetes strukturelles
      Ergebnis vor.
- [ ] Der Benutzer hat die wichtigsten Referenzabläufe bestätigt.
- [ ] Jede Regression ist einem Wiederherstellungspaket R2 bis R7 zugeordnet.
- [ ] Keine Phase wird vor Abschluss ihres realen Benutzerpfads geschlossen.

## 6. R2 – Fachlogik aus Plattformpfaden lösen

- [ ] Ein gemeinsames Importpaket für Analyse, Profile, Sprachlogik,
      Transformation und validierten `ImportPlan` einführen.
- [ ] Vorhandene reine Anki-/Xefjord-Funktionen aus `apps/api/src/services`
      extrahieren statt kopieren.
- [ ] Xefjord als eingebautes Profil des einzigen allgemeinen Anki-Importers
      erhalten.
- [ ] Profile über normalisierte Notiztyp-, Feld- und Templatesignaturen
      erkennen, nicht primär über paketabhängige Notiztyp-IDs.
- [ ] Datei-, ZIP-, Anki-SQLite-, Medien- und Persistenzadapter klar von
      Fachregeln trennen.
- [ ] Browser und Apple verwenden denselben validierten Importplan.
- [ ] Gemeinsame Pakete importieren weder Apps noch Capacitor, IndexedDB oder
      native SQLite-Plugins.

### R2-Go/No-go

Der Xefjord-Importplan und ein normaler APKG-Import müssen ohne Server und ohne
zweite Fachimplementierung dieselben Golden-Master-Ergebnisse liefern. Falls
das nicht gelingt, wird auf einem Recovery-Branch ab `62db38e` weitergearbeitet
und nur geprüfte Infrastruktur hinter die alten Schnittstellen übernommen.

## 7. R3 – Anki- und Xefjord-Parität

- [ ] APKG-Vorschau wiederherstellen.
- [ ] klassische und aktuelle Anki-Datenbanken unterstützen.
- [ ] Deck- und Unterdeckauswahl wiederherstellen.
- [ ] feldbasierte zusätzliche Unterdecks und Reihenfolge wiederherstellen.
- [ ] Feldzuordnung und gespeicherte deklarative Profile wiederherstellen.
- [ ] Xefjord automatisch erkennen und passende Sprachen vorschlagen.
- [ ] Sprachrichtung pro Karte erkennen.
- [ ] reine Sprachmarker und wiederholte Fragen entfernen.
- [ ] Mandarin-, Japanisch- und Koreanisch-Spezialkarten bewahren.
- [ ] Cloze und Image Occlusion ohne Layoutverlust bewahren.
- [ ] Medienauswahl, Cover und Importfortschritt wiederherstellen.
- [ ] Import vollständig lokal, begrenzt, sicher und atomar halten.
- [ ] Originalaudio unverändert zuerst speichern.

### R3-Benutzertest

Dieselben bekannten Xefjord-Pakete werden im Referenzstand und im neuen Build
importiert. Hierarchie, erste repräsentative Karten, Sprachrichtung, Audio und
Markerbereinigung müssen übereinstimmen. `Willkommen German` ist ausdrücklich
ein Negativ-Fixture.

## 8. R4 – Produktoberfläche, Editor und Lernen

- [ ] Dashboard und Navigation vergleichen.
- [ ] Deck-/Collection-Hierarchie vergleichen.
- [ ] Deck- und Karteneditor vollständig vergleichen.
- [ ] Kartenreihenfolge, verknüpfte Karten und Erklärungen vergleichen.
- [ ] Markdown, Wiki-Tabellen, KaTeX, Cloze und Medien vergleichen.
- [ ] normales Lernen und FSRS vergleichen.
- [ ] Map-Lernen, Gesten und Layout vergleichen.
- [ ] TTS-Sprachen, Klammerauslassung und Zeilenpausen vergleichen.
- [ ] Einstellungen und lokale Personalisierung vergleichen.
- [ ] Speichern, Reload, Prozessneustart und Wiederöffnen für jeden Flow prüfen.
- [ ] Keine zweite UI und keine Designänderung einführen.

## 9. R5 – Reale Zwei-Geräte-Synchronisation

- [ ] leerer Apple-Client übernimmt Browserbestand.
- [ ] leerer Browser übernimmt Apple-Bestand.
- [ ] Deck-, Karten- und Einstellungsänderungen bidirektional übertragen.
- [ ] Reviews und Schedulerzustände append-only übertragen.
- [ ] Import mit mehreren hundert Karten übertragen.
- [ ] Originalaudio und Bilder resumierbar übertragen und abspielen.
- [ ] Tombstones auf beiden Geräten anwenden.
- [ ] gleichzeitige Bearbeitung je Entität auflösen.
- [ ] Abbruch, Reconnect und Neustart ohne Datenverlust prüfen.
- [ ] Neuinstallation mit erhaltener Keychain-Identität prüfen.
- [ ] doppelte und umgeordnete Zustellung prüfen.
- [ ] Outbox, Watermarks, IDs, Versionen und Medienhashes vergleichen.
- [ ] UI-Status erst nach dauerhaftem Speichern als erfolgreich anzeigen.

## 10. R6 – PWA-/Apple-Webstack

- [ ] QR-Scan startet Kopplung automatisch.
- [ ] Verbindung, Webstack-Transfer und UI-Wechsel laufen automatisch.
- [ ] Der DataChannel bleibt beim UI-Wechsel erhalten.
- [ ] signierter Cache aktiviert ausschließlich vollständige Builds.
- [ ] fehlerhaftes Update behält den letzten funktionierenden Stack.
- [ ] normaler Start aktiviert nicht unbeabsichtigt `/pwa`.
- [ ] Safari und Chrome funktionieren nach vollständiger Cache-Löschung.
- [ ] Browser startet mit installiertem Peer-Webstack offline neu.
- [ ] iPhone, iPad und Mac Designed for iPad zeigen dieselbe Produktoberfläche.
- [ ] native Mac-WebRTC-Brücke real koppeln und synchronisieren.

## 11. R7 – Medien, Audio, FNF und kuratierte Inhalte

- [ ] Originalbilder, -audio und -video lokal und nach Sync prüfen.
- [ ] Audiooptimierung abbrechen, fortsetzen und nach Neustart wiederaufnehmen.
- [ ] Einsparanzeige mit Original- und Derivatgrößen prüfen.
- [ ] FNF exportieren, Bestand löschen und vollständig wiederherstellen.
- [ ] Maps installieren, lernen, synchronisieren und löschen.
- [ ] Numbers installieren, generieren, lernen, synchronisieren und löschen.
- [ ] mindestens eine weitere kuratierte Sprach-/Referenzsammlung prüfen.
- [ ] kuratiertes Update ohne Verlust persönlichen Fortschritts prüfen.

## 12. R8 – Abschluss und Freigabe

Phase 2, 4, 5 und 6 dürfen erst wieder als abgeschlossen markiert werden, wenn:

- [ ] die Paritätsmatrix keine kritischen offenen Punkte enthält,
- [ ] alle Golden-Master- und Sicherheitstests bestehen,
- [ ] die reale Zwei-Geräte-Matrix besteht,
- [ ] ein physisches iPhone geprüft wurde,
- [ ] Safari oder Chrome auf einem Mac geprüft wurde,
- [ ] Mac Designed for iPad geprüft wurde,
- [ ] keine Datenverluste, Duplikate oder wiederkehrenden Löschungen auftreten,
- [ ] die bestehende UI und das Kartendesign erhalten sind,
- [ ] kein kritischer Flow die alte private VPS-API benötigt und
- [ ] der Benutzer die Wiederherstellung ausdrücklich abgenommen hat.

Erst danach werden App-Store-Vorbereitung, Phase 3 oder spätere native
Plattformen fortgesetzt.

## 13. Benutzertests nach jedem Paket

Jede Rückmeldung enthält:

1. den erreichten Checklistenstand,
2. die automatisierten Nachweise,
3. einen kurzen realen Testablauf,
4. das genaue erwartete Ergebnis,
5. bekannte offene Punkte und
6. eine eindeutige Aussage, ob der nächste Schritt freigegeben werden kann.

## 14. Fortschrittsprotokoll

| Datum      | Paket          | Ergebnis                                                                    | Evidenz                                    |
| ---------- | -------------- | --------------------------------------------------------------------------- | ------------------------------------------ |
| 2026-08-11 | R0             | Referenz, Grenzen und Entwicklungsstopp dokumentiert                        | Git-Vergleich `62db38e..35709be`, ADR 0031 |
| 2026-08-11 | R1 begonnen    | Xefjord-/APKG-Lücke, entfernte Flowtests und Paritätsbereiche katalogisiert | Codepfade und Testinventar                 |
| 2026-08-11 | Grenzprüfungen | Content- und Sync-Struktur bestanden; Release-Readiness bleibt blockiert    | Repository-Skillskripte                    |
