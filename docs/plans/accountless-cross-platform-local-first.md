# Masterplan: Kontoloses, Apple-firstes und plattformübergreifendes Flash-n-Flip

> Status: **Freigegeben – harter lokaler Schnitt umgesetzt, VPS-Deployment ausstehend**
>
> Stand: **9. August 2026**
>
> Arbeitsgrundlage: `codex/accountless-rendezvous` / Release `0.5.118`
>
> Geltungsbereich: `/Users/frank/Documents/flash-n-flip`
>
> Architekturbezug: ADR 0018, ADR 0019, ADR 0029, ADR 0030 und ADR 0031

## 1. Zweck und Pflege dieser Datei

Diese Datei ist die verbindliche Master-Checkliste für die Umstellung von
Flash-n-Flip. Sie führt Produktentscheidungen, Architektur, Reihenfolge,
Abnahmekriterien, Release-Gates und den tatsächlich erreichten Stand zusammen.

Bis zur ausdrücklichen Freigabe dieses Plans beginnen keine weiteren
Umstellungsarbeiten. Nach der Freigabe gilt:

- Jede Umsetzungseinheit aktualisiert die betroffenen Kontrollkästchen.
- Ein Punkt wird nur mit nachprüfbarer Evidenz als erledigt markiert.
- Evidenz umfasst mindestens relevante Tests und den zugehörigen Commit.
- Deployment-Punkte benötigen zusätzlich den ausgerollten Release-Stand und
  einen Test über den tatsächlichen öffentlichen Pfad.
- Teilweise erledigte Punkte bleiben offen und erhalten einen kurzen
  Zwischenstand.
- Neue oder geänderte Grundsatzentscheidungen werden zuerst als ADR erfasst.
- Release-Blocker dürfen nicht durch eine redaktionelle Statusänderung
  übergangen werden.
- Für den einzigen aktuellen Nutzer wurde am 9. August 2026 ausdrücklich ein
  harter Generationenschnitt freigegeben: alte private Daten und Lernstände
  müssen nicht migriert werden; kuratierte Quellen und Inhalte bleiben erhalten.

### Statuslegende

- `[x]` umgesetzt und nachgewiesen
- `[ ]` offen
- `Zwischenstand:` teilweise vorhanden, aber noch nicht abgenommen
- `Release-Blocker:` verhindert die Freigabe oder Abschaltung des alten Pfads
- `Später:` bewusst nicht Teil des ersten Apple-Releases

## 2. Verbindliches Zielbild

Flash-n-Flip startet als native iOS-/iPadOS-Anwendung und läuft anfangs auch als
kompatible iPhone-/iPad-App auf Apple-silicon-Macs. Die Anwendung verwendet die
bestehende Weboberfläche, ist jedoch keine vom VPS geladene Web-Hülle. Der
Webstack, die lokale Datenbank, Imports, Audioverarbeitung, Sicherung und
Gerätekopplung gehören zur installierten Anwendung.

Android-, Windows-, Linux- und weitere Mac-Geräte können zunächst eine PWA
verwenden. Eine kleine, stabile Bootstrap-PWA kommt von `flash-n-flip.com`; den
vollständigen signierten Webstack erhält ein gekoppelter Browser direkt vom
iPhone. Spätere native Android- und Windows-Anwendungen verwenden dieselben
Domain-, Paket-, Import-, Replikations- und Konfliktverträge.

Private Decks, Collections, Medien, Einstellungen und Lernfortschritte bleiben
lokal. Direkter Austausch erfolgt bevorzugt per WebRTC DataChannel. Der VPS
vermittelt nur kurzlebige, Ende-zu-Ende verschlüsselte Verbindungsdaten und
bietet STUN. Er speichert langfristig weder Benutzerkonten noch private
Nutzdaten, führt keine Imports aus und transportiert keine Decks oder Medien.

### 2.1 Zielkomponenten

```text
iPhone / iPad / Apple-silicon Mac
  - gebündelter und Store-signierter Webstack
  - SQLite und lokaler Medienspeicher
  - Keychain und iCloud-Schlüsselbund
  - verschlüsseltes CloudKit-Backup und Geräte-Bootstrap
  - lokaler Import und native Audiooptimierung
  - WebRTC-Peer-Sync und Webstack-Auslieferung

Windows / Linux / Android / Mac-Browser
  - kleine Bootstrap-PWA von flash-n-flip.com
  - signierter Webstack direkt vom iPhone
  - IndexedDB/OPFS und dauerhafte Outbox
  - Offline-Editor und Offline-Lernen
  - WebRTC-Peer-Sync

Connect-VPS
  - HTTPS und minimale Bootstrap-PWA
  - flüchtige Rendezvous-Signalisierung im RAM
  - STUN-only
  - minimale payloadfreie Betriebsdiagnostik
  - keine Konten, keine privaten Daten, kein TURN, kein Nutzdatenrelay

Apple iCloud
  - automatische Aufnahme eigener Apple-Geräte
  - synchronisierbarer Wiederherstellungsschlüssel
  - verschlüsselte Backups und Wiederherstellungsmetadaten
  - explizite CKShare-Freigaben für Familienmitglieder
  - keine konkurrierende Live-Sync-Autorität
```

## 3. Beschlossene Produkt- und Architekturregeln

### 3.1 Local-first und Plattformneutralität

- [x] Apple-firstes, aber plattformneutrales Zielbild ist dokumentiert.
- [x] Gemeinsame Rendezvous-v1-Schemas liegen im Domain-Paket.
- [ ] SQLite wird in installierten Apps zur Autorität für Decks, Collections,
      Medienmetadaten, Einstellungen, Lernfortschritt, Outbox und Widerrufe.
- [x] IndexedDB wird in der PWA zur dauerhaften lokalen Autorität; Medienbytes
      liegen in der lokalen Repository-Ablage. OPFS bleibt eine spätere
      Speicheroptimierung.
- [ ] Apple-, Browser-, Android- und Windows-Adapter bestehen dieselben
      Repository-, Paket- und Sync-Contract-Tests.
- [ ] Gemeinsame Pakete importieren keine Capacitor-, Swift-, SQLite-,
      IndexedDB-, CloudKit-, Android-, Windows- oder WebRTC-Adapter.
- [ ] Scheduler-, Deck-, Collection-, Import-, Validierungs- und Konfliktregeln
      werden nicht pro Plattform dupliziert.
- [ ] Jede private Funktion bleibt bei Ausfall von Connect, iCloud und Store
      lokal nutzbar, soweit die dafür erforderlichen Daten bereits lokal sind.

### 3.2 Kein dauerhaftes Benutzerkonto auf dem VPS

- [x] Der anonyme Rendezvous-Dienst läuft parallel zum bisherigen Backend.
- [x] Neue Apple- und PWA-Nutzer benötigen kein Flash-n-Flip-Serverkonto.
- [x] Registrierung und Login sind aus dem lokalen Produktfluss entfernt und
      leiten auf `/pwa` um.
- [x] Der aktive VPS-Zielstack speichert keine E-Mail-Adressen, Passworthashes,
      Decks, Collections, Lernstände, Medien oder privaten Backups.
- [x] Der einzige aktuelle Nutzer hat bestätigt, dass bestehende private Daten
      und Lernstände verworfen beziehungsweise neu erzeugt werden dürfen.
- [x] PostgreSQL, Admin-App, Authentifizierung,
      private Uploads und serverseitige Imports kontrolliert stillgelegt.
      Zwischenstand: Code und Compose sind umgestellt; der reale VPS wird erst
      mit einem später ausdrücklich freigegebenen `!!!!!`-Deployment geändert.

### 3.3 Verbindliche Datenintegrität

- [ ] Jede Entität, Mutation und jedes Review-Ereignis erhält eine stabile,
      clientgenerierte UUIDv7.
