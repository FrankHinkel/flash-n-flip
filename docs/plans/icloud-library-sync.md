# Plan: iCloud-Bibliothek und Lernfortschritte

Stand: 2026-09-06. Neuplanung auf ausdruecklichen Wunsch des Nutzers.
Status: Umsetzungsvorschlag, keine bereits implementierte oder abgenommene Funktion.

## 1. Gewuenschtes Ergebnis

Flash-n-Flip speichert die persoenliche Bibliothek mit geladenen Decks, Karten,
Medien und Lernfortschritten in der privaten iCloud-Datenbank des Nutzers.
Apple-App und angemeldete PWA greifen auf dieselben Daten zu. Lernen bleibt
offline moeglich; SQLite beziehungsweise IndexedDB bleiben die lokalen Stores.

- Auf einem neuen Geraet erscheinen die vorhandenen Decks mit ihrem Lernstand.
- Deckinhalte und Medien lassen sich fuer die Offline-Nutzung herunterladen.
- Neu importierte und bearbeitete Decks werden nach aktivierter Verknuepfung
  automatisch hochgeladen; der Uploadstatus bleibt sichtbar.
- Entfernen eines lokalen Downloads, Abmelden und erneutes Herunterladen
  setzen den Lernfortschritt nicht zurueck.
- Pro Karte gewinnt der zeitlich letzte Lernfortschritt, auch wenn ein aelteres
  Ereignis erst spaeter hochgeladen wird.
- Endgueltiges Verwerfen von Fortschritten ist eine ausdrueckliche, auch in
  iCloud wirksame Loeschaktion. Ein lokaler Reset darf diese Regel nicht umgehen.

## 2. Belegter Ausgangspunkt

Pianoforte implementiert den Browserzugang in
`/Users/frank/Documents/Pianoforte/src/platform/web-cloud-library.ts`:
CloudKit JS, Apple-Anmeldung, private Datenbank, Bibliotheksabfrage mit
Paginierung, Assets und Loeschmarkierungen. Die aktuelle README beschreibt
denselben Zugang fuer Web und native App. Die aeltere ADR 0007 bezeichnet den
Browser noch als lokal; dieser Teil ist gegenueber dem Code veraltet.

Pianoforte synchronisiert laut README keine Uebungseinstellungen. Sein
Bibliothekszugang ist eine geeignete Referenz; die benoetigte Synchronisation
der Kartenlernstaende muss fuer Flash-n-Flip zusaetzlich entwickelt werden.
Auch der dortige Wiederholungsversuch nach einem Schreibkonflikt ist kein
Ersatz fuer die hier geforderten fachlichen Konfliktregeln.

Flash-n-Flip hat bisher einen deaktivierten nativen Cloud-Backup-Adapter in
`packages/direct-connect-webstack/src/apple-cloud-backup.ts`. Der vorhandene
Snapshot-Wiederherstellungspfad setzt einen leeren lokalen Bestand voraus.
Er eignet sich nicht fuer den laufenden Abgleich zweier befuellter Geraete.
Bestehende Review-, Deckloesch- und Fortschrittsreset-Einstiege liegen unter
anderem in `apps/web/lib/local-product-repository.ts`.

## 3. Architekturentscheidung

Vor der Implementierung eine neue ADR anlegen und die widersprechende
Projektvorgabe zur ausschliesslichen WebRTC-Replikation gezielt aktualisieren.
Empfehlung: Bei aktivierter iCloud-Verknuepfung ist iCloud die dauerhafte
gemeinsame Replikationsablage dieser Bibliothek. Die Anwendung schreibt zuerst
lokal und synchronisiert danach. Es gibt keine zweite, abweichende
Konfliktaufloesung fuer denselben Bestand.

Bestehendes WebRTC fuer eine verknuepfte Bibliothek erst nach erfolgreicher
Erstuebertragung auf allen beteiligten Geraeten stilllegen. Vorher vorhandene
Mutations-IDs und ausstehende Aenderungen uebernehmen. Alte Clients duerfen
diese Bibliothek danach nicht weiter mit alten Reset- oder Loeschregeln
beschreiben; dafuer eine explizite Protokoll-/Migrationsgrenze vorsehen.
Unverknuepfte lokale Bestaende behalten ihren bisherigen Betrieb.

