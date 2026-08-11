# Qualitätswiederherstellung: Parität zum Stand vor der iPhone-PWA-Umstellung

> Status: **Automatisierte Funktionsparität wiederhergestellt – sicherer Dauer-Reconnect, reale Geräteabnahme und öffentliche Freigabe bleiben blockiert**
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
- [ ] Jeden Benutzerfluss vertikal von UI bis Persistenz und Peer-Sync prüfen.
- [x] Vorhandene Fachlogik extrahieren und wiederverwenden statt duplizieren.
- [x] Entfernte fachliche Tests lokal wiederherstellen, nicht ersatzlos löschen.
- [ ] Jede sichtbare Abweichung zur Referenz einzeln dokumentieren und
      freigeben.
- [ ] Einen Punkt erst nach automatisierter Prüfung und realem Benutzerpfad als
      erledigt markieren.
- [ ] Nach jedem Wiederherstellungspaket einen kurzen Benutzertest mit
      erwartetem Ergebnis bereitstellen.

## 3. Reviewstatus zum Wiederherstellungsstart

| Reviewbereich        | Status                    | Befund                                                                                                                                                                                     |
| -------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Architektur          | **automatisiert erfüllt** | Gemeinsame Fachlogik bleibt plattformneutral; Browser und Apple verwenden lokale Adapter und denselben Peer-Vertrag.                                                                       |
| Content und Import   | **automatisiert erfüllt** | APKG/Xefjord, CSV/TSV und FNF bewahren nach Persistenz Notizen, Tags, Herkunft, Hierarchie, Richtungen und Medienreferenzen.                                                               |
| Offline-Sync         | **teilweise blockiert**   | Fragmentierung, Fehlererholung und bestätigter Status sind umgesetzt. Dauerhafte Vertrauensbeziehung und automatischer Reconnect benötigen noch sichere Browser-/Keychain-Schlüsselablage. |
| Release-Bereitschaft | **Release-Blocker**       | Technische Tests und Produktionsbuild bestehen. Öffentliche Freigabe bleibt an Betreiber-/Hosting-/Aufbewahrungs-/Kontaktangaben und realer Apple-Hardwareabnahme blockiert.               |

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

- [x] Xefjord German: künstliches Fixture im Repository sowie struktureller
      Vergleich des lokalen realen Pakets gegen Referenz- und aktuellen
      Importpfad
- [x] Xefjord Arabic
- [x] Xefjord Mandarin/Chinese
- [x] Xefjord Japanese
- [x] Xefjord Korean
- [x] normales klassisches APKG mit Unterdecks
- [x] APKG mit moderner Anki-Datenbankstruktur
- [x] Cloze-Notiztyp
- [x] Image Occlusion beziehungsweise bewahrtes Layout
- [x] FNF-Paket mit Bild und Audio
- [x] CSV und TSV mit Anführungszeichen, Zeilenumbrüchen und Unicode
- [x] kuratierte Maps-Collection
- [x] kuratierte Numbers-Collection
- [x] normales Deck mit Markdown, Wiki-Tabelle, KaTeX und Medien

Reale urheberrechtlich geschützte Pakete bleiben lokal. In Git gelangen nur
kleine künstliche Fixtures, Hashes und erwartete strukturelle Ergebnisse.

### 5.3 Paritätsmatrix

Statuswerte: `erfüllt`, `offen`, `Release-Blocker`, `bewusst später`.