- [ ] Eine Mutation liegt dauerhaft in der lokalen Outbox, bevor die UI Erfolg
      bestätigt.
- [ ] Review-Ereignisse bleiben append-only und werden nach Identität vereinigt,
      niemals überschrieben.
- [ ] Peer-Zustellung ist bei Wiederholung idempotent.
- [ ] Empfang, Validierung, Anwendung und Acknowledgement-/Watermark-Fortschritt
      werden auf dem Zielgerät atomar gespeichert.
- [ ] Löschungen verwenden Tombstones und signierte Widerrufsereignisse.
- [ ] Konflikte werden je Entität definiert; pauschales Last-write-wins ist
      verboten.
- [ ] Medienübertragung bleibt hashbasiert, resumierbar und von Metadaten
      getrennt.
- [ ] Kein Abbruch, Neustart, Gerätewechsel oder Speichermangel darf lokale
      Daten stillschweigend verwerfen.

## 4. Vertrauen, Schlüssel und Gerätemodell

### 4.1 Schlüsselhierarchie

- [ ] Offline-Release-Signierschlüssel, Account-Wiederherstellungsschlüssel,
      Geräteschlüssel und Sitzungsschlüssel werden strikt getrennt.
- [ ] Der private Release-Signierschlüssel liegt niemals in einer App, auf dem
      VPS oder in CloudKit.
- [ ] Jede Installation erzeugt einen eigenen Geräteschlüssel.
- [ ] Apple-Geräte schützen lokale Schlüssel über Keychain beziehungsweise
      Secure Enclave, soweit der Schlüsseltyp dies erlaubt.
- [ ] Ein synchronisierbares iCloud-Keychain-Geheimnis ermöglicht die
      automatische Wiederherstellung auf eigenen Apple-Geräten.
- [ ] Browser speichern Geräteschlüssel über WebCrypto und den lokalen
      Browserspeicher; eingeschränkter Hardwareschutz wird sichtbar dokumentiert.
- [ ] Langfristige Schlüssel verschlüsseln keine großen Nutzdaten direkt;
      versionierte Daten- und Sitzungsschlüssel werden per Envelope-Verfahren
      verteilt.
- [ ] Schlüsselrotation, kompromittierte Geräte, verlorene Geräte und
      Wiederaufnahme nach längerer Offline-Zeit sind spezifiziert und getestet.

### 4.2 Kopplung und Widerruf

- [ ] QR-Kopplung tauscht ausschließlich nicht erratbare Capabilities,
      öffentliche Schlüssel und signierte Geräteinformationen aus.
- [ ] Datei-, AirDrop- und LAN-Kopplung verwenden dasselbe Vertrauensmodell.
- [ ] Bereits vertraute Geräte finden sich über rotierende anonyme
      Rendezvous-IDs wieder.
- [ ] Die App zeigt verständlich, welche Geräte Zugriff besitzen und wann sie
      zuletzt direkt verbunden waren.
- [ ] Ein Gerät kann lokal widerrufen werden; der Widerruf wird als signiertes,
      idempotentes Ereignis verteilt.
- [ ] Ein widerrufenes Gerät erhält keine neuen Schlüssel oder Backups.
- [ ] Ohne erreichbares anderes Gerät bleibt ein Widerruf zunächst lokal; diese
      Grenze wird dem Benutzer korrekt erklärt.

## 5. Apple Account, automatische Geräteaufnahme und Backup

### 5.1 Eigene iPhones, iPads und Macs

- [ ] Beim ersten Start wird der aktuelle iCloud-Status geprüft, ohne ein
      Flash-n-Flip-Konto anzulegen.
- [ ] Native Apple-Geräte verwenden den angemeldeten iCloud-/Apple-Account als
      Geräte-Bootstrap; „Mit Apple anmelden“ erzeugt dabei kein zusätzliches
      Benutzerkonto auf dem VPS.
- [ ] Das erste Apple-Gerät erzeugt Geräteschlüssel und den geschützten
      Wiederherstellungsanker.
- [ ] Ein neues iPad oder ein neuer Mac mit demselben Apple Account erkennt den
      bestehenden verschlüsselten Bestand automatisch.
- [ ] Das neue Gerät stellt Schlüssel und Backup wieder her, erzeugt zusätzlich
      einen eigenen Geräteschlüssel und registriert sich in der privaten
      Geräteliste.
- [ ] Eigene Apple-Geräte benötigen keine QR-Kopplung untereinander.
- [ ] Nach dem Bootstrap erfolgt laufender Datenaustausch bevorzugt direkt per
      WebRTC und nicht über CloudKit als zweite Live-Autorität.
- [ ] Abgemeldetes iCloud, deaktivierter iCloud-Schlüsselbund, volles Kontingent
      und temporäre CloudKit-Ausfälle verhindern keine lokale Nutzung.
- [ ] Ein Apple-Account-Wechsel friert die Cloud-Anbindung ein und bietet
      ausdrücklich: lokal behalten, exportieren, mit neuem Account verbinden
      oder getrennt löschen. Es erfolgt keine automatische Vermischung.

### 5.2 Verschlüsseltes Backup

- [ ] Das Backupformat ist versioniert, verschlüsselt, signiert beziehungsweise
      authentifiziert und enthält ein Hashmanifest.
- [ ] Sicherbar sind Decks, Collections, Karten, Medien, Einstellungen,
      Review-Ereignisse, Schedulerzustand, Outbox, Tombstones und Widerrufe.
- [ ] Medienbackup kann getrennt aktiviert oder deaktiviert werden.
- [ ] Vor dem Upload werden Größe und voraussichtlicher iCloud-Verbrauch
      angezeigt.
- [ ] Backups werden nur aus einem transaktional konsistenten lokalen Stand
      erzeugt.
- [ ] Unterbrochene Uploads werden fortgesetzt oder sicher verworfen; ein
      unvollständiges Backup wird nie als wiederherstellbar markiert.
- [ ] Wiederherstellung prüft Signatur, Authentizität, Hashes, Schema und freien
      Speicher vor Sichtbarkeit.
- [ ] Mindestens eine vollständige Wiederherstellung nach Neuinstallation und
      nach Verlust aller lokalen App-Daten ist auf realer Hardware nachgewiesen.
- [ ] Optionaler Wiederherstellungscode beziehungsweise verschlüsselte
      Recovery-Datei schützt gegen den Verlust des iCloud-Schlüsselbunds.
- [ ] Benutzer können Backups auflisten, neu erzeugen, exportieren und löschen.
- [ ] CloudKit bleibt Backup-, Recovery- und Geräte-Bootstrap-Dienst; es erhält
      keinen konkurrierenden fachlichen Konfliktcursor.

### 5.3 Familienmitglieder

- [ ] Die App behauptet nicht, Apples Family-Sharing-Mitglieder automatisch
      erkennen zu können.
- [ ] Ein Eigentümer richtet einmalig eine private Familienbibliothek ein.
- [ ] Jedes Familienmitglied wird einmal pro Apple Account über `CKShare`
      eingeladen und muss die Freigabe ausdrücklich annehmen.
- [ ] Nach Annahme stehen freigegebene Daten automatisch auf den Apple-Geräten
      dieses Familienmitglieds bereit; eine Kopplung pro Gerät entfällt.
- [ ] Mitgliedschaft, Rechte, Austritt, Entfernung und Eigentümerwechsel sind
      als sichtbare Produktflüsse definiert.
- [ ] Gemeinsame Decks, Collections und Medien werden von persönlichen Decks
      getrennt.
- [ ] Persönlicher Lernfortschritt bleibt standardmäßig je Familienmitglied
      getrennt und wird nicht versehentlich gemeinsam überschrieben.
