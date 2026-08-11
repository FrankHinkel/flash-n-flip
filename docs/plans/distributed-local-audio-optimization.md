# Wiederherstellung und verteilte lokale Audiooptimierung

- Status: Entwurf zur Freigabe
- Datum: 11. August 2026
- Geltungsbereich: iPhone/iPad, gekoppelte Browser und spätere native
  Android-/Windows-/Mac-Clients
- Referenz: frühere FFmpeg-Pipeline in
  `apps/api/src/services/audio-optimizer.ts`
- Übergeordnet: ADR 0029 und
  `docs/plans/accountless-cross-platform-local-first.md`

## 1. Ziel

Flash-n-Flip soll die frühere Audioqualität wieder erreichen, ohne private
Audiodateien an den VPS zu senden. Importiertes Originalaudio bleibt zuerst
unverändert und sofort abspielbar. Eine fortsetzbare lokale Pipeline erzeugt
danach geprüfte Wiedergabederivate mit:

- angeglichener Sprachlautheit,
- sicher begrenzten Spitzenpegeln,
- zurückhaltender Rauschminderung,
- sinnvoll gekürzter Randstille,
- Mono-AAC-LC bei niedriger, für Sprachkarten geeigneter Datenrate,
- erneuter Dekodierungs- und Qualitätsprüfung vor der Aktivierung.

Sind mehrere vertrauenswürdige Geräte direkt verbunden, teilen sie die noch
offenen Dateien entsprechend ihrer Fähigkeiten und aktuellen Belastbarkeit.
Der VPS bleibt ausschließlich Rendezvous-/STUN-Dienst und erhält weder Audio,
Aufträge, Derivate noch Analysewerte.

## 2. Kritische Bestandsaufnahme

| Bereich              | Heutiger Stand                                                                                                                                                                                                  | Bewertung                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Frühere VPS-Qualität | Die bestehende FFmpeg-Pipeline entrauscht mit `afftdn`, behandelt Stille, misst und normalisiert ungefähr auf -18 LUFS, begrenzt True Peak, kodiert AAC-LC/Mono/24 kHz/40 kbit/s und prüft das Ergebnis erneut. | Als Qualitätsreferenz geeignet, aber nicht mehr als Produktdienst.                                      |
| Lokale Warteschlange | `apps/web/lib/audio-optimization.ts` führt Jobs seriell und pausierbar aus. Der Zustand liegt in `localStorage`.                                                                                                | Funktionsansatz vorhanden, aber nicht ausreichend dauerhaft und nicht geräteübergreifend.               |
| iPhone-Plugin        | Das Swift-Plugin liest Audio und schreibt Mono-AAC mit 44,1 kHz/64 kbit/s.                                                                                                                                      | Es transkodiert nur. Lautheit, True Peak, Rauschfilter, Stille und vollständige Ergebnisprüfung fehlen. |
| Speicherweg          | Komplette Audiodateien werden zwischen JavaScript und Swift Base64-kodiert.                                                                                                                                     | Unnötige Speichervervielfachung; für große Imports ungeeignet.                                          |
| Derivataktivierung   | Ein neues Medium wird erzeugt und jede betroffene Karte vom Original auf die neue Medien-ID umgeschrieben.                                                                                                      | Lokal funktionsfähig, aber konfliktanfällig, wenn mehrere Geräte gleichzeitig optimieren.               |
| Synchronisation      | Fertige Medien und Kartenmutationen können übertragen werden; Optimierungsjobs und Gerätefähigkeiten nicht.                                                                                                     | Ergebnisse reisen indirekt, Arbeit kann nicht verteilt werden.                                          |
| Browser              | Die Warteschlange startet nur auf nativen Capacitor-Geräten.                                                                                                                                                    | Ein gekoppelter PC kann derzeit keine Last übernehmen.                                                  |
| Hintergrundbetrieb   | Beim App-Start wird die Queue fortgesetzt; eine vom System garantierte längere Hintergrundausführung ist nicht eingerichtet.                                                                                    | Neustart grundsätzlich behandelbar, echter iOS-Hintergrundlauf noch offen.                              |
| Anzeige              | Die Einstellungen zeigen eine „potenzielle Wiedergabe-Ersparnis“.                                                                                                                                               | Solange Original und Derivat beide gespeichert sind, gibt es keine reale Speicherersparnis.             |

