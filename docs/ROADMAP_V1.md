# Flash & Flip – Phasenplan bis V1.0

Stand: 24. Juli 2026

## 1. Produktziel

Flash & Flip wird eine hochwertige Lernkartenplattform für iOS, Android und Web.
Sie verbindet zuverlässiges, offlinefähiges Lernen nach dem FSRS-Verfahren mit
einer kuratierten Community für veröffentlichte Lernkartensätze.

Das Produkt soll insbesondere die Schwächen bestehender Lösungen adressieren:

- verständlicher Einstieg ohne Kenntnis technischer Lernbegriffe
- moderne, konsistente und barrierearme Bedienung
- visueller Editor für ansprechende Lernkarten
- zuverlässiges Offline-Lernen und geräteübergreifende Synchronisation
- versionierte Community-Decks statt unverbundener Dateikopien
- verpflichtende Freigabe jeder Veröffentlichung durch einen Admin
- nachvollziehbare Moderation und Korrektur fehlerhafter Inhalte

## 2. Festgelegte technische Richtung

| Bereich                       | Technologie                                |
| ----------------------------- | ------------------------------------------ |
| iOS und Android               | React Native mit Expo                      |
| Web und öffentliche Community | Next.js                                    |
| Administration                | Next.js                                    |
| Backend/API                   | Node.js mit TypeScript                     |
| Zentrale Datenbank            | PostgreSQL                                 |
| Lokale Datenbank Mobile       | SQLite                                     |
| Lokale Datenbank Web          | IndexedDB                                  |
| Lernalgorithmus               | FSRS                                       |
| Repository                    | TypeScript-Monorepo mit pnpm und Turborepo |

Mobile und Web erhalten plattformgerechte Oberflächen. Gemeinsam genutzt werden
Fachlogik, Datenmodelle, Validierung, API-Typen, Synchronisationsregeln,
Übersetzungen und Design-Tokens.

## 3. Verbindlicher Umfang von V1.0

### In V1.0 enthalten

- Registrierung, Anmeldung und Geräteverwaltung
- private Lernkartensätze
- Text, Bilder, Audio, Formeln und Cloze-Karten
- visueller Karteneditor mit Vorschau
- Tags, Suche und Organisation
- FSRS-basierte Wiederholungsplanung
- Offline-Lernen auf Mobile und Web
- zuverlässige geräteübergreifende Synchronisation
- verständliche Lernziele und Statistiken
- öffentliche Community-Seiten
- Decksuche, Kategorien und Autorenprofile
- Abonnieren veröffentlichter Decks
- versionierte Deck-Aktualisierungen
- Einreichung zur Veröffentlichung
- verpflichtende Adminfreigabe
- Änderungsanforderungen und Revisionsvergleich
- Meldung einzelner Karten und ganzer Decks
- Sperrung und Zurückziehen veröffentlichter Inhalte
- Audit-Protokoll für Moderationsentscheidungen
- CSV-Import und -Export
- kontrollierter Anki-Import ohne Ausführung fremder Skripte
- Datenexport und Accountlöschung
- deutsche und englische Benutzeroberfläche

### Bewusst nicht in V1.0 enthalten

- Social Feed
- Chat und Direktnachrichten
- Schulklassen- oder Kursverwaltung
- gleichzeitige Live-Bearbeitung
- Autorenvergütung oder öffentlicher Marketplace
- automatische Veröffentlichung KI-generierter Inhalte
- Add-on- oder Plugin-System
- komplexe Gamification
- öffentliche Ranglisten

Neue Anforderungen werden vor V1.0 nur aufgenommen, wenn sie für Sicherheit,
Rechtskonformität, Datenintegrität oder die Kernnutzung zwingend notwendig sind.

## 4. Übergreifende Qualitätsregeln

Diese Regeln gelten für alle Phasen:

1. Kein Community-Inhalt wird ohne protokollierte Adminfreigabe veröffentlicht.
2. Veröffentlichte Revisionen sind unveränderlich.
3. Persönlicher Lernfortschritt ist vom Inhalt eines Community-Decks getrennt.
4. Lernen muss ohne Netzwerkverbindung funktionieren.
5. Review-Ereignisse werden eindeutig, unveränderlich und idempotent verarbeitet.
6. Serverseitige Berechtigungsprüfungen sind verbindlich.
7. Lernkarten dürfen kein frei ausführbares JavaScript enthalten.
8. Medien und formatierte Inhalte werden serverseitig geprüft und bereinigt.
9. Kritische Nutzerwege werden auf echten iOS- und Android-Geräten getestet.
10. Barrierefreiheit, Datenschutz und Löschbarkeit werden nicht auf eine
    Abschlussphase verschoben.
11. Datenbankänderungen benötigen Migrationen und Kompatibilitätstests.
12. Ein Release ist nur mit getestetem Backup- und Wiederherstellungspfad zulässig.

## 5. Phasenübersicht

| Phase | Schwerpunkt                                    | Geschätzte Dauer |
| ----- | ---------------------------------------------- | ---------------: |
| 0     | Produktgrundlagen und Guardrails               |       1–2 Wochen |
| 1     | Technisches Fundament und Designsystem         |       2–3 Wochen |
| 2     | Identität, Backend und Kerndatenmodell         |       3–4 Wochen |
| 3     | Private Decks und Kartenerstellung             |       4–5 Wochen |
| 4     | Lernen, FSRS, Offline und Synchronisation      |       4–6 Wochen |
| 5     | Community, Veröffentlichung und Administration |       4–5 Wochen |
| 6     | Geschlossene Beta und Härtung                  |       3–4 Wochen |
| 7     | Release Candidate und V1.0                     |       2–3 Wochen |

Für zwei Vollzeitentwickler sowie anteilige Unterstützung durch Design und QA
ergibt sich eine grobe Gesamtdauer von 24 bis 32 Wochen. Bei einer
Einzelentwicklung ist eher mit 36 bis 50 Wochen zu rechnen.

## 6. Phase 0 – Produktgrundlagen und Guardrails

### Ziel

Alle Entscheidungen treffen, die das Datenmodell, die Architektur oder spätere
rechtliche Anforderungen grundlegend beeinflussen.

### Arbeitspakete

- Zielgruppen und Mindestalter festlegen
- private, schulische und öffentliche Nutzungsszenarien abgrenzen
- Geschäfts- und Finanzierungsmodell festlegen
- Betreiber, Hostingregion und Supportverantwortung bestimmen
- Moderationsrollen und erwartete Bearbeitungszeiten definieren
- verbindlichen V1.0-Umfang bestätigen
- zentrale Begriffe und Navigationsmodell festlegen
- Datenlandkarte mit Speicherorten und Löschregeln beginnen
- Bedrohungsmodell für Accounts, Medien, Community und Administration erstellen
- Architekturentscheidungen als kurze ADRs dokumentieren
- Projekt-Skills für Architektur, Datenschutz, Lernlogik, Sync, Moderation,
  Sicherheit, Accessibility und Releases vorbereiten
- Definition of Done und Release-Blocker festlegen
- Geräte- und Browsermatrix für Tests festlegen

### Ergebnisse

- freigegebener Produktumfang
- Architekturübersicht
- initiales Domänenmodell
- Rollen- und Berechtigungsmatrix
- Moderationsprozess
- Datenlandkarte
- Risikoregister
- Qualitäts- und Release-Gates

### Exit-Kriterien

- Es bestehen keine offenen Grundsatzentscheidungen, die Authentifizierung,
  Minderjährigenschutz, Veröffentlichung oder Datenhaltung später grundlegend
  verändern würden.
- V1.0-Umfang und Nicht-Ziele sind schriftlich bestätigt.
- Jeder kritische Produktbereich besitzt einen benannten Prüfprozess.

## 7. Phase 1 – Technisches Fundament und Designsystem

### Ziel

Eine reproduzierbare Entwicklungsbasis für Web, iOS und Android schaffen.