- [ ] Kinder-, Eltern- und Schreibrechte benötigen vor öffentlicher Freigabe
      eine eigene Produkt-, Datenschutz- und Missbrauchsprüfung.

### 5.4 Apple Account auf Web, Android und Windows

- [ ] CloudKit JS/Web Services werden als optionaler Wiederherstellungsweg für
      Browser und spätere Nicht-Apple-Clients prototypisch geprüft.
- [ ] Eine sichtbare Apple-Anmeldung mit 2FA auf Nicht-Apple-Geräten wird nicht
      als automatische geräteeigene Anmeldung dargestellt.
- [ ] QR-/Datei-Kopplung bleibt der unabhängige Weg für Nutzer ohne Apple
      Account oder ohne CloudKit-Webzugriff.
- [ ] Apple-spezifische Sicherung erzeugt keine Apple-Abhängigkeit in Domain-,
      Paket- oder Sync-Protokollen.

## 6. Connect-VPS und direkte WebRTC-Replikation

### 6.1 Bereits vorhandene Rendezvous-Grundlage

- [x] `/rendezvous/v1/compatibility` ist öffentlich und kontolos verfügbar.
- [x] Sitzungen verwenden zufällige Capability-Tokens; der Dienst hält nur
      SHA-256-Hashes der Capabilities.
- [x] SDP-/ICE-Envelopes sind als verschlüsselte, größenbegrenzte Payloads mit
      stabiler Nachrichten-ID modelliert.
- [x] Wiederholtes Senden ist idempotent und konfliktbehaftete Wiederverwendung
      einer Nachrichten-ID wird abgelehnt.
- [x] Signale werden sequenziell und rollengetrennt abgeholt.
- [x] Zustand liegt nur im RAM und verfällt nach fünf Minuten.
- [x] Grenzen bestehen für Sitzungen, Nachrichten, Einzelpayload und gesamten
      verschlüsselten Payloadspeicher.
- [x] Rendezvous-Antworten verwenden `no-store` und eigene Rate-Limits.
- [x] STUN läuft ohne TURN und ohne Relay.
- [x] Der öffentliche Ablauf Compatibility, Create, Join, Send, Poll und Delete
      wurde auf dem VPS für Release `0.5.110` verifiziert.

### 6.2 Noch offene Connect-Arbeit

- [x] Capability-Erzeugung, Ende-zu-Ende-Verschlüsselung und Polling werden in
      den gemeinsamen Clientverträgen implementiert.
- [x] Apple-App und Bootstrap-PWA nutzen tatsächlich `/rendezvous/v1` statt des
      alten authentifizierten Pairingpfads.
- [ ] Signalisierungslogs werden automatisiert auf Capabilities, SDP, ICE,
      Schlüssel und verschlüsselte Payloadinhalte geprüft.
- [ ] Missbrauchs-, Last-, Speicher- und Langzeittests bestimmen die belastbare
      Sitzungs- und Benutzerkapazität des aktuellen VPS.
- [ ] Verhalten bei Prozessneustart, TTL-Ablauf, Überlastung und Rate-Limit ist
      für Clients definiert und getestet.
- [ ] Es ist dokumentiert, dass ein einzelner RAM-Store nicht ohne weiteres
      über mehrere API-Replikate skaliert; für den Ein-VPS-Betrieb bleibt genau
      eine Rendezvous-Instanz maßgeblich.
- [ ] Betriebsmetriken enthalten nur aggregierte, payloadfreie Werte mit kurzer
      Aufbewahrung.

### 6.3 Direkter Datenkanal

- [x] WebRTC DataChannels übertragen im Phase-1-Durchstich ein streng
      validiertes, versioniertes Deck-/Review-Envelope.
- [ ] Metadaten, Reviews, Medien, Backups, Webstack und Kontrollnachrichten
      besitzen getrennte Nachrichtentypen und Grenzen.
- [ ] Flow Control berücksichtigt `bufferedAmount` und verhindert ungebremstes
      Puffern großer Medien.
- [ ] Chunks besitzen Transfer-ID, Index, Gesamtgröße und Inhalts-Hash.
- [ ] Unterbrochene Transfers setzen am letzten bestätigten Chunk fort.
- [x] Empfangene Phase-1-Daten werden erst nach Entschlüsselung und vollständiger
      Schemaprüfung transaktional angewendet; Hash- und Berechtigungsprüfung für
      spätere Medien- und Vollsync-Nachrichten bleibt offen.
- [ ] Duplicate Delivery, Umordnung, Paketverlust, Verbindungswechsel und
      Prozessneustart sind getestet.
- [ ] Ein direkter Test weist nach, dass Connect und STUN keine Nutzdaten
      empfangen.
- [ ] Wenn kein direkter Internetpfad entsteht, stehen Datei, AirDrop und LAN
      als bewusste Alternativen bereit; TURN bleibt deaktiviert.

## 7. Signierte Webstack-Verteilung vom iPhone

### 7.1 Bootstrap-PWA auf `flash-n-flip.com`

- [x] Der VPS liefert unter `/connect` eine kleine, eigenständige
      HTTPS-Bootstrap-PWA aus; der bisherige Webbestand bleibt während der
      Migration parallel erhalten.
- [ ] Die Bootstrap-PWA enthält Pairing, WebRTC, Signaturprüfung, Cacheverwaltung,
      Wiederherstellung und eine verständliche Fehleranzeige.
- [ ] Ein möglichst stabiler, root-skopierter Service Worker kontrolliert den
      PWA-Anwendungsbereich.
- [ ] Manifest, Icons, Bootstrap und Service Worker bleiben klein und
      unabhängig vom vollständigen React/Next.js-Webstack.
- [ ] Die erste Installation und eine Wiederherstellung nach Löschen aller
      Browserdaten benötigen `flash-n-flip.com`; dieser Umstand wird erklärt.

### 7.2 Webstack im Apple-App-Bundle

- [x] Der Phase-1-Webstack wird reproduzierbar statisch gebaut und in das
      signierte Apple-App-Bundle aufgenommen.
- [x] Die Apple-App lädt diesen gebündelten Stack und keine entfernte Website
      als primäre UI.
- [ ] Jeder Build enthält Build-ID, App-Version, Protokollgenerationen,
      Mindest-Bootstrap-Version, Dateihashes und Signatur.
- [ ] Das private Release-Signiergeheimnis wird ausschließlich im kontrollierten
      Releaseprozess verwendet.
- [ ] Die App kann das signierte Webstack-Paket datei- beziehungsweise
      chunkweise an einen gekoppelten Browser liefern.
- [ ] App-Store-Updates ersetzen ausschließlich den im nativen Bundle
      enthaltenen Webstack; das iPhone lädt keinen neuen nativen Anwendungscode
      am Store vorbei.

### 7.3 Installation und Update im Browser

- [ ] Der Browser akzeptiert ausführbare Ressourcen ausschließlich nach
      erfolgreicher Release-Signatur- und Einzelhashprüfung.
- [ ] Peer-Vertrauen allein reicht niemals zur Freigabe von JavaScript aus.
- [ ] Der neue Stack wird in einen separaten versionsbezogenen Cache geschrieben.
- [ ] Aktivierung erfolgt erst atomar, nachdem alle Pflichtdateien geprüft sind.
- [ ] Die vorherige funktionierende Version bleibt als Rollback erhalten.
- [ ] Ein älteres iPhone darf einen Browser nicht automatisch herabstufen.
- [ ] Bei mehreren Geräten gewinnt die höchste signierte, lokal kompatible
      Build-ID; inkompatible Builds werden nicht aktiviert.
- [ ] Update und Reload unterbrechen keinen Import, keine Bearbeitung und keine
      laufende Lernsitzung.
- [ ] Stack-Cache, private Daten, Outbox und Medien sind getrennt; ein
      Webstack-Update löscht keine Nutzdaten.
