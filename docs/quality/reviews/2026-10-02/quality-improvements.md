# Flash-n-Flip: Qualitätsverbesserungen und Release-Nachprüfung

Stand: 2. Oktober 2026. Ausgangsbasis: `d4b62c8f8a37266b5ce80a5b28962eaddfc434cf`.
Projektversion: `0.5.179`. Fortsetzung des Reviews vom 30. September 2026.

**Ergebnis: weitere Sicherheits- und Logikprobleme korrigiert, aussagekräftige
Regressionstests ergänzt und die technischen Projektprüfungen bestanden. Eine
vollständige App-Store-Abnahme ist damit noch nicht nachgewiesen.** Insbesondere
fehlen die aktuelle gerenderte Sichtprüfung und die physischen Zwei-Geräte- und
Recovery-Nachweise. Diese Unterscheidung verhindert, dass ein Simulatorbuild
oder gemocktes CloudKit als funktionierender Endnutzerpfad ausgegeben wird.

## 1. Auftrag, Entscheidungen und Umfang

Der Auftrag umfasst die Behebung direkt korrigierbarer Probleme, Verbesserung
der Tests, einen ausführlichen Bericht sowie einen absichtlichen Commit mit
Push. Kein Deployment und kein App-Store-Upload wurden beauftragt. Der
Legacy-Checkout `/Users/frank/Documents/FlashCards` wurde nicht verändert.
Die Ausgangs-Arbeitskopie war sauber; die Änderungen gehören zu diesem Auftrag.

Der Produktverantwortliche hat die bestehende **iCloud-Zielrichtung** bestätigt.
SQLite und IndexedDB bleiben lokale Autorität. Die frühere WebRTC-only-Vorgabe
ist durch diese konkrete Entscheidung ersetzt; ein konkurrierender zweiter
Synchronisationsschreiber ist nicht vorgesehen. ADR 0054, AGENTS.md,
Release-Dokumentation und Datenflussübersicht wurden darauf abgestimmt.

Geschäfts-/Betreiber-/Store-Angaben werden auf ausdrücklichen Wunsch erst vor
Wirkbetriebsaufnahme erledigt und blockieren diesen technischen Auftrag nicht.
Es wurden keine fehlenden Betreiberfakten erfunden oder als geprüft markiert.

## 2. Sicherheitskorrekturen

### Produktionsabhängigkeiten

Der freigegebene `pnpm audit --prod --json` meldete vor der Nacharbeit neun
Befunde: fünf hoch, drei mittel und einen niedrig. Acht kamen aus der unbenutzten
Expo-Abhängigkeit, die Drizzle über seinen optionalen SQLite-Peer installierte.
Die API nutzt Drizzle mit PostgreSQL; die native lokale App verwendet den
Capacitor-SQLite-Adapter. Eine Suche in Apps und Packages fand keine Runtime-Nutzung
von Expo-SQLite. Der gezielte pnpm-Override entfernt ausschließlich diesen Peer
bei `drizzle-orm@0.45.2`, ohne Legacy-Quellcode zu entfernen.

Der weitere Befund betraf DOMPurify im Mermaid-Abhängigkeitsbaum. DOMPurify 3.x
ist jetzt auf `3.4.16` festgelegt. Der anschließende Produktionsaudit bestand mit
**null gemeldeten Sicherheitslücken** und 381 Produktionsabhängigkeiten
gegenüber 929 zuvor. Der Installationsvorgang entfernte 465 Pakete aus dem
gesamten aufgelösten Baum. Das bedeutet keine Garantie gegen unbekannte Lücken.

Die aktualisierten Third-Party-Notices und der kuratierte Katalog wurden aus dem
neuen Baum regeneriert und geprüft. Der Notices-Check bestätigt 146 Komponenten
und 78 Dokumente; Manifest-Hash:
`67301e4e9b48e6550e285f2b0d096578f9c76267e0e6535ed4506ec8d17cc356`.

Die zusätzliche Übermittlung des vollständigen Entwicklungsabhängigkeitsbaums
an npm wurde von der automatischen Freigabeprüfung abgelehnt, weil die bisherige
Freigabe ausdrücklich Produktionsabhängigkeiten betraf. Die Erweiterungsfrage
war zum Berichtsstand unbeantwortet; ein vollständiger Dev-Audit wurde daher
nicht als durchgeführt ausgewiesen.