Gemeinsame Schemas und Konfliktregeln gehoeren in Domain/Sync. Native CloudKit-
und Web-CloudKit-JS-Zugriffe implementieren denselben Adaptervertrag. Die VPS
speichert weiterhin keine privaten Bibliotheksdaten und vermittelt auch keine
Apple-Anmeldedaten. Familienfreigabe bleibt ausserhalb dieses Vorhabens.

## 4. Bibliothek und Identitaeten

Getrennte Datensaetze fuer Bibliotheksgeneration, Deck-Metadaten,
Inhaltsrevisionen, Kartenidentitaeten, Lernereignisse, aktuellen Kartenlernstand,
Medienreferenzen und Loeschmarkierungen vorsehen.

- Deck- und Karten-IDs bleiben bei Download, Wiederherstellung und Updates
  stabil. Medien erhalten Inhaltspruefsummen zur Integritaetspruefung und
  Deduplizierung. Ein Dateihash allein ist keine Kartenidentitaet.
- Deckhierarchie, eigene Bearbeitungen, Vorlagen und alle zum Lernen noetigen
  Inhalte sichern. Nur die urspruengliche APKG-Datei zu speichern reicht nicht.
- Gleiches Ursprungsdeck auf zwei bestehenden Geraeten anhand belegbarer
  Herkunft zuordnen. Mehrdeutige oder bewusst getrennte Kopien erhalten;
  keinesfalls nach Titel oder Kartenposition automatisch zusammenlegen.
- Inhaltsrevisionen versioniert publizieren. Gleichzeitige widersprechende
  Bearbeitungen erhalten eine Konfliktkopie statt stillen Datenverlusts.
- Medien separat und in begrenzten, wiederaufnehmbaren Arbeitseinheiten
  uebertragen. Erst ein vollstaendiges, geprueftes Manifest macht eine Revision
  als herunterladbar beziehungsweise offline verfuegbar sichtbar.
- Bibliotheksliste und Lernstand automatisch abgleichen. Grosse Medienpakete
  auf weiteren Geraeten standardmaessig bei Download laden, wie bei Pianoforte.
- Lernrelevante Konfiguration mit dem Zustand konsistent speichern;
  geraetespezifische Darstellung, Audioausgabe und Downloadauswahl lokal lassen.

## 5. Konfliktregel fuer Lernfortschritte

Jede Bewertung schreibt in einer lokalen Transaktion ein unveraenderliches
Review-Ereignis, den vollstaendigen daraus resultierenden Schedulerzustand und
einen dauerhaften Outbox-Eintrag. Erfasst werden mindestens Ereignis-ID,
Karten-ID, Deckgeneration, Bewertungszeitpunkt in UTC, Zeitzone, Bewertung,
Scheduler-/Parameterversion sowie Vorher-/Nachherzustand.

Der aktuelle Zustand einer Karte ist der Nachherzustand des gueltigen Reviews
mit dem neuesten `reviewedAt`. Bei exakt gleicher Zeit entscheidet die stabile
Ereignis-ID deterministisch. Diese Regel gilt ausschliesslich innerhalb
derselben Karten- und Deckgeneration. Uploadzeit und Cloud-Aenderungsdatum
entscheiden nicht ueber den Lernfortschritt.

Beispiel: iPhone bewertet Karte A um 10:00, iPad um 10:05. Das iPhone sendet
erst um 11:00. Trotzdem bleibt der Zustand von 10:05 aktuell. Eine Bewertung
von Karte B beeinflusst A nicht.

Alle unterschiedlichen Review-Ereignisse bleiben fuer Verlauf und Statistik
erhalten und werden anhand ihrer ID genau einmal gezaehlt. Der Scheduler darf
beim Zusammenfuehren nicht stillschweigend einen anderen aktuellen Zustand
durch Neuberechnung aller konkurrierenden Bewertungen erzeugen. Ein verlorener
Zustandsindex wird aus dem Gewinnerereignis wiederhergestellt.

