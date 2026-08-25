# Flash-n-Flip V1.0 Showstopper

Stand: 2026-08-25 · geprüfter Quellstand: 0.5.145

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
Geräte-/Browserabnahme. Unit- oder Strukturtests allein reichen bei Sync,
Persistenz, Medien und UI nicht aus.

## V1.0-Zielbild

V1.0 umfasst Web/PWA sowie die Apple-App auf iPhone und iPad; Apple-Silicon-Macs
nutzen zunächst die kompatible iPad-App. Lokale Daten bleiben in IndexedDB
beziehungsweise SQLite maßgeblich. Android, Windows, öffentliche Community,
CloudKit-Familienbibliotheken und JSXGraph 3D sind nicht Teil des V1.0-Kerns,
sofern sie nicht später ausdrücklich wieder aufgenommen werden.

## Priorisierte Arbeitsreihenfolge

| Reihenfolge | ID    | Gate                                                           | Status           |
| ----------: | ----- | -------------------------------------------------------------- | ---------------- |
|           1 | V1-01 | V1-Scope und iCloud-Semantik entscheiden                       | BLOCKER / EXTERN |
|           2 | V1-02 | iCloud auf realen Apple-Geräten aktivieren und abnehmen        | BLOCKER / EXTERN |
|           3 | V1-03 | Datenintegrität, Sync, Backup und Recovery beweisen            | BLOCKER          |
|           4 | V1-04 | Produktoberfläche vollständig internationalisieren             | BLOCKER          |
|           5 | V1-05 | Medienkarten vollständig erstellen, bearbeiten und übertragen  | BLOCKER          |
|           6 | V1-06 | Kritische Layout-, Accessibility- und Kontrastfehler schließen | BLOCKER          |
|           7 | V1-07 | Online-Hilfe minimieren und FnF-Help ausbauen                  | OFFEN            |
|           8 | V1-08 | Import, Export, Migration und Interoperabilität abnehmen       | BLOCKER          |
|           9 | V1-09 | Sicherheit und private Medien abnehmen                         | BLOCKER          |
|          10 | V1-10 | Recht, App Store und Betrieb finalisieren                      | BLOCKER / EXTERN |
|          11 | V1-11 | Performance, Speicher, Akku und Stabilität abnehmen            | BLOCKER          |
|          12 | V1-12 | Abo-Modell entscheiden und gegebenenfalls umsetzen             | OFFEN / OPTIONAL |
|          13 | V1-13 | Release Candidate auf allen Zielpfaden abnehmen                | BLOCKER          |

---

## V1-01 · V1-Scope und iCloud-Semantik entscheiden

Status: **BLOCKER / EXTERN**

Die Formulierung „iCloud-Synchronisation“ ist noch nicht eindeutig. Die
akzeptierte Architektur verwendet CloudKit nicht als zweite laufende
Sync-Autorität. Vorbereitet sind stattdessen:

- verschlüsseltes CloudKit-Backup;
- Wiederherstellung einer frischen Installation;
- automatischer Bootstrap eigener Apple-Geräte über iCloud Keychain;
- direkte, laufende Peer-Replikation über WebRTC.

Zu entscheiden:

- [ ] **Variante A (empfohlen):** iCloud übernimmt Backup, Recovery und
      Geräte-Bootstrap. Direkte Peer-Replikation bleibt der einzige Live-Sync.
- [ ] **Variante B:** Kontinuierlicher Apple-zu-Apple-Sync über CloudKit. Dafür
      sind ADR 0029/0030, Konfliktmodell, Löschsemantik, Medienübertragung und
      das Zusammenspiel mit WebRTC neu zu entscheiden und zu testen.
- [ ] V1.0-Plattformen und ausdrücklich verschobene Funktionen schriftlich
      bestätigen.
- [ ] Entscheiden, ob öffentliche Community-Funktionen in V1.0 deaktiviert
      bleiben oder vollständig inklusive Moderation veröffentlicht werden.

Abnahme: eine aktualisierte ADR und eine unveränderliche V1.0-Scope-Liste ohne
widersprüchliche Sync-Autoritäten.

Evidenz: [ADR 0029](docs/architecture/decisions/0029-accountless-cross-platform-local-first.md),
[ADR 0030](docs/architecture/decisions/0030-apple-bootstrap-cloudkit-recovery-and-peer-webstack.md).

## V1-02 · iCloud aktivieren und real abnehmen

Status: **BLOCKER / EXTERN**

Aktueller Befund: Native CloudKit-/Keychain-Adapter und verschlüsselte
Backup-Hüllen existieren, sind im aktuellen Personal-Team-Build aber absichtlich
deaktiviert. Eine Capability allein macht die Funktion nicht releasefähig.