### Persistierte iCloud-Policy

Die Cloud-Policy wurde bisher ohne vollständige Laufzeitvalidierung eingelesen.
Jetzt prüft ein gemeinsames Domain-Schema Account, Umgebung, Aktivierungsstatus
und vollständige Lösch-/Entfernungsintentionen mit stabilen IDs. Das Einlesen ist
auf 4 KiB begrenzt; ungültige oder übergroße Daten führen zum sicheren Abbruch.
Die Originaldaten bleiben für Diagnose erhalten. Ein fehlerhafter Policy-Eintrag
darf weder die Schutzgrenze aufheben noch Datenlöschung oder Account-Wechsel
erlauben. Auch Schreibvorgänge werden vor der Persistierung validiert.

15 neue Verhaltenstests prüfen unter anderem ungültiges JSON, unvollständige
Intentionen, Account-/Umgebungswechsel, deaktivierte Replikation, konkurrierende
Policy-Änderungen und die Freigabe einer Sperre nach Fehlern. Das Größenbudget
gilt auch bei mehrbyteigen UTF-8-Zeichen tatsächlich für Bytes.

### Backup-Eingaben und native Bridge

Die Backup-Validierung lehnt inkonsistente Byteangaben, nichtkanonisches Base64,
falsche Padding-Bits und doppelte Medien-IDs ab. Große Base64-Werte werden linear
geprüft; dafür wird keine rekursive Groß-Regex verwendet. Der neue Dateileser
begrenzt Gesamtgröße und Schachtelung, prüft UTF-8 strikt und weist unbekannte oder
doppelte Wurzelfelder sowie abgeschnittenes JSON zurück. Native Export-Chunks
werden anhand ihrer kodierten Länge begrenzt, bevor Swift sie dekodiert.

## 3. Behobene Logik- und Bedienfehler