Bei Cloud-Schreibkonflikten erneut lesen, fachlich vergleichen und bedingt
schreiben. Keine erzwungenen Ueberschreibungen. Nach einem Abbruch zwischen
Ereignisablage und Zustandsaktualisierung muss der naechste Lauf den Zustand
reparieren koennen. Bestehende Lernstaende ohne vollstaendige Ereignishistorie
als gekennzeichnete Migrationsbasis erhalten, ohne aktuelle Reviewzeiten zu
erfinden.

Zeitgrenze: Bei beliebig falsch gestellten Offline-Geraeteuhren ist die real
letzte Bewertung nicht sicher feststellbar. Online bekannte Zeitabweichungen
erkennen und fuer neue Ereignisse beruecksichtigen; gespeicherte Zeiten nicht
nachtraeglich umschreiben. Auffaellige Zukunftszeiten sichtbar behandeln und
nicht unbemerkt dauerhaft alle folgenden Bewertungen verdrängen lassen.
Diese Grenze gehoert zur Abnahme, nicht nur in einen Implementierungskommentar.

## 6. Entfernen, Zuruecksetzen und Loeschen

| Aktion                    | Verhalten                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Download entfernen        | Nur lokale Deckinhalte und entbehrliche Medien entfernen; Bibliothekszuordnung, Fortschritte und ausstehende Aenderungen behalten. |
| Aus Lernplan nehmen       | Nur die Teilnahme am Lernplan aendern.                                                                                             |
| Von iCloud abmelden       | Sync stoppen; lokalen Bestand und zugeordneten Account erhalten.                                                                   |
| Fortschritt zuruecksetzen | Ausdruecklich als Loeschen des Fortschritts auch in iCloud bestaetigen; Deck und Medien erhalten.                                  |
| Deck aus iCloud loeschen  | Deck, zugehoerige Lernfortschritte und nicht anderweitig benoetigte Medien geraeteuebergreifend entfernen.                         |

Nicht hochgeladene Originalinhalte duerfen beim Entfernen eines Downloads nicht
als vermeintlich wiederherstellbarer Cache verschwinden. Lokale Loeschwuensche
offline dauerhaft vormerken, aber die einzige Fortschrittskopie erst nach
bestaetigter Cloud-Loeschung verwerfen. Bis dahin klar als ausstehend anzeigen.

Eine minimale Loeschmarkierung beziehungsweise neue Fortschrittsgeneration
verhindert, dass ein lange offline gewesenes Geraet alte Daten wiederbelebt.
Auch gleichzeitig eintreffende Reviews gegen diese Generation pruefen.
Ein bewusst neuer Import nach endgueltiger Loeschung beginnt mit neuer
Deckgeneration. Geteilte Medien erst ohne verbleibende Referenzen bereinigen.

Bei vollstaendigem Loeschen der App-Daten ausserhalb der Anwendung kann auch
die Loeschmarkierung fehlen. Eine zuvor verknuepfte, nun fehlende Cloud-
Bibliothekskennung deshalb nicht automatisch neu befuellen: Synchronisation
anhalten und Wiederherstellung als bewusste Nutzeraktion behandeln. Ein
Netzwerkfehler ist niemals ein Beleg fuer eine entfernte Bibliothek.

## 7. Anmeldung, Datenschutz und Betrieb

Pianofortes Anmeldemuster fuer die PWA uebernehmen, mit eigenem Flash-n-Flip-
Container, passenden API-Tokens, erlaubten Web-Urspruengen und dokumentierten
Development-/Production-Umgebungen. Native App und PWA muessen dieselbe
Umgebung verwenden. Signing, Entitlements, Schema und benoetigte Indizes vor
der Aktivierung mit dem tatsaechlichen Apple-Team pruefen; der alte Personal-
Team-Kommentar belegt nicht die heute vorhandene Konfiguration.

