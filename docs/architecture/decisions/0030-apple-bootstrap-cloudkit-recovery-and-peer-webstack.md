# ADR 0030: Apple-Bootstrap, CloudKit-Recovery und Peer-Webstack

- Status: Accepted
- Datum: 9. August 2026
- Ergänzt: ADR 0029
- Präzisiert und ersetzt perspektivisch Teile von: ADR 0019 und ADR 0020

## Kontext

ADR 0029 legt eine kontolose, plattformübergreifende Local-first-Anwendung mit
direkter WebRTC-Replikation fest. Drei Produktfragen blieben dort offen:

1. Eigene iPads und Macs sollen sich über denselben Apple Account automatisch
   einrichten, ohne eine QR-Kopplung pro Gerät.
2. Familienmitglieder sollen nach einer einmaligen Freigabe ihre eigenen
   Apple-Geräte automatisch verwenden können, ohne persönlichen Lernfortschritt
   zusammenzuführen.
3. Ein gekoppelter Windows-, Linux-, Android- oder Mac-Browser soll den
   vollständigen Webstack direkt vom aktualisierten iPhone erhalten. Nur eine
   kleine Bootstrap-PWA soll von `flash-n-flip.com` kommen.

Diese Funktionen dürfen weder ein neues Flash-n-Flip-Benutzerkonto auf dem VPS
noch CloudKit als konkurrierende Live-Synchronisationsautorität einführen. Die
Auslieferung ausführbaren Webcodes durch ein Peer-Gerät benötigt außerdem eine
andere Vertrauenswurzel als die Gerätekopplung.

## Entscheidung

### 1. Lokale Autorität bleibt unverändert

SQLite ist in installierten Anwendungen und IndexedDB/OPFS ist in der PWA die
fachliche Autorität. Mutationen werden vor UI-Bestätigung in einer dauerhaften
Outbox gespeichert. Reviews bleiben append-only; Konflikte werden je Entität
aufgelöst. CloudKit und der Connect-Dienst besitzen keinen fachlichen
Master-Datensatz und keinen konkurrierenden Replikationscursor.

### 2. Apple Account statt Flash-n-Flip-Registrierung

Native Apple-Geräte prüfen den iCloud-Accountstatus und richten den lokalen
Bestand darüber ein. „Mit Apple anmelden“ erzeugt dabei kein zusätzliches
Flash-n-Flip-Konto und keine Benutzerverwaltung auf dem VPS.

Ein synchronisierbarer iCloud-Keychain-Wiederherstellungsanker darf zwischen
Geräten desselben Apple Accounts übertragen werden. Gerätespezifische private
Identitätsschlüssel bleiben dagegen gerätegebunden. Ein neues Gerät stellt den
Wiederherstellungsanker wieder her, entschlüsselt einen geprüften Backupstand,
erzeugt einen eigenen Geräteschlüssel und wird als eigenständiges Gerät sichtbar.

### 3. CloudKit ist Backup-, Recovery- und Bootstrap-Dienst

Die private CloudKit-Datenbank darf folgende anwendungsseitig verschlüsselte
Daten enthalten:

- versionierte Backupmanifeste und verschlüsselte Backupobjekte;
- Wiederherstellungs- und Schema-Metadaten;
- eine minimale private Geräteliste mit öffentlichen Schlüsseln, Status und
  Widerrufen;
- Informationen, die bereits vertrauten Geräten ein direktes Wiederfinden
  ermöglichen.

CloudKit erhält keine unverschlüsselten Decks, Medien oder Lernfortschritte und
keine Autorität zur fachlichen Konfliktentscheidung. Nach dem Bootstrap erfolgt
laufende Replikation bevorzugt direkt per WebRTC. iCloud-Ausfall, volles
Kontingent oder deaktivierter iCloud-Schlüsselbund sperren die lokale App nicht.

Ein Wechsel des Apple Accounts friert die bestehende Cloud-Anbindung ein. Die
App darf lokale Daten weder löschen noch automatisch mit dem neuen Account
vermischen. Sie bietet ausdrücklich lokales Behalten, Export, kontrollierte
Neu-Verknüpfung und Löschung an.

### 4. Familie verwendet explizite CloudKit-Freigaben

Die App versucht nicht, Apples Family-Sharing-Mitglieder automatisch zu
ermitteln. Eine Familienbibliothek wird über eine private `CKShare`-Freigabe
eingerichtet. Jedes Familienmitglied nimmt die Einladung einmal pro Apple
Account ausdrücklich an. Danach kann dessen private Apple-Gerätefamilie die
Freigabe ohne erneute Gerätekopplung verwenden.