| Benutzerfluss               | Referenzverhalten                              | Aktueller R1-Status   | Erforderlicher Nachweis                                     |
| --------------------------- | ---------------------------------------------- | --------------------- | ----------------------------------------------------------- |
| App-Start                   | bekannte Produktoberfläche ohne parallele UI   | extern blockiert      | iPhone, Browser und Mac zeigen denselben Produktstack       |
| Dashboard                   | Bestände, Fälligkeiten und Navigation korrekt  | erfüllt               | Referenzvergleich nach Reload und Neustart                  |
| Deckhierarchie              | Collections und Unterdecks stabil              | automatisiert erfüllt | Anlegen, Reload und atomarer Import; realer Peer-Sync offen |
| Deckeditor                  | atomisches Erstellen, Ändern und Löschen       | erfüllt               | Save/Reopen, Konflikt und Kartenreihenfolge                 |
| Kartendarstellung           | bisheriges Design und alle Inhaltstypen        | erfüllt               | strukturelle Tests und mobiler Browserlauf                  |
| Normales Lernen             | FSRS und Bewertungen deterministisch           | erfüllt               | Reviewlog, Schedulerzustand, Neustart und Peer-Replay       |
| Map-Lernen                  | bisherige Karte, Gesten und Sprache            | extern blockiert      | automatisierte Gesten/Layouttests; iPhone-Lauf offen        |
| TTS                         | Sprachseite, Klammerauslassung und Zeilenpause | automatisiert erfüllt | feste Sprach-/Text-Fixtures; realer Apple-Lauf offen        |
| Einstellungen               | lokal dauerhaft und synchronisierbar           | extern blockiert      | lokale Persistenz erfüllt; reale Gleichzeitigkeit offen     |
| CSV/TSV                     | bisherige Formate ohne Inhaltsverlust          | erfüllt               | gemeinsamer Parser, Persistenz, Reload und Fehlerfälle      |
| allgemeines APKG            | Vorschau, Unterdecks, Felder und Medien        | automatisiert erfüllt | vollständiger Import, Persistenz und Reload                 |
| Xefjord APKG                | Profil, Markerbereinigung und Sprachrichtung   | automatisiert erfüllt | vollständige Persistenz; reale Sprachpakete abzunehmen      |
| FNF-Import/Export           | portable vollständige Deckpakete               | erfüllt               | Export, Löschen, Restore und erneuter Export                |
| Originalmedien              | unverändert, sofort verwendbar                 | extern blockiert      | Hash/Storage erfüllt; Wiedergabe auf zwei Geräten offen     |
| Audiooptimierung            | asynchron, fortsetzbar, Original bleibt        | automatisiert erfüllt | Pause, Fortsetzen, Retry; Apple-Lauf offen                  |
| kuratierte Inhalte          | Installieren, Aktualisieren und Löschen        | automatisiert erfüllt | Maps, Numbers, Reload und Update; realer Peer-Sync offen    |
| Peer-Sync Metadaten         | bidirektional und idempotent                   | extern blockiert      | Contracts erfüllt; reale Zwei-Geräte-Matrix offen           |
| Peer-Sync Medien            | resumierbar und abspielbar                     | extern blockiert      | Chunk/Resume erfüllt; reale Wiedergabe offen                |
| Peer-Sync Reviews           | append-only ohne Duplikate                     | extern blockiert      | Contracts erfüllt; physischer Neustarttest offen            |
| Peer-Löschung               | Tombstones ohne Wiederauftauchen               | extern blockiert      | Contracts erfüllt; realer Reconnect offen                   |
| Webstack-Handoff            | automatisch, signiert und rollbackfähig        | extern blockiert      | Signatur/Cache/Rollback erfüllt; echter Handoff offen       |
| Mac Designed for iPad       | native WebRTC-Brücke                           | extern blockiert      | Bridge-Contracts erfüllt; realer Mac-App-Lauf offen         |
| lokaler Export/Restore      | vollständige Wiederherstellung                 | erfüllt               | frische Datenbank, Entitäten und Medien                     |
| iCloud/Family               | automatische Apple-Wiederherstellung           | bewusst später        | kostenpflichtiger Apple Developer Account                   |
| native Android-/Windows-App | gemeinsame Fachformate                         | bewusst später        | spätere Plattformphase                                      |

### 5.4 Wiederherzustellende Testaussagen

Die folgenden beim Cutover entfernten Tests werden nicht als Serverflows
zurückgebracht. Ihre Fachregeln werden in lokale Contract- oder Produktflowtests
überführt:

- [x] `card-order-flow`: stabile Kartenreihenfolge und atomischer Editor-Commit
- [x] `deck-editor-commit-flow`: Erstellen, Ändern, Löschen und Konflikte
- [x] `deck-language-flow`: Sprache und Richtung pro Deck/Karte
- [x] `markdown-roundtrip-flow`: strukturierter Inhalt ohne Formatverlust
- [x] `katex-reference-template-flow`: Formeln und Referenzen
- [x] `fnf-collection-flow`: Paketstruktur, Medien und Hierarchie
- [x] `number-collection-flow`: Installation, Generation und Löschung
- [x] `core-language-template-flow`: kuratierte Sprachsammlungen
- [x] `developer-reference-library-flow`: kuratierte Referenzen
- [x] `german-verb-template-flow` und `irregular-verb-template-flow`
- [x] `review-sync-flow`: append-only Reviews und Schedulerzustand
- [x] `xefjord-cross-language-flow`: virtuelle Sprachpaare und Fortschritt
- [x] `anki-subdeck-import`: Unterdeckauswahl und Feldhierarchie
- [x] `import-progress`: großer Import und sichtbarer Status
- [x] `xefjord-import-preset`: Erkennung, Vorauswahl und Markerbereinigung

Diese Altpfade bleiben bewusst entfernt und werden nicht wiederhergestellt:

- [x] Registrierung, Login und Passwortwiederherstellung
- [x] Admin-Benutzerverwaltung
- [x] kontoabhängiges Deck-Sharing
- [x] alte authentifizierte Gerätekopplung

### 5.5 R1-Abnahme

- [x] Referenzstand und aktueller Stand wurden mit identischen Fixtures
      ausgeführt.
- [x] Für jeden automatisierbaren kritischen Benutzerfluss liegt ein erwartetes strukturelles
      Ergebnis vor.
- [ ] Der Benutzer hat die wichtigsten Referenzabläufe bestätigt.
- [x] Jede Regression ist einem Wiederherstellungspaket R2 bis R7 zugeordnet.
- [ ] Keine Phase wird vor Abschluss ihres realen Benutzerpfads geschlossen.

## 6. R2 – Fachlogik aus Plattformpfaden lösen

- [x] Ein gemeinsames Importpaket für Analyse, Profile, Sprachlogik,
      Transformation und validierten `ImportPlan` einführen.
- [x] Vorhandene reine Anki-/Xefjord-Funktionen aus `apps/api/src/services`
      extrahieren statt kopieren.
- [x] Xefjord als eingebautes Profil des einzigen allgemeinen Anki-Importers
      erhalten.
- [x] Profile über normalisierte Notiztyp-, Feld- und Templatesignaturen
      erkennen, nicht primär über paketabhängige Notiztyp-IDs.
- [x] Datei-, ZIP-, Anki-SQLite-, Medien- und Persistenzadapter klar von
      Fachregeln trennen.
- [x] Browser und Apple verwenden denselben validierten Importplan.
- [x] Gemeinsame Pakete importieren weder Apps noch Capacitor, IndexedDB oder
      native SQLite-Plugins.

### R2-Go/No-go

Der Xefjord-Importplan und ein normaler APKG-Import müssen ohne Server und ohne
zweite Fachimplementierung dieselben Golden-Master-Ergebnisse liefern. Falls
das nicht gelingt, wird auf einem Recovery-Branch ab `62db38e` weitergearbeitet
und nur geprüfte Infrastruktur hinter die alten Schnittstellen übernommen.

## 7. R3 – Anki- und Xefjord-Parität

- [x] APKG-Vorschau im vollständigen Produktpfad wiederherstellen.
- [x] klassische und aktuelle Anki-Datenbanken nach Persistenz und Reload unterstützen.
- [x] Deck- und Unterdeckauswahl wiederherstellen.
- [x] feldbasierte zusätzliche Unterdecks und Reihenfolge wiederherstellen.
- [x] Feldzuordnung und gespeicherte deklarative Profile wiederherstellen.
- [x] Xefjord automatisch erkennen und passende Sprachen vorschlagen.
- [x] Sprachrichtung pro Karte erkennen und dauerhaft speichern.
- [x] reine Sprachmarker und wiederholte Fragen entfernen.
- [x] Mandarin-, Japanisch- und Koreanisch-Spezialkarten bewahren.
- [x] Cloze und Image Occlusion ohne Layoutverlust bewahren.
- [x] Medienauswahl, Cover und Importstatus wiederherstellen.
- [x] Import vollständig lokal, begrenzt, sicher und atomar halten.
- [ ] Originalaudio unverändert zuerst speichern und nach Reload abspielen.

