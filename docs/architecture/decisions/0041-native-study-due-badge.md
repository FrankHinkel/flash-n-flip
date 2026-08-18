# ADR 0041: Native Apple-Badges aus lokal persistierten Fälligkeiten

- Status: Angenommen
- Datum: 2026-08-18

## Kontext

Das Apple-App-Icon soll bereits fällige Wiederholungskarten des aktiven lokalen
Lernplans anzeigen. WebView-Timer laufen im Hintergrund oder nach einem
Prozessende nicht zuverlässig. Ein VPS-Push würde dem lokalen Datenmodell und
der Privatsphäregrenze widersprechen.

## Entscheidung

- Die gemeinsame Domain-Logik gruppiert ausschließlich persistierte
  `state.due`-Werte gelernter Karten und berechnet keine eigenen Intervalle.
- IndexedDB und SQLite stellen den Plan über das lokale Repository bereit;
  aktive Lernplan-, Sichtbarkeits-, Archiv- und Suspendierungsregeln werden vor
  der Abfrage angewendet.
- Die Web-App steuert Lebenszyklus und explizite Berechtigungsinteraktion über
  einen schmalen Capacitor-Vertrag.
- Der Apple-Adapter setzt den aktuellen Wert und plant höchstens 60
  ton- und bannerlose `UNUserNotificationCenter`-Badge-Termine. Er ersetzt nur
  Termine mit dem Flash-n-Flip-eigenen Präfix.
- Fehler der Badge-Anzeige bleiben außerhalb von Review-, Persistenz- und
  Synchronisationstransaktionen.

Die vollständigen Produkt- und Verifikationsregeln stehen in
[`badges.md`](../../../badges.md).

## Konsequenzen

Das Badge bleibt lokal und funktioniert anhand des zuletzt bekannten Zustands
auch bei angehaltenem oder beendetem WebView. Änderungen anderer Geräte werden
erst nach lokal angewendetem Direktabgleich berücksichtigt. Eine tatsächliche
minutenweise Hintergrundzustellung und das Fehlen sichtbarer Mitteilungen
müssen auf einem echten iPhone abgenommen werden.
