# Plan: Native iOS-Navigation mit Liquid Glass

## Ausgangslage

Flash-n-Flip verwendet auf iPhone und iPad bereits die bewährte React-/Next.js-
Produktoberfläche in einer Capacitor-WebView. Das frühere Ziel einer getrennten
Expo-Oberfläche wurde mit ADR 0018 bewusst verworfen, weil dadurch Navigation,
Lernansichten, Medien und Editorverhalten doppelt implementiert werden müssten.

Aktuell besitzt `FlashNFlipBridgeViewController` die gesamte iOS-Ansicht. Die
fünf Hauptbereiche werden deshalb auch in der installierten iOS-App durch die
Web-Navigation `.mobile-nav` dargestellt:

1. Übersicht (`/app`)
2. Decks (`/app/decks`)
3. Lernen (zuletzt verwendete Route unter `/app/learn`)
4. Entdecken (`/community`)
5. Lokal (`/app/settings`)

Das Web-Menü ist funktional und bleibt die Referenz für Browser und PWA. Auf
iOS erreicht eine nachgebildete Glasdarstellung jedoch weder die Systemwirkung
noch das adaptive Verhalten, die Barrierefreiheit und die Betriebssystem-
Integration einer nativen UIKit-Navigation.

## Zielentscheidung

Auf iOS und iPadOS wird ausschließlich die oberste Navigation nativ. Die
Produktoberfläche, Lernlogik, Datenhaltung, Importe, Medien, Synchronisierung
und sämtliche Inhaltsseiten bleiben in der vorhandenen React-/Capacitor-
Anwendung.

Die native Shell verwendet eine Standard-`UITabBar`. Dadurch erhält sie auf
neuen iOS-Versionen die jeweils aktuelle Systemdarstellung einschließlich
Liquid Glass und auf älteren unterstützten Versionen die dort übliche native
Darstellung. Es werden keine eigenen Blur-, Glas- oder Materialeffekte
nachgebaut.

```text
FlashNFlipNativeShellViewController
├── FlashNFlipBridgeViewController
│   └── genau eine WKWebView mit der bestehenden Produktoberfläche
└── UITabBar
    ├── Übersicht
    ├── Decks
    ├── Lernen
    ├── Entdecken
    └── Lokal
```

Eine eigene Container-View mit einer Standard-`UITabBar` ist einem
`UITabBarController` mit fünf Inhalts-Controllern vorzuziehen. Der vorhandene
Capacitor-Controller und seine WebView bleiben dadurch einmalig und dauerhaft
erhalten.

## Verbindliche Grenzen

- Es gibt genau **eine** Capacitor-WebView und genau eine aktive lokale
  Datenbankverbindung.
- Es gibt keine Rückkehr zu Expo und keine zweite native Produktoberfläche.
- UIKit-, Capacitor- und WebKit-Abhängigkeiten bleiben in `apps/apple`.
- React kennt nur einen kleinen, plattformneutral benannten Navigationsvertrag;
  native APIs gelangen nicht in Domain-, Scheduler-, Import- oder Sync-Pakete.
- Browser und installierte PWA behalten die bisherige Web-Navigation und ihr
  heutiges Erscheinungsbild.
- Ohne aktive native Shell sieht die App exakt aus und funktioniert exakt wie
  bisher.
- Die Tabbar löst nur Navigation aus. Import, Synchronisierung oder andere
  Aktionen dürfen nicht an einen Tab-Klick gekoppelt werden.
- Die bestehende lokale Daten- und Sync-Autorität wird nicht verändert.
- Es wird keine zweite Logozeichnung gepflegt. Das vorhandene Marken-SVG ist
  die einzige geometrische Quelle für App-Icon und natives Tabbar-Symbol.

## Navigationsvertrag

### Stabile Tab-Identitäten

Der native Vertrag verwendet stabile IDs statt übersetzter Texte oder
konkreter SF-Symbol-Namen:

| ID         | Startziel                                     | Aktive Routen                                  | Systembeschriftung |
| ---------- | --------------------------------------------- | ---------------------------------------------- | ------------------ |
| `overview` | `/app`                                        | `/app` ohne spezielleren Hauptbereich          | Übersicht          |
| `decks`    | `/app/decks`                                  | `/app/decks...` und Deckverwaltung             | Decks              |
| `study`    | zuletzt gültige Lernroute, sonst `/app/learn` | `/app/learn...`                                | Lernen             |
| `discover` | `/community`                                  | `/community...`                                | Entdecken          |
| `local`    | `/app/settings`                               | `/app/settings...` und lokale Geräteverwaltung | Lokal              |

