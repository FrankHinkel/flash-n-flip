# Implementierungsstatus V1.0

Stand: 28. Juli 2026

## Fertig implementiert und lokal verifiziert

- pnpm/Turborepo-Monorepo und CI-Pipeline
- React-Native-/Expo-App mit iOS-, Android- und Web-Bundles
- Next.js Web-App und getrennte Next.js Moderationsanwendung
- Fastify API, PostgreSQL-Schema und drei reproduzierbare Migrationen
- Registrierung, Login, Refresh, Logout, Geräte-Sitzungen,
  E-Mail-Verifikations- und Passwort-Reset-Token
- angemeldete Web-Sitzungen werden von `/` ohne sichtbare ausgeloggte
  Landingpage nach `/app` geleitet; ausgeloggte und No-Script-Besucher behalten
  die öffentliche Startseite
- private Decks und Karten mit optimistischer Versionierung
- strukturierte sichere Inhalte für Text, Überschrift, Liste, Formel, Bild,
  Audio, Video, Grafik, deklarative Animation, interaktive Europakarte und
  Cloze
- unabhängig von der UI wählbare Deck-Inhaltssprache mit EN-, DE-, ES- und
  FR-Varianten sowie Rückfall auf die UI-Sprache
- Europa-Testdeck mit 51 Staaten, antwortfreier Hervorhebung im
  Kartendurchlauf und getrenntem Erkundungsmodus für Karte, Länderinfo und
  Rückkehr zur Übersicht; die letzte sichere Bewertung `GOOD`/`EASY` wird
  ohne Änderung des FSRS-Zustands grau markiert
- visueller TipTap-Webeditor mit Fett, Kursiv, Durchstreichen, Inline-Code,
  Überschriften und Listen; Lückentexte unterstützen gemeinsames oder
  schrittweises Aufdecken sowie Vorschlagslisten, deren erste Eingabe korrekt
  bleibt und beim Lernen stabil gemischt wird
- integrierte Testsammlung „Deutsch: unregelmäßige Verben im Präsens“ mit
  46 Verben, vier Unterdecks und 184 selbst erstellten Karten; Beispiel:
  `Wir {{sind|bist|bin}} nach Hause gegangen.`
- sichere mobile Rich-Text-Anzeige mit verdeckten Lücken, zufällig angeordnetem
  Auswahl-Popup, gemeinsamem oder schrittweisem Aufdecken und aufgedeckten
  Antworten auf der Rückseite sowie mobile Ersterstellung
- sicherer CSV-, Anki-Text- und APKG-Import für alte und aktuelle Paketformate
  mit privaten Bildern und Audiodateien
- kontrollierte Anki-Template-Auswertung ohne Skript-, CSS-, Add-on-,
  Dateisystem- oder externe Netzwerkausführung; importierte Karten starten als
  neue FSRS-Karten
- CSV-Export, vollständiger Kontodatenexport und pseudonymisierende
  Accountlöschung
- signiertes und AES-256-GCM-verschlüsseltes `.fnfdeck`-Format mit
  kontogebundenem Schlüssel, eingebetteten Medien und geprüftem Import
- versionierte FSRS-Integration mit reproduzierbaren Review-Ereignissen
- IndexedDB-Outbox im Web und SQLite-Outbox auf Mobile
- Offline-Lerneinheiten und idempotente Wiederholungssynchronisation
- öffentliche Community-Suche, Quellenanzeige und Abonnements
- unveränderliche Revisionskarten, getrennt von Autoren-Arbeitskopien
- serverseitiger Veröffentlichungsautomat mit zwingender Adminrolle
- Moderationswarteschlange, Änderungsanforderung, Freigabe,
  Veröffentlichung, Meldungen, Sperrung und Auditspur
- authentifizierte Bild-, Audio- und Videowiedergabe in Web, iOS und Android
- Upload-Whitelist, Magic-Byte-Prüfung und öffentlicher Medienzugriff nur
  aus aktuell veröffentlichten Revisionen
- responsive Light-/Dark-Mode-Oberfläche, Reduced Motion,
  Tastaturfokus und semantische Beschriftungen
- acht projektlokale Codex-Skills als Architektur- und Release-Guardrails

## Verifizierungsnachweise

- alle TypeScript-Typprüfungen erfolgreich
- alle Lint-Prüfungen erfolgreich
- vollständige Unit- und Integrationstests erfolgreich
- Next.js Produktionsbuilds erfolgreich
- Expo-Bundles für iOS, Android und Web erfolgreich
- PostgreSQL-17-Migrationen gegen eine frische Datenbank erfolgreich
- API-Smoke-Test erfolgreich:
  Registrierung, Deck, Karten, idempotentes Review, Einreichung,
  Adminfreigabe, Veröffentlichung, Abonnement, unveränderliche Revision und
  Meldung
- visuelle Browserprüfung für Desktop und 390-px-Mobile ohne Konsolenfehler
- Browserprüfung des TipTap-Editors und des Lückenauswahl-Popups bei
  1440 × 900, 390 × 844 und 720 × 520 CSS-Pixeln in Bright und Dark; keine
  Überlagerung, kein Viewport-Scrollen und mindestens 10 px Schutzabstand zum
  Theme-Schalter
- realer Browserablauf für Europa-Deck, unabhängigen Sprachwechsel,
  antwortfreien Karten-Hover, Kartendurchlauf, Länderinfo mit Rückkehr,
  Maus-/Tastaturnavigation, Lernen, Export und kontogebundenen Reimport
- alle acht Skills formal validiert
- Lern-, Sync-, Publishing- und Content-Security-Guardrails erfolgreich

## Externe Release-Blocker

Diese Punkte können nicht sinnvoll aus dem Repository erfunden werden und
werden vom Release-Check bewusst abgelehnt:

1. rechtsverbindlicher Betreiber, Anschrift und Kontakt
2. Hostinganbieter, Region und Auftragsverarbeitung
3. verbindliche Aufbewahrungs- und Löschfristen
4. produktiver E-Mail-Provider für Verifikation und Passwortreset
5. produktiver Objektspeicher und Malware-Scanning für Medien
6. Expo-EAS-Projekt, Apple Developer Team und Google Play App
7. Store-Metadaten, Screenshots, Altersfreigaben und Datenschutzangaben
8. externer rechtlicher Review
9. Geräte-Beta auf der dokumentierten iOS-/Android-Matrix
10. dokumentierter Restore-Test auf der gewählten Produktionsplattform

Solange diese Angaben fehlen, bleibt das Projekt in der Entwicklungsreihe
`0.5.x`. Der Guardrail `pnpm release:check` muss fehlschlagen und darf erst nach
dem Ersetzen aller Pflichtplatzhalter grün werden.