- [ ] CSP, erlaubte Ressourcentypen und synthetische Response-Header verhindern,
      dass Peer-Nutzdaten als ausführbarer Code behandelt werden.
- [ ] Manipulierte, unvollständige, unterbrochene und zu alte Pakete sowie ein
      volles Browserkontingent sind getestet.

## 8. PWA auf vorhandenem PC als vollständiger Deck-Editor

- [ ] Ein iPhone zeigt einen QR-Code für die Bootstrap-PWA und die sichere
      Kopplung.
- [ ] Windows-, Linux-, Android- und Mac-Browser können den signierten Webstack
      direkt vom iPhone installieren.
- [ ] Die PWA fordert, soweit verfügbar, dauerhaften Browserspeicher an und
      zeigt verständlich, wenn dieser nicht zugesichert ist.
- [ ] Decks, Collections, Medien, Einstellungen und Outbox liegen lokal in
      IndexedDB/OPFS.
- [ ] Nach der Erstinstallation kann die PWA ohne iPhone und ohne VPS Decks
      erstellen und bearbeiten sowie mit vorhandenen Daten lernen.
- [ ] Tastatur-, Maus-, Drag-and-drop- und große Editorlayouts werden auf
      Windows und Mac geprüft.
- [ ] Änderungen werden dauerhaft lokal vorgemerkt und beim nächsten direkten
      Kontakt idempotent an das iPhone übertragen.
- [ ] Browser-Speicherbereinigung, privater Modus, Kontingentende und mehrere
      Browserprofile führen zu klaren Warnungen und Exportmöglichkeiten.
- [ ] Der Benutzer kann den PC widerrufen und dessen letzte bekannte
      Synchronisation nachvollziehen.

## 9. Lokale Imports und sichere Inhalte

### 9.1 Allgemeiner Importpfad

- [ ] APKG, FNF und CSV werden lokal und streamend verarbeitet.
- [ ] Dateiheader, erkannter MIME-Typ, Erweiterung und dekodierter Inhalt werden
      unabhängig voneinander geprüft.
- [ ] Archivgröße, entpackte Gesamtgröße, Anzahl Einträge, Pfadlänge,
      Verschachtelung und Einzeldateigröße besitzen harte Grenzen.
- [ ] ZIP-Slip, ZIP-Bomb, Symlinks, Mehrfachnamen und Unicode-Kollisionen werden
      abgewehrt.
- [ ] Anki-Skripte, Eventhandler, Iframes, Objekte, externe Trackingressourcen
      und ausführbare Templates werden niemals übernommen oder ausgeführt.
- [ ] Erlaubte Inhalte werden in strukturierte Blöcke übersetzt und standardmäßig
      escaped gerendert.
- [ ] SVG wird sicher sanitisiert oder gerastert; aktive Inhalte bleiben
      verboten.
- [ ] Freier Speicher wird vor Entpacken, Konvertierung und Commit geprüft.
- [ ] Ein Import-Stagingbereich enthält nur die aktuelle Transaktion und wird
      nach Erfolg, Abbruch, Neustart oder Fehler sicher bereinigt.
- [ ] Decks werden erst nach vollständiger Struktur- und Inhaltsprüfung atomar
      in SQLite beziehungsweise IndexedDB sichtbar.
- [ ] Importprofile und Feldzuordnungen bleiben plattformneutral und nutzen
      stabile Notiztyp-/Feld-/Templatesignaturen statt nur Quell-IDs.

### 9.2 Originalaudio als unverlierbare Grundlage

- [ ] Jede gültige Audiodatei wird beim Import zunächst unverändert gespeichert
      und ist sofort nutzbar, sofern die Plattform sie wiedergeben kann.
- [ ] Keine Audiodatei wird wegen einer fehlgeschlagenen oder nicht unterstützten
      Optimierung verworfen.
- [ ] Das Original bleibt in der ersten Umstellungsstufe dauerhaft erhalten;
      optimierte Dateien sind geprüfte Derivate.
- [ ] Eine spätere automatische Originallöschung benötigt eine gesonderte
      Freigabe, einen Backupnachweis und eine sichere Rückfallstrategie.
- [ ] Nicht abspielbare, aber strukturell sichere Originalformate werden sichtbar
      gekennzeichnet und für spätere Decoderunterstützung bewahrt.

### 9.3 Asynchrone Audiooptimierung auf dem iPhone

- [ ] Audiooptimierung läuft nach dem erfolgreichen Import als fortsetzbare
      lokale Warteschlange.
- [ ] Es wird immer nur eine Datei gleichzeitig verarbeitet.
- [ ] Jeder Auftrag besitzt Zustände wie ausstehend, analysiert, optimiert,
      geprüft, Original beibehalten und nicht unterstützt.
- [ ] Ein Checkpoint wird nach jeder vollständig geprüften Datei dauerhaft
      gespeichert.
- [ ] App-Abbruch, Systembeendigung, Neustart, Energiesparmodus und volles
      Speicherkontingent verlieren weder Original noch Warteschlangenstand.
- [ ] `BGContinuedProcessingTask` beziehungsweise ein kompatibler
      Hintergrundmechanismus wird mit sichtbarem Fortschritt und Abbruch
      verwendet, soweit das Zielsystem ihn unterstützt.
- [ ] AVFoundation/AudioToolbox übernimmt systemunterstützte Decoder, Downmix,
      Resampling und AAC-LC-Ausgabe.
- [ ] Accelerate/vDSP oder eine geprüfte gemeinsame DSP-Implementierung misst
      Lautheit, Spitzenwerte, Rauschen und Stille blockweise.
- [ ] Ogg/Opus-Unterstützung wird mit kleinen, rechtlich geprüften Decodern
      umgesetzt oder bis dahin als Original bewahrt; ein vollständiges FFmpeg
      wird nicht ungeprüft in die App aufgenommen.
- [ ] Zielwerte orientieren sich an der bestehenden Qualität: ungefähr
      `-18 LUFS`, maximal `-1,5 dBTP`, Mono, 24 kHz und AAC-LC mit 40 kbit/s.
- [ ] Lange oder ressourcenintensive Dateien dürfen von der Optimierung
      ausgenommen werden, bleiben aber im Original erhalten.
- [ ] Gerätebenchmarks bestimmen endgültige Grenzen für Dateigröße, Dauer,
      Gesamtdauer, Temperatur, Akku und Laufzeit.
- [ ] Das optimierte Ergebnis wird erneut dekodiert und gegen Format-, Dauer-,
      Lautheits- und Peak-Toleranzen geprüft.
- [ ] Erst ein vollständig geprüftes Derivat darf für die Wiedergabe bevorzugt
      werden; das Original bleibt weiterhin verfügbar.

### 9.4 Anzeige der Audioeinsparung

- [ ] Fortschritt und Ergebnis zeigen Anzahl ausstehender, optimierter,
      unveränderter, nicht unterstützter und fehlgeschlagener Dateien.
- [ ] Angezeigt werden Originalgröße, Derivatgröße, potenziell einsparbare Bytes
      und Prozentsatz.
- [ ] Solange Originale zusätzlich erhalten bleiben, wird die Ersparnis korrekt
      als **potenziell** und nicht als freigegebener Speicher bezeichnet.
- [ ] Tatsächlich freigegebener Speicher wird erst nach einer später ausdrücklich
      erlaubten Originallöschung ausgewiesen.
- [ ] Warnungen machen klar, dass Originale sicher sind und der Import trotz
      einzelner Optimierungsprobleme verwendbar bleibt.
- [ ] Optional können gekoppelte leistungsfähige PCs später Optimierungsaufträge
      direkt übernehmen; dies ist nicht Bestandteil des ersten Apple-Releases.

## 10. Kuratierte Inhalte