Welche Route zu welchem Tab gehört, bleibt als eine kanonische, getestete
Web-/Anwendungsregel definiert. Swift erhält nur die stabilen IDs und
Darstellungsdaten. Falls eine gemeinsame Deklaration nicht ohne Plattform-
Kopplung generiert werden kann, wird die kleine Swift-Zuordnung durch einen
Vertragstest gegen die Web-Zuordnung abgesichert.

### Native Richtung: Tabbar zu WebView

Beim Tippen auf einen Tab sendet die Shell über ein kleines Capacitor-Plugin
eine Navigationsanforderung an die Web-Anwendung. Die Web-Anwendung führt den
Routenwechsel mit ihrem bestehenden Router aus. Swift verändert weder direkt
den History-State der Seite noch lädt es für normale Tabwechsel das Dokument
neu.

Für `study` wird die zuletzt gültige Lernroute verwendet. Diese Zuständigkeit
bleibt bei der Web-Anwendung, weil dort bereits `lastStudyHrefKey` und die
Normalisierung der Lernroute liegen.

### Web-Richtung: WebView zu Tabbar

Nach jedem relevanten Routenwechsel meldet die Web-Anwendung mindestens:

```text
routeChanged(tabId, pathname, optionalConnectionState)
```

Damit bleiben native Auswahl und Web-Inhalt auch bei folgenden Wegen synchron:

- interne Links innerhalb einer Seite;
- Zurück-/Vorwärts-Navigation;
- Deep Links und Start-URLs;
- Wiederherstellung nach Prozessende oder WebView-Neuladen;
- Wechsel innerhalb eines Lern- oder Einstellungsbereichs.

Unbekannte oder modale Routen behalten den zuletzt eindeutig zugeordneten Tab,
statt willkürlich auf „Übersicht“ zu springen.

### Verbindungsstatus

„Lokal“ bleibt ein Navigationsziel und keine Sync-Aktion. Der vorhandene
Verbindungszustand darf optional als zugängliches Badge beziehungsweise als
Statusänderung der Tabbar dargestellt werden. Farbe allein genügt nicht;
VoiceOver muss „verbunden“, „Abgleich läuft“, „Fehler“ oder „nicht verbunden“
erkennen können. Die Shell startet oder beschleunigt durch diese Anzeige keinen
Abgleich.

## App-Icon und natives Markensymbol

### Eine gemeinsame SVG-Quelle

`apps/web/app/icon.svg` bleibt die kanonische geometrische Markenquelle. Das
SVG enthält bereits die für eine native Aufbereitung benötigten Bestandteile:

1. den gelben Hintergrund;
2. die dunkelblaue Karte;
3. die hellblaue Karte;
4. den durch die Kartenformen entstehenden Blitz als Aussparung.

Das Logo wird weder neu gezeichnet noch für iOS inhaltlich verändert. Der
vorhandene Generator darf weiterhin die Web-, PWA- und klassischen
Asset-Catalog-Ausgaben erzeugen. Apple-spezifische Ausgaben werden aus
derselben SVG-Geometrie abgeleitet und dürfen nicht als unabhängige
Handzeichnung entstehen.

### Farbiges App-Icon

Das App-Icon auf Home Screen, in Suche, Einstellungen, Mitteilungen und App
Store bleibt farbig. Monochromie ist keine Voraussetzung für Liquid Glass.

Für aktuelle Apple-Systeme werden Hintergrund und Karten als getrennte
SVG-Ebenen in Icon Composer importiert. Beleuchtung, Schatten, Brechung,
Transparenz und Maskierung entstehen dort beziehungsweise durch das System und
werden nicht in die Quellpfade eingebrannt. Aus einer gemeinsamen geschichteten
Datei werden die Darstellungen `Default`, `Dark`, `Clear` und `Tinted/Mono`
abgeleitet und auf Wiedererkennbarkeit geprüft.