### R3-Benutzertest

Dieselben bekannten Xefjord-Pakete werden im Referenzstand und im neuen Build
importiert. Hierarchie, erste repräsentative Karten, Sprachrichtung, Audio und
Markerbereinigung müssen übereinstimmen. `Willkommen German` ist ausdrücklich
ein Negativ-Fixture.

## 8. R4 – Produktoberfläche, Editor und Lernen

- [x] Dashboard und Navigation automatisiert vergleichen.
- [x] Deck-/Collection-Hierarchie automatisiert vergleichen.
- [x] Deck- und Karteneditor vollständig automatisiert vergleichen.
- [x] Kartenreihenfolge, verknüpfte Karten und Erklärungen vergleichen.
- [x] Markdown, Wiki-Tabellen, KaTeX, Cloze und Medien vergleichen.
- [x] normales Lernen und FSRS vergleichen.
- [x] Map-Lernen, Gesten und Layout im kleinen Browserviewport vergleichen.
- [x] TTS-Sprachen, Klammerauslassung und Zeilenpausen vergleichen.
- [x] Einstellungen und lokale Personalisierung vergleichen.
- [x] Speichern, Reload, simulierten Prozessneustart und Wiederöffnen prüfen.
- [x] Keine zweite UI und keine Designänderung einführen.

## 9. R5 – Reale Zwei-Geräte-Synchronisation

Automatisierte Voraussetzung:

- [x] bidirektionale Metadaten- und Einstellungsübertragung im Peer-Contract
- [x] append-only Reviews, stabile IDs, Watermarks und dauerhafte Outbox
- [x] 100.000 lokale Änderungen atomar; auch einzelne große Mutationen transportseitig begrenzen und fragmentieren
- [x] Medieninventar, resumierbare Chunks und Hashprüfung
- [x] Tombstones, Entitätskonflikte, doppelte und umgeordnete Zustellung
- [ ] dauerhafte Vertrauensbeziehung, Reconnect, Prozessneustart und erhaltene Geräteidentität
- [x] Erfolg erst nach dauerhaftem Anwenden und Bestätigen; Transportstatus getrennt anzeigen

Noch auf realen Geräten auszuführen:

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

Automatisierte und lokale Browser-Nachweise:

- [x] QR-/Einladungsfluss, automatischer Handoff und UI-Grenze als Contracts
- [x] DataChannel-Übergabe und aufgeschobene Sync-Nachrichten
- [x] signierter atomarer Cache, Downgrade-Schutz und Rollback
- [x] `/` und `/app` aktivieren den `/pwa`-Fallback nicht unbeabsichtigt
- [x] STUN-only ohne TURN-Relay
- [x] importierter Produktstack bei 390 × 844 Pixel ohne horizontalen Überlauf
- [x] native iOS-/Mac-WebRTC-Brücke gebaut und automatisiert geprüft

Noch auf realen Browsern und Apple-Geräten auszuführen:

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

- [x] Originalbilder und -audio lokal unverändert speichern; Derivate getrennt halten.
- [x] Audiooptimierung pausieren, fortsetzen und fehlgeschlagene Jobs wiederholen.
- [x] Einsparanzeige mit Original- und Derivatgrößen prüfen.
- [x] FNF exportieren, Bestand löschen und vollständig wiederherstellen.
- [x] Maps installieren, lernen und löschen.
- [x] Numbers installieren, generieren, lernen und löschen.
- [x] kuratierte Sprach- und Referenzsammlungen strukturell prüfen.
- [x] kuratiertes Update ohne Verlust persönlichen Fortschritts prüfen.
- [ ] Originalmedien nach realem Browser-iPhone-Sync wiedergeben.
- [ ] Maps und Numbers auf beiden realen Geräten synchronisieren.