### 2.1 Konsequenz für die Speicheranzeige

In der sicheren ersten Stufe bleiben Original und Derivat erhalten. Damit gilt:

```text
tatsächliche lokale Belegung = Original + Derivat
potenzielle spätere Ersparnis = Originalgröße - Derivatgröße
tatsächlich freigegeben = erst nach sicherer Originallöschung
```

Die Oberfläche muss diese drei Werte trennen. Sie darf eine potenzielle
Ersparnis nicht als bereits freigegebenen Speicher darstellen.

## 3. Verbindliche Leitplanken

- Originalaudio wird vor jedem Auftrag atomar gespeichert und niemals durch
  einen Optimierungsfehler beschädigt oder verworfen.
- Karten behalten dauerhaft die ID des Originalmediums. Die bevorzugte
  Wiedergabequalität wird über eine abgeleitete Derivatzuordnung bestimmt.
- Eine Datei ist die kleinste Arbeitseinheit. Eine einzelne Datei wird nicht
  zwischen Geräten aufgeteilt.
- Jedes Ergebnis ist durch Quellhash, Pipelineversion, Ausgabehash und
  Qualitätswerte identifizierbar und idempotent anwendbar.
- Verarbeitung erfolgt standardmäßig seriell pro Mobilgerät. Desktopgeräte
  dürfen nach Messung mehr als einen Slot anbieten.
- Medienbytes werden getrennt von Metadaten, gehasht, begrenzt und resumierbar
  über den vorhandenen WebRTC-Medienkanal übertragen.
- Unvollständige oder ungeprüfte Ausgaben werden nie von Karten abgespielt und
  nie als fertige Derivate synchronisiert.
- Keine private Audiodatei und kein Optimierungsauftrag erreicht den VPS.
- Die gemeinsame Pipelinebeschreibung ist plattformneutral. AVFoundation,
  Accelerate, WebAssembly oder spätere native Android-/Windows-Engines sind
  Adapter und enthalten keine abweichenden Produktregeln.
- Automatisches Löschen von Originalen bleibt bis zu einer gesonderten
  Freigabe ausgeschaltet.

## 4. Zielpipeline `speech-audio-v2`

### 4.1 Gemeinsamer Vertrag

Ein neues Domain-Paket beschreibt Pipelineversion, Grenzen, Ergebniszustände
und Toleranzen. Es kennt keine AVFoundation-, FFmpeg-, Browser- oder
SQLite-APIs.

Zielwerte der ersten Version:

- integrierte Lautheit: -18 LUFS mit einer Toleranz von ±2 LU,
- maximaler True Peak: -1,5 dBTP,
- Mono,
- 24 kHz,
- AAC-LC,
- ungefähr 40 kbit/s für Sprachmaterial,
- Rauschminderung in der Größenordnung der früheren 12-dB-Pipeline, ohne
  hörbare Sprachverfremdung,
- 150 ms Schutz am Anfang und Ende nach erkannter Randstille,
- interne Stille nicht zusammenschneiden; nur tatsächliches Rauschen darin
  absenken beziehungsweise auf Stille setzen,
- automatische Optimierungsgrenze zunächst 16 MiB und 30 Minuten pro Datei;
  größere sichere Originale bleiben erhalten und erhalten den Zustand
  `NOT_SUPPORTED_BY_POLICY` statt `FAILED`.

Die Plattformausgaben müssen nicht bytegleich sein. Sie müssen denselben
messbaren Qualitätsvertrag erfüllen.

### 4.2 Verarbeitungsschritte

1. Quellbytes anhand Signatur, Dekodierbarkeit, Spurzahl, Dauer und Grenzen
   prüfen; Dateiendung und MIME-Angabe allein reichen nicht.