Das Xcode-Projekt unterstützt derzeit iOS 15. Deshalb muss zusätzlich geprüft
werden, welche Ausgabe Xcode für ältere Systeme erzeugt. Die bisherige
farbliche Erscheinung darf dort nicht unbeabsichtigt ersetzt oder unleserlich
werden. Der bestehende flache App-Icon-Export bleibt bis zur erfolgreichen
Abnahme als Vergleichs- und Rollback-Grundlage erhalten.

### Monochromes Tabbar-Symbol

Innerhalb der nativen Tabbar wird nicht das farbige quadratische App-Icon
verwendet. Für den Tab `overview` wird aus denselben Karten- und Blitzpfaden ein
einfarbiges Custom Symbol abgeleitet:

- kein gelber quadratischer Hintergrund;
- keine fest eingebrannten Blau- oder Grautöne;
- Template-/Symbol-Rendering durch UIKit;
- Systemfarbe für nicht ausgewählt und Akzentfarbe für ausgewählt;
- klare Erkennbarkeit in kleinen Tabbar-Größen und allen unterstützten
  Symbolgewichten.

Das abgeleitete SVG wird als Apple Custom Symbol beziehungsweise Symbol Image
Set validiert. Ein beliebiges normales SVG wird nicht ungeprüft als Tabbar-
Bild verwendet. Die übrigen Tabs nutzen geeignete SF Symbols. Alle Tabs
behalten ihre sichtbaren Textbeschriftungen.

## Layout und Systemverhalten

- Die native Tabbar liegt im sicheren unteren Bereich und bestimmt ihre Höhe
  selbst. Es werden keine festen 73-Pixel-Abstände für iOS übernommen.
- Die WebView darf unter das native Material reichen, interaktive Inhalte und
  Lernsteuerungen müssen aber einen von der Shell gelieferten unteren
  Schutzabstand berücksichtigen.
- Unter nativer Shell wird nur `.mobile-nav` ausgeblendet. Desktop-Sidebar,
  PWA-Navigation und browserbasierte responsive Regeln bleiben unangetastet.
- Der native Laufzeitmodus wird über eine explizite Shell-Fähigkeit erkannt,
  nicht nur über User-Agent oder Bildschirmbreite.
- Helles und dunkles Erscheinungsbild kommen aus dem System. Eigene
  `UITabBarAppearance`-Anpassungen werden nur eingesetzt, wenn eine notwendige
  Lesbarkeit sonst nachweislich nicht erreicht wird.
- SF Symbols werden als native Tab-Icons verwendet; `overview` nutzt das aus
  der gemeinsamen Markenquelle abgeleitete monochrome Custom Symbol. Texte
  bleiben sichtbar, weil Symbole allein für die Hauptnavigation nicht
  ausreichen.
- Vergrößerte Schrift, VoiceOver, „Transparenz reduzieren“, „Kontrast erhöhen“
  und Querformat müssen unterstützt werden.
- Die erste Stufe behält auf dem iPad dieselben fünf Tabs. Eine spätere adaptive
  Tab-/Sidebar-Darstellung ist zulässig, erhält aber denselben Vertrag und
  dieselbe WebView.

## Verhalten in Lern- und Memory-Ansichten

Die Navigation soll nicht abhängig vom wechselnden Frageninhalt springen. Die
native Leiste bleibt deshalb grundsätzlich am unteren Bildschirmrand stabil.

Vor einer eventuellen Ausnahme für besonders immersive Lernansichten wird auf
einem realen iPhone geprüft, ob die native Leiste tatsächlich zu viel nutzbare
Kartenfläche beansprucht. Ein automatisches, überraschendes Ein- und Ausblenden
ist nicht vorgesehen. Falls später ein systemgestütztes Minimieren eingeführt
wird, müssen Rückkehr, VoiceOver-Fokus und die festen Lernsteuerungen stabil
bleiben.

## Umsetzung in Phasen

### Phase 0 – Entscheidung absichern

- [ ] Diesen Plan gegen ADR 0018 und ADR 0037 prüfen.
- [ ] Eine neue ADR für die native iOS-Navigations-Shell anlegen.
- [ ] Aktuelle Routen, aktive Tab-Zuordnung und die besondere Lernroute als
      Vertragstests erfassen.
- [ ] `apps/web/app/icon.svg` als einzige geometrische Markenquelle in ADR und
      Asset-Generierung festhalten.
