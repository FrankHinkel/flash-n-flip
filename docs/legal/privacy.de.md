# Datenschutzhinweise

Status: **nicht für einen öffentlichen Start freigegeben**.

Betreiber: `TODO_OPERATOR`

Rechtskontakt: `TODO_LEGAL_CONTACT`

Hosting und Serverstandort: `TODO_HOSTING`

Aufbewahrung der Betriebslogs und des inaktiven Altbestands:
`TODO_RETENTION`.

## Lokale Nutzung ohne Benutzerkonto

Flash-n-Flip besitzt im Generation-2-Produktfluss kein Benutzerkonto auf dem
VPS. Private Lernsets, Karten, Einstellungen, Medien und Lernfortschritte
werden im Browser in IndexedDB beziehungsweise in installierten Apps in SQLite
und dem lokalen Medienspeicher abgelegt. Die Daten werden nicht für
Registrierung, Profilbildung, Community-Veröffentlichung oder ein privates
Serverbackup hochgeladen.

Die lokale Speicherung ist technisch erforderlich, um den ausdrücklich
gewünschten Offline-Editor, Lernfortschritt, Neustart und Export bereitzustellen.
Nutzer können einzelne Decks löschen, einen vollständigen lokalen Export
erstellen oder die Website-/App-Daten über ihr Betriebssystem entfernen. Ein
lokaler Export liegt anschließend unter alleiniger Kontrolle des Nutzers.

## Kuratierte Sammlungen und PWA

Die öffentliche Route `/pwa`, der Service Worker und ein statisches,
versioniertes Bundle kuratierter Sammlungen werden von `flash-n-flip.com`
ausgeliefert. Der Abruf ist nicht mit einem Flash-n-Flip-Konto verbunden.
Installierte Sammlungen werden lokal gespeichert und können lokal wieder
gelöscht oder aktualisiert werden.

## Gerätekopplung und direkte Übertragung

Eine Kopplung wird ausdrücklich über `/connect` gestartet. Der Connect-Dienst
hält für höchstens fünf Minuten eine zufällige Sitzungs-ID, Hashes zweier
zufälliger Capabilities, die ausgehandelte Protokollversion sowie
Ende-zu-Ende-verschlüsselte WebRTC-Signale im Arbeitsspeicher. Er erhält keine
E-Mail-Adresse und kein Benutzerprofil. Die Capabilities stehen im
Authorization-Header und müssen deshalb auch in Proxy- und Anwendungslogs
redigiert bleiben.

Decks, Karten, Medien und Lernereignisse werden nach dem Verbindungsaufbau
direkt über den WebRTC DataChannel übertragen. Der Connect-VPS ist kein TURN-
oder Nutzdatenrelay. Bereits gekoppelte Geräte speichern ihre Vertrauens- und
Replikationsdaten lokal.

Für einen zusätzlichen direkten Netzwerkkandidaten kann das Gerät eine
STUN-Binding-Anfrage senden. Dabei verarbeitet der STUN-Dienst technisch die
öffentliche Quell-IP und den UDP-Port und antwortet an diese Adresse. Die reale
Logkonfiguration von Container und Host sowie ihre Löschfrist müssen vor dem
öffentlichen Start noch verbindlich geprüft werden.

## Betriebsdaten und inaktiver Altbestand

Der HTTP-Dienst erzeugt Betriebslogs für Sicherheit und Fehlerdiagnose. Die
tatsächlich protokollierten Felder, Empfänger, Serverstandorte, Zugriffsrechte,
Rotation und konkrete maximale Aufbewahrungsdauer sind noch festzulegen. Die
Standardkonfiguration kann insbesondere Quell-IP und Quellport enthalten.

Frühere PostgreSQL-, Upload- und Sicherungsbestände sind im neuen Zielbetrieb
nicht eingebunden, können bis zur getrennt freizugebenden VPS-Bereinigung aber
noch auf dem privaten Server vorhanden sein. Zweck und Löschtermin dieser
Rollback-Grundlage müssen vor einem öffentlichen Start dokumentiert werden.

## Rechtlicher Prüfstatus

Diese Datei beschreibt den aktuellen technischen Datenfluss, ersetzt aber
keine anwaltliche Prüfung. Insbesondere Betreiberangaben, Rechtsgrundlagen,
Betroffenenrechte, zuständige Aufsichtsbehörde, Hosting, Minderjährige,
Aufbewahrungsfristen und der Umgang mit dem Altbestand sind vor einem
öffentlichen Start zu vervollständigen.
