# Flash-n-Flip V1.0 Showstopper

Stand: 2026-08-26 · geprüfter Quellstand: 0.5.148

Dieses Dokument ist die verbindliche V1.0-Gate-Liste. Ein Punkt ist erst
abgeschlossen, wenn nicht nur Quellcode vorhanden ist, sondern die genannte
Abnahme auf dem realen Zielpfad bestanden wurde.

## Status und Arbeitsweise

- `BLOCKER`: verhindert V1.0.
- `OFFEN`: erforderlich, aber noch nicht vollständig untersucht oder umgesetzt.
- `EXTERN`: benötigt eine externe Entscheidung, Freigabe oder Infrastruktur.
- `OPTIONAL`: kein V1.0-Blocker, solange ausdrücklich auf eine spätere Version
  verschoben.
- `ERLEDIGT`: Abnahmekriterien und Evidenz sind im Punkt dokumentiert.

Es wird immer nur der oberste nicht abgeschlossene Punkt der Reihenfolge
bearbeitet. Jeder Abschluss ergänzt Datum, Commit, Testbefehle und reale
Geräteabnahme. Unit- oder Strukturtests allein reichen bei Sync,
Persistenz, Medien und UI nicht aus.

## V1.0-Zielbild

V1.0 startet Apple-only als App auf iPhone und iPad; Apple-Silicon-Macs nutzen
zunächst die kompatible iPad-App. SQLite und lokaler Medienspeicher sind
maßgeblich. Web/PWA bleibt im Repository erhalten, ist aber ebenso wie Android,
Windows, öffentliche Community, CloudKit-Familienbibliotheken und JSXGraph 3D
nicht Teil des V1.0-Kerns. Die Apple-App startet und arbeitet ohne
`flash-n-flip.com`, PWA-Server, Rendezvous, STUN oder WebRTC-Synchronisation.

## Priorisierte Arbeitsreihenfolge

| Reihenfolge | ID    | Gate                                                           | Status           |
| ----------: | ----- | -------------------------------------------------------------- | ---------------- |
|           1 | V1-01 | V1-Scope festschreiben                                         | BLOCKER          |
|           2 | V1-02 | Datenintegrität, Backup und Recovery beweisen                  | BLOCKER          |
|           3 | V1-03 | Produktoberfläche vollständig internationalisieren             | BLOCKER          |
|           4 | V1-04 | Medienkarten vollständig erstellen, bearbeiten und übertragen  | BLOCKER          |
|           5 | V1-05 | Kritische Layout-, Accessibility- und Kontrastfehler schließen | BLOCKER          |
|           6 | V1-06 | Online-Hilfe und FnF-Help inklusive Unterlagen ausbauen        | BLOCKER          |
|           7 | V1-07 | Import, Export, Migration und Interoperabilität abnehmen       | BLOCKER          |
|           8 | V1-08 | Sicherheit und private Medien abnehmen                         | BLOCKER          |
|           9 | V1-09 | Recht, App Store und Betrieb finalisieren                      | BLOCKER / EXTERN |
|          10 | V1-10 | Performance, Speicher, Akku und Stabilität abnehmen            | BLOCKER          |
|          11 | V1-11 | Abo-Modell entscheiden und gegebenenfalls umsetzen             | OFFEN / OPTIONAL |
|          12 | V1-12 | iCloud-Semantik entscheiden                                    | BLOCKER / EXTERN |
|          13 | V1-13 | iCloud auf realen Apple-Geräten aktivieren und abnehmen        | BLOCKER / EXTERN |
|          14 | V1-14 | Release Candidate auf allen Zielpfaden abnehmen                | BLOCKER          |

---

## V1-01 · V1-Scope festschreiben

Status: **BLOCKER**

- [x] V1.0-Plattformen und ausdrücklich verschobene Funktionen schriftlich
      bestätigen: Apple-only; Web/PWA, Android und Windows nach V1.0.
