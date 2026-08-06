# Datenschutzhinweise

Status: nicht für einen öffentlichen Start freigegeben.

Betreiber: `TODO_OPERATOR`

Rechtskontakt: `TODO_LEGAL_CONTACT`

Hosting: `TODO_HOSTING`

Die konkrete Aufbewahrungsrichtlinie ist vor dem öffentlichen Start als
`TODO_RETENTION` festzulegen. Die technische Datenübersicht befindet sich in
`docs/legal/data-map.md`.

## Gerätekopplung und direkte Übertragung

Wenn eine angemeldete Person die Gerätekopplung startet, verarbeitet der VPS
die Geräte-ID, den Gerätenamen, die Plattform, Fähigkeiten und den öffentlichen
Geräteschlüssel. Eine Kopplungssitzung enthält außerdem kurzlebige öffentliche
Sitzungsschlüssel und kryptografische Nachweise. Das im QR-Code enthaltene
Kopplungsgeheimnis wird ausschließlich auf den beteiligten Geräten verarbeitet
und weder in PostgreSQL noch in Anwendungslogs gespeichert.

Kopplungs- und WebRTC-Signalisierungsdaten laufen nach fünf Minuten ab. Sie
dienen nur dazu, eine verschlüsselte Direktverbindung zwischen den eigenen
Geräten aufzubauen. Lernsets, Karten und Medien werden über diese
Direktverbindung übertragen und nicht als Teil der Kopplung auf dem VPS
gespeichert. Lokale Transfers können vorübergehend validierte Chunks im
Gerätespeicher ablegen, damit eine unterbrochene Übertragung fortgesetzt werden
kann.

Der Status `Unplug` bezeichnet rein lokalen Betrieb, `Network` eine geöffnete
Direktverbindung und `Globe` die Erreichbarkeit des VPS für Kopplung und
Signalisierung. Ein Gerät kann in den Einstellungen widerrufen werden.

Diese Datei ist ein Implementierungsplatzhalter und keine Rechtsberatung.