| Befund                                                                                                                                     | Korrektur                                                                                                                                                                                                      | Aussagekräftiger Nachweis                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eine verspätete Locale-Ladung überschrieb die inzwischen gewählte Sprache. Gesperrter Browser-Storage konnte den Provider abbrechen.       | Benutzeränderungen haben Vorrang; Lade-/Speicherfehler werden abgefangen; nach Unmount wird kein Cache mehr beschrieben.                                                                                       | Fünf Tests montieren den echten Provider und prüfen sichtbare Texte, Dokument-Sprache, verspätete Promises und verweigerten Storage.                                      |
| Einstellungen speicherten einen veralteten vollständigen Snapshot und konnten dabei das Theme auf `SYSTEM` zurücksetzen.                   | Gezielt geänderte Felder werden über den vorhandenen partiellen Repository-Pfad gespeichert. Fehler sind als lokalisierter Alert sichtbar.                                                                     | Der DOM-Test verändert die tatsächliche Checkbox und prüft den partiellen Schreibauftrag.                                                                                 |
| Eine verspätete Settings-Ladung konnte ein gerade eingegebenes Tagesziel überschreiben.                                                    | Bearbeitete Felder werden sofort beim Tippen markiert und vor nachträglicher Hydrierung geschützt.                                                                                                             | Das Ziel `42` bleibt nach späterer Ladeantwort und Blur erhalten.                                                                                                         |
| Mehrfachklicks konnten parallele Backup-/Restore-Aktionen starten; Abbruch konnte irreführend wirken.                                      | Ein gemeinsamer Operations-Lock schützt Export/Restore; Bedienelemente werden deaktiviert, der Fortschrittszustand wird angezeigt und der Lock immer freigegeben.                                              | Sechs Settings-Verhaltenstests decken Doppelklick, gegenseitige Sperre, Abbruch, Fehleranzeige und erneuten Versuch ab.                                                   |
| Beim Start einer bereits verknüpften iCloud-Bibliothek konnte die Account-Abfrage den eigentlichen Synchronisationsdurchlauf verschlucken. | Automatische Arbeit wartet auf die bestehende Operation und prüft danach erneut ihre gültige Generation.                                                                                                       | Ein Regressionstest schlug mit dem ursprünglichen Runtime-Code fehl und besteht mit der Korrektur.                                                                        |
| Account-Beobachtung konnte als explizite Aktivierung behandelt werden.                                                                     | Automatische Trigger verwenden immer `explicit: false`; nur die Benutzeraktion aktiviert eine bisher nicht aktivierte Bibliothek.                                                                              | Abwesende/deaktivierte Policy lädt nichts hoch; explizite Aktivierung und bereits verknüpfter Start werden separat geprüft.                                               |
| Suspendierung, Hintergrundfehler und Änderungen während eines Durchlaufs konnten inkonsistent behandelt werden.                            | Coalescing erlaubt einen Folgedurchlauf, verwirft alte Generationen und meldet Fehler über den Runtime-Zustand. Resume ist idempotent.                                                                         | Fünf zusätzliche Coalescer-Tests; Cloud-eigene Änderungen erzeugen keinen Upload-Rückkopplungskreis.                                                                      |
| Wiederholte Stapel-IDs in einer Lernplanauswahl wurden mehrfach gezählt.                                                                   | Die Auswahl wird in beiden lokalen Adaptern vor Zählen und Abruf dedupliziert.                                                                                                                                 | Echte SQLite-Abfragen und IndexedDB werden mit derselben Bibliothek verglichen; neue und fällige Karten bleiben genau einmal gezählt. Der Test war vor der Korrektur rot. |
| Singular/Plural, Standard-Lernplanname und französische Prozentanzeige waren inkonsistent.                                                 | Die vier unterstützten Sprachen nutzen ihre Kardinalregeln; bei Kartenfortschritt werden Karten- und Review-Anzahl unabhängig behandelt. Neue Standardpläne werden lokalisiert, eigene Titel bleiben erhalten. | 14 i18n-Tests insgesamt sowie fünf zusätzliche Repository-Tests für vier Sprachen und bestehende Titel.                                                                   |
| Der gemeinsame i18n-Check bewertete die statische bilinguale Pianoforte-Seite wie die viersprachige Lern-App.                              | Eng begrenzte EN/DE-Regel nur für den Pianoforte-Routenbaum; gemeinsamer Flash-n-Flip-Scan bleibt streng. Der englische Bereich bekommt korrektes `lang="en"`.                                                 | Fünf neue Scanner-Tests prüfen auch ähnlich benannte Fremdpfade und weiterhin abgelehnte Flash-n-Flip-Hardcodes.                                                          |

Die neue Oberfläche zeigt Exportfehler und Größenlimits in allen vier Sprachen.
Die Restore-Dateiauswahl besitzt einen zugänglichen Namen, Fehler verwenden
`role="alert"`, der Operationszustand `aria-busy`. Das sind überprüfte
DOM-Semantiken; eine VoiceOver- oder geometrische Layoutabnahme ersetzen sie nicht.
Ein zusätzlicher Repository-Test verweigert sämtliche Cache-Lesezugriffe und
prüft dennoch den erfolgreichen IndexedDB-Patch mit erhaltenem Theme und Locale.
Er fand einen verbliebenen ungeschützten Cache-Zugriff; auch dieser ist korrigiert.

**Zusätzlicher Datenintegritätsbefund:** Ein Restore konnte erfolgreich COMMITten,
während seine native Bridge-Antwort verloren ging. Die bisherige Fehlerbereinigung
löschte danach gerade wiederhergestellte Medien, obwohl deren Referenzen schon
durabel in SQLite standen. Zwei echte SQL-Regressionstests reproduzierten diesen
Fehler sowohl für den Objekt- als auch den Stream-Restore. Sobald die Veröffentlichung
beginnt, werden verifizierte Staging-Medien jetzt auch bei einer unklaren Antwort
erhalten. Die Operation meldet weiterhin ihren Fehler; sie behauptet keinen
bestätigten Erfolg. Bei tatsächlichem Rollback bleibt der Zielbestand leer und
ein erneuter Restore kann das gültige Staging nach Reopen wiederverwenden. Dafür
existiert ein weiterer SQL-Test. Parse-/Hash-/Staging-Fehler vor der Veröffentlichung
bereinigen weiterhin ausschließlich ihre eigenen neu angelegten Medien.

## 4. Vollbackup: Größenvertrag und Wiederherstellung