- [x] Öffentliche Community-Funktionen bleiben in V1.0 deaktiviert.
- [x] PWA-, Rendezvous-, STUN-, WebRTC- und Peer-Webstack-Pfade aus dem
      Apple-Build entfernen; Quellcode für eine spätere Web/PWA-Neubewertung
      erhalten.
- [x] iCloud wird erst nach Abschluss der übrigen Gates in V1-12 und V1-13
      bearbeitet; der kostenpflichtige Apple Developer Account wird dann
      eingerichtet.

Abnahme: eine unveränderliche V1.0-Scope-Liste mit klarer Arbeitsreihenfolge.

## V1-02 · Datenintegrität, Backup und Recovery

Status: **BLOCKER**

Aktueller Befund: Die automatisierte Recovery-Basis deckt Decks, Karten,
Medienbytes, Reviews, Einstellungen und die persistente Outbox ab. Ein
unterbrochener Restore kann bereits vollständig geschriebene Backup-Medien
fortsetzen; bei einem Fehler werden neu bereitgestellte Medien wieder entfernt.
FNF-Roundtrips vergleichen zusätzlich Hierarchie, Kartenanzahl und exakte
SHA-256-Medienmengen. Die reale SQLite-/Apple-Geräteabnahme und die vollständige
Vorversions-Migrationsmatrix stehen weiterhin aus.

- [x] Offline-Persistenz für Decks, Karten, Medien und Reviews sowie deren
      Wiederöffnung im automatisierten lokalen Repository-Test abdecken.
- [x] Atomare lokale Mutationen, append-only Reviews, Tombstones, dauerhafte
      Outbox und unterbrochene Medien-Restores automatisiert absichern.
- [ ] SQLite-/IndexedDB-Schema-Upgrades von jeder unterstützten Vorversion
      proben; Abbruch und Rollback dokumentieren.
- [x] Vollständigen lokalen FNF-Export mit Hierarchie, Karten und exakten
      Medienbytes automatisiert als Recovery-Weg prüfen.
- [ ] Backup-Restore und Release-Rollback auf realer SQLite-/Apple-Hardware
      proben, nicht nur automatisiert beschreiben.

Abnahme: keine stille Datenlöschung, keine doppelten Reviews und identische
fachliche Zustände nach Neustart sowie nach Export und Restore.

Automatische Evidenz: `pnpm check`,
`packages/direct-connect-webstack/src/local-app.test.ts` und
`apps/web/lib/local-product-repository.test.ts` am 2026-08-26. Reale
SQLite-/Geräteevidenz: noch offen.

## V1-03 · UI-Sprachen EN, DE, ES und FR

Status: **BLOCKER**

Aktueller Befund: Die kanonische Produktoberfläche besitzt jetzt einen
typisierten, key-basierten Katalog für `en`, `de`, `es` und `fr`. Der
CI-Audit schlägt bei fehlenden Sprachwerten, abweichenden Platzhaltern,
Inline-Übersetzungspaaren und sichtbaren hartcodierten JSX-Texten fehl. Ein
responsiver Browser-Smoke-Test bestätigte alle vier Sprachen bei 390 px und
Desktopbreite ohne horizontalen Überlauf. Fachliche Übersetzungsprüfung,
VoiceOver, 200-%-Zoom und reale iPhone-/iPad-Abnahme bleiben offen.

- [x] Ein key-basiertes, typisiertes Übersetzungssystem als einzige Quelle
      festlegen; Komponenten dürfen keine neuen Inline-Paare mehr anlegen.
- [x] EN und DE migrieren sowie ES und FR im kanonischen Katalog ergänzen.
- [x] Navigation, Editor, Lernen, Import, Einstellungen, Sync, Fehler,
      Bestätigungen, leere Zustände, Help und Accessibility-Namen abdecken.
- [x] Datums-, Zahlen-, Größen-, Plural- und Sprachbezeichnungen über die
      Locale-Helfer beziehungsweise semantische Katalog-Keys führen.
- [x] Fehlende Keys, Platzhalterabweichungen, Inline-Paare und sichtbare
      hartcodierte JSX-Texte in CI fehlschlagen lassen.