## 12. R8 – Abschluss und Freigabe

Phase 2, 4, 5 und 6 dürfen erst wieder als abgeschlossen markiert werden, wenn:

- [ ] die Paritätsmatrix keine kritischen offenen Punkte enthält,
- [x] alle Golden-Master- und Sicherheitstests bestehen,
- [ ] die reale Zwei-Geräte-Matrix besteht,
- [ ] ein physisches iPhone geprüft wurde,
- [ ] Safari oder Chrome auf einem Mac geprüft wurde,
- [ ] Mac Designed for iPad geprüft wurde,
- [ ] keine Datenverluste, Duplikate oder wiederkehrenden Löschungen auftreten,
- [x] die bestehende UI und das Kartendesign im automatisierten und lokalen Browservergleich erhalten sind,
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

| Datum      | Paket               | Ergebnis                                                                                               | Evidenz                                              |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 2026-08-11 | R0                  | Referenz, Grenzen und Entwicklungsstopp dokumentiert                                                   | Git-Vergleich `62db38e..35709be`, ADR 0031           |
| 2026-08-11 | R1 begonnen         | Xefjord-/APKG-Lücke, entfernte Flowtests und Paritätsbereiche katalogisiert                            | Codepfade und Testinventar                           |
| 2026-08-11 | R1 German           | Xefjord-German-Golden-Master reproduziert die lokale Importregression                                  | künstliches APKG plus lokales Realpaket              |
| 2026-08-11 | R1 Sprachen         | Arabic, Mandarin, Japanese und Korean strukturell charakterisiert                                      | lokale Realpaket-Matrix mit Hashbindung              |
| 2026-08-11 | R1 Formate          | APKG, Cloze, FNF, CSV und TSV mit künstlichen Fixtures charakterisiert                                 | deterministische paketübergreifende Matrix           |
| 2026-08-11 | R1 Inhalte          | Image Occlusion, Maps, Numbers und strukturierte Karten charakterisiert                                | signierter Katalog und reale Lokaladapter            |
| 2026-08-11 | Grenzprüfungen      | Content- und Sync-Struktur bestanden; Release-Readiness bleibt blockiert                               | Repository-Skillskripte                              |
| 2026-08-11 | R2                  | Anki-, Xefjord-, Hierarchie-, Profil- und CSV/TSV-Regeln in Domain extrahiert                          | API und Browser nutzen gemeinsame Fachlogik          |
| 2026-08-11 | R3                  | Lokale Vorschau, Profile, Auswahl, Sonderkarten, Medien und Xefjord-Parität wiederhergestellt          | reale Fünf-Sprachen-Matrix ohne Marker               |
| 2026-08-11 | R4–R7 automatisiert | Produkt-, Lern-, Sync-, Webstack-, Medien-, Audio- und Curated-Contracts bestanden                     | vollständiger Workspace-Test und Produktionsbuild    |
| 2026-08-11 | R8 vorbereitet      | Release 0.5.129 technisch gebaut; öffentliche Freigabe und Hardwareabnahme bleiben offen               | Release-Check: Legal-Platzhalter; reale Geräte nötig |
| 2026-08-11 | Status korrigiert   | Frühere Abschlussaussagen zurückgenommen; vollständige Persistenz- und Hardwarepfade sind wieder offen | gemeldete Xefjord- und Peer-Sync-Regressionen        |
| 2026-08-11 | Paritätsumsetzung   | Persistenzverlust in APKG/Xefjord behoben; CSV/TSV und FNF vollständig lokal rundgeführt               | 933 Workspace-Tests, Typprüfung, Produktionsbuild    |
| 2026-08-11 | Sync-Härtung        | große Mutationen fragmentiert, Fehlerbarriere erholbar, Grün erst nach ACK und leerer Outbox           | Peer-Contract, mobile Hell-/Dunkelprüfung            |

Der Vergleich des lokalen realen German-Pakets (Hashpräfix
`1ed7fdf7b464e059`) umfasst 2 Decks, 410 Karten und 205 Medien. Der
Referenzpfad erkennt alle 410 Karten und entfernt 615 reine Richtungsmarker.