- [ ] Bezahltes Apple Developer Team, endgültige Team-ID, Bundle-ID und
      CloudKit-Container bereitstellen.
- [ ] Production-Schema und Entitlements konfigurieren; Adapter und sichtbare
      Einstellungen nur in fähigen Builds registrieren.
- [ ] Backup erstellen, App löschen, neu installieren und auf einem zweiten
      eigenen iPhone/iPad vollständig wiederherstellen.
- [ ] Decks, Karten, Medien, Einstellungen und Lernfortschritt byte- bzw.
      fachlich vergleichen.
- [ ] Unterbrechung während Upload und Restore, volles iCloud-Kontingent,
      deaktiviertes iCloud, fehlender Schlüsselbund und Offline-Start testen.
- [ ] Apple-Account-Wechsel darf lokale Daten nicht löschen oder vermischen.
- [ ] Manipuliertes, altes, unvollständiges und inkompatibles Backup ablehnen;
      vorherigen lokalen Zustand erhalten.
- [ ] Backup löschen, Status aktualisieren und dokumentierte Aufbewahrung
      verifizieren.
- [ ] App-Store-Datenschutzangaben und Hilfe an den tatsächlichen Datenfluss
      anpassen.

Abnahme: vollständige Matrix auf mindestens zwei physischen Apple-Geräten mit
verschiedenen Installationszuständen; lokale Nutzung bleibt bei jedem
Cloudfehler möglich.

Evidenz: [Mobile Release](docs/operations/mobile-release.md),
[Accountless Plan](docs/plans/accountless-cross-platform-local-first.md).

## V1-03 · Datenintegrität, Sync, Backup und Recovery

Status: **BLOCKER**

- [ ] Offline erstellte/editierte/gelöschte Decks, Karten, Medien und Reviews
      über Prozessneustart erhalten.
- [ ] Duplicate Delivery, unterbrochene Übertragung, Wiederverbindung,
      Reihenfolgefehler und gleichzeitige Änderungen auf mehreren Geräten
      deterministisch testen.
- [ ] Outbox, Tombstones und Watermarks dürfen weder Reviews verlieren noch
      Entitäten wiederbeleben.
- [ ] Peer-Widerruf, Gerätewechsel und komplett leere Bibliotheken ohne
      destruktive Kurzschlüsse testen.
- [ ] SQLite-/IndexedDB-Schema-Upgrades von jeder unterstützten Vorversion
      proben; Abbruch und Rollback dokumentieren.
- [ ] Vollständigen lokalen FNF-Export als unabhängigen Recovery-Weg prüfen.
- [ ] Backup-Restore und Release-Rollback proben, nicht nur beschreiben.

Abnahme: keine stille Datenlöschung, keine doppelten Reviews und identische
fachliche Zustände nach Neustart und erneuter Verbindung.

## V1-04 · UI-Sprachen EN, DE, ES und FR

Status: **BLOCKER**

Aktueller Befund: Die kanonische UI unterstützt nur `en` und `de`.
Mehrsprachige Deckinhalte und kuratierte Geografie-Daten sind kein Ersatz für
eine übersetzte Produktoberfläche. Viele Komponenten verwenden zudem noch das
zweiparametrige `text(english, german)`.

- [ ] Ein key-basiertes, typisiertes Übersetzungssystem als einzige Quelle
      festlegen; Komponenten dürfen keine neuen Inline-Paare mehr anlegen.
- [ ] EN und DE vollständig migrieren, danach ES und FR ergänzen.
- [ ] Navigation, Editor, Lernen, Import, Einstellungen, Sync, Fehler,
      Bestätigungen, leere Zustände, Help und Accessibility-Namen abdecken.
- [ ] Datums-, Zahlen-, Größen-, Plural- und Sprachbezeichnungen lokalisieren.
- [ ] Fehlende Keys und unbeabsichtigte Fallbacks in CI fehlschlagen lassen.
- [ ] Übersetzungen fachlich prüfen; rechtliche Texte separat qualifiziert
      prüfen lassen.
- [ ] 390 px, iPad, Desktop, 200 % Zoom und große iOS-Schrift mit langen
      französischen/deutschen Texten abnehmen.

Abnahme: automatischer 100-%-Key-Report sowie visueller Smoke-Test aller vier
Sprachen auf Web und Apple-App.

Evidenz: `packages/i18n/src/index.ts`,
`apps/web/components/i18n-provider.tsx`.

## V1-05 · Medienkarten vollständig erstellen und bearbeiten

Status: **BLOCKER**