- [ ] Übersetzungen fachlich prüfen; rechtliche Texte separat qualifiziert
      prüfen lassen.
- [ ] 390 px, iPad, Desktop, 200 % Zoom und große iOS-Schrift mit langen
      französischen/deutschen Texten abnehmen.

Abnahme: automatischer 100-%-Key-Report sowie visueller Smoke-Test aller vier
Sprachen auf iPhone und iPad.

Evidenz: `packages/i18n/src/index.ts`,
`apps/web/components/i18n-provider.tsx`, `pnpm i18n:check` und Browser-Smoke-Test
am 2026-08-26 bei 390 × 844 sowie 1024 × 768. Reale Apple-Geräteevidenz: noch
offen.

## V1-04 · Medienkarten vollständig erstellen und bearbeiten

Status: **BLOCKER**

Aktueller Befund: Der normale Karteneditor kann Bilder lokal importieren oder
über die Kamera übernehmen, drehen, mittig zuschneiden, komprimieren und mit
Alt-Text/dekorativem Status versehen. Audio kann lokal importiert oder direkt
aufgenommen, vorgehört, benannt, transkribiert und verlustfrei als WAV gekürzt
werden. Medien und Kartenmutation werden atomar gespeichert; eine anschließende
Bereinigung löscht ausschließlich global unreferenzierte Medien. **Die reale
iPhone-/iPad-Abnahme, große FNF-Roundtrips und Formatmatrix bleiben offen.**

- [x] Bild aus Datei/Fotomediathek/Kamera hinzufügen; drehen, zuschneiden,
      komprimieren und Alt-Text bzw. dekorativen Status setzen.
- [x] Audio aus Datei hinzufügen und direkt aufnehmen; benennen, vorhören,
      ersetzen, trimmen und optional transkribieren.
- [x] Video nur aufnehmen, wenn Größen-, Format- und UX-Budget vertretbar sind;
      andernfalls ausdrücklich auf 1.x verschieben.
- [ ] Medienblöcke im Editor frei einfügen, sortieren, ersetzen und löschen;
      Referenzen in beiden Kartenseiten und in Tabellen unterstützen.
- [ ] MIME, Dateisignatur und decodierten Inhalt getrennt prüfen; Grenzen für
      Einzeldatei, Deck und Import definieren.
- [ ] HEIC/JPEG/PNG/WebP/GIF sowie AAC/M4A/MP3/WAV/OGG auf iPhone und iPad
      mit dokumentierter Konvertierungsstrategie testen.
- [x] Unterbrochenes Speichern darf keine Karte beschädigen; verwaiste Medien
      werden erst nach sicherer Referenzprüfung entfernt.
- [ ] FNF-Roundtrip und später iCloud-Synchronisation/-Wiederherstellung mit
      großen Medien und gleichen Hashes prüfen.
- [ ] Accessibility: Alt-Text, Audiolabel/Transkript, Videountertitel und
      tastatur-/touchbedienbare Controls.

Abnahme: eine Karte wird auf jedem Zielgerät vollständig erstellt, exportiert,
gelöscht, importiert, wiederhergestellt und wiedergegeben; private Medien werden
nie über externe URLs geladen.

Evidenz: `apps/web/components/media-block-editor.tsx`,
`apps/web/lib/local-media-editor.ts`,
`apps/web/lib/local-product-repository.test.ts`.

## V1-05 · Layout, Accessibility und Kontrast

Status: **BLOCKER**

Bekannte Teilaufgaben:

- [ ] Discover-Decks bei mittleren Breiten ohne Überlappung, unruhige
      Spaltenwechsel oder übergroße Leerflächen darstellen.
- [ ] Markdown-Tabellen mit kurzen Header-Spalten und großen Multimedia-Zellen
      in Editor und Study identisch dimensionieren.
- [ ] Lückentext-Einblendungen dürfen Tabellenbreiten nicht springen lassen.
- [ ] Alle Kernrouten bei 390 px, iPad Split View, Desktop, 200 % Zoom, Bright
      und Dark sowie größter unterstützter iOS-Schrift prüfen.