Accountwechsel isolieren: Noch ausstehende Daten von Account A niemals unter
Account B hochladen. Laufende Anfragen an Account und Sitzung binden und bei
Abmeldung abbrechen beziehungsweise ihre Ergebnisse nicht falsch anwenden.

Geplante Basis ist die private CloudKit-Datenbank wie bei Pianoforte. Die
vorhandene Backup-Verschluesselung mit iCloud-Keychain-Schluessel darf nicht
einfach fuer die PWA vorausgesetzt werden. Private CloudKit-Speicherung nicht
als eigene Ende-zu-Ende-Verschluesselung bezeichnen. Bestehende verschluesselte
Backups unveraendert erhalten; eine Uebernahme erfolgt ueber einen Client, der
sie legitim entschluesseln kann. Falls eigene E2E-Verschluesselung beibehalten
werden soll, ist ein browserfaehiger Schluessel- und Wiederherstellungspfad
vor Aktivierung zusaetzlich zu spezifizieren.

Abgleich nach lokalen Aenderungen, Anmeldung, App-Aktivierung, Netzrueckkehr
und manuellem Aktualisieren; Wiederholungen mit begrenztem Backoff. Keine
permanente Hintergrund-Pollingschleife. Sichtbare Aenderungen zwischen zwei
bereits offenen Clients ueber einen geprueften Benachrichtigungsweg oder einen
begrenzten Vordergrundabgleich nachfuehren. Bei geschlossener PWA keinen
garantierten Hintergrundabgleich versprechen.

Die UI unterscheidet lokal gespeichert, Upload ausstehend, in iCloud gesichert,
Download verfuegbar und Fehler. Speichermangel, abgelaufene Anmeldung und
Teiluebertragungen duerfen nie als erfolgreicher Sync erscheinen.
Datenschutzerklaerung und bisherige Aussage "keine CloudKit-Uebertragung"
zusammen mit dem tatsaechlichen Datenfluss aktualisieren.

## 8. Umsetzung in abnehmbaren Schritten

1. Architektur und Verträge: ADR, Projektvorgaben, gemeinsame Schemas,
   Identitaets-/Generationsregeln und deterministische Merge-Testfaelle.
2. Apple-Zugang: eigene Konfiguration, native und PWA-Anmeldung, Accountbindung
   und kleiner geraeteuebergreifender Schreib-/Lesetest im Testcontainer.
3. Deckbibliothek: ein vorhandenes Deck samt Hierarchie, Bearbeitungen und
   Medien hochladen, auf zweitem Client anzeigen, herunterladen und offline
   oeffnen. Uploadfortsetzung nach Prozessabbruch nachweisen.
4. Lernfortschritt: dauerhafte Outbox, Review-Transfer, Gewinnerzustand pro
   Karte, Statistik und Wiederherstellung nach Abbruch integrieren.
5. Loeschregeln: Downloadentfernung, cloudweiter Reset, Deckloeschung,
   Generationsschutz und Accountwechsel durchgaengig implementieren.
6. Bestandsmigration: lokale Sicherung, Zuordnung bestehender Identitaeten,
   zusammenfuehrender Erstabgleich auch bei befuellter Cloud und schrittweise
   Uebertragung mit dauerhaftem Fortschrittsmarker. Erst nach bestaetigter
   Uebertragung alten Sync fuer den Bestand stilllegen. Bei Fehlern lokal
   weiterarbeiten; kein destruktiver Rollback auf veraltete Snapshots.
7. Produktintegration: Cloudstatus und Aktionen in Einstellungen/Bibliothek,
   Datenschutztexte und Betriebsdokumentation; danach vollstaendige Abnahme.

Voraussichtlich betroffene Bereiche: `packages/domain`, `packages/sync`,
Cloud-/Repository-Adapter in `packages/direct-connect-webstack`,
`apps/web/lib/local-generation.ts`, `apps/web/lib/local-product-repository.ts`,
Bibliotheks-/Einstellungsoberflaechen, Apple-Plugin/Entitlements und Dokumentation.
Die genaue Dateiliste wird pro Umsetzungsschritt vor dem Editieren festgelegt.