JSON-Vollbackup-Export und -Restore verwenden jetzt denselben 700-MiB-Vertrag.
Andere native FNF-Exporte behalten das bisherige 256-MiB-Limit. Limits bleiben
explizit und werden vor dem Lesen bzw. dem Start des nativen Exports geprüft.

Der Export liest Medien einzeln und erzeugt JSON-Segmente statt eines einzigen
großen JSON-Strings. Der Dateileser verarbeitet 64-KiB-Blöcke. Restore validiert
und staged einzelne Medien, bevor die lokale Autorität veröffentlicht wird.
Fehlschläge bereinigen ausschließlich neu angelegte Staging-Medien; gültige
vorhandene Staging-Präfixe und fremde Medien werden erhalten. Beschädigte oder
doppelte Daten dürfen keinen teilweise sichtbaren Deck-/Review-Stand erzeugen.

Der neue reproduzierbare Test `pnpm backup:stress` erstellt rein synthetische
Decks, Karten, Lernplan, Einstellungen, drei Reviews und 26 Medien zu je 8 MiB.
Ein Prozess exportiert auf eine echte temporäre Datei; ein zweiter Node-Prozess
restauriert sie in eine frische IndexedDB-Testdatenbank und vergleicht sämtliche
Entitäten, Schedulerzustände, Journal-/Outbox-IDs und die 26 originalen Medienhashes.

| Messgröße                    | Ergebnis                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------- |
| JSON-Datei                   | 290.927.051 Bytes, etwa 277,45 MiB; größer als das frühere native 256-MiB-Limit |
| Original-Mediendaten         | 208 MiB, 26 von 26 Hashes erfolgreich verglichen                                |
| Reviews                      | 3 von 3 erhalten                                                                |
| Export und Restore           | Bestanden in getrennten Node-Prozessen; 8,29 Sekunden Gesamtlaufzeit            |
| Maximales RSS Exportprozess  | 1.394.400 KiB                                                                   |
| Maximales RSS Restoreprozess | 763.200 KiB                                                                     |

Die Speicherwerte enthalten die Fake-IndexedDB-Implementierung und ihre Kopien.
Das Verfahren hält weiterhin den Autoritäts-Snapshot, Blob-Segmente und einzelne
dekodierte Medien im Speicher. Es ist **kein Nachweis konstanten Speicherbedarfs**
und keine Zusage, dass jede 700-MiB-Datei auf jedem iPhone verarbeitet werden kann.
Der reale große Roundtrip einschließlich nativer Share-Sheet-/Dateiauswahl und
Speicherdruck auf Geräten bleibt ein eigener Abnahmeschritt.

## 5. Verbesserte Testqualität

Die zusätzliche Abdeckung prüft beobachtbares Verhalten und Datenintegrität.
Die bestehenden Quelltext-/Strukturtests wurden nicht als alleinige Beweise
verwendet. Tests für Renderer/Persistenz wurden durch echte DOM-Interaktionen,
Dateien, Hashes, fehlerhafte Zwischenzustände und eine echte SQL-Engine ergänzt.

Besonders relevant sind die acht neuen Tests mit dateibasierter `node:sqlite`
Datenbank. Der Capacitor-Transport wird ersetzt, seine SQL-Anweisungen werden
jedoch unverändert durch SQLite ausgeführt. Geprüft werden:

1. Review, Schedulerzustand, Outbox und Medien nach Schließen und Wiederöffnen
   einer Datenbankdatei; erneute Zustellung derselben Review-ID.
2. Tatsächlicher SQL-Rollback nach Outbox-Fehler: keine neue Review-Zeile, kein
   geänderter Kartenfortschritt, kein Sequenzsprung und kein Journal-Zuwachs.
3. Erfolgreiches COMMIT mit verlorener Bridge-Antwort: Wiederholung nach Reopen
   erzeugt weder einen zweiten Review noch weitere Scheduler-/Outbox-Änderungen.
4. Tatsächliche UNIQUE- und FOREIGN-KEY-Verletzungen mit atomarem Rollback.
5. Übereinstimmung der SQL-/IndexedDB-Lernabfragen, einschließlich suspendierter
   Karten, fremder Stapel und wiederholter Stapel-IDs.
6. Beide Restore-Wege bei verlorenem COMMIT-Reply sowie wiederaufnehmbarer Restore
   nach tatsächlichem SQL-Rollback, jeweils mit erhaltenen Originalmedien.