2. Audio dateibasiert oder blockweise dekodieren; kein vollständiger
   Base64-Roundtrip durch die WebView.
3. Erster Durchlauf: Dauer, Kanalzahl, Lautheit, True Peak, Rauschprofil und
   Stilleintervalle messen.
4. Zweiter Durchlauf: vorsichtige spektrale Rauschminderung, Randstille,
   Lautheitskorrektur und Peak-Begrenzung anwenden.
5. Auf Mono/24 kHz konvertieren und AAC-LC kodieren.
6. Temporäre Ausgabe schließen, erneut öffnen und vollständig dekodieren.
7. Hash, Format, Dauer, Lautheit, True Peak, Dateigröße und Dekodierbarkeit
   gegen den Vertrag prüfen.
8. Nur ein bestandenes Ergebnis atomar als Derivat installieren.
9. Falls es qualitativ nicht besteht oder keinen sinnvollen Nutzen bringt,
   Original unverändert bevorzugen und einen verständlichen Zustand speichern.

### 4.3 iPhone-Engine

- AVFoundation/AudioToolbox übernimmt Dekodierung, Resampling und AAC-LC.
- Accelerate/vDSP übernimmt blockweise Pegel-, FFT-, Rausch- und
  Lautheitsberechnungen.
- Eingabe und Ausgabe werden über geschützte temporäre Dateien oder native
  Dateihandles ausgetauscht. JavaScript erhält nur Job-IDs, Fortschritt und
  Resultatmetadaten.
- Der DSP läuft mit Utility-Priorität, maximal einer Datei gleichzeitig und
  liefert nach jedem fachlichen Schritt einen abbrechbaren Fortschritt.
- Bei kritischem Temperaturzustand, Energiesparmodus oder sehr niedrigem
  Akkustand wird nach der aktuellen Datei pausiert. Die genaue Standardregel
  wird durch den Gerätebenchmark festgelegt.
- Ein vom aktuellen iOS-Ziel unterstützter Hintergrundmechanismus wird erst
  nach einem realen Gerätetest aktiviert. Das System darf den Prozess jederzeit
  beenden; deshalb bleibt der Checkpoint pro Datei die eigentliche Garantie.

## 5. Konfliktfreies Derivatmodell

### 5.1 Stabile Originalreferenz

Karten verweisen weiterhin auf `originalMediaId`. Der Media-Resolver wählt für
die Wiedergabe optional ein gültiges Derivat. Dadurch erzeugt Audiooptimierung
keine Kartenmutationen und kann Lerninhalte nicht überschreiben.

### 5.2 Derivatmetadaten

Eine Derivatentität enthält mindestens:

- Originalmedien-ID und SHA-256 des Originals,
- Pipeline-ID und Pipelineversion,
- Ausgabe-Medien-ID, SHA-256, MIME-Typ und Bytegröße,
- erzeugendes Gerät und Engineversion,
- gemessene Eingangs- und Ausgangswerte,
- Prüfstatus und Zeitpunkt,
- Gründe für `KEPT_ORIGINAL`, `UNSUPPORTED` oder `FAILED`.

Die Ausgabe-Medien-ID wird stabil aus Quellhash, Pipelineversion und
Ausgabehash abgeleitet. Gleiches Ergebnis wird dadurch auf allen Geräten
dedupliziert.

### 5.3 Mehrere gültige Kandidaten

AVFoundation und FFmpeg/WebAssembly können trotz gleicher Zielwerte
unterschiedliche AAC-Bytes erzeugen. Treffen mehrere geprüfte Kandidaten ein,
wählen alle Clients deterministisch:

1. höchste unterstützte Pipelineversion,
2. bestandene lokale Dekodierungs- und Qualitätsprüfung,
3. kleinste Abweichung vom Lautheitsziel,
4. kleinere Datei innerhalb gleicher Qualitätsklasse,
5. lexikografisch kleinerer Ausgabehash als letzte stabile Auflösung.

