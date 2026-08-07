# ADR 0026: STUN-only für skalierbare Direktverbindungen

- Status: Accepted
- Datum: 7. August 2026
- Ergänzt: ADR 0022 und ADR 0025

## Kontext

WebKit kann lokale WebRTC-Adressen zum Schutz der Privatsphäre als
`.local`-/mDNS-Namen bereitstellen. Die Signalisierung vermittelt diese
Host-Kandidaten bereits zwischen den beteiligten Geräten, aber nicht jede
Browser- und Betriebssystemkombination kann den mDNS-Namen des anderen Geräts
zuverlässig im LAN auflösen. Web-Anwendungen dürfen die verborgene private
IP-Adresse nicht selbst auslesen und können sie daher auch nicht als Klartext
über einen Connect-Server austauschen.

Ein TURN- oder Medienrelay widerspricht dem lokalen Datenmodell und würde
Bandbreitenkosten proportional zu übertragenen Decks und Medien erzeugen. Der
VPS soll nur den Verbindungsaufbau unterstützen; Nutzdaten müssen direkt
zwischen den Geräten fließen.

## Entscheidung

1. Der Produktions-VPS bietet auf UDP-Port 3478 einen standardisierten
   STUN-Binding-Dienst unter demselben Hostnamen wie die Web-Anwendung an.
2. Der Dienst läuft im ausdrücklich erzwungenen `stun-only`-Modus. TURN-
   Allocate-Anfragen werden ignoriert; es gibt keine TURN-Zugangsdaten und
   keinen veröffentlichten Relay-Portbereich.
3. WebRTC verwendet weiterhin alle lokalen Host- und mDNS-Kandidaten und
   ergänzt einen serverreflexiven Kandidaten aus STUN. ICE entscheidet zwischen
   diesen direkten Kandidaten. Vor dem Versand von Angebot und Antwort wird die
   ICE-Sammlung abgewartet, sodass lokale und internetfähige Kandidaten gebündelt
   in der SDP übertragen werden und mobile Browser nicht von einer Folge
   zeitkritischer Trickle-ICE-Anfragen abhängen. Relay-Kandidaten werden im
   Client weiterhin abgewiesen.
4. Der STUN-Dienst verarbeitet nur kurzlebige Binding-Datagramme. Binding-Logs,
   persistente Zustände, Datenbankzugriff und Nutzdatenweiterleitung bleiben
   deaktiviert.
5. Das Container-Image ist unveränderlich per Version und Digest gebunden,
   läuft als unprivilegierter Benutzer mit schreibgeschütztem Dateisystem und
   begrenztem Speicher sowie begrenzter Prozesszahl.
6. Der bestehende authentifizierte Connect-Server vermittelt weiterhin nur
   kurzlebige SDP- und ICE-Nachrichten. Decks, Karten, Medien und Lernstände
   passieren weder den Connect-Server noch den STUN-Dienst.
7. Eine einzelne kontenübergreifende Deckübertragung ist einschließlich der
   referenzierten Medien auf 256 MiB begrenzt. Sender und Empfänger prüfen das
   Limit unabhängig voneinander.

## Skalierung

STUN beantwortet beim Verbindungsaufbau wenige kleine, zustandslose UDP-
Anfragen. Seine Last wächst mit Verbindungsversuchen, nicht mit Deckgröße,
Mediengröße oder Übertragungsdauer. Die anschließende Übertragung bleibt
Peer-to-Peer. Damit entsteht kein durch Nutzerinhalte bestimmtes VPS-
Bandbreitenmodell wie bei TURN.

Der Dienst ist horizontal austauschbar, weil Clients den aktuellen
Anwendungshost verwenden und kein serverseitiger Sitzungszustand existiert.
Für stark wachsende gleichzeitige Verbindungszahlen kann UDP 3478 später auf
eigene STUN-Endpunkte verteilt werden, ohne das Transferprotokoll zu ändern.

## Grenzen

- STUN ist kein Relay. Symmetrische NATs, Client-Isolation, gesperrtes UDP oder
  restriktive Unternehmensnetze können weiterhin eine Direktverbindung
  verhindern.
- Derselbe WLAN-Name beweist nicht, dass Geräte sich gegenseitig erreichen
  dürfen. Gastnetz- und Access-Point-Isolation bleiben bewusst ohne VPS-
  Datenfallback sichtbar.
- Native Apple-, Android- und Windows-Clients können später zusätzlich
  plattformeigene LAN-Erkennung verwenden. Der Web/PWA-Pfad bleibt auf
  standardkonformes ICE beschränkt.

## Verifikation

- Ein STUN-Binding-Test muss einen serverreflexiven UDP-Endpunkt liefern.
- Ein TURN-Allocate-Test darf keine Relay-Sitzung erzeugen.
- Produktionskonfiguration und Client dürfen keine `turn:`- oder `turns:`-URL
  enthalten.
- Ein erfolgreicher Transfer muss im ausgewählten ICE-Kandidatenpaar ohne
  Kandidatentyp `relay` auskommen.
- API-, Caddy- und STUN-Logs dürfen weder SDP/ICE-Payloads noch Deck- oder
  Mediendaten enthalten.