Der lokale und der Referenzpfad liefern für German, Arabic, Mandarin, Japanese
und Korean jeweils null verbleibende Sprachmarker. Der vollständige
Workspace-Test, die Import-Golden-Master, die Sync-/Learning-/Content-
Grenzprüfungen und der Produktionsbuild bestehen. Der Release-Readiness-Check
stoppt weiterhin korrekt an nicht finalisierten Betreiber-, Hosting-,
Aufbewahrungs- oder Kontaktangaben. Diese Angaben und die reale
Browser-iPhone-Mac-Abnahme sind keine automatisiert auflösbaren Punkte.
Die Prüfung zählt ausschließlich eigenständige Markerzeilen, damit legitime
Erwähnungen einer Sprache nicht entfernt werden. Der vereinfachte lokale Pfad
lässt auf allen 410 Karten Markertext zurück. Damit ist die gemeldete
Regression `Willkommen German` reproduzierbar belegt, aber in R1 bewusst noch
nicht behoben.

Die Spezialsprachen zeigen weitere getrennte Wiederherstellungspunkte:

- Arabic, Japanese und Korean behalten im Referenzpfad ihre bidirektionalen
  Sprachrichtungen und entfernen Marker sowie wiederholte Fragen.
- Mandarin wird als `zh`-Preset erkannt, die bisherige Richtungslogik erkennt
  im realen Paket aber keine Karte. R3 muss daher die Aliasbeziehung
  `Mandarin`/`Chinese` ausdrücklich abdecken.
- Beim Japanese-Paket sieht der Referenzpfad 2504 Medien, der vereinfachte
  lokale Pfad nur 206. Diese Differenz ist ein Release-Blocker, bis geklärt ist,
  welche Medien zu den Spezialkarten gehören und vollständig bewahrt werden
  müssen.

Die allgemeine Importmatrix bestätigt, dass klassische und moderne
Anki-Datenbankstrukturen, Unterdecks, Cloze-Karten, Originalaudio sowie ein
lokales FNF-Paket mit Bild und Audio grundsätzlich lokal gelesen werden. Sie
belegt zugleich folgende noch nicht akzeptierte Abweichungen:

- Mehrzeilige, korrekt zitierte CSV-Felder scheitern im aktuellen lokalen
  Import bereits an der Zeilentrennung.
- Beim TSV-Import bleiben HTML-Auszeichnungen erhalten und die Tag-Spalte wird
  an die Rückseite angehängt, statt als Tags übernommen zu werden.
- Der aktuelle Cloze-Pfad rendert ein zusätzliches Feld auf die Rückseite, das
  der Referenzpfad nicht als Karteninhalt ausgibt.
- Ein direkt in der klassischen Anki-Vorlage eingebundenes Bild wird von den
  beiden Pfaden unterschiedlich behandelt. R2/R3 müssen über den gemeinsamen
  Importplan festlegen, welche sicheren strukturierten Blöcke tatsächlich zur
  Karte gehören.

Die noch fehlenden Inhalts-Fixtures schließen die R1-Golden-Master-Liste:

- Image Occlusion ist ein weiterer Release-Blocker: Der Referenzpfad
  desinfiziert die beiden SVG-Masken und erzeugt strukturierte Overlays. Der
  aktuelle lokale Pfad verwirft beide Masken und importiert nur das Grundbild.
- Der signierte Geografie-Katalog enthält 100 Decks, 2766 Karten und 100
  Kartenmodelle. Seine Signatur, Referenzen und die atomare Installation des
  tatsächlichen Katalogbaums in IndexedDB sind geprüft.
- Die lokale Numbers-Collection erzeugt für `de-DE` nach `en-US` bis 100 sieben
  Decks und 19 Kompetenzkarten. Die 37 Werte einer Runde beginnen mit 0 bis 20,
  enthalten alle erforderlichen Dekaden und wiederholen sich erst in der
  nächsten Runde.
- Das künstliche lokale FNF-Paket bewahrt Markdown, eine Wiki-Tabelle, KaTeX,
  Bild und Audio als validierte strukturierte Inhalte.