- [ ] Fixe/sticky/absolute Elemente auf Überlappung, Clipping und Safe Areas
      prüfen.
- [ ] Textkontrast mindestens 4,5:1, große Schrift 3:1; Controls, Fokus und
      bedeutungstragende Icons mindestens 3:1.
- [ ] Vollständige Tastaturbedienung, sichtbarer Fokus, VoiceOver-Namen,
      Reihenfolge und Statusmeldungen auf den Kernpfaden abnehmen.
- [ ] Reduzierte Bewegung und Touch-Ziele von mindestens 44 × 44 CSS px
      sicherstellen.

Abnahme: dokumentierte Screenshot-/Messmatrix ohne kritische Accessibility-,
Kontrast-, Überlappungs- oder Scroll-Blocker.

## V1-06 · Online-Hilfe und FnF-Help

Status: **BLOCKER**

- [ ] Online-Hilfe als kleine, kontextbezogene Hilfe öffnen; Such-/Indexansicht
      minimierbar machen und den Lernfluss nicht überdecken.
- [ ] Ein eindeutiger `(i)`-Einstieg führt aus Editor, Study, Import, Backup und
      Einstellungen direkt zum passenden Thema.
- [ ] FnF-Help zur primären, installierbaren und offline verfügbaren Referenz
      ausbauen; Online-Hilfe bleibt Einstieg und Problemlöser.
- [ ] FnF-Help vollständig auf EN und DE anbieten; ES/FR nach Abschluss von
      V1-03. Quelltext aller Mermaid-, ABC- und JSXGraph-Beispiele bleibt
      kopierbar.
- [ ] Einführungen für Markdown, Tabellen, Cloze, KaTeX/mhchem, Referenzkarten,
      Medien, Import/Export, Backup/Recovery und Accessibility ergänzen.
- [ ] Im installierbaren FnF-Help-Deck folgenden englischen und deutschen,
      vollständig offline verfügbaren Unterlagenbereich aufbauen:

  ```text
  Flash-n-Flip Help
  └── Legal & Product Information
      ├── Legal
      │   ├── Third-Party Licenses
      │   ├── Privacy & Data Flow
      │   └── Terms, Imprint & Support
      ├── Accessibility
      ├── Security & Responsible Disclosure
      ├── Data Ownership, Export, Backup & Recovery
      └── Version, Compatibility & Release Notes
  ```

- [ ] `Third-Party Licenses` aus dem installierten Produktions-Dependency-Graph
      und den Apple-Pins
      des jeweiligen Release-Commits deterministisch erzeugen, statt
      Lizenztexte manuell zu kopieren. Für jede ausgelieferte Komponente müssen
      Name, Version, Copyright/Attribution, Lizenzkennung sowie der erforderliche
      vollständige Lizenz- oder Notice-Text enthalten sein.
- [ ] JavaScript-/Web-Abhängigkeiten, Capacitor, CocoaPods-/Swift-Pakete,
      Schriften, Icons, Soundfonts, Notensatz-, Diagramm-, Mathematik- und
      Grafikbibliotheken sowie kuratierte/bündelte Assets erfassen. Fehlende,
      unbekannte oder mit der Distribution unvereinbare Lizenzen müssen den
      Release-Check fehlschlagen lassen.
- [ ] Kanonische Rechts- und Produktunterlagen in ihren fachlich zuständigen
      Quellen pflegen. FnF-Help zeigt daraus eine versionierte, generierte
      Offline-Fassung mit App-Version und Commit an, damit keine veraltete
      manuelle Zweitquelle entsteht.
- [ ] Datenschutz und Datenfluss, AGB/Impressum/Support, Accessibility,
      Sicherheitskontakt, Dateneigentum/Export/Backup/Recovery sowie
      Versions-/Kompatibilitäts-/Release-Hinweise fachlich aktuell halten;
      Rechtstexte vor Veröffentlichung qualifiziert prüfen lassen.