Aktueller Befund: Das Inhaltsmodell sowie FNF-Import/-Export unterstützen Bild,
Bild-Overlay, Audio und Video über interne Medien-IDs. Anki/FNF-Import bewahrt
Medien. Der normale Karteneditor kann Medien jedoch nicht vollständig direkt
hinzufügen, aufnehmen, austauschen oder entfernen; er bietet im Wesentlichen
Markdown und ABC-Musikbearbeitung. **Dateikarten sind daher noch nicht komplett.**

- [ ] Bild aus Datei/Fotomediathek/Kamera hinzufügen; drehen, zuschneiden,
      komprimieren und Alt-Text bzw. dekorativen Status setzen.
- [ ] Audio aus Datei hinzufügen und direkt aufnehmen; benennen, vorhören,
      ersetzen, trimmen und optional transkribieren.
- [ ] Video nur aufnehmen, wenn Größen-, Format- und UX-Budget vertretbar sind;
      andernfalls ausdrücklich auf 1.x verschieben.
- [ ] Medienblöcke im Editor frei einfügen, sortieren, ersetzen und löschen;
      Referenzen in beiden Kartenseiten und in Tabellen unterstützen.
- [ ] MIME, Dateisignatur und decodierten Inhalt getrennt prüfen; Grenzen für
      Einzeldatei, Deck und Import definieren.
- [ ] HEIC/JPEG/PNG/WebP/GIF sowie AAC/M4A/MP3/WAV/OGG auf Web, iPhone und iPad
      mit dokumentierter Konvertierungsstrategie testen.
- [ ] Unterbrochenes Speichern darf keine Karte beschädigen; verwaiste Medien
      werden erst nach sicherer Referenzprüfung entfernt.
- [ ] FNF-Roundtrip, Peer-Transfer, iCloud-Backup und Wiederherstellung mit
      großen Medien und gleichen Hashes prüfen.
- [ ] Accessibility: Alt-Text, Audiolabel/Transkript, Videountertitel und
      tastatur-/touchbedienbare Controls.

Abnahme: eine Karte wird auf jedem Zielgerät vollständig erstellt, exportiert,
gelöscht, importiert, synchronisiert und wiedergegeben; private Medien werden
nie über externe URLs geladen.

## V1-06 · Layout, Accessibility und Kontrast

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

## V1-07 · Online-Hilfe und FnF-Help

Status: **OFFEN**

- [ ] Online-Hilfe als kleine, kontextbezogene Hilfe öffnen; Such-/Indexansicht
      minimierbar machen und den Lernfluss nicht überdecken.
- [ ] Ein eindeutiger `(i)`-Einstieg führt aus Editor, Study, Import, Sync und
      Einstellungen direkt zum passenden Thema.
- [ ] FnF-Help zur primären, installierbaren und offline verfügbaren Referenz
      ausbauen; Online-Hilfe bleibt Einstieg und Problemlöser.
- [ ] FnF-Help vollständig auf EN und DE anbieten; ES/FR nach Abschluss von
      V1-04. Quelltext aller Mermaid-, ABC- und JSXGraph-Beispiele bleibt
      kopierbar.
- [ ] Einführungen für Markdown, Tabellen, Cloze, KaTeX/mhchem, Referenzkarten,
      Medien, Import/Export, Sync/Recovery und Accessibility ergänzen.
- [ ] Hilfe-Inhalte versionieren und beim Update ohne Duplikate aktualisieren.
- [ ] Offline-, Such-, Deep-Link-, kleine Viewport- und VoiceOver-Abnahme.

Abnahme: Ein neuer Nutzer kann ohne externe Dokumentation ein Deck mit Text,
Formel, Medien und Referenzkarte erstellen, exportieren und wiederherstellen.

## V1-08 · Import, Export, Migration und Interoperabilität

Status: **BLOCKER**

- [ ] FNF ist im Öffnen-/Import-Dialog zuerst und roundtrip-stabil für alle
      aktuellen Blöcke, Medien, Referenzkarten und Deckeinstellungen.
- [ ] FNF-Feature-Flags lehnen unbekannte Pflichtfunktionen verständlich ab.
- [ ] APKG-Direktöffnung mit einfacher Standardstrecke und optionalen
      Expertenoptionen auf repräsentativen realen Decks testen.
- [ ] CSV, APKG und FNF gegen große Dateien, Abbruch, wenig Speicher,
      Duplikate, Reimport und bösartige Inhalte testen.
- [ ] Exportierte Daten nach App-Löschung auf einer frischen Installation
      vollständig wiederherstellen.
- [ ] Kompatibilitätsmatrix für letzte unterstützte FNF-, Datenbank- und
      Peer-Protokollgeneration dokumentieren.