Gemeinsame Decks, Collections und Medien bilden eine eigene Domäne. Persönliche
Decks, Einstellungen, Review-Ereignisse und Schedulerzustände bleiben
standardmäßig pro Person getrennt. Austritt, Entfernung oder Widerruf rotieren
die betroffenen gemeinsamen Schlüssel, ohne persönliche Daten anderer
Teilnehmer zu löschen.

### 5. Die PWA-Origin liefert nur einen stabilen Bootstrap

`https://flash-n-flip.com` liefert eine kleine, auditierbare Bootstrap-PWA mit:

- Web-App-Manifest und Icons;
- Pairing- und Rendezvous-Client;
- Signatur- und Hashprüfung;
- einem möglichst stabilen, root-skopierten Service Worker;
- versionsbezogener Cacheverwaltung, atomarer Aktivierung und Rollback.

Die erste Installation sowie die Wiederherstellung nach vollständigem Löschen
der Browserdaten benötigen diese HTTPS-Origin. Nach erfolgreicher Installation
bleibt die PWA mit bereits lokal vorhandenen Daten offline nutzbar.

### 6. Der App-Store-Build enthält den vollständigen Webstack

Jeder Apple-App-Build enthält einen reproduzierbar gebauten Webstack mit:

- monotoner Build-ID und App-Version;
- unterstützten Protokoll- und Schema-Versionen;
- Mindestversion des Bootstraps;
- Dateiliste, Größen und kryptografischen Hashes;
- einer Signatur aus dem kontrollierten Releaseprozess.

Der private Release-Signierschlüssel liegt weder im App-Bundle noch auf dem VPS,
in CloudKit oder auf einem Benutzergerät. Der App-Store-Build enthält nur das
fertig signierte Paket und die notwendigen öffentlichen Prüfschlüssel.

### 7. Das iPhone darf den signierten Webstack direkt verteilen

Ein gekoppeltes iPhone überträgt Manifest und fehlende Webstack-Dateien direkt
über einen WebRTC DataChannel. Peer-Vertrauen allein autorisiert niemals die
Ausführung von Code. Der Browser prüft zuerst die Release-Signatur und danach
jede Datei gegen das signierte Manifest.

Der neue Stack wird in einen getrennten versionsbezogenen Cache geschrieben.
Er wird erst aktiviert, wenn alle Pflichtdateien vollständig geprüft und die
lokalen Schemamigrationen vorbereitet sind. Die vorherige funktionierende
Version bleibt als Rollback erhalten. Ein älteres Gerät darf einen Browser
nicht automatisch herabstufen.

Nutzdaten, importierte Inhalte und Peer-Nachrichten dürfen nie in ausführbare
Webstack-Pfade oder den Bootstrap-Cache gelangen. Content Security Policy,
strikte Ressourcentypen und getrennte Protokollkanäle schützen diese Grenze.

### 8. Update-Eigentum bleibt plattformspezifisch

Native Apple-Anwendungsversionen und ihr gebündelter Webstack kommen
ausschließlich über den Apple App Store. Das iPhone lädt keinen Ersatz für
seinen nativen Anwendungscode aus dem Netz oder von Peers.

Ein PWA-Client darf dagegen eine neuere, gültig release-signierte Webstack-
Version von einem aktualisierten iPhone übernehmen. App-Version,
Webstack-Build, Datenbankschema, Paketformat, Replikationsprotokoll und
Rendezvous-Protokoll bleiben getrennte Versionsachsen.

### 9. Nicht-Apple-Geräte bleiben unabhängig erreichbar

QR-/Datei-Kopplung bleibt der universelle Weg für Browser und spätere native
Android-/Windows-Clients. CloudKit JS beziehungsweise CloudKit Web Services darf
später als optionaler Apple-Account-Recoveryweg geprüft werden, ist aber keine
Voraussetzung für die plattformübergreifenden Domain- und Sync-Protokolle.

## Abgelehnte Alternativen

### Vollständigen Webstack vom VPS oder einem CDN laden

Dies würde zwar die Installation vereinfachen, aber den VPS beziehungsweise
einen Content-Dienst wieder zum dauerhaften Anwendungsauslieferer machen. Der
beschlossene Peer-Weg hält den Browserstack auf dem Stand eines tatsächlich
aktualisierten, Store-signierten iPhones.

### Gerätekopplung als Signatur für Anwendungscode verwenden

Ein kompromittiertes oder manipuliertes Peer-Gerät könnte damit Code unter der
vertrauenswürdigen Origin einschleusen. Deshalb bleibt die Offline-Release-
Signatur eine unabhängige Vertrauenswurzel.

### CloudKit als laufenden zweiten Sync-Kanal verwenden