Nicht gewählte Kandidaten dürfen erst nach einer sicheren, synchronisierten
Bereinigung entfernt werden.

## 6. Dauerhafte lokale Warteschlange

- Installierte Apps speichern Jobs in SQLite, Browser in IndexedDB; nicht in
  `localStorage`.
- Offene Jobs werden aus Originalaudio ohne gültiges Derivat deterministisch
  abgeleitet. Der lokale Queueeintrag enthält nur Ausführungszustand,
  Checkpoint, Fehler, Versuchszahl und temporäre Dateireferenz.
- Zulässige Zustände:

```text
PENDING -> ANALYZING -> PROCESSING -> ENCODING -> VERIFYING -> COMPLETE
                                   \-> KEPT_ORIGINAL
                                   \-> UNSUPPORTED
                                   \-> FAILED_RETRYABLE
                                   \-> FAILED_FINAL
```

- `PROCESSING` wird nach Prozessabbruch beim nächsten Start zu `PENDING`, wenn
  kein vollständig geprüftes Derivat existiert.
- Wiederholungen sind durch Jobschlüssel und Ergebnis-Hash idempotent.
- Temporäre Dateien werden beim Start geprüft und entweder fortgesetzt oder
  sicher verworfen. Original und bereits fertige Derivate bleiben unberührt.

## 7. Lastverteilung zwischen gekoppelten Geräten

### 7.1 Fähigkeiten austauschen

Nach erfolgreicher Webstack-Übergabe und Sync-Kompatibilitätsprüfung meldet
jedes Gerät flüchtig:

- Plattform und Engineversion,
- unterstützte Eingangsformate,
- Pipelineversionen,
- maximale Dateigröße und Dauer,
- Zahl freier Arbeitsslots,
- gemessenen Durchsatz aus einem kleinen lokalen Benchmark,
- Energie-/Temperaturklasse und Pausenstatus,
- vorhandene Quellhashes und bereits fertige Jobschlüssel.

Diese Betriebsdaten bleiben in der direkten WebRTC-Verbindung und werden nicht
als Benutzerprofil gespeichert.

### 7.2 Verteilung

- Für die erste Stufe werden genau zwei gleichzeitig verbundene Geräte
  unterstützt. Mehrgeräte-Mesh folgt erst nach stabiler Zwei-Geräte-Abnahme.
- Das Gerät mit der lexikografisch kleineren Geräte-ID koordiniert nur die
  aktuelle Verbindung. Es wird dadurch keine neue Datenautorität.
- Bereits laufende Dateien bleiben auf ihrem Gerät. Nur ausstehende Jobs werden
  neu verteilt.
- Gewichtet wird nach gemessenem Durchsatz und freien Slots. Ein iPhone bietet
  höchstens einen Slot; ein geeigneter Desktop nach Benchmark ein oder zwei.
- Ein Worker erhält Jobschlüssel und Originalhash. Sind die Originalbytes lokal
  vorhanden, beginnt er sofort. Andernfalls fordert er sie über den bestehenden
  resumierbaren Medienkanal an.
- Zuweisungen besitzen eine sitzungsgebundene Frist auf Basis lokaler monotoner
  Zeit. Geräteuhren entscheiden nicht über Besitz oder Konflikte.
- Bei Verbindungsabbruch läuft ein bereits lokaler Auftrag weiter. Nicht
  gestartete Fremdzuweisungen fallen nach einer kurzen Schonfrist in die lokale
  Queue zurück.
- Fertige Metadaten werden idempotent synchronisiert; die Derivatbytes folgen
  separat über den bestehenden Hash-/Chunk-Transfer.
- Doppelte Arbeit ist zulässig und darf höchstens zwei gültige Kandidaten
  erzeugen. Sie darf niemals Karten oder Originale beschädigen.

### 7.3 Protokoll

Für die Audioarbeit werden eigene Peer-Nachrichten eingeführt, beispielsweise:

```text
AUDIO_WORKER_CAPABILITIES
AUDIO_WORK_INVENTORY
AUDIO_WORK_ASSIGN
AUDIO_WORK_PROGRESS
AUDIO_WORK_RESULT
AUDIO_WORK_RELEASE
```

Sie werden streng begrenzt und enthalten keine Audiodaten. Die Einführung ist
eine neue lokale Sync-Protokollgeneration. Wie beim bisherigen Webstack muss
vorher ein Upgradepfad existieren, damit eine alte Browser-Hülle zunächst die
neue App vom iPhone laden kann und erst danach die neue Audiogeneration nutzt.

## 8. Browser- und Desktopstrategie

Ein normaler Browser besitzt keine verlässliche plattformübergreifende
AAC-/DSP-Pipeline. Deshalb wird keine ungeprüfte Weblösung festgeschrieben.

Es werden drei Varianten mit denselben Dateien verglichen:

1. `ffmpeg.wasm`, seriell und optional mit Threads, als vom iPhone signiert
   übertragener Worker ohne externes CDN,
2. WebCodecs/Web Audio nur dort, wo Dekoder, Offline-DSP und ein geeignetes
   interoperables Ausgabeformat vollständig vorhanden sind,
3. spätere native Mac-/Windows-/Android-Adapter mit systemeigenem Codec und
   gemeinsamer Pipelinebeschreibung.

`ffmpeg.wasm` wird nur übernommen, wenn App-/Webstack-Größe, Lizenz,
Spitzen-RAM, Startzeit, Browserstabilität, Akkulast und Ergebnisprüfung
akzeptabel sind. Scheitert der Browser-Prototyp, bleibt der Browser trotzdem
vollwertiger Editor und Queue-Koordinator; die Audioarbeit übernehmen dann
iPhone/iPad oder ein späterer nativer Desktopclient.

## 9. Benchmark iPhone 15 gegen Zwei-CPU-VPS

### 9.1 Referenzkorpus

- die 239 Originalaudios des realen Xefjord-Arabic-Pakets,
- kurze Sprachclips unter 3 Sekunden,
- Clips zwischen 3 und 30 Sekunden,
- einzelne lange Dateien,
- MP3, WAV, M4A/AAC, FLAC und Ogg/Opus soweit unterstützt,
- sehr leise, sehr laute, verrauschte und bereits saubere Aufnahmen,
- führende, interne und nachlaufende Stille,
- Stereo, beschädigte Dateien und Grenzgrößen.

Alle Geräte verarbeiten exakt dieselben Quellbytes seriell. Simulatorwerte
zählen nicht als iPhone-Benchmark.

### 9.2 Messwerte

| Kategorie       | Messwert                                                                         |
| --------------- | -------------------------------------------------------------------------------- |
| Geschwindigkeit | Gesamtzeit, Median/P95 pro Datei, Echtzeitfaktor und Dateien pro Minute          |
| Ressourcen      | CPU-Zeit, Spitzen-RAM, temporärer Speicher, übertragene Bytes                    |
| Mobil           | Akkuverbrauch pro 100 Dateien, Temperaturzustand, Pausen und Systemabbrüche      |
| Qualität        | Eingangs-/Ausgangs-LUFS, True Peak, Clipping, Daueränderung, Rauschabsenkung     |
| Größe           | Original, Derivat, potenzielle Ersparnis und tatsächliche Gesamtbelegung         |
| Robustheit      | nicht unterstützt, Original beibehalten, wiederholbar fehlgeschlagen, beschädigt |
| Bedienung       | blockierte UI-Zeit, Importdauer bis Nutzbarkeit und Fortschrittsverständlichkeit |

### 9.3 Go/No-go

- Kein Originalverlust und kein unspielbares aktiviertes Derivat.
- 100 % der aktivierten Derivate lassen sich erneut vollständig dekodieren.
- Lautheit und True Peak liegen innerhalb des gemeinsamen Vertrags.
- Kein hörbares Pumpen, metallisches Sprachrauschen oder abgeschnittenes Wort
  im kuratierten Hörvergleich.