- [ ] Hilfe-Inhalte versionieren und beim Update ohne Duplikate aktualisieren.

Technische Evidenz: `scripts/generate-third-party-notices.mjs` erzeugt aus dem
installierten pnpm-Produktionsgraph, `Package.resolved`, Lucide-Assets und der
Soundfont-Provenienz eine gehashte Offline-Referenz mit 255 Komponenten. 13
Upstream-NPM-Pakete liefern selbst keine separate Lizenzdatei; hierfür wird die
unveränderte Paketdeklaration samt Attribution, Upstream und kanonischem SPDX-Link
ausgewiesen. Volltexte werden nicht erfunden. Die vollständige rechtliche
Release-Abnahme und die acht bekannten Legal-Blocker bleiben offen.

- [ ] Offline-, Such-, Deep-Link-, kleine Viewport- und VoiceOver-Abnahme.

Abnahme: Ein neuer Nutzer kann ohne externe Dokumentation ein Deck mit Text,
Formel, Medien und Referenzkarte erstellen, exportieren und wiederherstellen.

## V1-07 · Import, Export, Migration und Interoperabilität

Status: **BLOCKER**

- [ ] FNF ist im Öffnen-/Import-Dialog zuerst und roundtrip-stabil für alle
      aktuellen Blöcke, Medien, Referenzkarten, Deckeinstellungen und
      Lernfortschritte.
- [ ] FNF-Feature-Flags lehnen unbekannte Pflichtfunktionen verständlich ab.
- [ ] APKG-Direktöffnung mit einfacher Standardstrecke und optionalen
      Expertenoptionen auf repräsentativen realen Decks testen.
- [ ] CSV, APKG und FNF gegen große Dateien, Abbruch, wenig Speicher,
      Duplikate, Reimport und bösartige Inhalte testen.
- [ ] Exportierte Daten nach App-Löschung auf einer frischen Installation
      vollständig wiederherstellen.
- [ ] Kompatibilitätsmatrix für letzte unterstützte FNF-, Datenbank- und später
      iCloud-Sync-Protokollgeneration dokumentieren.

Abnahme: Golden Fixtures plus reale Fremddecks auf iPhone und iPad; keine
verlorenen Medien, Kartenseiten, Reihenfolgen oder Lernereignisse.

## V1-08 · Content-, Dependency- und Gerätesicherheit

Status: **BLOCKER**

- [ ] Markdown, KaTeX, Mermaid, ABC und JSXGraph gegen Script-, URL-, HTML-,
      Template- und Ressourceninjektion fuzz-/regressionstesten.
- [ ] SVG ablehnen oder sicher rasterisieren; externe Bilder, Tracking-Pixel,
      `javascript:`, gefährliche `data:`- und `file:`-URLs sperren.
- [ ] Private Medien bleiben lokal beziehungsweise ausschließlich in
      ausdrücklich gewählten, verschlüsselten Transfers.
- [ ] Das kopierte Apple-Bundle enthält weder eine ausführbare
      `https://flash-n-flip.com`-Referenz, `/rendezvous/v1`, `stun:`,
      Connect-Assets noch ein Peer-Webstack-Manifest.
- [ ] FNF-, Webstack- und kuratierte Signaturen inklusive Schlüsselrotation,
      Downgrade- und Manipulationsfällen abnehmen.
- [ ] Dependency-, Secret- und Berechtigungsscan für den Release-Commit;
      Kamera/Mikrofon/Fotomediathek nur bei tatsächlicher Nutzung anfordern.
- [ ] Bedrohungsmodell und Sicherheitskontakt aktualisieren.

Abnahme: Content-Security-Check, Dependency-Scan und manuelle Angriffsfixtures
ohne kritischen Befund.

## V1-09 · Recht, App Store und Betrieb

Status: **BLOCKER / EXTERN**

Der aktuelle Release-Check meldet folgende Pflichtblocker:

- [ ] Produktionslogs: Felder, Zugriff, Rotation und Löschfrist verifizieren.
- [ ] Löschung und Backup-Ablauf inaktiver Legacy-Daten definieren.
- [ ] Aktuellen Auftragsverarbeitungsvertrag mit netcup bestätigen.
- [ ] Betreiber-/Unternehmensstatus und gegebenenfalls zu veröffentlichende
      Steuerkennungen klären.
- [ ] EU-App-Store-DSA-Trader-Status setzen.
- [ ] Minderjährigenkonzept und Store-Altersfreigabe festlegen.
- [ ] Finale Rechtstexte qualifiziert prüfen lassen.

Zusätzlich:

- [ ] App-Store-Privacy-Labels, Support-URL, Marketing-URL, Screenshots,
      Review-Hinweise und Export-/Löschbeschreibung finalisieren.
- [ ] Monitoring, Alarmierung, Supportverantwortung, Incident Response,
      Stufenrollout und Rollback praktisch testen.
- [ ] Community nur veröffentlichen, wenn Freigabe, Meldung, Moderation,
      Begründung, Einspruch, Lizenz und Auditpfad vollständig sind.

Abnahme: `pnpm release:check` ohne Blocker, finale Store-Metadaten und
qualifizierte rechtliche Freigabe. Dieses Dokument ist keine Rechtsberatung.

## V1-10 · Performance, Speicher, Akku und Stabilität

Status: **BLOCKER**

- [ ] Kaltstart, Navigation, Editor, große Deckliste und Lernstart auf dem
      ältesten unterstützten iPhone/iPad messen und Budgets festlegen.
- [ ] 10.000 Karten, große FNF/APKG-Dateien, lange Musikstücke und viele Medien
      ohne UI-Blockade oder Speicherabsturz testen.
- [ ] Akku-/Hintergrundprofiling für Timer, Polling, Audio, Animation und
      spätere iCloud-Aktivität auf installierter App durchführen.
- [ ] SQLite-/IndexedDB-Speicherwachstum, Medien-Deduplizierung, Cache- und
      Orphan-Cleanup messen.
- [ ] Crash-, Low-Memory-, Suspend/Resume-, Flugmodus- und Prozess-Kill-Matrix
      ausführen.
- [ ] Fehler müssen verständlich, wiederholbar und ohne Datenverlust sein.

Abnahme: dokumentierte Budgets und reale Profilergebnisse; keine kritischen
Crashes, Hänger oder auffällige Hintergrundlast.

## V1-11 · Optionales Abo für etwa 2–5 Euro pro Jahr

Status: **OFFEN / OPTIONAL**

Empfehlung: **4,99 Euro/Jahr als freiwilliges „Flash-n-Flip Supporter“-Abo**.
Bei diesem Preis sind rechen- oder speicherintensive Server-/KI-Leistungen nicht
tragfähig. Das Abo darf weder lokale Eigentümerschaft noch grundlegendes
Erstellen, Lernen, FNF-Export, Recovery oder Gerätesync sperren.

Attraktiver, ehrlicher Gegenwert mit laufendem Nutzen:

- regelmäßig neue, redaktionell geprüfte FnF-Help- und Lernpakete;
- zusätzliche Themes, Deckdarstellungen und App-Icons;
- erweiterte lokale Statistiken und Übungsansichten;
- Komfortfunktionen wie gespeicherte Layout-/Importprofile;
- sichtbarer, aber unaufdringlicher Supporter-Status.

Vor Umsetzung entscheiden:

- [ ] Ist das Abo V1.0-Bestandteil oder bewusst V1.1? Ohne Entscheidung bleibt
      es kein technischer V1.0-Blocker.
- [ ] Einmaliger Kauf oder Trinkgeld als einfachere Alternative gegen das Abo
      testen; ein Abo benötigt glaubwürdigen fortlaufenden Mehrwert.
- [ ] StoreKit-2-Produkte, Kauf, Restore, Erneuerung, Ablauf, Billing Retry,
      Grace Period, Refund und Offline-Entitlement spezifizieren.