- [ ] Bestehende iPhone-/iPad-Screenshots und Abstände als Vergleichsbasis
      sichern.

**Abnahme:** Die ADR bestätigt eine native Navigationsschicht bei weiterhin
einer React-Produktoberfläche und einer WebView.

### Phase 1 – Native Shell ohne Produktumschaltung

- [ ] `FlashNFlipNativeShellViewController` als UIKit-Container einführen.
- [ ] Den vorhandenen `FlashNFlipBridgeViewController` genau einmal als Child
      einbetten.
- [ ] Eine native `UITabBar` mit stabilen IDs, lokalisierten Labels und
      passenden SF Symbols hinzufügen.
- [ ] Aus dem bestehenden Marken-SVG ein monochromes, von Apple validiertes
      Custom Symbol für `overview` ableiten.
- [ ] Die vorhandenen SVG-Ebenen in Icon Composer übernehmen und Default-,
      Dark-, Clear- und Tinted/Mono-Darstellungen konfigurieren.
- [ ] Bestehenden App-Icon-Export als Vergleich und Rollback erhalten, bis die
      geschichtete Ausgabe auch auf älteren unterstützten iOS-Versionen
      abgenommen ist.
- [ ] Bestehende Plugin-Registrierung, WebView-Farbe, Scroll- und Bounce-Regeln
      unverändert übernehmen.
- [ ] Shell und Tabbar zunächst hinter einer lokalen Entwicklungs-Fähigkeit
      aktivierbar machen.
- [ ] Native Strukturtests so umstellen, dass sie weiterhin eine einzelne
      Bridge-Instanz und die registrierten Plugins absichern.

**Abnahme:** Die App startet mit exakt einer WebView und einer sichtbaren
System-Tabbar; Datenbank, Import, Audio und Geräteabgleich werden nicht doppelt
initialisiert.

### Phase 2 – Beidseitige Navigation

- [ ] Kleinen Apple-Navigationsadapter beziehungsweise ein Capacitor-Plugin
      mit explizit versioniertem Vertrag implementieren.
- [ ] Tab-Klicks in Web-Routen übersetzen, ohne Dokument-Reload.
- [ ] Web-Routenwechsel an die Shell melden.
- [ ] `popstate`, portable Navigation, Next-Navigation, Deep Links und
      WebView-Neustart abdecken.
- [ ] Die zuletzt verwendete Lernroute ausschließlich im bestehenden
      Web-Anwendungscode bestimmen.
- [ ] Schnelle wiederholte Tabwechsel idempotent behandeln und veraltete
      Rückmeldungen ignorieren.

**Abnahme:** Bei jedem Navigationsweg stimmen sichtbarer Inhalt, URL und
ausgewählter Tab überein. Ein Tabwechsel erzeugt keine zweite WebView und keinen
zweiten Sync-/Datenbank-Start.

### Phase 3 – Web-Menü auf iOS ersetzen

- [ ] Die native Shell-Fähigkeit vor dem ersten relevanten Layout-Paint an die
      Web-Anwendung melden, um ein kurzes Aufblitzen des Web-Menüs zu vermeiden.
- [ ] `.mobile-nav` nur bei bestätigter nativer Tabbar ausblenden.
- [ ] Den bisher reservierten Web-Menü-Abstand nur in diesem Modus entfernen.
- [ ] Den tatsächlichen nativen Schutzabstand als CSS-Variable beziehungsweise
      über den Shell-Vertrag bereitstellen.
- [ ] Lern-, Memory-, Deck-, Import-, Discover- und Einstellungsansichten auf
      Überdeckung und unnötige Leerfläche prüfen.
- [ ] Browser und PWA mit unveränderter Web-Navigation regressionsprüfen.

**Abnahme:** Auf iOS existiert nur eine sichtbare Hauptnavigation; im Browser
und in der PWA sieht die Navigation aus wie vor der Änderung.

### Phase 4 – Status, Barrierefreiheit und iPad

- [ ] Den Zustand von „Lokal“ semantisch und sparsam in die native Leiste
      spiegeln.
- [ ] VoiceOver-Reihenfolge, ausgewähltes Element, Labels, Badges und Fokus nach
      Tabwechsel prüfen.
- [ ] Helles/dunkles Systemdesign, Reduce Transparency, Increase Contrast,
      große Schrift und Querformat prüfen.
