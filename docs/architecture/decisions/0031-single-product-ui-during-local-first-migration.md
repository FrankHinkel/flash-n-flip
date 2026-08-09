# ADR 0031: Eine Produktoberfläche während der Local-first-Migration

- Status: Accepted
- Datum: 9. August 2026
- Ergänzt: ADR 0029 und ADR 0030

## Kontext

Release `0.5.113` verband die neue lokale Autorität mit einer eigenständigen
statischen Oberfläche für Decks, Karten, Lernen, Einstellungen, Medien und
Backups unter `/connect`. Obwohl diese Oberfläche als technischer Durchstich
gedacht war, bildete sie aus Benutzersicht eine zweite Flash-n-Flip-App. Sie
wich damit von der bestehenden React-/Next.js-Oberfläche und vom festgelegten
Migrationsprinzip ab, jeden vorhandenen Benutzerfluss nacheinander hinter
unveränderter Bedienung auf lokale Repositories umzustellen.

Ein technischer Testharness ist kein Ersatz für Produktparität. Contract- und
Adaptertests können Datenintegrität nachweisen, aber nicht rechtfertigen, eine
zweite Deck-, Editor- oder Lernoberfläche auszuliefern.

## Entscheidung

1. Die bestehende React-/Next.js-Anwendung unter `/app` bleibt die einzige
   visuelle und funktionale Produktoberfläche für Decks, Collections, Karten,
   Lernen, Einstellungen, Medien, Import, Export und Backup.
2. Die statische Bootstrap-/Connect-Hülle darf ausschließlich Installation,
   Releaseprüfung, Gerätekopplung, Rendezvous, QR-Scan, Verbindungsstatus und
   direkten Protokolltransport bereitstellen. Sie rendert keine parallelen
   Produktflüsse.
3. Lokale Repository-, Scheduler- und Synchronisationsverträge werden jeweils
   hinter den bestehenden React-Komponenten angebunden. Ein Benutzerfluss gilt
   erst als migriert, wenn seine ursprüngliche UI den lokalen Pfad vollständig
   verwendet und seine bestehende Bedienung sowie Kartendarstellung bestehen.
4. Der gebündelte Apple-Webstack muss perspektivisch dieselbe Produktoberfläche
   und dieselben Komponenten ausliefern. Eine separate native HTML-Oberfläche
   ist kein zulässiger Endzustand.
5. Interne Testharnesses dürfen lokal oder in automatisierten Tests existieren,
   werden aber nicht über `/connect`, das App-Bundle oder einen öffentlichen
   Produktpfad ausgeliefert.
6. Ein automatischer Grenztest weist jede erneute Aufnahme von Deck-, Karten-,
   Lern-, Einstellungs-, Medien- oder Backup-Bedienelementen in die
   Connect-Hülle zurück.
7. Bootstrap-Assets tragen eine Build-ID in ihren URLs und Cache-Namen. Dadurch
   darf eine neue HTML-Hülle nicht mit JavaScript oder CSS einer älteren
   Version kombiniert werden.

## Konsequenzen

- Die lokale Phase-2-Vertrags- und Adaptergrundlage bleibt erhalten.
- Der zuvor behauptete Abschluss der vollständigen Phase 2 wurde zurückgenommen
  und erst mit Release `0.5.116` nach Migration der vorhandenen Produktflüsse
  erneut festgestellt.
- `/connect` bleibt klein, auditierbar und unabhängig vom Kartendesign.
- Die Migration benötigt mehrere vertikale Produktänderungen, vermeidet dafür
  doppelte Bedienlogik, abweichende Kartenansichten und spätere Rückmigrationen.
- Der native Apple-Build kann vor vollständiger UI-Integration nur den
  Kopplungs-/Bootstrap-Pfad darstellen und ist noch kein vollständiger
  Produktbuild.

## Abgelehnte Alternativen

### Die statische Phase-2-Oberfläche optisch an die bestehende UI angleichen

Auch eine ähnlich aussehende zweite Oberfläche würde Komponenten, Verhalten
und Fachabläufe duplizieren und langfristig auseinanderlaufen.

### Die bestehende Web-App als entfernte Capacitor-URL laden

Das würde zwar sofort die bekannte Oberfläche zeigen, aber Offlinebetrieb und
App-Store-eigene Codeauslieferung aufgeben. Der native Build muss den geprüften
Webstack bündeln.

## Abnahme

- `/connect` enthält ausschließlich Kopplungs- und Statusfunktionen.
- Die bestehende `/app`-Oberfläche bleibt visuell unverändert.
- Jeder weitere Phase-2-Teil benennt den migrierten Originalfluss und prüft
  Speichern, Neustart, Offlinebetrieb und Wiederöffnen durch genau diesen Pfad.
- Phase 2 bleibt offen, solange Decks, Editor, Lernen, Einstellungen, Medien und
  vollständiger Export/Import noch API-Persistenz oder eine Testoberfläche
  benötigen.

## Umsetzungsnachweis

Release `0.5.116` erfüllt die Abnahme dieser Entscheidung:

- `/connect` bleibt auf Kopplung, Verbindungsstatus und Transport begrenzt.
- Die bestehenden `/app`-Komponenten verwenden für Decks, Karten, FSRS-Zustand,
  Reviews, Einstellungen, Medien und vollständige Sicherungen die gemeinsame
  lokale Autorität.
- API-Bestände werden nur noch als Migrationsquelle gelesen und vor der ersten
  lokalen Änderung vollständig übernommen; die anschließende
  Produktpersistenz schreibt nicht in die API.
- Die vorhandene Deck-, Karten- und Lernansicht wurde im Browser über Anlegen,
  Speichern, Reload, Review und erneuten Reload geprüft.
- Der vorhandene Kartenaufbau wurde weder ersetzt noch neu gestaltet.