- Spitzen-RAM bleibt durch Streaming unabhängig von der Gesamtgröße eines
  importierten Decks; als Startgrenze gelten höchstens 150 MiB zusätzliche
  Prozessbelegung pro aktivem Mobiljob.
- Die UI bleibt bedienbar; keine lange Hauptthread-Arbeit durch Base64 oder DSP.
- Temperatur- oder Energieschutz pausiert kontrolliert und verliert keinen Job.
- Erst die Messung entscheidet, ob das iPhone 15 standardmäßig auch ohne
  Ladegerät optimiert und wie Jobs zwischen iPhone und VPS-Referenz
  beziehungsweise Desktop gewichtet werden.

Erwartungen an eine Geschwindigkeit werden vor dem Benchmark bewusst nicht als
Fakt behauptet. Der Hardware-AAC-Encoder des iPhones kann die Kodierung stark
beschleunigen; Rauschfilter, Zweipass-Lautheitsanalyse und Dateiverwaltung
bleiben jedoch CPU-/I/O-Arbeit.

## 10. Benutzeroberfläche

Die bestehende Oberfläche bleibt erhalten und wird nur um klare Zustände
ergänzt:

- `12 von 239 optimiert`, aktuelle Datei und Verarbeitungsschritt,
- Pause nach aktueller Datei, Fortsetzen und fehlgeschlagene erneut versuchen,
- beteiligte Geräte und deren Beitrag, zum Beispiel `iPhone 74 · PC 165`,
- Originalgröße, Derivatgröße, aktuelle Gesamtbelegung,
- potenzielle Ersparnis bei behaltenem Original,
- tatsächlich freigegebener Speicher nach später erlaubter Bereinigung,
- verständliche Zustände für nicht unterstützt und Original beibehalten,
- keine dauerhafte Warnung, solange Originale sicher und abspielbar sind.

Standardmäßig darf das System im Hintergrund leise arbeiten. Detailwerte sind
aufklappbar und blockieren weder Import noch Lernen.

## 11. Optionale spätere Originallöschung

Diese Stufe ist **nicht** Teil der ersten Wiederherstellung. Sie benötigt eine
separate Benutzerfreigabe und mindestens:

- vollständig geprüftes und lokal abspielbares Derivat,
- erfolgreichen Export/Backup oder eine zweite verifizierte Kopie des
  Originals auf einem vertrauenswürdigen Gerät,
- verständliche Anzeige des Rückfallverlustes bei Entfernung,
- synchronisierte, idempotente Bereinigungsentscheidung,
- Wiederanlauf- und Unterbrechungstest,
- keine Löschung, solange ein älterer Client das Derivat nicht sicher versteht.

Empfehlung: Originale zunächst dauerhaft behalten. Die Qualitätsvorteile
werden sofort genutzt; echte Speicherfreigabe folgt erst nach belastbarer
Backup-/Replica-Abnahme.

## 12. Umsetzungsphasen und Checkliste

### Phase A – Referenz einfrieren und messen

- [ ] Frühere VPS-Pipeline als lokale/CI-Referenz festhalten; keine Produkt-API
      für private Audiodaten reaktivieren.
- [ ] Reales und synthetisches Golden-Master-Korpus versionieren, soweit die
      Quelldaten rechtlich im Repository liegen dürfen; private Audios bleiben
      lokale Testfixtures.
- [ ] Qualitäts- und Benchmarkbericht für Zwei-CPU-VPS und physisches iPhone 15
      erzeugen.
- [ ] Hörvergleich für saubere, verrauschte, leise und stille Clips durchführen.

Abnahme: Wir kennen Qualitätsabweichung, Durchsatz, RAM, Akku und Temperatur;
keine Architekturentscheidung basiert nur auf einer Vermutung.

### Phase B – Konfliktfreie lokale Grundlage

