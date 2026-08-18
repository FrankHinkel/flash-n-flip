# Datenschutzhinweise

Status: **technisch aktualisierter Entwurf; noch nicht für einen öffentlichen
Produktivstart freigegeben**.

Stand: 18. August 2026

## Verantwortlicher

Frank Hinkel<br>
Friedenstr. 39<br>
67292 Kirchheimbolanden<br>
Deutschland

Telefon: [+49 6353 749953](tel:+496353749953)<br>
E-Mail: [flash-n-flip@hi-sys.de](mailto:flash-n-flip@hi-sys.de)

## Aktueller Produktumfang

Flash-n-Flip besitzt im aktiven Generation-2-Produktfluss kein Benutzerkonto
auf dem VPS. Private Lernsets, Karten, Einstellungen, Medien und
Lernfortschritte werden im Browser in IndexedDB beziehungsweise in
installierten Apps in SQLite und dem lokalen Medienspeicher abgelegt. Sie
werden nicht für Registrierung, Profilbildung, Community-Veröffentlichung,
Werbung, Analytik oder ein privates Serverbackup an Flash-n-Flip übertragen.

Der öffentliche Server liefert die PWA, die kleine Connect-Hülle und statische,
signierte kuratierte Sammlungen aus. Außerdem vermittelt er auf ausdrücklichen
Wunsch kurzfristig eine direkte Geräteverbindung. Der aktive VPS betreibt keine
Registrierung, Anmeldung, Community, serverseitigen Import, private Uploads,
Zahlungen, Werbung oder TURN-Weiterleitung.

## Lokale Speicherung auf dem Gerät

Die lokale Speicherung dient dem ausdrücklich gewünschten Offline-Editor, dem
Lernen, dem Lernfortschritt, der Wiederherstellung nach einem Neustart, dem
direkten Geräteabgleich und dem lokalen Export. Sie ist für diese Funktionen
technisch erforderlich. Flash-n-Flip verwendet im aktiven Produktfluss keine
nicht erforderlichen Analyse-, Werbe- oder Tracking-Speicherungen.

Nutzer können einzelne Lernsets löschen, einen vollständigen lokalen Export
erstellen oder die Website-/App-Daten über ihr Betriebssystem entfernen. Auf
ausschließlich lokal gespeicherte Inhalte hat der Betreiber technisch keinen
Zugriff. Ein exportiertes Backup liegt unter alleiniger Kontrolle des Nutzers.

## Öffentliche PWA und kuratierte Sammlungen

Beim Abruf von `flash-n-flip.com`, `/pwa`, `/connect`, Rechtstexten und
statischen Sammlungen verarbeitet der Server die technisch übermittelten
Verbindungsdaten. Dazu können IP-Adresse und Port, Zeitpunkt, angeforderte
Route, HTTP-Status, Laufzeit und Request-ID gehören. Der Abruf ist nicht mit
einem Flash-n-Flip-Konto verbunden.

Installierte Sammlungen werden lokal gespeichert und können lokal gelöscht
oder durch ein App-/PWA-Update ersetzt werden. Die Katalogdateien selbst
enthalten keine Nutzerkennung.

## Gerätekopplung und direkte Übertragung

Eine Kopplung wird ausdrücklich über `/connect` gestartet. Der
Rendezvous-Dienst hält für höchstens fünf Minuten eine zufällige Sitzungs-ID,
Hashes zweier zufälliger Capabilities, die ausgehandelte Protokollversion sowie
Ende-zu-Ende-verschlüsselte WebRTC-Signale im Arbeitsspeicher. Er erhält keine
E-Mail-Adresse und kein Benutzerprofil. Authorization-Header, Capability-
Hashes und verschlüsselte Payloads werden im Anwendungslogger redigiert.

Lernsets, Karten, Medien und Lernereignisse werden nach dem Verbindungsaufbau
direkt über den WebRTC DataChannel zwischen den ausdrücklich gekoppelten
Geräten übertragen. Der VPS ist kein TURN- oder Nutzdatenrelay. Bereits
gekoppelte Geräte speichern ihre Vertrauens- und Replikationsdaten lokal.

Ein aktualisiertes iPhone kann zusätzlich den im App-Store-Build enthaltenen
Web-Anwendungsstack direkt an einen gekoppelten Browser übertragen. Der
Browser prüft Releasesignatur und Hashwerte vor der lokalen Aktivierung. Der
VPS überträgt diesen Webstack nicht.

Für einen direkten Netzwerkkandidaten kann ein Gerät eine STUN-Binding-Anfrage
senden. Der STUN-Dienst verarbeitet dabei technisch die öffentliche Quell-IP
und den UDP-Port und antwortet an diese Adresse. Eine dauerhafte STUN-
Anwendungsspeicherung ist nicht vorgesehen; Container- und Hostprotokolle sind
jedoch Teil der noch offenen Aufbewahrungsprüfung.

## Hosting und Empfänger

Die öffentliche Web-, Rendezvous- und STUN-Infrastruktur wird bei folgendem
Auftragsverarbeiter betrieben:

netcup GmbH<br>
Emmy-Noether-Straße 10<br>
76131 Karlsruhe<br>
Deutschland

Der verwendete Serverstandort ist Nürnberg, Deutschland. Eine Übertragung der
aktiven VPS-Daten in ein Drittland ist nicht vorgesehen. Der Abschluss
beziehungsweise aktuelle Bestand des erforderlichen Vertrags zur
Auftragsverarbeitung mit netcup muss vor dem öffentlichen Produktivstart noch
bestätigt werden.

