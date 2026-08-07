# ADR 0025: Kurzlebiger kontenübergreifender Deckversand

- Status: Accepted
- Datum: 7. August 2026
- Ergänzt: ADR 0021, ADR 0022 und ADR 0023

## Kontext

Nutzer sollen eigene Decks und Sammlungen an Freunde oder Partner mit einem anderen Flash-n-Flip-Konto senden können. Der VPS darf dabei weder Deckinhalte noch Medien speichern oder als Downloadquelle dienen. Kontenübergreifendes Teilen darf außerdem nicht die dauerhafte Vertrauensgruppe der Geräte eines Kontos erweitern.

## Entscheidung

1. „Teilen“ erzeugt eine einmalige, auf 15 Minuten begrenzte Sitzung. Der QR-Code beziehungsweise Link enthält Sitzungs-ID und ein zufälliges Geheimnis im URL-Fragment; der VPS speichert nur dessen SHA-256-Hash.
2. Genau ein Gerät des Absenderkontos und ein Gerät des Empfängerkontos handeln nach ausdrücklicher Bestätigung des Absenders eine WebRTC-Datenverbindung aus.
3. Der VPS autorisiert Teilnehmer und vermittelt ausschließlich begrenzte SDP-/ICE-Signale. Decks, Karten und Medien werden ausschließlich über den WebRTC DataChannel übertragen.
4. Die Sitzung erzeugt keine kontenübergreifende Gerätekopplung, keine Gruppe und keine dauerhafte Beziehung. Weitere Geräte des Empfängerkontos können das empfangene reale Deck anschließend über den bestehenden Direkttransport des eigenen Kontos erhalten.
5. Übertragen werden ein ausgewähltes reales Deck und seine realen Unterdecks. Virtuelle Anki-Richtungen sowie virtuelle Xefjord-Pivot-Decks werden niemals serialisiert. Sie werden auf dem Zielgerät aus den vorhandenen realen Decks bei Bedarf neu gebildet.
6. Lernstände und Peer-Synchronisationsnachrichten werden bei einem kontenübergreifenden Transfer nicht übertragen.
7. Namen werden nach NFKC-Normalisierung, Randtrimmen, Leerraumverdichtung und kleinschreibender Zuordnung verglichen. Existiert genau ein gleichnamiges Deck, wird es nur ersetzt, wenn `updatedAt` des Eingangs strikt neuer ist. Gleich alte oder ältere Eingänge werden ignoriert.
8. Mehrdeutige gleichnamige Ziele und ID-Kollisionen mit abweichendem Namen werden sicherheitshalber ignoriert. Es wird niemals willkürlich ein Ziel überschrieben.
9. Ein Update behält lokale Anzeigeeinstellungen und Lernstände unveränderter Karten-IDs. Neue Karten erhalten einen lokalen Anfangszustand; entfernte Karten werden aus der lokalen Lernwarteschlange entfernt.
10. Decks und Medien werden erst nach vollständiger Hash-, Größen-, MIME- und Inhaltsprüfung gemeinsam in einer IndexedDB-Transaktion sichtbar gemacht. Unterbrechungen bleiben wiederaufnehmbar.

## Konsequenzen

- Besitz oder Lizenzierung eines geteilten Inhalts wird technisch nicht erweitert; der Absender muss zum Teilen berechtigt sein.
- Ohne direkten WebRTC-Pfad scheitert die Übertragung, da es absichtlich keinen VPS-Payload-Fallback gibt.
- Der Empfänger sieht vor Annahme exakt, wie viele Decks neu, aktualisiert oder ignoriert werden.
- Lokale, kontenübergreifend empfangene Decks bleiben offline und nach Neustart nutzbar. Ihre Lernstände werden nicht an nicht existente VPS-Karten-IDs gesendet.

## Release-Gates

- Ein Gerät desselben Kontos kann eine Einladung nicht als Empfänger beanspruchen.
- Ein fremdes, nicht beteiligtes Konto kann Sitzung und Signale nicht lesen.
- Das Klartextgeheimnis erscheint weder in PostgreSQL noch in Serverlogs.
- Nach Abschluss werden alle Signale gelöscht; es entsteht kein `device_pairings`-Datensatz zwischen Konten.
- Sammlungen übertragen nur reale Decks; virtuelle Ansichten entstehen ausschließlich aus lokal vorhandenen Grundlagen.
- Gleichnamige Eingänge werden nur bei strikt neuerem Zeitstempel übernommen; ältere, gleiche, mehrdeutige oder kollidierende Eingänge bleiben unverändert.