### Arbeitspakete

- TypeScript-Monorepo einrichten
- Expo-App für iOS und Android einrichten
- Next.js-Anwendungen für Web und Administration einrichten
- Node.js-API und PostgreSQL-Entwicklungsumgebung einrichten
- gemeinsame Pakete für Domänenmodell, API, Validierung und Design definieren
- Linting, Formatierung, Typprüfung und Tests in CI integrieren
- Umgebungen für Entwicklung, Test und Produktion trennen
- Secret- und Konfigurationsmanagement festlegen
- Design-Tokens für Farben, Typografie, Abstände und Animationen erstellen
- grundlegende Komponenten und Zustände dokumentieren
- Light Mode, Dark Mode und Reduced Motion berücksichtigen
- Fehlerüberwachung und datensparsame technische Telemetrie vorbereiten
- automatisierte Vorschauen für Webänderungen ermöglichen

### Ergebnisse

- reproduzierbare Builds für Web, iOS und Android
- CI-Pipeline
- gemeinsames Designsystem
- Basisnavigation
- dokumentierte Paketgrenzen
- erste End-to-End-Teststrecke

### Exit-Kriterien

- Alle Zielplattformen lassen sich aus einem frischen Checkout bauen.
- Typprüfung, Linting und Basistests laufen automatisiert.
- Kernkomponenten funktionieren responsiv und mit Tastatur beziehungsweise
  Screenreader.
- Fachlogik ist nicht in plattformspezifischen UI-Paketen dupliziert.

## 8. Phase 2 – Identität, Backend und Kerndatenmodell

### Ziel

Accounts, Berechtigungen und persistente Kerndaten sicher bereitstellen.

### Zentrale Entitäten

- User
- Profile
- Device
- Deck
- Note
- CardTemplate
- Card
- Media
- ReviewEvent
- DeckRevision
- PublicationSubmission
- ModerationDecision
- Subscription
- ContentReport
- AuditEvent

### Arbeitspakete

- Registrierung, Anmeldung und E-Mail-Verifikation
- sichere Sitzungs- und Geräteverwaltung
- Passwortzurücksetzung und Accountwiederherstellung
- Rollen für Nutzer, Autor, Prüfer und Admin
- serverseitige Autorisierung für jede geschützte Operation
- PostgreSQL-Schema und versionierte Migrationen
- private Decks und grundlegende CRUD-Operationen
- Medienablage mit privaten und öffentlichen Bereichen
- signierte und zeitlich begrenzte Medienzugriffe
- Änderungs- und Audit-Protokolle für sensible Aktionen
- Accountlöschung und Datenexport konzipieren
- Rate Limits und Missbrauchsschutz
- automatisierte Berechtigungs- und Isolationstests

### Ergebnisse

- produktionsnahes Authentifizierungsmodell
- abgesichertes API-Grundgerüst
- versioniertes Datenbankschema
- Rollen- und Berechtigungstests
- Export- und Löschkonzept

### Exit-Kriterien

- Nutzer können keine fremden privaten Decks oder Medien abrufen.
- Adminfunktionen sind ausschließlich serverseitig autorisierten Rollen
  zugänglich.
- Migrationen laufen vorwärts auf einer realistischen Testdatenbank.
- Accountlöschung und Datenexport sind technisch durchgängig beschrieben.

## 9. Phase 3 – Private Decks und Kartenerstellung

### Ziel

Nichttechnische Nutzer können ansprechende Lernkarten selbstständig erstellen,
organisieren und bearbeiten.

### Arbeitspakete

- Decks erstellen, umbenennen, duplizieren, archivieren und löschen
- Karten und zugrunde liegende Notizen konsistent modellieren
- visuellen Editor für Vorder- und Rückseite entwickeln
- Basic-, Reverse- und Cloze-Kartentypen
- Bilder, Audio und mathematische Formeln
- sichere strukturierte Inhaltsblöcke
- Vorschau für Mobile, Tablet und Web
- automatische Speicherung und Wiederherstellung von Entwürfen
- Tags, Filter und Volltextsuche
- Mehrfachauswahl und Stapeloperationen
- CSV-Import und -Export
- eingeschränkter Anki-Import
- Warnungen für nicht unterstützte Templates oder Skripte
- Mediengrößen, Typen und Metadaten prüfen
- Undo/Redo für kritische Editoraktionen

