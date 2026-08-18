# App-Badge für fällige Karten

## Entscheidung

Die installierte Apple-App soll auf ihrem App-Icon die Anzahl der bereits
fälligen Wiederholungskarten im aktiven Lernplan anzeigen. Eine Genauigkeit auf
die Minute ist ausreichend; das Badge ist kein Wecker und benötigt keine
sekundengenaue Garantie.

Neue, noch nie gelernte Karten zählen nicht zum Badge. Sie sind zwar zum Lernen
verfügbar, besitzen aber noch keinen zukünftigen FSRS-Fälligkeitszeitpunkt.

## Warum kein JavaScript-Timer

Ein `setTimeout` im WebView ist nur eine Optimierung, solange die App aktiv ist.
iOS kann das WebView im Hintergrund anhalten oder den Prozess beenden. Auch ein
`BGAppRefreshTask` darf frühestens ab einem gewünschten Zeitpunkt laufen; den
tatsächlichen Ausführungszeitpunkt bestimmt iOS.

Die Hintergrundaktualisierung muss deshalb vorab als native lokale
Badge-Notification bei `UNUserNotificationCenter` hinterlegt werden. iOS kann
deren Badge-Wert auch setzen, wenn das WebView angehalten oder die App beendet
ist. Eine minutengenaue Planung ist dafür ausreichend und realistisch, bleibt
aber den normalen Zustellungsregeln von iOS unterworfen.

## Fachliche Quelle der Werte

Die Badge-Planung darf keine eigenen Lernintervalle berechnen. Maßgeblich sind
ausschließlich die bereits persistent gespeicherten `due`-Zeitpunkte der
Karten. Berücksichtigt werden nur Wiederholungskarten, die

- zum aktiven Lernplan gehören,
- nicht durch ausgeblendete oder archivierte Decks ausgeschlossen sind und
- nach den bestehenden Repository-Regeln lernbar sind.

Die plattformneutrale Repository-Abfrage soll mindestens liefern:

```ts
type StudyBadgePlan = {
  dueNow: number;
  transitions: Array<{
    at: string;
    dueCount: number;
  }>;
};
```

`dueNow` ist die Anzahl mit `due <= now`. Für zukünftige Karten werden die
Fälligkeiten auf die nächste volle Minute aufgerundet, damit keine Karte zu früh
als fällig erscheint. Karten derselben Minute bilden einen gemeinsamen
Übergang. `dueCount` ist jeweils der kumulierte Gesamtwert nach diesem Übergang.

Capacitor- oder Apple-APIs bleiben im Apple-App-Adapter. Domain-, Scheduler- und
Repository-Code dürfen keine Capacitor-Abhängigkeit erhalten.

## Native Planung

Für Apple wird ein kleiner Capacitor-Adapter verwendet, der

1. nur die Badge-Berechtigung verständlich anfordert,
2. das aktuelle Badge sofort auf `dueNow` setzt beziehungsweise bei `0`
   entfernt,
3. ausschließlich die von Flash-n-Flip angelegten ausstehenden Badge-Termine
   ersetzt und
4. für die vorberechneten Übergänge lokale, ton- und bannerlose
   Badge-Notifications plant.

Falls die zum Einsatz kommende Version von `@capacitor/local-notifications`
den numerischen Badge-Wert und eine wirklich sichtbarkeitsfreie Zustellung auf
iOS vollständig unterstützt, kann sie verwendet werden. Andernfalls ist ein
kleiner nativer Swift-Adapter über `UNUserNotificationCenter` vorzuziehen. Ein
allgemeiner Fremd-Plugin nur zum unmittelbaren Setzen des Badges ist nicht
notwendig.

iOS begrenzt die Anzahl ausstehender Notifications. Deshalb werden
minutengleiche Übergänge zusammengefasst und eine begrenzte rollierende Folge
geplant. Nahe Übergänge behalten Minutengenauigkeit; weiter entfernte Termine
können gröber zusammengefasst werden. Bei jedem Öffnen oder jeder relevanten
Mutation wird die Folge vollständig aus dem aktuellen lokalen Zustand neu
erstellt.

## Zeitpunkte für eine Neuberechnung

Das Badge und die ausstehenden Übergänge werden neu geplant nach:

- dem Speichern eines Reviews oder jeder anderen Änderung von `state.due`,
- Import, Wiederherstellung oder angewendeter Synchronisation,
- Hinzufügen, Entfernen, Löschen, Archivieren oder Ausblenden eines Decks,
- Wechsel oder Änderung des aktiven Lernplans,
- App-Start und Rückkehr in den Vordergrund sowie
- Änderungen an Zeitzone oder lokaler Tagesgrenze, soweit die bestehende
  Lernlogik davon betroffen ist.

Wenn die App nicht läuft, kann das Badge nur den zuletzt lokal bekannten und
vorab geplanten Zustand abbilden. Änderungen eines anderen Geräts werden erst
nach ihrer lokalen Synchronisation berücksichtigt; dafür ist kein VPS-Push und
keine Speicherung privater Lerndaten auf dem VPS vorgesehen.

## Berechtigungen und Fehlerverhalten

- Ohne Badge-Berechtigung bleibt die Lernfunktion vollständig nutzbar.
- Eine Ablehnung wird respektiert und nicht bei jedem Start erneut abgefragt.
- Die Einstellung kann später in der App beziehungsweise in den
  Systemeinstellungen erklärt werden.
- Fehler beim Setzen oder Planen eines Badges dürfen weder Review noch lokale
  Persistenz oder Synchronisation zurückrollen.
- Eigene Notification-IDs beziehungsweise ein eigener Identifier-Präfix
  verhindern, dass andere lokale Notifications der App gelöscht werden.

## Verifikation

Neben fokussierten Unit- und Repository-Tests ist die reale Ausführung auf einem
iPhone zu prüfen:

- `0`, eine und mehrere bereits fällige Karten,
- mehrere Karten mit demselben Fälligkeits-Minutenwert,
- Übergang auf die nächste Minute bei Vordergrund, Hintergrund und beendeter
  App,
- Neuberechnung direkt nach einem Review,
- Planwechsel, archiviertes Deck, Import und angewendete Synchronisation,
- App- und Gerätestart, Zeitzonenwechsel sowie Sommer-/Winterzeitgrenze,
- verweigerte und später aktivierte Badge-Berechtigung,
- keine Banner, Töne oder Einträge im Notification Center für reine
  Badge-Aktualisierungen und
- unveränderte Lern- und Synchronisationsdaten bei einem nativen Fehler.

Die Funktion gilt erst als fertig, wenn Badge-Wert und Fälligkeitsliste nach
einem Prozessneustart weiterhin übereinstimmen und die minutenweise
Hintergrundaktualisierung auf einem echten Gerät nachgewiesen wurde.

## Referenzen

- [Capacitor Local Notifications](https://capacitorjs.com/docs/apis/local-notifications)
- [Apple: Scheduling a notification locally](https://developer.apple.com/documentation/usernotifications/scheduling-a-notification-locally-from-your-app)
- [Apple: `BGTaskRequest.earliestBeginDate`](https://developer.apple.com/documentation/backgroundtasks/bgtaskrequest/earliestbegindate)