Der optionale Storage-Parameter des lokalen Repositorys erlaubt diese Prüfung
der echten Plattformadapter ohne globale Plattform-Manipulation. Die
Produktionsauswahl bleibt dieselbe. Die minimale Entwicklungs-Node-Version ist
wegen des ohne Sonderflag nutzbaren SQLite-Moduls jetzt `22.13.0`.

Mehrere neue Regressionstests wurden bewusst gegen den fehlerhaften Stand
ausgeführt: Locale-Übernahme, vier Settings-Szenarien, iCloud-Startup sowie die
Mehrfachzählung und beide Medienverlust-Szenarien gingen vor ihrer Korrektur fehl.
Die kalte Modulinitialisierung
der Runtime erhält ein Setup-Zeitbudget, damit Parallelität nicht als angeblicher
Produktfehler erscheint; die eigentlichen Verhaltenstests behalten ihr normales
Zeitlimit. Es wurden keine fehlgeschlagenen Assertions abgeschwächt, um den
Gesamtcheck grün zu bekommen.

## 6. Ausgeführte Prüfungen

| Prüfung                     | Ergebnis / Grenze                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm check`                | Vollständiger Gesamtcheck bestanden: Assets, Editor-Regeln, i18n, Notices, Katalog, Connectivity-Regeln, Format, Lint, Typen, Pakettests und Builds.                                                         |
| Pakettests                  | 2.004 Tests; Ausgangsreview 1.901, somit 103 zusätzliche Tests.                                                                                                                                              |
| Script-Tests im Gesamtcheck | 22 zusätzliche Node-Testfälle; davon fünf neue i18n-Scannerfälle.                                                                                                                                            |
| `pnpm backup:stress`        | Großer Datei-Roundtrip in zwei Prozessen bestanden; keine native Gerätebehauptung.                                                                                                                           |
| `pnpm version:check`        | Alle Version-Manifeste synchron auf `0.5.179`.                                                                                                                                                               |
| `pnpm audit --prod --json`  | Bestanden, alle Schweregrade 0.                                                                                                                                                                              |
| Xcode Release / Debug       | Unsigned Simulatorbuilds bestanden; kein signiertes Gerätearchiv oder TestFlight-Nachweis.                                                                                                                   |
| Browser-Sichtprüfung        | Zum Berichtsstand blockiert: Mac gesperrt; In-App-Browser reagierte nicht auf Navigation/Fokussierung. Der lokale Server lieferte die App, aber es gibt keinen daraus abgeleiteten aktuellen Layoutnachweis. |

Paketaufteilung: Web 1.015, API 329, Domain 277, Direct-Connect-Webstack 198,
Sync 99, API-Client 29, Apple 17, i18n 14, Scheduler 11, Peer-Transfer 6,
Package-Format 5, Admin 4. Der Debug-Build erlaubt den vorhandenen nativen
iCloud-Transport für Abnahmen; der Release-Build bleibt ausdrücklich mit
`FNFCloudLibraryEnabled = false` gesperrt, bis die Geräteabnahme erfolgt.

Ein eigener, frisch angelegter iOS-27-Simulator akzeptierte Installation und
zwei Startaufrufe des Release-Builds (PID 99123, anschließend PID 1259).
Das belegt ausschließlich den nativen Installations-/Prozessstart; ohne gerenderte Oberfläche wird daraus
kein erfolgreicher Lernpfad, SQLite-Force-Quit-Test oder UI-Abnahmenachweis.
Der eigens angelegte Testsimulator wurde nach der Prüfung entfernt.

Der letzte gesonderte `pnpm build` bestand ebenfalls. Der Apple-Build ist nun
explizit von Turbo-Caching ausgenommen: Capacitor-Synchronisierung verändert
native Projektartefakte und lässt sich nicht durch einen Cache ohne passende
Outputs ersetzen. Der Nachweis zeigt zwölf wiederverwendete Builds und den
bewusst ausgeführten Apple-Build; die bisherige No-Outputs-Warnung entfällt.

Die 39 bisherigen Formatbefunde wurden mechanisch behoben. Der große
Lockfile-Diff entsteht zusätzlich durch das Entfernen der unbenutzten
Expo-Abhängigkeiten. Generierte Notices bleiben bytegenau durch ihren Generator
geprüft und werden nicht anschließend von Prettier umgeschrieben. Next.js darf
im Dev-Modus die gepflegten Projektanweisungen nicht automatisch überschreiben;
die dokumentierte `agentRules: false`-Option verhindert dies.

## 7. Aktualisierter Status des Ausgangsreviews

| Früherer Punkt                       | Aktueller Status                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 Architekturkonflikt               | Durch bestätigte Produktentscheidung und ADR 0054 aufgelöst.                                                                                                                    |
| R2 Manual-only-/Runtime-Widerspruch  | Aktivierungs- und Ereignisgrenze vereinheitlicht; Start-/Consent-Fehler korrigiert.                                                                                             |
| R3 Physische Datenintegritätsabnahme | Bleibt offen; reale SQLite-Engine und separate Backup-Prozesse verbessern den Nachweis, ersetzen iOS-Force-Quit und zwei Geräte nicht.                                          |
| R4 Betreiber-/Legal-Angaben          | Auf ausdrücklichen Wunsch vor Wirkbetriebsaufnahme zurückgestellt; kein Hindernis für diesen technischen Auftrag.                                                               |
| R5 Store-/Accessibility-Abnahme      | Aktuelle gerenderte Sichtprüfung, VoiceOver, größere Texte, iPad/Rotation/Mac und signiertes Archive/TestFlight bleiben offen.                                                  |
| R6 Große Sicherungen                 | Größenvertrag, segmentierter Dateipfad, Staging-Fehlersicherheit und großer automatisierter Roundtrip umgesetzt. Tatsächliche Gerätespeicher-/Share-Sheet-Abnahme bleibt offen. |
| R7 Abhängigkeitsadvisories           | Produktionsaudit nun ohne gemeldete Befunde. Vollständiger Dev-Audit benötigt die ausstehende zusätzliche Freigabe.                                                             |
| R8 Gesamtcheck und Sprache           | Gesamtcheck besteht, Format und Scanner konsistent, Locale-/Settings-Races und Sprachprobleme korrigiert.                                                                       |

## 8. Was zur belastbaren Release-Abnahme noch nachzuweisen ist

Die offenen technischen Punkte sind konkrete Nachweislücken, keine pauschale
Behauptung über unbekannte Fehler. Die ausgeführten Prüfungen rechtfertigen einen
wesentlich besser abgesicherten Entwicklungsstand, aber noch keine vollständige
öffentliche Release-Freigabe.

Erforderlich bleiben der echte Lern-/Settings-/Backup-Weg im gebündelten iOS-WebView
und bei iPhone-/iPad-Layouts, Offline-Coldstart und Force-Quit mit fortgesetztem
Lernstand, große Originalmedien-Recovery auf einem frischen zweiten Gerät sowie
iCloud-Unterbrechungen, Konflikte, Wiederzustellung, Löschmarker und Account-Wechsel
auf zwei physischen Geräten. Für Store-Distribution gehören anschließend ein
signiertes Archive und TestFlight-Nachweise dazu. Betreiber-/Store-Fakten folgen
gemäß der vereinbarten Reihenfolge vor Wirkstart.

## 9. Reproduzierbare Nachprüfung und Primärquellen

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm version:check
pnpm audit --prod --json
pnpm backup:stress
pnpm --filter @flashcards/direct-connect-webstack exec vitest run src/native-sqlite-real.test.ts
```

Die native Build-Anleitung steht in `docs/operations/mobile-release.md`, die
physische Abnahmematrix in `docs/quality/test-matrix.md`. Die mitgelieferte
`verification.json` enthält die kompakten Ergebnisse und Grenzen, ohne private
Bibliotheksdaten oder Zugangsdaten.

- [pnpm: Overrides](https://pnpm.io/10.x/settings): gezieltes Entfernen eines optionalen Unterpakets mit `-`.
- [Node.js: SQLite](https://nodejs.org/api/sqlite.html): integrierte SQL-Engine und Versionen ihrer Verfügbarkeit.
- [GitHub-Advisory zu DOMPurify](https://github.com/advisories/GHSA-p98j-92pf-mc4p): Befund im Produktionsaudit vor dem Versionsoverride.