Direkt gekoppelte Geräte sind vom Nutzer ausgewählte Empfänger der unmittelbar
zwischen diesen Geräten übertragenen Daten. Der Betreiber bestimmt diese
Empfänger nicht und erhält die übertragenen privaten Inhalte nicht.

## Zwecke und Rechtsgrundlagen

Die kurzfristige Verarbeitung der Rendezvous- und Verbindungsdaten dient der
Bereitstellung der ausdrücklich gestarteten Direktverbindung. Die Verarbeitung
technischer Betriebsdaten dient der Auslieferung des Dienstes sowie der
Stabilität, Fehlerdiagnose, Missbrauchsabwehr und Systemsicherheit. Als
Rechtsgrundlagen kommen die Bereitstellung des angeforderten Dienstes und das
berechtigte Interesse an einem stabilen und sicheren Betrieb in Betracht. Die
abschließende juristische Zuordnung und Interessenabwägung ist vor dem
öffentlichen Produktivstart zu prüfen.

Für die technisch notwendige lokale Speicherung gilt die Ausnahme für einen
vom Nutzer ausdrücklich gewünschten digitalen Dienst. Nicht erforderliche
Speicherungen würden eine gesonderte Rechtsgrundlage beziehungsweise
Einwilligung benötigen; sie sind im aktuellen Produktfluss nicht aktiviert.

## Betriebslogs und Aufbewahrung

Fastify, Coturn, Docker und das Hostsystem können Betriebs- und
Sicherheitsprotokolle erzeugen. Authorization-Header, Capability-Hashes und
verschlüsselte Payloads werden im Anwendungslogger redigiert. Die tatsächlich
protokollierten Felder, Zugriffsrechte, Rotation und maximale Aufbewahrungsdauer
müssen auf dem laufenden VPS noch verbindlich geprüft und technisch begrenzt
werden. Bis dahin besteht keine Freigabe für einen öffentlichen Produktivstart.

Der Rendezvous-Inhalt im Arbeitsspeicher wird beim Abschluss oder spätestens
nach fünf Minuten verworfen. Für Betriebslogs darf daraus keine fünfminütige
Löschzusage abgeleitet werden.

## Inaktiver Altbestand

Frühere PostgreSQL-, Upload- und Sicherungsbestände sind im aktiven
Generation-2-Dienst nicht eingebunden. Sie können als vorübergehende Rollback-
Grundlage noch auf dem privaten VPS vorhanden sein. Vor einem öffentlichen
Produktivstart müssen ein überprüfter Export-/Migrationsabschluss, ein
konkreter Löschtrigger und die Auslauffrist vorhandener Sicherungen festgelegt
werden.

## Apple-Dienste

Im derzeitigen Personal-Team-Build sind iCloud-Backup,
iCloud-Schlüsselbund-Bootstrap und CloudKit-Familienfreigaben deaktiviert. In
diesem Build fordert Flash-n-Flip keine iCloud-Berechtigung an und überträgt
keine App-Daten an CloudKit. Vor einer späteren Aktivierung ist eine neue
Datenschutzprüfung erforderlich.

Die Bereitstellung der iOS-App über den App Store unterliegt zusätzlich der
eigenen Datenverarbeitung durch Apple. Vor einer EU-Veröffentlichung müssen die
App-Store-Datenschutzangaben und der DSA-Trader-Status abschließend festgelegt
werden.

## Rechte betroffener Personen

Soweit der Betreiber personenbezogene Daten verarbeitet, bestehen nach den
gesetzlichen Voraussetzungen insbesondere Rechte auf Auskunft, Berichtigung,
Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch.
Anfragen können an `flash-n-flip@hi-sys.de` gerichtet werden.

Der Betreiber kann ausschließlich lokal gespeicherte Lerninhalte nicht einem
Nutzer zuordnen, einsehen, berichtigen oder löschen. Diese Daten können Nutzer
direkt in der App, über einen lokalen Export oder durch Entfernen der App-/
Website-Daten kontrollieren.

Betroffene Personen können sich bei einer Datenschutzaufsichtsbehörde
beschweren. Für den Sitz des Verantwortlichen ist voraussichtlich zuständig:

Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit
Rheinland-Pfalz<br>
Hintere Bleiche 34<br>
55116 Mainz<br>
E-Mail: `poststelle@datenschutz.rlp.de`<br>
Website: <https://www.datenschutz.rlp.de/>

## Minderjährige

Flash-n-Flip ist eine Lernanwendung und kann deshalb auch von Minderjährigen
verwendet werden. Der aktuelle kontolose Produktfluss hält private Lerninhalte
lokal und enthält weder personalisierte Werbung noch öffentliche
Veröffentlichung oder Profilbildung. Eine abschließende Alters-, Eltern- und
App-Store-Einstufung muss vor dem öffentlichen Produktivstart festgelegt und
in allen Sprachen einheitlich beschrieben werden.

## Offener Prüfstatus

Diese Hinweise beschreiben den aktuellen technischen Datenfluss, ersetzen aber
keine anwaltliche Freigabe. Offen bleiben insbesondere die reale
Logkonfiguration und Aufbewahrungsfrist, der Altbestand, der netcup-
Auftragsverarbeitungsvertrag, die geschäftliche beziehungsweise steuerliche
Einordnung, der DSA-Trader-Status und die Minderjährigenregelung.