- [ ] Kartenreferenzen auf dem Original stabil halten.
- [ ] Versioniertes Derivat- und Qualitätsmodell im Domainpaket definieren.
- [ ] Queue von `localStorage` nach SQLite/IndexedDB migrieren.
- [ ] Native dateibasierte Schnittstelle statt Base64 implementieren.
- [ ] Wiederanlauf, Pause, Retry und temporäre Bereinigung testen.
- [ ] Speicheranzeige in aktuell, potenziell und tatsächlich freigegeben teilen.

Abnahme: Ein Abbruch an jedem Schritt lässt Original, Karten und Queue korrekt;
doppelte Installation desselben Ergebnisses ist idempotent.

### Phase C – Frühere Audioqualität auf dem iPhone wiederherstellen

- [ ] Zweipass-Analyse, Loudness-/True-Peak-Vertrag und Validierung umsetzen.
- [ ] Vorsichtige vDSP-Rauschminderung gegen die FFmpeg-Referenz abgleichen.
- [ ] Randstille mit Schutzintervallen behandeln.
- [ ] Mono/24-kHz/AAC-LC-Ausgabe mit Zielbitrate erzeugen.
- [ ] Ausgabe erneut vollständig dekodieren und messen.
- [ ] Energie-, Temperatur- und Hintergrundabbruch sicher behandeln.

Abnahme: Qualitätsvertrag und Hörtest bestehen auf physischem iPhone 15; die
VPS-Produktverarbeitung bleibt abgeschaltet.

### Phase D – Browser-/Desktop-Prototyp

- [ ] `ffmpeg.wasm` und verfügbare Browser-Codecs gegen dasselbe Korpus messen.
- [ ] Lazy Loading aus dem signierten iPhone-Webstack ohne CDN nachweisen.
- [ ] Lizenz, Paketgröße, RAM, Startzeit und Absturzverhalten prüfen.
- [ ] Entscheidung dokumentieren: Browserworker, nur native Desktopengine oder
      zunächst iPhone-only.

Abnahme: Nur eine nachweislich sichere und wirtschaftliche Engine erhält die
Capability `AUDIO_OPTIMIZATION_V2`.

### Phase E – Direkte Arbeitsverteilung

- [ ] Capability-, Inventory-, Assign-, Progress-, Result- und Release-
      Nachrichten definieren und begrenzen.
- [ ] Kompatiblen Upgradepfad vor Erhöhung der Peer-Protokollgeneration bauen.
- [ ] Gewichteten Zwei-Geräte-Scheduler und sitzungsgebundene Fristen umsetzen.
- [ ] Bereits vorhandene Originale per Hash erkennen; fehlende resumierbar
      übertragen.
- [ ] Ergebnisbytes getrennt von Metadaten übertragen und validieren.
- [ ] Disconnect, Doppelarbeit, Neustart und konkurrierende Ergebnisse testen.

Abnahme: iPhone und PC teilen 239 Dateien, können mehrfach getrennt und neu
verbunden werden und konvergieren ohne Kartenänderung auf dieselben gültigen
Wiedergabederivate.

### Phase F – Produktanzeige und reale Langzeitabnahme

- [ ] Fortschritt, Gerätebeitrag, Qualitätszustände und Speicherwerte anzeigen.
- [ ] Pause/Fortsetzen/Retry auf beiden Geräten prüfen.
- [ ] Import, Lernen und Audio während laufender Optimierung prüfen.
- [ ] iPhone-Neustart, Browser-Reload, Energiesparmodus, volles
      Speicherkontingent und Verbindungsabbruch prüfen.
- [ ] 1.000-Dateien-Langlauf und wiederholten Peer-Transfer durchführen.

Abnahme: Die Optimierung arbeitet unaufdringlich, Originale bleiben sicher und
der sichtbare Fortschritt entspricht dem dauerhaft gespeicherten Zustand.

### Phase G – Optionale echte Speicherfreigabe

- [ ] Erst nach gesonderter Freigabe Backup-/Replica-Nachweis definieren.
- [ ] Explizite Originalbereinigung mit Tombstone und Wiederanlauf umsetzen.
- [ ] Tatsächlich freigegebene Bytes statt potenzieller Ersparnis anzeigen.
- [ ] N-1-/N-2-Kompatibilität vor jeder Bereinigung nachweisen.