- [ ] Kuratierte Collections, Decks und Referenzen verwenden stabile IDs und
      verändern persönlichen Lernfortschritt nicht.
- [ ] Katalogmanifest und Pakete enthalten Version, Locale, Lizenz, Quelle,
      Größe, Hash und Release-Signatur.
- [ ] Offline-Signierschlüssel und eingebettete öffentliche Prüfschlüssel werden
      getrennt verwaltet.
- [ ] Eine kleine Startsammlung kann Teil des App- und Webstack-Bundles sein und
      dadurch vom iPhone an PWA-Clients weitergegeben werden.
- [ ] Größere optionale Sammlungen können über einen getrennten statischen
      Content-Host oder direkt von einem gekoppelten Gerät bezogen werden.
- [ ] Der Content-Host verarbeitet keine privaten Inhalte und benötigt keine
      Benutzerkennung.
- [ ] Pakete werden erst nach Hash-, Signatur-, Struktur-, Lizenz- und
      Größenprüfung installiert.
- [ ] Rücknahme, Schlüsselrotation, beschädigte Releases, Teiltransfers und
      Rollback sind spezifiziert.
- [ ] Ein kuratiertes Update aktualisiert Inhalte, aber niemals persönliche
      Review-Ereignisse oder Schedulerzustände.

## 11. Versionen, Updates und Kompatibilität

- [ ] App-Version, Webstack-Build, Datenbankschema, Paketformat,
      Replikationsprotokoll und Rendezvous-Protokoll sind getrennte Versionen.
- [ ] Die jeweils aktuelle und mindestens zwei ältere Protokollgenerationen
      werden unterstützt.
- [ ] Kompatibilitätsfixtures prüfen aktuelle und ältere Apple-, Browser-,
      Android- und Windows-Envelopes.
- [ ] Ein alter Client bleibt lokal nutzbar, auch wenn Connect seine
      Protokollgeneration nicht mehr unterstützt.
- [ ] iPhone-/iPad-App-Updates kommen ausschließlich über den Apple App Store.
- [ ] Der Store-Build liefert anschließend den zugehörigen signierten Webstack
      an verbundene PWA-Clients.
- [ ] Ein Updatehinweis auf einen neueren App-Store-Build wird pro Zielversion
      höchstens einmal lokal angezeigt.
- [ ] Kein Hinweis erzwingt ein Update während Lernen, Import oder Bearbeitung.
- [ ] SQLite- und IndexedDB-Migrationen über mehrere ausgelassene Releases
      werden mit realen alten Datenbeständen getestet.
- [ ] Eine fehlgeschlagene Migration aktiviert den neuen Webstack nicht und
      bewahrt einen sicheren Wiederherstellungsweg.

## 12. App-Store-Mehrwert und Release-Nachweis

Die Apple-App muss erkennbar mehr leisten als eine verpackte Website. Folgende
native Funktionen werden implementiert und in den App-Review-Hinweisen erklärt:

- [ ] gebündelter, ohne Website startfähiger Webstack
- [ ] SQLite als lokale Datenautorität
- [ ] Keychain/Secure-Enclave-Integration
- [ ] automatischer iCloud-Geräte-Bootstrap
- [ ] verschlüsseltes CloudKit-Backup und Wiederherstellung
- [ ] native Files-/AirDrop-Integration
- [ ] lokaler APKG-/FNF-/CSV-Import
- [ ] native AVFoundation-/vDSP-Audiooptimierung
- [ ] fortsetzbare Hintergrundverarbeitung mit sichtbarem Fortschritt
- [ ] direkte WebRTC-Gerätekopplung und Replikation
- [ ] signierte Webstack-Auslieferung an einen vorhandenen PC
- [ ] lokale Offline-Nutzung ohne VPS

Abnahme:

- [ ] App-Review-Notizen beschreiben QR-Testweg, Testdaten, iCloud-Verhalten,
      Webstack-Auslieferung und native Funktionen vollständig.
- [ ] Die App funktioniert auf einem physischen iPhone und iPad ohne den VPS,
      nachdem die lokalen Daten vorhanden sind.
- [ ] iPhone-Layouts, iPad-Layouts, dunkles/helles Design, vergrößerter Text,
      VoiceOver und relevante Bedienhilfen sind geprüft.
- [ ] Datenschutzangaben, Support-URL, Altersfreigabe, Screenshots,
      Betreiberangaben und Store-Metadaten sind vollständig.

## 13. Datenschutz, Sicherheit und rechtliche Prüfungen

Diese Checkliste ist keine Rechtsberatung. Vor einer öffentlichen Freigabe
bleibt eine qualifizierte rechtliche Prüfung erforderlich.

- [ ] Die Datenflusskarte wird für lokale SQLite-/IndexedDB-Daten, Keychain,
      private und geteilte CloudKit-Daten, WebRTC, Rendezvous, STUN,
      Bootstrap-PWA, Content-Host, Store, Support und Diagnostik aktualisiert.
- [ ] Für jede Datenkategorie sind Zweck, Rechtsgrundlage, Empfänger,
      Speicherort, Löschtrigger, maximale Aufbewahrung und Benutzerkontrolle
      dokumentiert.
- [ ] Aussagen wie „nur lokal“ unterscheiden lokale Daten, Apple-verarbeitete
      Cloud-Daten und operatorseitige Verbindungs-/Betriebsdaten korrekt.
- [ ] Signalisierungs- und Webserverlogs enthalten keine Inhalte, Capabilities,
      Geräteschlüssel, SDP oder ICE-Payloads.
- [ ] Persistente IP-Protokollierung bleibt deaktiviert oder erhält eine
      dokumentierte Notwendigkeit, Zugriffsbeschränkung und kurze Löschfrist.
- [ ] CloudKit- und App-Store-Datenflüsse werden in Datenschutzhinweisen und
      Apple Privacy Labels korrekt abgebildet.
- [ ] Familienfreigaben erklären Eigentümer, Teilnehmer, Rechte, Austritt,
      Löschung und getrennten persönlichen Lernfortschritt.
- [ ] Export, Backup-Löschung, lokale Löschung, Gerätewiderruf und vollständige
      Kontomigration sind als echte Benutzerflüsse vorhanden.
- [ ] Betreibername, ladungsfähige Anschrift, Kontakt, Hostingempfänger,
      Serverstandorte und reale Aufbewahrungszeiten sind vor öffentlicher
      Freigabe keine Platzhalter mehr.
- [ ] Datenschutz durch Technikgestaltung, Verschlüsselung, Wiederherstellbarkeit
      und regelmäßige Sicherheitsprüfung werden gegen den realen Datenfluss
      bewertet.
- [ ] Community-Publishing, Moderation, Empfehlungen, Werbung, Tracking und
      Zahlungen bleiben außerhalb dieser ersten Umstellung und werden nicht
      versehentlich aktiviert.

## 14. Phasen und empfohlene Reihenfolge

### Apple-Developer-Kontogrenze

Mit „Apple-Developer-Account“ ist hier die kostenpflichtige Mitgliedschaft im
Apple Developer Program gemeint. Ein normaler Apple Account genügt für Xcode,
Simulatoren und eingeschränkte Tests auf eigenen Geräten über ein Personal
Team.