- [ ] Accountloses Entitlement über Apple-Geräte hinweg klären.
- [ ] Premium-Inhalte in FNF-Exporten und Familienfreigabe lizenzrechtlich und
      technisch entscheiden.
- [ ] Preisexperiment und Nutzertest durchführen; Support- und Inhaltskosten
      gegen Nettoerlös rechnen.
- [ ] Kaufstatus, Verwaltung/Kündigung, Datenschutz, AGB, Widerruf und
      Store-Metadaten abnehmen.

Apple verlangt bei Auto-Renewable Subscriptions einen fortlaufenden Wert und
eine Wiederherstellungs-/Verwaltungsstrecke. Für kleine Anbieter kann das App
Store Small Business Program die Provision reduzieren. Maßgeblich bleiben die
zum Release aktuellen Apple-Regeln:

- <https://developer.apple.com/app-store/subscriptions/>
- <https://developer.apple.com/app-store/review/guidelines/>
- <https://developer.apple.com/app-store/small-business-program/>

Abnahme bei Aufnahme in V1.0: StoreKit-Sandboxmatrix, Kaufwiederherstellung auf
zweitem Gerät, Ablauf/Refund/Offline-Fälle, Accessibility und rechtliche
Freigabe. Andernfalls expliziter Eintrag unter „Nach V1.0“.

## V1-12 · V1-Scope und iCloud-Semantik entscheiden

Status: **BLOCKER / EXTERN**

Dieses Gate wird bewusst erst begonnen, wenn V1-01 bis V1-11 abgeschlossen
oder ausdrücklich aus V1.0 verschoben sind. Bis dahin bleibt FNF-Export/-Restore
der unabhängige Recovery- und Übertragungsweg.

- [ ] iCloud als einzige automatische Apple-Synchronisations- und
      Recovery-Strecke verbindlich in einer aktualisierten ADR festlegen.
- [ ] Konfliktmodell, Tombstone-/Löschregeln, Medienübertragung, Cursor,
      Idempotenz und Wiederaufnahme nach Unterbrechung vollständig entwerfen.
- [ ] Nutzerverständliche Begriffe und Statusanzeigen für Backup, Restore,
      Gerätesync, letzte Sicherung und Fehlerzustände festlegen.
- [ ] Datenumfang, Verschlüsselungsgrenzen, Quoten, Aufbewahrung, Löschung und
      Verhalten beim Wechsel/Verlust des Apple Accounts dokumentieren.
- [ ] FNF-Export/-Restore als plattformunabhängigen Notfallweg beibehalten.

Abnahme: aktualisierte Architekturentscheidung ohne konkurrierende
Synchronisationsautoritäten sowie abgestimmte Produkt-, Datenschutz- und
Recovery-Semantik.

Evidenz: [ADR 0049](docs/architecture/decisions/0049-apple-only-v1-local-runtime.md);
ADR 0029 und ADR 0030 werden vor der iCloud-Umsetzung ersetzt oder aktualisiert.

## V1-13 · iCloud aktivieren und real abnehmen

Status: **BLOCKER / EXTERN**

Nach Abschluss von V1-12 wird der kostenpflichtige Apple Developer Account
eingerichtet. Erst dann werden Team, Container, Produktionsschema und
Entitlements verbindlich angelegt; vorherige lokale Simulator- oder
Strukturtests gelten nicht als reale Abnahme.

- [ ] Bezahltes Apple-Developer-Team, Team-ID, Bundle-ID und produktiven
      iCloud-/CloudKit-Container einrichten und dokumentieren.
- [ ] Produktionsschema, Entitlements und den Adapter gemäß der in V1-12
      gewählten Semantik aktivieren; Entwicklungs- und Produktionsumgebung
      getrennt halten.
- [ ] Sicherung, Löschen der App, Neuinstallation und Wiederherstellung auf dem
      Ursprungsgerät und einem zweiten physischen Apple-Gerät testen.
- [ ] Decks, Karten, Medien, Einstellungen und Lernfortschritt nach Restore
      fachlich und anhand stabiler IDs/Hashes vergleichen.