- [ ] iPad-Größenklassen und die Apple-silicon-Mac-Darstellung prüfen.
- [ ] Erst nach diesen Tests entscheiden, ob eine adaptive iPad-Sidebar einen
      eigenen Folgeplan erhält.

**Abnahme:** Navigation und Status sind ohne Farberkennung verständlich und
auf unterstützten Apple-Geräten systemgerecht bedienbar.

### Phase 5 – Aktivierung und Bereinigung

- [ ] Die native Shell-Fähigkeit standardmäßig für iOS/iPadOS aktivieren.
- [ ] Den Entwicklungs-Schalter erst entfernen, nachdem ein Rückfall auf die
      Web-Navigation nicht mehr für die Abnahme benötigt wird.
- [ ] Überholte iOS-spezifische Glas-/Blur-Regeln nur entfernen, wenn sie in
      Browser/PWA nachweislich nicht mehr benötigt werden.
- [ ] Xcode-/Capacitor-Builddokumentation und Release-Abnahmematrix ergänzen.
- [ ] Ergebnis und tatsächliche Konsequenzen in der ADR festhalten.

**Abnahme:** Das native Menü ist der produktive iOS-Pfad, während Web/PWA und
die lokale Datenautorität vollständig erhalten bleiben.

## Test- und Abnahmematrix

### Automatisiert

- Swift-/Strukturtest: genau eine `FlashNFlipBridgeViewController`-Instanz.
- Vertragstest: alle stabilen Tab-IDs und Routenzuordnungen sind vollständig.
- Asset-Test: App-Icon und Custom Symbol bleiben aus der kanonischen SVG-
  Geometrie ableitbar; keine zweite manuell gepflegte Logoquelle entsteht.
- Xcode-/Symbolprüfung: Das Overview-Symbol ist ein gültiges Custom Symbol und
  verwendet Template- statt festem Mehrfarben-Rendering.
- Navigationstest: Native → Web und Web → Native einschließlich unbekannter
  Unterroute.
- Wiederholungstest: schnelles mehrfaches Tippen erzeugt keine Reloads oder
  doppelten Initialisierungen.
- Web-Layouttest: `.mobile-nav` bleibt ohne native Fähigkeit sichtbar.
- Native-Layouttest: Web-Menü und dessen fester Platz entfallen mit Fähigkeit.
- Regression: bestehende Identity-, Audio-, SQLite-, Webstack- und
  Direct-Connect-Registrierung bleibt erhalten.

### Reale Geräte

- Physisches iPhone mit der neuesten unterstützten iOS-Version und Liquid
  Glass.
- App-Icon in Default, Dark, Clear und Tinted sowie Tabbar-Symbol in
  ausgewähltem und nicht ausgewähltem Zustand prüfen.
- Mindestens ein Gerät beziehungsweise Simulator mit älterer unterstützter
  iOS-Darstellung, da das Projekt derzeit iOS 15 als Mindestziel führt.
- iPad Hoch-/Querformat und Split View.
- Start, Hintergrund/Vordergrund, Prozessende und erneuter Start.
- Interne Links, Zurück-Geste, Deep Link und direkter Start in jedem Haupttab.
- Lernen und Memory ohne springende oder verdeckte Steuerungen.
- Import, Audio, SQLite und Geräteabgleich ohne zweite Initialisierung.
- PWA und Browser mit unverändertem bisherigen Menü.

## Energie- und Leistungsgrenzen

Die native Navigation darf keinen zusätzlichen dauerhaften Timer, Polling-Loop
oder Sync-Start einführen. Der Routenstatus wird ereignisgetrieben übertragen.
In Instruments beziehungsweise Xcode Energy Log ist zu prüfen:

- keine zweite WebView und kein zweiter JavaScript-Kontext;
- keine zusätzliche SQLite-Verbindung;
- keine wiederholten Bridge-Nachrichten im Ruhezustand;
- keine Layoutschleife durch wechselnde Safe-Area-Werte;
- kein zusätzlicher Geräteabgleich durch Auswahl oder Statusanzeige des Tabs.

## Risiken und Gegenmaßnahmen