### Ergebnisse

- vollständiger privater Autorenworkflow
- sichere Vorlagen und Inhaltsblöcke
- Import- und Exportbasis
- mobile und webbasierte Vorschau

### Exit-Kriterien

- Ein neuer Nutzer kann ohne externe Anleitung ein Deck erstellen.
- Automatische Speicherung verliert bei App- oder Browserabbruch keine bereits
  bestätigten Änderungen.
- Importierte Inhalte können keinen aktiven Code ausführen.
- Editor, Vorschau und späterer Lernmodus rendern dieselben Inhalte konsistent.

## 10. Phase 4 – Lernen, FSRS, Offline und Synchronisation

### Ziel

Zuverlässiges Lernen auf allen Plattformen, unabhängig von der
Netzwerkverbindung.

### Arbeitspakete

- FSRS-Bibliothek integrieren und Version speichern
- verständliche Antwortoptionen und Erklärungen gestalten
- Tagesziel, neue Karten und Wiederholungen berechnen
- Lernwarteschlange lokal erzeugen
- Review-Ereignisse append-only speichern
- stabile IDs und idempotente Verarbeitung
- SQLite-Repository für Mobile
- IndexedDB-Repository für Web
- gemeinsame Repository- und Synchronisationsschnittstellen
- Outbox für Offline-Änderungen
- inkrementelle Synchronisation und Wiederaufnahme
- Konfliktregeln pro Entität
- Medien separat und wiederaufnehmbar synchronisieren
- Zeitzonen, Tageswechsel und Geräteuhren behandeln
- abgebrochene Lernsitzungen wiederherstellen
- lokale Erinnerungen und Benachrichtigungen
- verständliche Lernstatistiken
- Backup- und Wiederherstellungspfad
- Last- und Dauertests mit großen Decks

### Kritische Testszenarien

- Lernen im Flugmodus
- App-Abbruch direkt nach einer Bewertung
- dieselbe Karte auf zwei Geräten bearbeiten
- wiederholtes Senden desselben Review-Ereignisses
- Gerätewechsel zwischen verschiedenen Zeitzonen
- unterbrochener Medienupload
- längere Offline-Nutzung mit anschließender Synchronisation
- Scheduler-Update mit bestehender Lernhistorie

### Ergebnisse

- deterministischer Lernmodus
- offlinefähige lokale Datenhaltung
- robuste Synchronisationsengine
- nachvollziehbare Lernstatistiken

### Exit-Kriterien

- Keine doppelten oder verlorenen Review-Ereignisse in den definierten
  Störfällen.
- Derselbe Account kann auf mindestens zwei Geräten offline lernen und später
  konsistent synchronisieren.
- Scheduler-Tests liefern plattformübergreifend identische Ergebnisse.
- Ein beschädigter oder abgebrochener Sync kann fortgesetzt oder sicher neu
  aufgebaut werden.

## 11. Phase 5 – Community, Veröffentlichung und Administration

### Ziel

Eine kuratierte Community aufbauen, in der ausschließlich geprüfte Revisionen
öffentlich erscheinen.

### Verbindlicher Veröffentlichungsprozess

```text
Privater Entwurf
    → Zur Prüfung eingereicht
    → Automatische Vorprüfung
    → Admin-Prüfung
    → Änderungen angefordert oder freigegeben
    → Veröffentlicht
```

### Arbeitspakete