- [ ] Unterbrochenen Upload/Restore, Offline-Betrieb, volles iCloud-Kontingent,
      deaktiviertes iCloud/Keychain und Prozessabbruch ohne stille
      Datenverluste testen.
- [ ] Apple-Account-Wechsel sowie fehlende, beschädigte, veraltete,
      unvollständige und inkompatible Backups sicher und verständlich behandeln.
- [ ] Backup-Löschung, Status, Zeitpunkt, Umfang und Aufbewahrung in App und
      Hilfe transparent machen.
- [ ] Privacy Labels, Datenschutzhinweise und FnF-Help an den tatsächlich
      verifizierten Datenfluss anpassen.

Abnahme: vollständiger Backup-/Restore-Test auf mindestens zwei physischen
Apple-Geräten mit Fehler- und Unterbrechungsmatrix; Simulator- und Unit-Tests
allein reichen nicht.

Evidenz: [Mobile Release](docs/operations/mobile-release.md) und
[Accountless Plan](docs/plans/accountless-cross-platform-local-first.md).

## V1-14 · Release Candidate und Go/No-Go

Status: **BLOCKER**

- [ ] Reviewed Commit sowie Daten- und iCloud-Sync-Protokoll einfrieren.
- [ ] `pnpm check` und `pnpm release:check` ohne Blocker.
- [ ] Signiertes iOS-Archive reproduzierbar aus dem geprüften Commit erzeugen.
- [ ] Kernfluss auf iPhone und iPad: Onboarding, Erstellen, Medien, Import,
      Lernen, Referenzen, Offline, iCloud-Sync, Export, Restore und Löschen.
- [ ] Bright/Dark, EN/DE/ES/FR, 390 px, iPad Split View, 200 % Zoom und
      VoiceOver abnehmen.
- [ ] Migration, Backup-Restore, Monitoring, Support, Stufenrollout und
      Rollback praktisch proben.
- [ ] Store-Beta/TestFlight, danach 5 %, 25 % und 100 % mit Stop-Kriterien.

Go nur, wenn alle V1-Blocker `ERLEDIGT` sind. Stop/rollback bei lokaler
Datenlöschung, doppelten Reviews, nicht wiederherstellbaren Backups, privater
Medienexposition, kritischem Crash oder unbenutzbarem Kernpfad.

## Bewusst nach V1.0 verschiebbar

- Android- und Windows-Clients;
- Web/PWA einschließlich PWA-Server, Rendezvous, STUN, WebRTC und direkter
  Geräteübertragung;
- CloudKit-Familienbibliotheken/CKShare;
- öffentliche Community einschließlich Publishing und Moderation;
- JSXGraph 3D;
- Videoerstellung, falls V1-04 sie ausdrücklich verschiebt;
- Abo, falls V1-11 keine belastbare V1.0-Entscheidung erhält;
- serverbasierte KI- oder Generierungsdienste.

## Aktueller Audit-Nachweis

- Release-Readiness-Check: **nicht bestanden**, acht rechtlich/betrieblich
  offene Release-Blocker in V1-09.
- Content-Security-Strukturcheck: ohne automatischen Blocker; reale
  Medienerstellung und Angriffsfixtures bleiben offen.
- iCloud: Quelladapter vorhanden, aktuelle Release-Capability deaktiviert;
  reale Geräteabnahme offen.
- UI-Lokalisierung: kanonischer EN/DE/ES/FR-Katalog und CI-Audit vorhanden;
  fachliche Übersetzungs- sowie reale Geräte-/VoiceOver-Abnahme offen.
- Medien: Schema, Import, Wiedergabe und FNF-Roundtrip vorhanden; direktes
  Authoring im Standardeditor vorhanden; reale Geräte- und Formatmatrix offen.

## Abschlussprotokoll

Für jeden erledigten Punkt ergänzen:

```text
Status: ERLEDIGT
Datum:
Commit:
Automatische Prüfungen:
Reale Abnahme (Gerät/OS/Viewport):
Restrestrisiko:
```
