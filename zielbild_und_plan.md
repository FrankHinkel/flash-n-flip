# Flash-n-Flip: Zielbild und Umsetzungsplan fuer iCloud

## Verbindliches Zielbild

Flash-n-Flip bleibt local-first. Web und PWA verwenden IndexedDB, installierte
Apple-Apps SQLite. Import, Deckverwaltung und Lernen funktionieren offline.
iCloud repliziert bestaetigte Daten zwischen den eigenen Apple-Geraeten und der
PWA, ist aber keine Voraussetzung fuer die lokale Nutzung.

Es laeuft hoechstens ein endlicher iCloud-Auftrag. Lokale Aenderungen werden
ereignisgesteuert zusammengefasst. Es gibt kein Polling, keine Focus- oder
Online-Endlosschleife und keine unbegrenzten automatischen Wiederholungen.

### Persoenliche und importierte Decks

Persoenliche und importierte Decks werden mit Metadaten, Hierarchie, Karten,
Medien, Lernfortschritt und Loeschinformationen synchronisiert.

| Lokal | iCloud         | Cloud-Aktion                    | Papierkorb                                          |
| ----- | -------------- | ------------------------------- | --------------------------------------------------- |
| Ja    | Nein           | Cloud-Sync, startet automatisch | loescht nur lokal und stoppt ausstehende Uploads    |
| Nein  | Ja             | Cloud-Download                  | loescht Deck, Medien und Lernfortschritt aus iCloud |
| Ja    | Ja, abweichend | Cloud-Sync                      | fragt nach nur lokal oder ueberall loeschen         |
| Ja    | Ja, synchron   | Cloud-Check                     | fragt nach nur lokal oder ueberall loeschen         |
| Nein  | Nein           | kein Eintrag                    | entfaellt                                           |

Nur lokal loeschen behaelt die bestaetigte iCloud-Fassung. Das Deck erscheint
danach als Cloud-Download. Bei einer noch unvollstaendigen iCloud-Fassung wird
die Loeschung nicht vorzeitig ausgefuehrt.

Lokal und iCloud loeschen entfernt Deck, Unterdecks, Karten, Medien und
Lernfortschritt. Ein Tombstone verhindert die Wiederherstellung durch ein
aelteres Geraet. Andere verbundene Geraete uebernehmen die Loeschung. Lokale
Daten verschwinden erst nach der Cloud-Bestaetigung.

### Kuratierte Decks

Kuratierte Deckinhalte werden nicht in iCloud gespeichert. Sie stammen aus dem
App-Deployment oder dem signierten kuratierten Katalog. iCloud speichert fuer
sie nur die Aktivierung und append-only Lernfortschritte.

Beim Entfernen eines kuratierten Decks werden ausstehende Lernfortschritte
zuerst bestaetigt in iCloud gespeichert. Danach wird das Deck lokal
ausgeblendet und sein lokaler Lernfortschritt entfernt. Der Cloud-Lernfortschritt
bleibt erhalten. Ist iCloud nicht erreichbar, werden die lokalen Daten nicht
vorzeitig verworfen.

Bei einer spaeteren Aktivierung kommt der Inhalt erneut aus Deployment oder
Katalog. Der Lernfortschritt wird aus iCloud geladen. Kuratierte Decks werden
nicht als herunterladbare Deckkopien unter My iCloud angezeigt.

### Konfliktregeln

Reviews besitzen stabile, clientseitig erzeugte IDs und bleiben append-only.
Die Verarbeitung ist idempotent. Fuer den aktuellen Kartenstand gewinnt das
zeitlich letzte tatsaechliche Review anhand `reviewedAt`, nicht der letzte
Upload. Gleichstaende werden ueber die stabile Review-ID aufgeloest.

Deck- und Karteninhalte verwenden Revisionen und einen Drei-Wege-Merge. Echte
konkurrierende Inhaltsaenderungen werden nicht mit pauschalem Last-write-wins
ueberschrieben. Synchronisierte Loeschungen verwenden Tombstones.

### Discover und My iCloud

Discover verwaltet kuratierte Decks. My iCloud verwaltet persoenliche und
importierte Decks als stabile Deck-Hierarchie. Eltern stehen immer vor ihren
Unterdecks. Verwaiste oder zyklische Eintraege werden nicht auf die oberste
Ebene verschoben. Eintraege werden nach stabiler Deck-ID dedupliziert und
waehrend eines laufenden Auftrags nicht wild neu sortiert.

Die Statussymbole bedeuten:

- Cloud-Sync: nur lokal oder nicht synchron
- Cloud-Download: nur in iCloud
- Cloud-Check: lokal und bestaetigt synchron
- Kreisfortschritt: dieses Deck wird gerade uebertragen

Die Gesamtanzeige zeigt einen Durchlauf mit Phase, aktuellem Deck,
Objektfortschritt, Bytes soweit bekannt, Cloud-Anfragen und einem eindeutigen
Endzustand.

## Umsetzungsplan

1. Gemeinsame Zustaende fuer local-only, cloud-only, diverged, synced,
   pending-delete und error verwenden.
2. Kuratierte und persoenliche Decks bereits in der Cloud-Projektion trennen.
3. Cloud-Inventar nur aus vollstaendig publizierten Headern aufbauen und
   kuratierte Aktivierungen aus My iCloud herausfiltern.
4. Automatische Arbeit als persistente Single-Flight-Ausfuehrung ohne Timer,
   Polling oder parallele Laeufe starten.
5. Lernfortschritte vor Deckinhalten verarbeiten, Eltern vor Kindern ordnen,
   Karten nach Faelligkeit serialisieren und Medien separat zuletzt uebertragen.
6. Lokale Verfuegbarkeitsfelder wie Papierkorb und Ausblendung nicht als
   Cloud-Deckinhalt replizieren.
7. Loeschungen erst nach Bestaetigung aus UI und Repository entfernen. Alte
   lokale Loeschwarteschlangen werden abgebrochen statt blind wiederholt.
8. My iCloud mit eindeutigen Icons, Deck-Fortschritt, Unterdeck-Aktionen und
   begrenzten Sammelaktionen ausstatten.
9. Unterbrechung, Neustart, Duplikate, Review-Konflikte, kuratierte
   Reaktivierung und Loeschungen fokussiert automatisiert pruefen.
10. Version erst nach realer Zwei-Geraete-Abnahme als 0.6.0 freigeben.

## Abnahmekriterien

- Ein Import erscheint sofort lokal und genau einmal in My iCloud.
- Ein zweites Geraet kann Hierarchie, Karten, Medien und Fortschritt laden.
- Nur lokal loeschen laesst die Cloud-Fassung erneut herunterladbar.
- Ueberall loeschen entfernt bei persoenlichen Decks auch den Lernfortschritt.
- Kuratiertes Entfernen behaelt dagegen den Cloud-Lernfortschritt.
- Reaktivierung eines kuratierten Decks stellt den Cloud-Lernfortschritt her.
- Unterbrechung und Neustart erzeugen weder Datenverlust noch Duplikate.
- Ein zweiter Lauf ohne Aenderungen liest keine Inhalts-Assets erneut.
- Kein Refresh oder App-Neustart startet einen Sync-Marathon.
- Listen bleiben waehrend der Anzeige stabil.
