# Datenschutzhinweise

Status: nicht für einen öffentlichen Start freigegeben.

Betreiber: `TODO_OPERATOR`

Rechtskontakt: `TODO_LEGAL_CONTACT`

Hosting: `TODO_HOSTING`

Die konkrete Aufbewahrungsrichtlinie ist vor dem öffentlichen Start als
`TODO_RETENTION` festzulegen. Die technische Datenübersicht befindet sich in
`docs/legal/data-map.md`.

## Gerätekopplung und direkte Übertragung

Nach der Anmeldung registriert Flash-n-Flip das jeweilige Gerät automatisch
beim Konto. Der VPS verarbeitet dafür Geräte-ID, Gerätenamen, Plattform,
Fähigkeiten, öffentlichen Geräteschlüssel und den Zeitpunkt des letzten
Kontakts. Aktive Geräte desselben Kontos können ohne QR-Code, Kopplungslink oder
Zahlencode eine kurzlebige Verbindungssitzung mit öffentlichen Sitzungsschlüsseln
und kryptografischen Nachweisen aushandeln.

Verbindungs- und WebRTC-Signalisierungsdaten laufen nach fünf Minuten ab. Sie
dienen nur dazu, eine verschlüsselte Direktverbindung zwischen den eigenen
Geräten aufzubauen. Lernsets, Karten und Medien werden über diese
Direktverbindung übertragen und nicht als Teil der Kopplung auf dem VPS
gespeichert. Lokale Transfers können vorübergehend validierte Chunks im
Gerätespeicher ablegen, damit eine unterbrochene Übertragung fortgesetzt werden
kann.

Der Status `Unplug` bezeichnet rein lokalen Betrieb, `Network` eine geöffnete
Direktverbindung und `Globe` die Erreichbarkeit des VPS für Geräteerkennung und
Signalisierung. Ein Gerät kann in den Einstellungen widerrufen werden.

Zum ausdrücklich ausgelösten Teilen eines Lernsets mit einem anderen Konto
verarbeitet der VPS für höchstens 15 Minuten eine zufällige Sitzungs-ID, die
beteiligten Konto- und Geräte-IDs, öffentliche Sitzungsschlüssel,
kryptografische Nachweise sowie WebRTC-Signale. Das im QR-Code oder Link
enthaltene Geheimnis wird serverseitig nur als SHA-256-Hash gespeichert. Der
Absender sieht das beanspruchende Konto und Gerät und muss die Übertragung
bestätigen. Lernset-, Karten- und Mediendaten werden ausschließlich über die
verschlüsselte Direktverbindung übertragen; Lernstände werden nicht geteilt.
Nach Abschluss werden die Signale gelöscht und es entsteht keine dauerhafte
Verknüpfung zwischen den Konten.

Diese Datei ist ein Implementierungsplatzhalter und keine Rechtsberatung.