Abnahme: Kein Original wird ohne nachweisbaren Rückfallweg und ausdrückliche
Benutzerentscheidung entfernt.

## 13. Testmatrix

| Fall                                           | Erwartung                                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| App wird während Analyse beendet               | Original bleibt; Job startet kontrolliert neu.                                                 |
| App wird während Kodierung beendet             | Temporäres Derivat wird nie aktiviert.                                                         |
| Verbindung fällt nach Zuweisung aus            | Worker darf lokal beenden; sonst fällt Job später zurück.                                      |
| Zwei Geräte optimieren dieselbe Datei          | Beide Ergebnisse sind idempotent; deterministische Auswahl konvergiert.                        |
| Derivatbytes werden unterbrochen               | Chunktransfer setzt fort; Metadaten aktivieren keine fehlenden Bytes.                          |
| Derivat ist kleiner, aber zu laut              | Verwerfen und Original beibehalten.                                                            |
| Derivat ist größer, aber hörbar besser         | Nach definierter Qualitäts-/Größenregel Original oder Derivat; keine spontane Einzelfalllogik. |
| Ogg/Opus auf nicht unterstütztem Apple-Decoder | Sichtbar `UNSUPPORTED`; Original bleibt und kann ein geeigneter Peer übernehmen.               |
| PC ist schneller als iPhone                    | Scheduler weist dem PC nach Benchmark mehr neue Dateien zu.                                    |
| iPhone wird heiß oder Akku niedrig             | Nach aktueller Datei pausieren und PC weiterarbeiten lassen.                                   |
| Browserworker benötigt zu viel RAM             | Capability zurückziehen; Browser bleibt Editor/Koordinator.                                    |
| Nur ein Gerät ist vorhanden                    | Vollständige serielle lokale Optimierung funktioniert weiterhin.                               |
| VPS ist offline                                | Import, Optimierung und lokaler Fortschritt bleiben funktionsfähig.                            |

## 14. Release-Blocker

- Originalverlust, beschädigte Originalreferenz oder unspielbares aktiviertes
  Derivat,
- Kartenkonflikte durch konkurrierende Optimierung,
- nicht fortsetzbare Jobs nach App-/Prozessende,
- Audio- oder Auftragsbytes auf dem VPS,
- ungeprüfte MIME-/Codec-Ausgabe oder fehlende Hashprüfung,
- unbeschränkter Base64-/RAM-Verbrauch,
- irreführende Anzeige einer noch nicht realisierten Speicherersparnis,
- Protokollsprung, der die Webstack-Aktualisierung alter Browser blockiert,
- hörbar abgeschnittene Sprache oder deutlich schlechtere Rausch-/Lautheits-
  Qualität als die freigegebene Referenz.

## 15. Entscheidungen zur Freigabe

Empfohlene Standardeinstellungen:

1. **Originale zunächst behalten.** Echte Löschung erst in Phase G separat
   freigeben.
2. **iPhone seriell mit einem Slot.** Bei Temperatur-/Energiegrenze nach der
   aktuellen Datei pausieren.
3. **PC bevorzugt belasten, wenn er nachweislich schneller ist.** Die Verteilung
   folgt dem gemessenen Durchsatz und nicht einem festen Plattformnamen.
4. **Browserengine nur nach Phase-D-Go.** Kein großes FFmpeg-WASM-Paket allein
   aufgrund vermuteter Geschwindigkeit in jeden Webstack aufnehmen.
5. **Messbare Parität statt Bytegleichheit.** Alle Engines erfüllen denselben
   Qualitätsvertrag; identische AAC-Bytes sind nicht erforderlich.

Mit Freigabe dieses Plans beginnt Phase A. Die Freigabe erlaubt weder eine
Reaktivierung der VPS-Audioverarbeitung noch das Löschen von Originalaudio.