Zwei konkurrierende Cursor- und Konfliktautoritäten könnten Reviews duplizieren,
Löschungen wiederbeleben oder Geräte nach langer Offlinezeit auseinanderlaufen
lassen. CloudKit bleibt daher auf Backup, Recovery, Gerätemetadaten und
explizite Familienfreigaben begrenzt.

### Alle Family-Sharing-Mitglieder automatisch freischalten

Die App besitzt keine verlässliche allgemeine Familienmitgliederliste und darf
private Daten nicht aus einer Kauf- oder Speicherfamilie ableiten. Eine
ausdrückliche private `CKShare`-Einladung ist erforderlich.

## Implementierungsstand 0.5.120

Die Entscheidung ist im Quellstand durch plattformneutrale Backup- und
Webstack-Schemata, authentifizierte Chunkverschlüsselung, einen nativen
Keychain-/CloudKit-Adapter, CKShare-Annahme, einen vollständigen gebündelten
Original-Webstack und das WebRTC-Übertragungsprotokoll umgesetzt. Der
root-skopierte Bootstrap-Service-Worker liest ausschließlich atomar aktivierte
Build-Caches; die vorherige Version bleibt als Rollback erhalten.

Die Ed25519-Releasesignatur ist ausdrücklich nicht die Apple-Codesignatur. Der
private Schlüssel bleibt außerhalb von Git, App-Bundle, VPS und CloudKit. Der
iOS-Code lädt oder aktiviert keinen Peer-Code; er verteilt ausschließlich den
bereits im App-Store-Build enthaltenen Webstack an Browser. Damit bleibt die
ungewöhnliche Funktion innerhalb der in Abschnitt 2.5.2 der App Review
Guidelines beschriebenen Grenze zu erläutern und im realen App Review prüfen zu
lassen.

Noch nicht als Produktabnahme erledigt sind reale CloudKit-Container-
Provisionierung, zwei Apple Accounts, Familieninhalte/Widerruf sowie physische
Browserübertragungen. Diese Punkte bleiben Release-Gates und werden nicht durch
Simulator- oder Contract-Tests ersetzt.

Da ein Personal Team keine iCloud-Capability provisionieren kann, ist der
CloudKit-Teil in Release `0.5.120` vorübergehend vollständig deaktiviert: Das
Xcode-Projekt besitzt keine aktiven iCloud-Entitlements, die native Bridge
registriert den CloudKit-Adapter nicht, der Share-Acceptance-Pfad ist nicht
aktiv und die Weboberfläche initialisiert keine Cloudfunktionen. Die bestehende
Implementierung und eine ausdrücklich unreferenzierte
`App.CloudKit.entitlements`-Vorlage bleiben für die spätere Reaktivierung mit
einem kostenpflichtigen Apple Developer Team erhalten. Lokale SQLite-Daten,
Keychain-Geräteidentität, WebRTC-Synchronisation und der signierte Peer-Webstack
sind davon nicht betroffen.

Release `0.5.123` schließt außerdem die Auslieferungsgrenze der Bootstrap-
Origin: `/` öffnet ausschließlich `/connect`, und ein frischer Browser erhält
auf `/app`, `/community` oder den stillgelegten Kontorouten nur die
Kopplungshülle. Der Bootstrap-Service-Worker lädt weder `/pwa` noch
Next.js-Produktrouten oder kuratierte Kataloge im
Hintergrund vor. Ein atomar aktivierter Peer-Webstack bedient diese Routen
weiterhin vollständig aus seinem signierten Build-Cache. Die öffentliche
Hintertür `/pwa` bleibt absichtlich erhalten, setzt aber erst nach einem
ausdrücklichen Aufruf eine lokale Fallback-Markierung und kann daher
nicht mehr durch den normalen Startpfad oder die Cache-Vorbereitung aktiviert
werden.

Release `0.5.124` schließt den Lebenszyklus zwischen Bootstrap und Peer-Cache:
`serviceWorker.ready` allein gilt nicht mehr als ausreichende Kontrolle. Vor
dem ersten Abruf von `app.css` und `app.js` muss `/sw.js` das aktuelle Dokument
tatsächlich kontrollieren; andernfalls wird die Bootstrap-Seite vor der
Kopplung einmal automatisch neu geladen und ein weiterer Fehlschlag sichtbar
abgebrochen. Der Browser erzeugt die Einladung automatisch und wechselt nach
signierter Aktivierung ohne zusätzliche Bestätigung in die Produktoberfläche.
Die Apple-Hülle wechselt nach vollständiger, zuverlässig geordneter
Dateiauslieferung ebenfalls automatisch aus dem Koppelmodus zurück. Das
WebRTC-Protokoll bleibt dabei Generation 1 und damit mit Release `0.5.122`
kompatibel.

