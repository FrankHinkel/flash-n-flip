# ADR 0001: APKG-Import auf dem API-Server

- Status: angenommen
- Datum: 24. Juli 2026

## Kontext

Anki-Pakete enthalten eine SQLite-Collection, Vorlagen und optional Medien.
Aktuelle Pakete verwenden Zstandard-Kompression und ein
Protobuf-Medienmanifest; ältere Pakete verwenden unkomprimierte
`collection.anki2`- oder `collection.anki21`-Datenbanken und ein JSON-Manifest.
Vorlagen und Kartenfelder können nicht vertrauenswürdiges HTML, CSS,
Dateiverweise oder Skripte enthalten.

## Entscheidung

Der API-Server ist alleiniger Eigentümer des APKG-Imports.

- Das Archiv wird mit Grenzen für Uploadgröße, Eintragszahl, entpackte Größe
  und Kompressionsverhältnis gelesen.
- Archivpfade werden nie als Dateipfade übernommen. Nur die Collection wird
  unter einem zufällig erzeugten temporären Namen mit Modus `0600` geöffnet.
- Anki-Templates werden durch einen begrenzten Daten-Renderer verarbeitet.
  JavaScript, CSS, Add-ons, externe URLs und lokale Dateiverweise werden nicht
  ausgeführt oder geladen.
- Karten werden in strukturierte FlashCards-Blöcke konvertiert.
- Bilder und Audio werden anhand ihrer Dateisignatur erkannt, gehasht,
  dedupliziert und privat gespeichert.
- Medien, Decks, Notizen und Karten werden in einer Transaktion registriert.
  Bei einem Fehler werden neu geschriebene Mediendateien entfernt.
- Anki-Review-Historie und Intervalle werden nicht übernommen. Importierte
  Karten besitzen keinen FSRS-Fortschritt und starten als neue Karten.
- Unterdecks werden als getrennte private FlashCards-Decks mit sichtbarer
  Hierarchie im Titel importiert.

## Folgen

Web, iOS und Android verwenden denselben Importpfad und dasselbe kanonische
Datenmodell. Private Medien werden ausschließlich authentifiziert ausgeliefert.
Eine Veröffentlichung bleibt ein separater Vorgang mit unveränderlicher
Revision und Adminfreigabe.

Nicht unterstützte oder beschädigte Medien werden mit einem Importhinweis
ausgelassen. SVG, Video, Template-JavaScript, Template-CSS und externe
Ressourcen werden bewusst nicht übernommen.