Abnahme: Golden Fixtures plus reale Fremddecks auf Web, iPhone und iPad; keine
verlorenen Medien, Kartenseiten, Reihenfolgen oder Lernereignisse.

## V1-09 · Content-, Dependency- und Gerätesicherheit

Status: **BLOCKER**

- [ ] Markdown, KaTeX, Mermaid, ABC und JSXGraph gegen Script-, URL-, HTML-,
      Template- und Ressourceninjektion fuzz-/regressionstesten.
- [ ] SVG ablehnen oder sicher rasterisieren; externe Bilder, Tracking-Pixel,
      `javascript:`, gefährliche `data:`- und `file:`-URLs sperren.
- [ ] Private Medien bleiben lokal beziehungsweise ausschließlich in
      ausdrücklich gewählten, verschlüsselten Transfers.
- [ ] FNF-, Webstack- und kuratierte Signaturen inklusive Schlüsselrotation,
      Downgrade- und Manipulationsfällen abnehmen.
- [ ] Dependency-, Secret- und Berechtigungsscan für den Release-Commit;
      Kamera/Mikrofon/Fotomediathek nur bei tatsächlicher Nutzung anfordern.
- [ ] Bedrohungsmodell und Sicherheitskontakt aktualisieren.

Abnahme: Content-Security-Check, Dependency-Scan und manuelle Angriffsfixtures
ohne kritischen Befund.

## V1-10 · Recht, App Store und Betrieb

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

## V1-11 · Performance, Speicher, Akku und Stabilität

Status: **BLOCKER**

- [ ] Kaltstart, Navigation, Editor, große Deckliste und Lernstart auf dem
      ältesten unterstützten iPhone/iPad messen und Budgets festlegen.
- [ ] 10.000 Karten, große FNF/APKG-Dateien, lange Musikstücke und viele Medien
      ohne UI-Blockade oder Speicherabsturz testen.
- [ ] Akku-/Hintergrundprofiling für Timer, Polling, WebRTC, Audio, Animation
      und Wiederverbindung auf installierter App durchführen.
- [ ] SQLite-/IndexedDB-Speicherwachstum, Medien-Deduplizierung, Cache- und
      Orphan-Cleanup messen.
- [ ] Crash-, Low-Memory-, Suspend/Resume-, Flugmodus- und Prozess-Kill-Matrix
      ausführen.
- [ ] Fehler müssen verständlich, wiederholbar und ohne Datenverlust sein.

Abnahme: dokumentierte Budgets und reale Profilergebnisse; keine kritischen
Crashes, Hänger oder auffällige Hintergrundlast.

## V1-12 · Optionales Abo für etwa 2–5 Euro pro Jahr

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
- [ ] Accountloses Entitlement über Apple-Geräte hinweg klären; Web/PWA darf
      keine irreführende plattformübergreifende Freischaltung versprechen.
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

## V1-13 · Release Candidate und Go/No-Go

Status: **BLOCKER**

- [ ] Reviewed Commit und Daten-/Peer-Protokoll einfrieren.
- [ ] `pnpm check` und `pnpm release:check` ohne Blocker.
- [ ] Signierten Web/PWA-Build und signiertes iOS-Archive aus demselben Commit
      reproduzierbar erzeugen.
- [ ] Kernfluss auf Web, iPhone und iPad: Onboarding, Erstellen, Medien,
      Import, Lernen, Referenzen, Offline, Sync, Export, Restore und Löschen.
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
- kontinuierlicher CloudKit-Live-Sync, falls V1-01 Variante A bestätigt;
- CloudKit-Familienbibliotheken/CKShare;
- öffentliche Community einschließlich Publishing und Moderation;
- JSXGraph 3D;
- Videoerstellung, falls V1-05 sie ausdrücklich verschiebt;
- Abo, falls V1-12 keine belastbare V1.0-Entscheidung erhält;
- serverbasierte KI- oder Generierungsdienste.

## Aktueller Audit-Nachweis

- Release-Readiness-Check: **nicht bestanden**, acht rechtlich/betrieblich
  offene Release-Blocker in V1-10.
- Content-Security-Strukturcheck: ohne automatischen Blocker; reale
  Medienerstellung und Angriffsfixtures bleiben offen.
- iCloud: Quelladapter vorhanden, aktuelle Release-Capability deaktiviert;
  reale Geräteabnahme offen.
- UI-Lokalisierung: EN/DE vorhanden, ES/FR fehlen als Produktoberfläche.
- Medien: Schema, Import, Wiedergabe und FNF-Roundtrip vorhanden; direktes
  Authoring im Standardeditor unvollständig.

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