## 9. Verbindliche Abnahme

- iPhone und installierte Safari-PWA mit demselben Account: echtes Anmelden,
  Importieren, Uebertragen, Herunterladen und Lernen auf beiden Seiten.
- Zusaetzlich iPad beziehungsweise zweiter Browserclient; Bildschirmpruefung
  im iPhone-Format und in der nativen iOS-WebView.
- Gleiche Karte offline unterschiedlich bewerten und in beiden Upload-
  Reihenfolgen synchronisieren: identischer Gewinnerzustand auf allen Clients.
- Unterschiedliche Karten parallel lernen: beide Fortschritte bleiben erhalten.
- Doppelte Zustellung, gleiche Zeitstempel, falsche Uhr, grosse Historie und
  Zustandsrekonstruktion ohne doppelte Statistik pruefen.
- App nach lokalem Speichern sowie waehrend Upload, Download und Loeschung
  beenden und neu starten: keine verlorenen bestaetigten Aktionen.
- Download entfernen und erneut laden: unveraenderter Lernstand.
- Cloudweiter Reset und Deckloeschung bei offline gebliebenem Zweitgeraet:
  keine Wiederbelebung durch dessen alte Outbox.
- Abmeldung, Accountwechsel und ausserhalb der App geleerte Cloud: kein
  Uebertragen an den falschen Account und keine automatische Wiederbefuellung.
- Cloud voll, Netzabbruch, abgelaufene Anmeldung und Teilfehler: Daten lokal
  erhalten, Wiederaufnahme moeglich, Status korrekt.
- Zwei bereits befuellte Geraete migrieren; mehrdeutige Deckkopien erhalten.
  Neuinstallation aus iCloud inklusive Medien und Lernstand wiederherstellen.

Unit-/Integrationstests allein belegen keine native/PWA-Paritaet. Aktuell wurden
fuer diesen Plan Quellen gelesen, aber keine Live-iCloud-, Build- oder
Geraetetests ausgefuehrt. Containerzugriff, Signing und Produktionskonfiguration
sind offene Voraussetzungen fuer die spaetere Umsetzung und echte Abnahme.

## 10. Referenzen

- Pianoforte: `src/platform/web-cloud-library.ts`, `README.md`,
  `docs/architecture/decisions/0007-private-cloudkit-score-library.md`
  im ausschliesslich lesend betrachteten Referenzprojekt.
- Flash-n-Flip: bestehende Cloud-Backup-/Bootstrap-Pfade,
  `apps/web/lib/local-product-repository.ts`,
  `packages/sync/src/peer-conflicts.ts` und Projektvorgaben.
- [Apple: CloudKit JS](https://developer.apple.com/documentation/cloudkitjs).
- [Apple: Modifying Records](https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/ModifyRecords.html):
  bedingte Updates mit `recordChangeTag`, individuelle Operationsergebnisse
  und begrenzte Anwendbarkeit atomarer Requests. Der Plan setzt keine atomare
  Gesamtbibliotheksuebertragung voraus.

## 11. Ausfuehrungsstand 2026-09-06

Schritt 1 ist als ADR 0052, gemeinsame Schemas, Konflikt-/Generationsregeln
und automatisierte Vertragstests umgesetzt. Schritt 2 enthaelt einen
CloudKit-JS-Anmelde-/Record-Adapter und einen deaktivierten nativen
CloudKit-Record-Adapter. Die echte Apple-Konfiguration und der native/PWA-
Schreib-/Lesetest sind noch offen. Der Nutzer wurde nach Containerzugang,
Web-API-Token und zugelassenen Urspruengen gefragt.

Die Schritte 3 bis 7 sind noch nicht abgeschlossen. Insbesondere fehlen die
produktive Repository-/Outbox-Anbindung, Deck-/Medienuebertragung, Migration,
Loeschbereinigung und Benutzeroberflaeche. Die neue Synchronisation ist nicht
aktiviert. Details und Nachweise stehen in `docs/icloud-library-setup.md`.