| Risiko                                          | Gegenmaßnahme                                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| Native Auswahl und Web-Route laufen auseinander | Beidseitiger, ereignisgetriebener Vertrag mit stabilen IDs und Tests               |
| Fünf Tabs erzeugen fünf WebViews                | Eigener Container mit einer Standard-`UITabBar` und genau einem Bridge-Child       |
| Web-Menü blitzt beim Start kurz auf             | Shell-Fähigkeit vor dem ersten relevanten Layout-Paint bereitstellen               |
| Inhalte werden von der Tabbar verdeckt          | Tatsächlichen nativen Schutzabstand übertragen, keine feste Pixelannahme           |
| Browser/PWA verlieren ihr Menü                  | Web-Menü ausschließlich bei bestätigter nativer Fähigkeit ausblenden               |
| Lernansicht verliert zu viel Höhe               | Reale iPhone-Abnahme; keine vorschnelle Sonderlogik oder zweite Oberfläche         |
| Verbindungsstatus verursacht Batterielast       | Bestehende Ereignisse spiegeln, kein eigenes Polling und kein Sync beim Tabwechsel |
| Neue iOS-Darstellung bricht ältere Systeme      | Nur Standard-UIKit-Komponenten und Verfügbarkeitstests verwenden                   |
| App-Icon und Tabbar-Marke laufen auseinander    | Beide Ausgaben ausschließlich aus `apps/web/app/icon.svg` ableiten                 |
| Buntes Logo stört die Liquid-Glass-Tabbar       | Farbe am App-Icon behalten, Tabbar-Symbol monochrom durch UIKit rendern            |

## Rollback

Bis zur endgültigen Aktivierung bleibt die Web-Navigation vollständig
funktionsfähig. Bei einem nativen Shell-Fehler kann die Fähigkeit deaktiviert
und wieder der bisherige einzelne `FlashNFlipBridgeViewController` als Root
verwendet werden. Dieser Rollback verändert keine Decks, Reviews, Medien,
Geräteidentitäten oder Synchronisationsdaten.

## Nicht Bestandteil dieses Vorhabens

- native Nachimplementierung der Deck-, Lern-, Import- oder Memory-Oberflächen;
- SwiftData/Core Data als neue Datenautorität;
- Änderung des Lernalgorithmus oder des Synchronisationsprotokolls;
- fünf getrennte Navigations-Stacks mit jeweils eigener WebView;
- selbst gezeichnetes „Liquid Glass“ in CSS oder UIKit;
- Neuzeichnung oder Monochromisierung des farbigen Anwendungslogos;
- Aufgabe oder visuelle Neugestaltung der Web-/PWA-Navigation;
- Android- oder Windows-Navigation in dieser Phase.

## Architekturstatus

- **Erfüllt:** Die bestehende React-Produktoberfläche bleibt die gemeinsame
  Produktoberfläche; Plattformdarstellung bleibt in `apps/apple`; eine WebView
  und eine lokale Autorität bleiben erhalten.
- **Offen:** Der konkrete Bridge-Vertrag, die native Schutzabstandsübergabe und
  die iPad-Adaptation werden in den jeweiligen Phasen implementiert und
  abgenommen.
- **Release-Blocker:** Mehrere WebViews, doppelte SQLite-/Sync-Initialisierung,
  nicht synchronisierte Tab-/Routenzustände, verdeckte Lernsteuerungen oder ein
  abweichendes Browser-/PWA-Menü verhindern die Aktivierung.

## Referenzen

- ADR 0018: `docs/architecture/decisions/0018-local-first-capacitor-vps-sync.md`
- ADR 0037: `docs/architecture/decisions/0037-installed-app-runtime-boundary.md`
- Apple Human Interface Guidelines – Tab bars:
  <https://developer.apple.com/design/human-interface-guidelines/tab-bars>
- Apple Human Interface Guidelines – Materials:
  <https://developer.apple.com/design/human-interface-guidelines/materials>
- Apple – Adopting Liquid Glass:
  <https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass>
- Apple Human Interface Guidelines – App icons:
  <https://developer.apple.com/design/human-interface-guidelines/app-icons>
- Apple – Creating your app icon using Icon Composer:
  <https://developer.apple.com/documentation/Xcode/creating-your-app-icon-using-icon-composer>
- Apple – Creating custom symbol images for your app:
  <https://developer.apple.com/documentation/uikit/creating-custom-symbol-images-for-your-app>
