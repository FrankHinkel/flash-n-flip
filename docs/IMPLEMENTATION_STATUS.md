# Implementierungsstatus V1.0

Stand: 24. Juli 2026

## Fertig implementiert und lokal verifiziert

- pnpm/Turborepo-Monorepo und CI-Pipeline
- React-Native-/Expo-App mit iOS-, Android- und Web-Bundles
- Next.js Web-App und getrennte Next.js Moderationsanwendung
- Fastify API, PostgreSQL-Schema und zwei reproduzierbare Migrationen
- Registrierung, Login, Refresh, Logout, Geräte-Sitzungen,
  E-Mail-Verifikations- und Passwort-Reset-Token
- private Decks und Karten mit optimistischer Versionierung
- strukturierte sichere Inhalte für Text, Überschrift, Liste, Formel, Bild,
  Audio und Cloze
- visueller Webeditor mit Vorschau sowie mobile Ersterstellung
- sicherer CSV- und Anki-Textimport ohne Skript- oder Add-on-Ausführung
- CSV-Export, Kontodatenexport und pseudonymisierende Accountlöschung
- versionierte FSRS-Integration mit reproduzierbaren Review-Ereignissen
- IndexedDB-Outbox im Web und SQLite-Outbox auf Mobile
- Offline-Lerneinheiten und idempotente Wiederholungssynchronisation
- öffentliche Community-Suche, Quellenanzeige und Abonnements
- unveränderliche Revisionskarten, getrennt von Autoren-Arbeitskopien
- serverseitiger Veröffentlichungsautomat mit zwingender Adminrolle
- Moderationswarteschlange, Änderungsanforderung, Freigabe,
  Veröffentlichung, Meldungen, Sperrung und Auditspur
- Upload-Whitelist, Magic-Byte-Prüfung und öffentlicher Medienzugriff nur
  aus aktuell veröffentlichten Revisionen
- responsive Light-/Dark-Mode-Oberfläche, Reduced Motion,
  Tastaturfokus und semantische Beschriftungen
- acht projektlokale Codex-Skills als Architektur- und Release-Guardrails

## Verifizierungsnachweise

- alle TypeScript-Typprüfungen erfolgreich
- alle Lint-Prüfungen erfolgreich
- 22 Unit- und Integrationstests erfolgreich
- Next.js Produktionsbuilds erfolgreich
- Expo-Bundles für iOS, Android und Web erfolgreich
- PostgreSQL-17-Migrationen gegen eine frische Datenbank erfolgreich
- API-Smoke-Test erfolgreich:
  Registrierung, Deck, Karten, idempotentes Review, Einreichung,
  Adminfreigabe, Veröffentlichung, Abonnement, unveränderliche Revision und
  Meldung
- visuelle Browserprüfung für Desktop und 390-px-Mobile ohne Konsolenfehler
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

Solange diese Angaben fehlen, bleibt die Version korrekt als
`1.0.0-rc.0` gekennzeichnet. Der Guardrail `pnpm release:check` muss fehlschlagen
und darf erst nach dem Ersetzen aller Pflichtplatzhalter grün werden.
