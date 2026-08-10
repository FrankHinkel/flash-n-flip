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

Ein aktualisiertes iPhone kann zusätzlich den im App-Store-Build enthaltenen
Web-Anwendungsstack direkt an einen gekoppelten Browser übertragen. Der Browser
prüft eine unabhängige Releasesignatur und die Hashwerte sämtlicher Dateien,
bevor er die neue Version in einem getrennten lokalen Cache aktiviert. Der VPS
überträgt auch diesen Webstack nicht.

Für einen zusätzlichen direkten Netzwerkkandidaten kann das Gerät eine
STUN-Binding-Anfrage senden. Dabei verarbeitet der STUN-Dienst technisch die
öffentliche Quell-IP und den UDP-Port und antwortet an diese Adresse. Die reale
Logkonfiguration von Container und Host sowie ihre Löschfrist müssen vor dem
öffentlichen Start noch verbindlich geprüft werden.

## Apple Account, iCloud-Backup und Familienfreigaben

**Aktueller Stand:** Im Personal-Team-Build ab Release `0.5.120` sind
iCloud-Backup, iCloud-Schlüsselbund-Bootstrap und Familienfreigaben vollständig
deaktiviert. Die App fordert keine iCloud-Berechtigung an und überträgt in
diesem Build keine App-Daten an CloudKit. Die folgende Beschreibung gilt erst
für eine spätere, gesondert geprüfte Reaktivierung.

In der Apple-App kann ein vollständiges lokales Backup in der privaten
CloudKit-Datenbank des angemeldeten Apple Accounts gespeichert werden. Vor dem
Upload verschlüsselt die App Decks, Medien, Einstellungen und Lernfortschritte
blockweise mit AES-256-GCM. Der zugehörige zufällige Wiederherstellungsschlüssel
wird über den iCloud-Schlüsselbund zwischen eigenen Apple-Geräten
synchronisiert. Apple verarbeitet die verschlüsselte Backup-Hülle und die für
CloudKit technisch erforderlichen Metadaten, erhält von Flash-n-Flip aber
keinen Klartextschlüssel.

Ein frisches eigenes Apple-Gerät kann diesen Bestand ohne Flash-n-Flip-Konto
und ohne QR-Kopplung wiederherstellen. Bei einem Apple-Account-Wechsel werden
vorhandene lokale Daten weder gelöscht noch automatisch mit dem neuen Account
vermischt. Das iCloud-Backup kann in den Einstellungen ausdrücklich gelöscht
werden; die lokalen Daten bleiben dabei erhalten.

Eine Familienbibliothek wird nicht aus Apples Family-Sharing-Gruppe abgeleitet,
sondern nur über eine ausdrückliche private CKShare-Einladung freigegeben.
Persönliche Einstellungen und Lernfortschritte bleiben getrennt. Die
fachlichen Austritts-, Widerrufs- und Inhaltsflüsse sind vor einem öffentlichen
Start noch vollständig zu implementieren und rechtlich zu prüfen.

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