- öffentlich indexierbare Deckseiten
- Kategorien, Suche, Filter und Sortierung
- Autorenprofile
- Deckvorschau vor dem Abonnieren
- Abonnements statt unkontrollierter Kopien
- unveränderliche veröffentlichte Revisionen
- Änderungsprotokoll zwischen Revisionen
- Updatehinweise für Abonnenten
- private Forks für eigene Anpassungen
- Einreichungsformular mit Quellen- und Lizenzangaben
- automatische Qualitäts- und Sicherheitsprüfungen
- Adminvorschau für Web und Mobile
- Revisionsvergleich
- Freigabe, Ablehnung und Änderungsanforderung
- Meldung einzelner Karten und Decks
- Sperren, Zurückziehen und Wiederherstellen
- Begründung und Einspruchsmöglichkeit
- Moderations- und Audit-Protokoll
- Schutz vor Spam und massenhaften Einreichungen

### Automatische Vorprüfungen

- Pflichtfelder und leere Karten
- defekte oder fehlende Medien
- Duplikate
- unzulässiges HTML oder JavaScript
- gefährliche Links
- Dateityp und Dateigröße
- Quellen- und Lizenzangaben
- auffällige oder verbotene Inhalte
- offensichtliche Qualitätsprobleme

Automatische Prüfungen ersetzen niemals die vorgeschriebene Adminfreigabe.

### Ergebnisse

- öffentlicher Community-Katalog
- versioniertes Abonnementmodell
- vollständiger Moderationsworkflow
- Adminoberfläche
- Melde- und Einspruchsprozess

### Exit-Kriterien

- Es existiert kein technischer Veröffentlichungsweg ohne Adminentscheidung.
- Jede Moderationsentscheidung ist einem Admin, Zeitpunkt und Grund zugeordnet.
- Änderungen an veröffentlichten Decks erzeugen zwingend eine neue Revision.
- Persönlicher Lernfortschritt bleibt bei Community-Updates erhalten.
- Gemeldete Inhalte können sofort ausgeblendet werden, ohne Auditdaten zu
  verlieren.

## 12. Phase 6 – Geschlossene Beta und Härtung

### Ziel

Produkt, Betrieb und Moderation unter realistischen Bedingungen absichern.

### Arbeitspakete

- TestFlight und Google Play Internal Testing
- geschlossene Web-Beta
- Tests auf älteren und leistungsschwächeren Geräten
- VoiceOver-, TalkBack- und Tastaturtests
- Kontrast, Schriftvergrößerung und Reduced Motion
- Sicherheitsprüfung von Authentifizierung, API und Medien
- Abhängigkeits- und Lizenzprüfung
- Datenschutz- und DSA-Review
- Minderjährigen- und Empfehlungskonzept prüfen
- Datenexport und vollständige Accountlöschung testen
- Lasttests für Suche, Sync, Medien und Adminprüfung
- Backup und Wiederherstellung praktisch testen
- Logging auf Datenminimierung prüfen
- Alarmierung und Incident-Prozess
- Moderations-SLA mit realen Testeinreichungen erproben
- Feedbackkanal und Supportprozess
- Produktanalytik nur datensparsam und transparent

### Beta-Metriken

- erfolgreiche Lernstarts und abgeschlossene Sitzungen
- Sync-Fehlerrate
- App-Abstürze und nicht behandelte Fehler
- Zeit bis zur ersten selbst erstellten Karte
- Zeit bis zur ersten abgeschlossenen Lernsitzung
- Dauer einer Adminprüfung
- Anteil zurückgewiesener beziehungsweise überarbeiteter Einreichungen
- Accessibility- und Supportmeldungen

### Ergebnisse

- stabiler Release Candidate
- dokumentierte Betriebsprozesse
- geprüfte rechtliche Oberfläche
- gelöste kritische Beta-Funde

### Exit-Kriterien

- Keine offenen kritischen Sicherheits-, Datenschutz- oder Datenintegritätsfunde.
- Keine offenen Release-Blocker aus Accessibility oder Moderation.
- Backup und Wiederherstellung wurden mit Produktionsnähe erfolgreich getestet.
- Absturz-, Sync- und Fehlerraten liegen innerhalb der festgelegten Budgets.