Release `0.5.125` priorisiert den signierten App-Handoff vor Deck-, Lernstands-
und Medienabgleich. Bereits eingetroffene lokale Synchronisationsnachrichten
bleiben bis zur atomaren Webstack-Aktivierung geordnet im Arbeitsspeicher und
werden anschließend unverändert über die idempotente lokale Autorität
verarbeitet. Dadurch kann ein großer Medienbestand die App-Auslieferung nicht
mehr blockieren. Bietet ein verbundenes iPhone innerhalb von zehn Sekunden
keinen gebündelten Webstack an, endet der Browser nicht mehr irreführend im
Zustand „Verbunden“, sondern fordert sichtbar ein aktuelles beziehungsweise
vollständig gebautes iPhone-Paket an. Ein im nativen Paket fehlendes
Release-Manifest ist ebenfalls ein expliziter Fehler.

Release `0.5.126` behandelt den internen Wechsel von der nativen
Connect-Hülle in die Produktoberfläche als Wiederverwendung derselben
SQLite-Verbindung. Das iOS-Plugin kennzeichnet diesen Zustand mit
`CreateConnection: Connection … already exists`; der Adapter prüft anschließend
den Öffnungszustand und verwendet die vorhandene Verbindung weiter, statt den
erwarteten Zustand als Startfehler anzuzeigen. Eine geschlossene vorhandene
Verbindung wird geöffnet. Datenbank, Outbox und laufender Peer-Abgleich werden
dabei weder gelöscht noch neu angelegt.

## Konsequenzen

### Positiv

- Eigene Apple-Geräte benötigen keine manuelle Kopplung.
- Ein vorhandener PC wird nach einmaliger Kopplung zum vollwertigen Offline-
  Deckeditor.
- Der VPS benötigt langfristig weder Benutzerverwaltung noch private Daten oder
  umfangreiche Webstack-Auslieferung.
- App-Store-Updates des iPhones können signierte PWA-Updates direkt an bekannte
  Browser weitergeben.
- Private Backups zählen zum iCloud-Kontingent des Benutzers statt zum
  VPS-Speicher.

### Kosten und Risiken

- Die Bootstrap-PWA und ihr Release-Prüfschlüssel sind eine hochkritische
  Vertrauensgrenze und müssen klein und auditierbar bleiben.
- Ein verlorener iCloud-Zugang oder gelöschter iCloud-Schlüsselbund benötigt
  einen zusätzlichen Recovery-Datei- oder Wiederherstellungscode-Pfad.
- Browser können lokalen Speicher löschen; Export, Backup und verständliche
  Warnungen bleiben erforderlich.
- CloudKit-Verfügbarkeit und Kontingent beeinflussen Backup und Bootstrap, aber
  nicht die lokale Nutzung.
- Ohne TURN können restriktive Netze direkte Übertragung verhindern; Datei,
  AirDrop und LAN bleiben notwendige Ausweichwege.
- Die ungewöhnliche Webstack-Auslieferung wird in den App-Review-Hinweisen
  transparent beschrieben und benötigt reale Review-Testschritte.

## Release-Gates

- Ein neues eigenes Apple-Gerät stellt ohne QR-Code einen geprüften lokalen
  Bestand wieder her.
- Ein Accountwechsel vermischt oder löscht keine lokalen Daten.
- Ein Familienmitglied sieht nur ausdrücklich freigegebene Inhalte; persönlicher
  Lernfortschritt bleibt getrennt.
- Ein manipulierter Peer, ein verändertes Manifest oder eine veränderte Datei
  aktiviert keinen Webstack.
- Eine unterbrochene Aktivierung startet weiterhin die vorherige Version.
- Ein älteres iPhone kann keinen automatischen Downgrade auslösen.
- CloudKit-Ausfall und Connect-Ausfall sperren die lokale App nicht.
- Der Connect-VPS und STUN empfangen während eines direkten Webstack- oder
  Nutzdatentransfers keine übertragenen Inhalte.
- Datenschutzinformationen und Apple Privacy Labels entsprechen dem realen
  CloudKit-, WebRTC-, Bootstrap- und Store-Datenfluss.

## Referenzen

- [Apple: synchronisierbare Keychain-Einträge](https://developer.apple.com/documentation/security/ksecattrsynchronizable)
- [Apple: private CloudKit-Datenbank](https://developer.apple.com/documentation/cloudkit/ckcontainer/privateclouddatabase)
- [Apple: geteilte CloudKit-Datensätze](https://developer.apple.com/documentation/cloudkit/shared-records)
- [Apple: CloudKit JS](https://developer.apple.com/documentation/cloudkitjs)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [W3C Service Workers](https://www.w3.org/TR/service-workers/)
- [W3C WebRTC](https://www.w3.org/TR/webrtc/)