| Phase                                 | Kostenpflichtige Mitgliedschaft       | Begründung                                                                                                                                |
| ------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0: Plan, ADR, Bedrohungsmodell  | nicht erforderlich                    | Dokumentation und lokale Prüfungen                                                                                                        |
| Phase 1 im Simulator                  | nicht erforderlich                    | Webstack, SQLite, Kryptografie und Rendezvous können lokal entwickelt werden                                                              |
| Phase 1 auf eigenem iPhone            | noch nicht zwingend                   | Personal Team erlaubt persönliche Gerätetests, aber Profile, App-IDs und Geräte laufen nach sieben Tagen ab und sind zahlenmäßig begrenzt |
| Phase 2: lokale Autorität             | technisch noch teilweise ohne möglich | Für verlässliche Mehrgerätetests und stabile Signierung bereits deutlich empfohlen                                                        |
| Phase 3: iCloud, CloudKit und CKShare | **zwingend erforderlich**             | iCloud-/CloudKit-Capabilities, Container und produktionsnahe Entitlements benötigen das Apple Developer Program                           |
| Phase 4 und 5                         | bereits erforderlich                  | App-Bundle, Gerätekopplung, native Hintergrundverarbeitung und reale Mehrgerätetests bauen auf der Mitgliedschaft auf                     |
| TestFlight und App Store              | **zwingend erforderlich**             | Distribution, App Store Connect, Beta- und Produktionssignierung                                                                          |

Beschaffungspunkt:

- [ ] Kostenpflichtiges Apple Developer Program spätestens während Phase 1
      einrichten, damit Team-ID, Bundle-ID, Signierung und CloudKit-Container vor
      Phase 3 stabil feststehen.
- [ ] Entscheiden, ob die App unter einer Person oder einer Organisation
      veröffentlicht wird; bei einer Organisation D-U-N-S- und Rollenklärung
      frühzeitig abschließen.

Offizielle Grundlage:

- [Apple: Mitgliedschaften vergleichen](https://developer.apple.com/support/compare-memberships/)
- [Apple: unterstützte iOS-Capabilities](https://developer.apple.com/help/account/reference/supported-capabilities-ios)
- [Apple: TestFlight- und App-Store-Distribution](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)

### Phase 0: Planfreigabe und ADR-Aktualisierung

- [x] Diesen Masterplan ausdrücklich freigeben.
- [x] ADR 0029 um iCloud-Backup/Geräte-Bootstrap, Familienfreigaben und
      peer-verteilten signierten Webstack ergänzen oder durch einen Folge-ADR
      präzisieren.
- [x] ADR 0019/0020 für den stabilen Bootstrap-Service-Worker und die
      Peer-Cache-Aktivierung präzisieren.
- [x] Bedrohungsmodell für Schlüssel, CloudKit, PWA-Origin, Peer-Codeverteilung,
      Imports und Geräteverlust dokumentieren.

Go/No-go: Keine neue Vertrauens- oder Persistenzimplementierung ohne akzeptierte
ADR- und Bedrohungsmodellgrenzen.

### Phase 1: Kleiner vertikaler Apple-/PWA-Durchstich

- [x] Apple-App startet einen gebündelten Minimal-Webstack.
- [x] Eine kleine SQLite-Datenbank und Keychain-Geräteidentität funktionieren.
- [x] Bootstrap-PWA wird von `flash-n-flip.com` ausgeliefert.
- [x] QR-Kopplung nutzt den deployten kontolosen Rendezvous-Dienst.
- [x] Ende-zu-Ende verschlüsselte Signalisierung erzeugt einen DataChannel.
- [x] Ein Testdeck und ein Review-Ereignis werden direkt übertragen.
- [x] Zielgerät speichert beides dauerhaft und zeigt es nach Neustart erneut.
- [ ] Connect-/STUN-Logs und Netzwerkbeobachtung bestätigen, dass keine
      Nutzdaten über den VPS gingen.

Zwischenstand: Der Ablauf wurde Browser-zu-Browser über die reale Clientlogik
einschließlich Doppelzustellung und Neustart geprüft. Der signierte iOS-
Simulator-Build behält seine Keychain-Identität über einen Prozessneustart und
öffnet den SQLite-Speicher fehlerfrei. Auf einem physischen iPhone wurde der
Einladungs- und WebRTC-Verbindungsweg über Release `0.5.111` bestätigt. Offen
bleiben der physische Transfer-/Neustartnachweis und der abschließende
Netz-/Lognachweis. Die Phase-2-Vertragsgrundlage darf parallel entstehen;
kritische Benutzerflüsse werden erst nach diesem Restnachweis von der API-
Persistenz getrennt.

Go/No-go: Erst fortfahren, wenn Testdeck und Review nach Offlinephase,
Doppelzustellung und Neustart korrekt bleiben.

### Phase 2: Vollständige lokale Autorität

- [x] Repositoryverträge und Contract-Tests abschließen.
- [x] Apple-SQLite- und Web-IndexedDB/OPFS-Adapter implementieren.
- [x] Deckübersicht, Editor, Scheduler, Lernen, Einstellungen und Medien
      nacheinander auf lokale Repositories umstellen.
- [x] Outbox, Tombstones, Watermarks und Konfliktregeln vervollständigen.
- [x] Vollständigen lokalen Export und Import als geprüften
      Repository-Service implementieren.
- [x] Export und Import über die bestehende Produktoberfläche bereitstellen.

Technischer Stand Release `0.5.113`: Die plattformneutrale Contract-Engine für
atomare Fachmutation, UUIDv7, Gerätesquenz, Outbox, append-only Reviews,
Tombstones, lückenlose Watermarks, payloadgeprüfte Peer-Anwendung und
hashgeprüften vollständigen Repository-Export/Restore ist implementiert und
getestet. Apple SQLite und Browser-IndexedDB speichern diese Daten dauerhaft;
der Peer-Abgleich tauscht das idempotente Journal anhand von Watermarks aus.

Release `0.5.116` bindet diese Grundlage hinter den bestehenden
React-/Next.js-Komponenten ein. Deckübersicht, Editor, Lernansicht,
FSRS-Reviews, Einstellungen, Medienauflösung sowie vollständiger lokaler
Export/Restore verwenden nun dieselbe lokale Autorität. Ein Review wird mit
stabiler Ereignis-ID und neuem Schedulerzustand dauerhaft geschrieben, bevor
die UI zur nächsten Karte wechselt. Die WebRTC-Replikation liest und bestätigt
dasselbe Mutationjournal; ein paralleler Produktdatenbestand unter `/connect`
existiert weiterhin nicht.

Release `0.5.118` hebt diesen Übergang bewusst auf. Generation 2 verwendet neue
IndexedDB-/SQLite-Namen, entfernt einmalig alte Browser-Token und Alt-Caches und
übernimmt keine serverzentrierten Kontodaten. Deckliste, Dashboard, Editor,
Lernen, Einstellungen, Xefjord-Ansichten, Zahlendecks und CSV/TSV-Import besitzen
keinen API-Fallback mehr. Registrierung, Login, Passwort- und Communitypfade
sind nicht mehr aktiv; die API registriert nur Health und Rendezvous v1.

Kuratierte Sammlungen bleiben erhalten: Die bestehenden Generatorquellen
erzeugen ein streng validiertes, versioniertes 8-MB-App-Bundle. Installation,
Update, Löschen und erneute Installation erfolgen über dieselbe lokale
Autorität. `/pwa` ist ein öffentlicher, später schützbarer Einstieg ohne iPhone.

Reale Browserabnahme auf den Originalpfaden:

- Deck über `/app/decks/new` angelegt, Karte im vorhandenen Editor ergänzt,
  gespeichert, Seite neu geladen und unverändert wiedergefunden.
- Karte über `/app/learn` aufgedeckt und mit **Gut** bewertet; nach Reload
  war sie nicht erneut fällig.
- Sprache, Theme und Pinch-Zoom über `/app/settings` geändert und nach Reload
  wiederhergestellt; gleichzeitige Einstellungsänderungen werden verlustfrei
  vereinigt.
- Vollständiger Download und Restore sind in der bestehenden
  Daten-und-Privatsphäre-Sektion erreichbar; Restore akzeptiert absichtlich nur
  eine frische lokale Autorität.
- Bei `390 × 844` misst die vorhandene Lernkarte `384 × 711`, hat rundum
  `14 px` Innenabstand, erzeugt keinen Seitenscroll und kollidiert nicht mit
  Navigation oder Statusbedienelementen.

Die physische iPhone-/iOS-WebView-Abnahme des vollständigen Produktstacks ist
kein Restfehler von Phase 2, sondern benötigt das in Phase 4 zu bündelnde und
zu signierende Original-Webstack-Paket. SQLite- und iOS-Adapterverträge sind
automatisiert geprüft.

Go/No-go: Erfüllt im Quellstand `0.5.118`; reales VPS-Deployment und physische
iOS-WebView-Abnahme bleiben getrennte Freigaben.

### Phase 3: Apple Account, Backup und Familie

- [ ] iCloud-Keychain-Bootstrap implementieren.
- [ ] Verschlüsseltes CloudKit-Backup und Wiederherstellung implementieren.
- [ ] Automatische Aufnahme eines zweiten eigenen Apple-Geräts prüfen.
- [ ] CKShare-Familienbibliothek mit getrenntem Lernfortschritt implementieren.
- [ ] Accountwechsel, iCloud-Ausfall, volles Kontingent und Widerruf prüfen.

Go/No-go: Ein neues eigenes Apple-Gerät muss ohne QR-Code einen vollständigen,
geprüften lokalen Stand wiederherstellen können.

### Phase 4: Signierter Webstack und PC-Editor

- [ ] Release-Paketformat, Signatur und Cache-Aktivierung implementieren.
- [ ] Webstack vom iPhone an Windows-/Mac-/Linux-Browser übertragen.
- [ ] Installierte PWA offline neu starten und Decks bearbeiten.
- [ ] Änderungen nach Wiederverbindung direkt zum iPhone replizieren.
- [ ] Downgrade-, Manipulations-, Abbruch- und Rollbacktests bestehen.

Go/No-go: Ein kompromittierter oder manipulierter Peer darf niemals
unsignierten Anwendungscode unter `flash-n-flip.com` aktivieren.

### Phase 5: Lokale Imports und Audio

- [ ] APKG/FNF/CSV sicher und streamend lokal importieren.
- [ ] Originalaudio vollständig erhalten und sofort verfügbar machen.
- [ ] Native asynchrone Audiooptimierung mit Checkpoints implementieren.
- [ ] Einsparanzeige und sichere Derivatumschaltung implementieren.
- [ ] Große, beschädigte, ungewöhnliche und unterbrochene Imports prüfen.

Go/No-go: Kein Import- oder Optimierungsfehler darf ein gültiges Originalaudio
oder bereits vorhandene lokale Daten verlieren.

### Phase 6: Kuratierte Inhalte und Kompatibilität

- [ ] Signierten Katalog, Bundle-Startsammlung und optionale statische Pakete
      implementieren.
- [ ] Protokollgeneration N, N-1 und N-2 prüfen.
- [ ] Mehrversionsmigrationen und Store-/Webstack-Updatehinweise prüfen.
- [ ] Schlüsselrotation und Rücknahme eines kuratierten Pakets üben.

### Phase 7: Migration bestehender Nutzer

- [ ] Für jedes bestehende Konto einen vollständigen Export erzeugen.
- [ ] Decks, Collections, Karten, Medien, Einstellungen, Review-Historie,
      Schedulerzustand und IDs lokal importieren.
- [ ] Anzahl, Beziehungen, Hashes, Fälligkeiten und Review-Identitäten gegen den
      Serverbestand prüfen.
- [ ] Nutzer bestätigt den migrierten Stand auf mindestens zwei Geräten oder
      auf einem Gerät plus geprüftem Wiederherstellungsbackup.
- [ ] Rollback und erneuter Export bleiben bis zur Bestätigung möglich.
- [ ] Löschung und Aufbewahrung des alten Serverbestands werden rechtlich und
      technisch nachvollziehbar durchgeführt.

Go/No-go: Ohne vollständigen Nachweis für jedes bestehende Konto wird kein
alter privater Datenpfad entfernt.

### Phase 8: VPS-Minimierung

- [x] Registrierung, Login, Passwortwiederherstellung und Konto-API aus dem
      aktiven Zielbetrieb entfernen.
- [x] Admin-App und Admin-API aus dem aktiven Zielbetrieb entfernen.
- [x] PostgreSQL und Datenmigrationen aus dem Zielbetrieb entfernen.
- [x] Private Uploads, serverseitige Medien und serverseitige Imports entfernen.
- [x] API-Container auf einen kleinen Connect-Dienst reduzieren.
- [x] Web-Container auf öffentliche PWA, Original-UI und statische Auslieferung
      reduzieren.
- [x] Connect und STUN mit Read-only-/tmpfs-, RAM-, PID- und
      No-new-privileges-Grenzen betreiben; Caddy/Web-Grenzen weiter messen.
- [ ] CPU-, RAM-, Platten-, Netzwerk- und Sitzungslimits per Lasttest bestimmen.
- [ ] Backup und Rollback der letzten serverzentrierten Version bleiben für den
      vereinbarten Übergangszeitraum erhalten.

Lokaler Produktionsnachweis für Release `0.5.118`: Das gebündelte
Rendezvous-Image ist `80.232.262` Bytes groß, das eigenständige Web-/PWA-Image
`101.730.316` Bytes. Beide Images starten ohne PostgreSQL, Admin-App, Upload-
Volume oder FFmpeg; Health, `/pwa` und HTTP 404 auf stillgelegten privaten
Routen wurden im Wegwerf-Container geprüft.

### Phase 9: Spätere Android- und Windows-Apps

- [ ] Gemeinsame Fixtures ohne Apple-Code ausführen.
- [ ] SQLite-, Keystore-, Datei-, LAN- und WebRTC-Adapter implementieren.
- [ ] Signierte Plattformdistribution und Updates integrieren.
- [ ] Store-unabhängige Paket- und Sync-Kompatibilität nachweisen.

Später: Native Android-/Windows-Pakete sind nicht Voraussetzung für das erste
Apple-Release; die PWA deckt den frühen PC-/Android-Zugang ab.

## 15. Benutzerbezogene Abnahmematrix

| Benutzerfluss               | Ziel                                          | Aktueller Stand                                           |
| --------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| App-Start auf iPhone        | gebündelter Webstack, kein VPS nötig          | offen; derzeit Remote-URL-Brücke                          |
| Deckübersicht und Editor    | SQLite lokal                                  | Original-Web-UI lokal umgesetzt; iOS-Bundle in Phase 4    |
| Lernen und FSRS             | lokal, append-only Reviews                    | Original-Web-UI lokal umgesetzt und neu gestartet         |
| Zweites eigenes Apple-Gerät | automatisch über Apple Account                | offen                                                     |
| Familienmitglied            | einmalige CKShare-Annahme, danach automatisch | offen                                                     |
| Windows-/Mac-/Linux-PC      | PWA-Webstack, Offline-Editor                  | öffentliche `/pwa` und lokale Original-UI umgesetzt       |
| Android-Browser             | PWA plus QR                                   | öffentliche `/pwa` umgesetzt; Gerätetest offen            |
| Direkter Gerätesync         | WebRTC DataChannel ohne Nutzdaten auf VPS     | lokales Journal integriert; reale Mehrgeräteabnahme offen |
| APKG/FNF/CSV-Import         | vollständig lokal                             | CSV/TSV lokal; APKG/FNF und Medien offen                  |
| Originalaudio               | immer sicher behalten                         | offen im neuen lokalen Pfad                               |
| Audiooptimierung            | asynchron, fortsetzbar, native Pipeline       | offen                                                     |
| Einsparanzeige              | Original, Derivat, potenziell/tatsächlich     | offen                                                     |
| Kuratierte Inhalte          | signiert, versioniert, offline                | versioniertes App-Bundle lokal; Signatur noch offen       |
| Backup und Restore          | verschlüsselt in privatem iCloud              | offen                                                     |
| Export ohne Cloud           | verschlüsselte Datei/AirDrop                  | offen                                                     |
| App-Update                  | Apple App Store                               | Releaseprozess offen                                      |
| PWA-Update                  | signierter Webstack vom aktualisierten iPhone | offen                                                     |
| Kontoloser Connect          | RAM-only Rendezvous plus STUN                 | Servergrundlage umgesetzt                                 |
| Alter VPS-Bestand           | vom Zielbetrieb trennen                       | Code/Compose getrennt; reale VPS-Bereinigung offen        |

## 16. Release-Blocker

Folgende Zustände blockieren das erste öffentliche Apple-Release:

- Apple-App lädt weiterhin die Produktionswebsite als primäre UI.
- Kritische Flows verwenden noch serverseitige Persistenz statt SQLite.
- Lokale Reviews oder Outbox-Einträge können bei Neustart verloren gehen.
- Doppelte Peer-Zustellung kann Reviews duplizieren oder überschreiben.
- Schlüssel-, iCloud-, Accountwechsel- oder Widerrufspfade sind unklar.
- Backup lässt sich nach Neuinstallation nicht vollständig wiederherstellen.
- Import kann aktive Inhalte ausführen oder gültige Originalmedien verlieren.
- Audiooptimierung kann Originaldateien beschädigen oder vor Verifikation
  ersetzen.
- Ein Peer kann unsignierten Webstack aktivieren.
- Datenbankmigrationen über ausgelassene App-Versionen sind nicht geprüft.
- Private Inhalte, Capabilities, SDP oder ICE erscheinen in VPS-Logs.
- Rechtliche Betreiberangaben, reale Datenflüsse oder Aufbewahrungsfristen sind
  unbekannt beziehungsweise Platzhalter.

Folgende Zustände blockieren zusätzlich die Abschaltung des alten Backends:

Für den einzigen aktuellen Nutzer sind die folgenden Migrationsnachweise durch
den ausdrücklich freigegebenen harten Generationenschnitt aufgehoben. Sie
werden wieder verpflichtend, sobald vor dem realen Schnitt weitere Nutzer oder
nicht ersetzbare private Daten existieren.

- Ein bestehendes Konto besitzt keinen vollständig geprüften lokalen Export.
- Migrierte Daten sind nicht durch ein zweites Gerät oder Restore-Backup
  bestätigt.
- Ein kritischer Lern-, Editor-, Medien- oder Importpfad benötigt noch das alte
  Backend.
- Löschung, Aufbewahrung, Backup und Rollback des Serverbestands sind nicht
  dokumentiert und freigegeben.

## 17. Prüfmatrix pro Arbeitspaket

Jedes relevante Paket wird mindestens gegen folgende Fälle geprüft:

- [ ] normaler Erfolgsweg
- [ ] Offlinebetrieb vor, während und nach der Aktion
- [ ] App-/Browser-Neustart an jeder dauerhaften Grenze
- [ ] doppelte und umgeordnete Zustellung
- [ ] unterbrochener Transfer und Wiederaufnahme
- [ ] zwei Geräte mit gleichzeitigen Änderungen
- [ ] falsche Uhrzeit und Zeitzonenwechsel
- [ ] volles Speicher- oder Cloudkontingent
- [ ] beschädigte, manipulierte und übergroße Eingaben
- [ ] verlorenes oder widerrufenes Gerät
- [ ] alte App-/Protokoll-/Datenbankversion
- [ ] heller/dunkler Modus, kleines Display und vergrößerter Text bei UI-Flows
- [ ] tatsächlicher Ablauf auf physischem iPhone und im iOS-WebView

## 18. Evidenz und Fortschrittsprotokoll

### Nachgewiesener Ausgangsstand

| Datum      | Stand                                                      | Evidenz                                                          |
| ---------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| 2026-08-09 | ADR 0029 und erster kontoloser Rendezvous-v1-Dienst        | Commit `cd7ff77`                                                 |
| 2026-08-09 | Domain-, Store-, Route- und öffentlicher Ablauf getestet   | API-, Domain-, Sync- und Peer-Tests; öffentlicher VPS-Test       |
| 2026-08-09 | STUN-only ohne TURN                                        | Production-Compose und VPS-Prüfung                               |
| 2026-08-09 | Release `0.5.110` auf VPS                                  | öffentlicher Compatibility/Create/Join/Send/Poll/Delete-Test     |
| 2026-08-09 | Masterplan freigegeben; ADR 0030 und Bedrohungsmodell V2   | Phase-0-Commit; Dokument- und Sicherheitschecks                  |
| 2026-08-09 | Phase-1-WebRTC-Durchstich, PWA und gebündelte Apple-App    | Release `0.5.111`; Phase-1-Commit                                |
| 2026-08-09 | Keychain-/SQLite-Neustart und idempotente Direktzustellung | iOS-Simulator, zwei Browser, Paket- und Sicherheitsprüfungen     |
| 2026-08-09 | Phase-2-Repositoryvertrag und Adaptergrundlage             | Release `0.5.112`; Domain-, Sync-, IndexedDB-/SQLite-Tests       |
| 2026-08-09 | Phase-2-Technik über separaten Stack geprüft               | Release `0.5.113`; keine Produktabnahme der Original-UI          |
| 2026-08-09 | Parallele Produktoberfläche aus Connect entfernt           | Release `0.5.114`; ADR 0031 und UI-Grenztest                     |
| 2026-08-09 | Phase 2 hinter der unveränderten Original-UI abgeschlossen | Release `0.5.116`; 823 Paket-/UI-Tests, Build und Browserabnahme |
| 2026-08-09 | Zahlenrunden und TTS-Anmerkungen korrigiert                | Release `0.5.117`; doppelungsfreie Runden, TTS- und API-Tests    |
| 2026-08-09 | Harter lokaler Generationenschnitt und VPS-Minimierung     | Release `0.5.118`; lokale Produkt-, Katalog-, API- und PWA-Tests |

### Vorlage für künftige Fortschrittszeilen

| Datum      | Erledigte Checklistenpunkte | Commit/Release | Tests und reale Abnahme             |
| ---------- | --------------------------- | -------------- | ----------------------------------- |
| YYYY-MM-DD | Abschnitt und Punkt         | Commit/Version | Testnamen, Gerät, öffentlicher Pfad |

## 19. Bewusst zurückgestellte Punkte

- Native Android- und Windows-Anwendungen vor dem ersten Apple-Release
- zentrale Community-Veröffentlichung und Moderation
- Werbung, Tracking und nicht notwendige Analytik
- Zahlungen und Abonnements
- TURN-Relay für restriktive Netze
- automatische Originallöschung nach Audiooptimierung
- verteilte Audiooptimierung auf gekoppelten PCs
- eigenständige native Linux-Anwendung

## 20. Freigabe

Mit der Freigabe dieses Plans werden Zielbild, Reihenfolge, Sicherheitsregeln und
Release-Gates zur verbindlichen Arbeitsgrundlage. Die Freigabe bedeutet noch
nicht, dass riskante Löschungen oder die Abschaltung des alten Backends pauschal
genehmigt sind; diese erfolgen erst nach den jeweils dokumentierten Go/No-go-
Nachweisen.

- [x] Plan durch den Benutzer freigegeben
- [x] Folge-ADR für iCloud, Familie und Peer-Webstack akzeptiert
- [x] Start von Phase 1 autorisiert
- [x] Start von Phase 2 autorisiert
- [x] Harter Schnitt ohne Migration alter privater Daten autorisiert
- [x] Umsetzung der VPS-Minimierung autorisiert