## 13. Phase 7 – Release Candidate und V1.0

### Ziel

Kontrollierte Veröffentlichung einer stabilen und betreibbaren V1.0.

### Arbeitspakete

- Funktions- und Datenbankschema-Freeze
- abschließende Regressionstests
- RC-Builds für Web, iOS und Android
- Store-Texte, Screenshots und Datenschutzangaben
- Impressum, Datenschutz und Nutzungsbedingungen finalisieren
- Barrierefreiheitsinformationen bereitstellen, soweit erforderlich
- Produktionskonfiguration und Secrets prüfen
- Backup, Wiederherstellung und Rollback bestätigen
- Dashboards, Alarmierung und Bereitschaftswege aktivieren
- Supportdokumentation und bekannte Einschränkungen veröffentlichen
- Migrationen auf einer Produktionskopie proben
- gestaffelten Rollout durchführen
- V1.0 kennzeichnen und Release Notes veröffentlichen

### Rolloutstufen

```text
Intern
  → geschlossene Beta
  → 5 Prozent
  → 25 Prozent
  → 100 Prozent
```

Jede Stufe besitzt Abbruchkriterien für Abstürze, Sync-Fehler, Datenverlust,
Sicherheitsprobleme und nicht beherrschbare Moderationslast.

### Exit-Kriterien

- Produktionssystem und App-Versionen sind veröffentlicht.
- Monitoring, Support und Moderation sind besetzt.
- Rollback wurde nicht nur dokumentiert, sondern praktisch geprüft.
- Keine bekannten Fehler gefährden Lernfortschritt, private Daten oder den
  vorgeschriebenen Freigabeprozess.
- V1.0-Scope und bekannte Einschränkungen sind öffentlich dokumentiert.

## 14. Hauptrisiken und Gegenmaßnahmen

| Risiko                                      | Gegenmaßnahme                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| Sync-Fehler verursachen Lernverlust         | Append-only Review-Log, Idempotenz, Störfalltests und Recovery          |
| Adminprüfung wird zum Engpass               | automatische Vorprüfung, Priorisierung und klarer Moderationsstatus     |
| Schlechte Community-Inhalte                 | Quellenpflicht, Revisionen, Meldungen und nachvollziehbare Freigabe     |
| Urheberrechtsverletzungen                   | Lizenzangaben, Notice-and-Action-Prozess und schnelle Sperrung          |
| Unsichere Karteninhalte                     | strukturierte Blöcke, HTML-Allowlist und kein JavaScript                |
| Minderjährige werden unzureichend geschützt | Privacy by Default, verständliche Regeln und geeignete Meldemechanismen |
| Mobile UX bleibt hinter nativen Apps zurück | frühe Tests auf echten Geräten und plattformspezifische UI-Anpassungen  |
| Funktionsumfang wächst unkontrolliert       | verbindlicher V1.0-Scope und dokumentiertes Änderungsverfahren          |
| Scheduler-Verhalten ändert sich unbemerkt   | feste Testvektoren, gespeicherte Versionen und Migrationssimulation     |
| Betrieb kann Daten nicht wiederherstellen   | automatisierte Backups und regelmäßig getestete Restores                |

## 15. Definition of Done für V1.0

V1.0 gilt erst als abgeschlossen, wenn:

- Web, iOS und Android produktiv verfügbar sind,
- private Decks zuverlässig erstellt und gelernt werden können,
- Offline-Lernen und Synchronisation die definierten Störfälle bestehen,
- FSRS plattformübergreifend deterministisch arbeitet,
- Community-Decks gesucht, abonniert und aktualisiert werden können,
- keine Veröffentlichung die Adminfreigabe umgehen kann,
- Moderation und Audit-Protokoll produktiv funktionieren,
- Accountlöschung und Datenexport getestet sind,
- kritische Wege barrierearm bedienbar sind,
- Sicherheits-, Rechts- und Release-Prüfungen keine Blocker enthalten,
- Backup, Restore, Monitoring, Support und Rollback einsatzbereit sind.
