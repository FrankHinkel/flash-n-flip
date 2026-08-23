# Chemistry I – Inhalts- und Umsetzungsplan

## Zielbild

`Chemistry I` ist eine deutschsprachige, installierbare Grundlagen-Sammlung,
die Chemie als zusammenhängende Labor-Mission vermittelt. Die Karten bauen
fachlich aufeinander auf und wechseln bewusst zwischen Begriffsverständnis,
Teilchenebene, Reaktionsgleichungen, Rechnungen und Fehleranalyse.

Die sichtbaren Karten bleiben knapp. Ausführliche Definitionen, Herleitungen,
typische Fehlvorstellungen, alternative Lösungswege und Zusatzwissen erscheinen
ausschließlich über die vorhandene `(i)`-Funktion als `supplementalContent`.
Damit bleibt die eigentliche Abrufaufgabe klar, ohne fachliche Tiefe zu verlieren.

## Zielgruppe und Umfang

- Zielgruppe: Sekundarstufe II, berufliche Ausbildung und Einstieg ins
  naturwissenschaftliche Studium
- Voraussetzungen: Grundrechenarten, Brüche, Zehnerpotenzen und einfache
  Gleichungsumformungen
- Umfang: ungefähr 55 Kernkarten plus 8 mehrstufige Missionskarten
- Lernzeit: 90–120 Minuten im Übungsmodus oder mehrere reguläre Lernsitzungen
- Sprache: Deutsch; international gebräuchliche Elementsymbole und Formeln
- KaTeX: mathematische Beziehungen, Brüche, Logarithmen und Herleitungen
- mhchem: Stoffe, Ionen, Isotope, Reaktionen und Einheiten mit `\ce` und `\pu`

## Sammlungsstruktur

```text
Chemistry I
├── 00 · Willkommen im Chemie-Labor
├── 01 · Stoffe, Teilchen und Formeln
├── 02 · Reaktionsgleichungen
├── 03 · Mol und Stöchiometrie
├── 04 · Säuren, Basen und pH
├── 05 · Chemisches Gleichgewicht
├── 06 · Redox und Elektrochemie
├── 07 · Organische Chemie im Alltag
└── 08 · Abschlussmission: Die unbekannte Probe X
```

Die Reihenfolge ist fachlich progressiv. Jedes Unterdeck muss dennoch einzeln
übbar bleiben und mit einer kurzen Orientierungskarte beginnen.

## Karten- und `(i)`-Konvention

### Sichtbare Vorderseite

- genau eine Abrufaufgabe oder Vorhersage
- nur die Informationen, die zum Lösen erforderlich sind
- Formeln direkt gerendert, nicht als Bild
- keine lange Einführung vor der eigentlichen Frage
- plausible Antwortalternativen statt offensichtlich falscher Ablenker

### Sichtbare Rückseite

- richtige Antwort zuerst
- höchstens zwei kurze Begründungssätze
- bei Rechnungen: Ergebnis mit Einheit und maximal ein zentraler Rechenschritt
- bei Reaktionen: ausgeglichene Gleichung plus knappe Einordnung
- keine vollständige Lehrbucherklärung

### `(i)`-Zusatzinhalte

Jede anspruchsvolle Karte erhält mindestens einen benannten Zusatzinhalt. Die
Labels sollen konkret statt generisch sein:

- `Herleitung` – vollständiger Rechen- oder Bilanzierungsweg
- `Teilchenebene` – Erklärung des Vorgangs auf atomarer oder molekularer Ebene
- `Typischer Denkfehler` – plausible Fehlvorstellung und ihre Korrektur
- `Begriffe` – notwendige Definitionen und Abgrenzungen
- `Praxisbezug` – sichere Alltags- oder Technikrelevanz
- `Weiterdenken` – Transferfrage oder fachliche Vertiefung

Ein `(i)`-Inhalt darf mehrere strukturierte Blöcke enthalten. Er darf keine
ausführbaren Templates, extern geladenen Medien, Roh-HTML, Skripte oder
unsichere URLs enthalten. Formeln werden als strukturierter Markdown-/KaTeX-
Inhalt gespeichert.

### Beispielkarte

Vorderseite:

```markdown
Welche Stoffmenge Wasser entsteht aus $\pu{2.0 mol}$ Wasserstoff, wenn
Sauerstoff im Überschuss vorliegt?

$$
\ce{2 H2 + O2 -> 2 H2O}
$$
```

Rückseite:

```markdown
Es entstehen **$\pu{2.0 mol}$ Wasser**.

Das Verhältnis $n(\ce{H2}):n(\ce{H2O})$ beträgt $2:2=1:1$.
```

`(i) Herleitung`:

```markdown
Die Koeffizienten der ausgeglichenen Gleichung geben das Stoffmengenverhältnis
an:

$$
\frac{n(\ce{H2O})}{n(\ce{H2})}=\frac{2}{2}=1
$$

Damit gilt:

$$
n(\ce{H2O})=\pu{2.0 mol}\cdot 1=\pu{2.0 mol}
$$
```

`(i) Typischer Denkfehler`: Der Index 2 in `\ce{H2}` beschreibt zwei Atome in
einem Molekül. Er ist kein frei veränderbarer stöchiometrischer Koeffizient.

## 00 · Willkommen im Chemie-Labor

Ziel: Lernlogik, Symbolsprache und Mission erklären, bevor Wissen abgefragt
wird. Diese Karten sind Erläuterungskarten und verändern den Lernfortschritt
nicht durch künstlich schwierige Detailfragen.

1. **Drei Ebenen der Chemie**
   - sichtbar: Stoffebene, Teilchenebene und Symbolebene an Wasser
   - `(i) Begriffe`: Beobachtung und Modell sauber trennen
2. **So liest man chemische Formeln**
   - sichtbar: Koeffizient, Elementsymbol, Index und Ladung
   - Beispiel: `$\ce{2 SO4^2-}$`
   - `(i) Typischer Denkfehler`: Index, Koeffizient und Ladung verwechseln
3. **So funktionieren KaTeX und mhchem auf den Karten**
   - sichtbar: kurze Beispiele für `$...$`, `$$...$$`, `\ce{...}` und `\pu{...}`
   - `(i) Eingabehilfe`: kopierbare, sichere Mustersyntax
4. **Die Mission „Probe X“**
   - sichtbar: Lernende sammeln in jedem Kapitel Evidenz für die Abschlussanalyse
   - `(i) Lernstrategie`: zuerst vorhersagen, dann Antwort öffnen, danach erklären

## 01 · Stoffe, Teilchen und Formeln

Ziel: chemische Schreibweisen sicher zwischen Stoff-, Teilchen- und Symbolebene
übersetzen.

Geplante Kernkarten:

1. Atom, Molekül und Ion unterscheiden
2. Kation und Anion an `$\ce{Na+}$` und `$\ce{Cl-}$` erkennen
3. Protonen, Neutronen und Elektronen eines neutralen Atoms bestimmen
4. Isotopenschreibweise `$\ce{^{14}_{6}C}$` lesen
5. Atome in `$\ce{Ca3(PO4)2}$` zählen
6. Gesamtladung einer Ionenverbindung prüfen
7. Verhältnisformel aus `$\ce{Mg^2+}$` und `$\ce{Cl-}$` bilden
8. Molekülformel, Verhältnisformel und Strukturformel abgrenzen
9. Reinstoff, Element, Verbindung und Gemisch unterscheiden
10. Physikalische und chemische Änderung unterscheiden

Wichtige `(i)`-Inhalte:

- Schalenmodell als begrenztes Einführungsmodell kennzeichnen
- Massenzahl und relative Atommasse nicht gleichsetzen
- Klammerregeln beim Zählen mehratomiger Ionen vollständig zeigen
- bei Ionenverbindungen von Formeleinheiten statt Molekülen sprechen
- keine detaillierten Stoffeigenschaften auf die Kartenrückseite verlagern

## 02 · Reaktionsgleichungen

Ziel: Reaktionsgleichungen als Atom-, Ladungs- und Teilchenbilanz verstehen.

Geplante Kernkarten:

1. Edukte, Produkte und Reaktionspfeil benennen
2. `$\ce{H2 + O2 -> H2O}$` durch Koeffizienten ausgleichen
3. Verbrennung von Methan ausgleichen
4. Zersetzung von Wasserstoffperoxid ausgleichen
5. Synthese, Zersetzung, Verbrennung und Austausch zuordnen
6. Zustandsangaben `(s)`, `(l)`, `(g)` und `(aq)` lesen
7. Fällungsreaktion `$\ce{Ag+ + Cl- -> AgCl v}$` erkennen
8. vollständige und gekürzte Ionengleichung unterscheiden
9. Ladungsbilanz einer Ionengleichung prüfen
10. eine absichtlich fehlerhafte Gleichung diagnostizieren

Verbindliche Beispiele:

```latex
$$
\ce{2 H2 + O2 -> 2 H2O}
$$

$$
\ce{CH4 + 2 O2 -> CO2 + 2 H2O}
$$

$$
\ce{2 H2O2 -> 2 H2O + O2}
$$
```

Wichtige `(i)`-Inhalte:

- Bilanzierung mit Elementtabelle Schritt für Schritt
- Indizes dürfen beim Ausgleichen nicht verändert werden
- Koeffizienten geben Verhältnisse, nicht automatisch reale Teilchenzahlen an
- Fällungspfeile nur ergänzend; Aggregatzustand bleibt maßgeblich

## 03 · Mol und Stöchiometrie

Ziel: zwischen Masse, Stoffmenge, Teilchenzahl und Reaktionsverhältnis wechseln.

Geplante Kernkarten:

1. Bedeutung von `$\pu{1 mol}$` erklären
2. Avogadro-Konstante zuordnen
3. molare Masse von `$\ce{H2O}$` bestimmen
4. mit `$n=\frac{m}{M}$` Masse in Stoffmenge umrechnen
5. mit `$N=nN_\mathrm{A}$` Teilchenzahl berechnen
6. Koeffizienten als Stoffmengenverhältnis lesen
7. Produktmenge aus gegebenem Edukt berechnen
8. limitierenden Reaktanden qualitativ erkennen
9. limitierenden Reaktanden quantitativ bestimmen
10. theoretische und tatsächliche Ausbeute unterscheiden
11. prozentuale Ausbeute berechnen
12. Einheiten- und Größenordnungsfehler finden

Verbindliche Formeln:

```latex
$$
n=\frac{m}{M}
$$

$$
N=n\cdot N_\mathrm{A}
$$

$$
\eta=\frac{m_\mathrm{tatsächlich}}{m_\mathrm{theoretisch}}\cdot 100\,\%
$$
```

Wichtige `(i)`-Inhalte:

- jede Rechnung mit Größen, Einheiten und Plausibilitätskontrolle
- Unterschied zwischen Zahlenwert und Einheit
- vollständige Tabelle für den limitierenden Reaktanden
- Rundung erst am Ende; signifikante Stellen angemessen behandeln

## 04 · Säuren, Basen und pH

Ziel: Protonenübertragung, korrespondierende Paare und einfache pH-Rechnungen
verstehen.

Geplante Kernkarten:

1. Brønsted-Säure und Brønsted-Base definieren
2. Säure und Base in einer Reaktion markieren
3. korrespondierende Säure-Base-Paare bestimmen
4. Reaktion von Chlorwasserstoff mit Wasser erklären
5. Reaktion von Ammoniak mit Wasser erklären
6. Autoprotolyse des Wassers einordnen
7. pH einer gegebenen Oxoniumionenkonzentration berechnen
8. Oxoniumionenkonzentration aus einem pH bestimmen
9. Neutralisationsgleichung vervollständigen
10. stark/schwach von konzentriert/verdünnt abgrenzen

Verbindliche Beispiele:

```latex
$$
\ce{HCl + H2O -> H3O+ + Cl-}
$$

$$
\ce{NH3 + H2O <=> NH4+ + OH-}
$$

$$
\mathrm{pH}=-\log_{10}\!\left(c(\ce{H3O+})\right)
$$
```

Wichtige `(i)`-Inhalte:

- pH-Rechnungen nur für didaktisch ausdrücklich angegebene Modellannahmen
- Aktivität und Konzentration als Modellgrenze erwähnen, nicht im Kern abfragen
- „stark“ beschreibt Protolysegrad, „konzentriert“ die Stoffmenge pro Volumen
- Sicherheitswissen nur allgemein; keine gefährlichen Versuchsanleitungen

## 05 · Chemisches Gleichgewicht

Ziel: dynamisches Gleichgewicht und Reaktion auf äußere Änderungen erklären.

Geplante Kernkarten:

1. dynamisches Gleichgewicht von Reaktionsstillstand unterscheiden
2. Hin- und Rückreaktion auf Teilchenebene beschreiben
3. Massenwirkungsgesetz aus einer Gleichung aufstellen
4. Konzentrationsänderung qualitativ vorhersagen
5. Druckänderung bei Gasreaktionen beurteilen
6. Temperaturänderung bei exo-/endothermer Reaktion beurteilen
7. Rolle eines Katalysators korrekt erklären
8. einfachen Wert für `$K_c$` berechnen

Leitbeispiel:

```latex
$$
\ce{N2 + 3 H2 <=> 2 NH3}
$$

$$
K_c=\frac{c(\ce{NH3})^2}{c(\ce{N2})\,c(\ce{H2})^3}
$$
```

Wichtige `(i)`-Inhalte:

- unmittelbare Störung und anschließende Verschiebung zeitlich trennen
- Katalysator verändert Geschwindigkeit, aber nicht Gleichgewichtslage
- reine Feststoffe und Flüssigkeiten nur nach eingeführtem Modell behandeln
- Le-Chatelier als Vorhersagehilfe, nicht als mechanistische Erklärung darstellen

## 06 · Redox und Elektrochemie

Ziel: Elektronenübertragung, Oxidationszahlen und galvanische Zellen verbinden.

Geplante Kernkarten:

1. Oxidation und Reduktion als Elektronenabgabe/-aufnahme
2. Oxidationsmittel und Reduktionsmittel bestimmen
3. einfache Oxidationszahlen zuweisen
4. Oxidationsteilgleichung für Zink aufstellen
5. Reduktionsteilgleichung für Kupfer(II) aufstellen
6. Teilgleichungen zur Gesamtreaktion kombinieren
7. Elektronen- und Ladungsbilanz prüfen
8. Anode und Kathode einer galvanischen Zelle bestimmen
9. Elektronenfluss und Ionenbewegung unterscheiden
10. Standard-Zellspannung berechnen

Verbindliche Beispiele:

```latex
$$
\ce{Zn -> Zn^2+ + 2 e-}
$$

$$
\ce{Cu^2+ + 2 e- -> Cu}
$$

$$
E^\circ_\mathrm{Zelle}=E^\circ_\mathrm{Kathode}-E^\circ_\mathrm{Anode}
$$
```

Wichtige `(i)`-Inhalte:

- Merkhilfen dürfen die Definition nicht ersetzen
- Vorzeichen von Elektrodenpotenzialen nachvollziehbar einsetzen
- Salzbrücke als Ladungsausgleich, nicht als Elektronenleiter erklären
- galvanische Zelle und Elektrolyse klar abgrenzen

## 07 · Organische Chemie im Alltag

Ziel: funktionelle Gruppen und ausgewählte Reaktionstypen an alltagsnahen
Molekülen erkennen.

Geplante Kernkarten:

1. Kohlenstoffgerüst und funktionelle Gruppe unterscheiden
2. Alkan, Alken und Alkin erkennen
3. Alkohol an `$\ce{CH3CH2OH}$` erkennen
4. Carbonsäure an `$\ce{CH3COOH}$` erkennen
5. Aldehyd und Keton unterscheiden
6. Estergruppe erkennen
7. einfache homologe Reihe ordnen
8. Strukturisomere als gleiche Summenformel mit anderer Verknüpfung erklären
9. Edukte und Produkte einer Veresterung zuordnen
10. Eigenschaften nicht allein aus der Summenformel ableiten

Leitbeispiel:

```latex
$$
\ce{CH3COOH + CH3CH2OH <=> CH3COOCH2CH3 + H2O}
$$
```

Wichtige `(i)`-Inhalte:

- mhchem eignet sich für kondensierte Formeln, nicht für jede Strukturzeichnung
- Strukturformeln bei Bedarf als intern erzeugte, sichere Rastergrafik oder
  strukturierter Grafikblock, niemals als unbereinigtes SVG
- Stoffeigenschaften als Trends mit Ausnahmen erklären
- keine Syntheseanleitungen oder riskanten praktischen Parameter

## 08 · Abschlussmission: Die unbekannte Probe X

Die Mission prüft Transfer statt bloßer Wiederholung. Probe X ist ein
didaktisch konstruiertes, wasserlösliches Carbonatsalz. Die Identität wird erst
nach mehreren Evidenzschritten eingegrenzt.

### Missionskarten

1. **Beobachtung oder Interpretation?**
   - Aussagen zur Löslichkeit und Leitfähigkeit klassifizieren
   - `(i) Wissenschaftliches Arbeiten`: Beobachtung, Hypothese, Schlussfolgerung
2. **Gelöste Teilchen**
   - aus der Leitfähigkeit auf bewegliche Ionen schließen
   - `(i) Teilchenebene`: Hydratation ohne unnötige Modelldetails
3. **Gasentwicklung beim Ansäuern**
   - mögliche Anionen aus sicher beschriebenen Beobachtungen eingrenzen
   - `(i) Typischer Denkfehler`: Beobachtung allein beweist noch keine Identität
4. **Carbonatgleichung**
   - Gleichung ergänzen und bilanzieren
5. **Kalkwasser-Nachweis als gegebene Evidenz**
   - Niederschlagsbildung interpretieren, ohne Versuchsanleitung
6. **Stoffmengenrechnung**
   - aus einer vorgegebenen Stoffmenge Carbonat die Stoffmenge `$\ce{CO2}$` bestimmen
7. **Kationen-Evidenz**
   - aus vorgegebenen analytischen Daten ein plausibles Salz auswählen
8. **Abschlussbericht**
   - Beobachtungen, Gleichungen, Rechnung und verbleibende Unsicherheit verbinden

Verbindliche Reaktionen:

```latex
$$
\ce{CO3^2- + 2 H3O+ -> CO2 + 3 H2O}
$$

$$
\ce{CO2 + Ca(OH)2 -> CaCO3 v + H2O}
$$
```

Die letzte Rückseite nennt die wahrscheinlichste Identität knapp. `(i)
Beweisführung` enthält die vollständige Argumentationskette und benennt, welche
Schlüsse sicher, wahrscheinlich oder durch die gegebenen Daten nicht möglich
sind.

## Lernmechanik

- Orientierungskarten: Referenzmodus oder sehr leichte Einführung, nicht als
  Detailmemorierung gestalten
- Kernkarten: normale FSRS-Bewertung
- Rechenketten: verknüpfte, sequenzielle Karten; Zwischenergebnisse werden nicht
  vorzeitig gezeigt
- Mission: feste Reihenfolge im Übungsmodus; im späteren Wiederholen einzeln
  lernbar
- Cloze: nur wenn tatsächlich ein präziser Abrufwert fehlt
- Multiple Choice: nur mit fachlich plausiblen Fehlmodellen als Alternativen
- keine Karte darf voraussetzen, dass ein versteckter `(i)`-Inhalt zuvor geöffnet
  wurde

## Technische Umsetzung

- stabile Template-ID: `science:chemistry-i:v1`
- stabile Deck- und Karten-Keys; Inhaltsupdates dürfen Lernfortschritt nicht
  zurücksetzen
- `sourceTemplateKey` und versionierter statischer Katalog analog zu anderen
  app-eigenen Sammlungen
- Formeln als Markdown/Rich-Text und nicht als Bilder speichern
- `mhchem` lokal aus dem installierten KaTeX-Paket laden; kein CDN
- für alle Renderer `trust: false`, bestehende Größen- und Expansionsgrenzen
  beibehalten
- Detailtexte über `supplementalContent` mit lokalisierten Labels
- keine externen Medienreferenzen oder ausführbaren importierten Templates

## Quellen- und Qualitätsanforderungen

- Begriffe und Nomenklatur anhand IUPAC-Empfehlungen prüfen
- Naturkonstanten mit Quelle, Wert und Abruf-/Versionsdatum festhalten
- Zahlenaufgaben intern gegen eine unabhängige Berechnung prüfen
- Modellannahmen ausdrücklich nennen
- Gefahrstoffwissen korrekt, aber ohne praktische gefährliche Durchführung
- Inhalte und Quellen lizenzrechtlich dokumentieren; keine ungeklärten Grafiken

## Verifikation und Abnahme

1. mhchem rendert `\ce`, `\pu`, Ladungen, Isotope, Gleichgewichts- und
   Reaktionspfeile in Web und iOS-WebView.
2. Inline- und Displayformeln funktionieren auf Vorderseite, Rückseite, in
   Clozes, Tabellen und sämtlichen `(i)`-Inhalten.
3. Ungültige oder unsichere Formeln führen zur sicheren Quelltextdarstellung;
   keine Links, Skripte oder externen Ressourcen werden ausgeführt.
4. Alle Zahlenwerte, Gleichungen, Atom- und Ladungsbilanzen sind fachlich
   gegengeprüft.
5. iPhone-Viewport und iPad zeigen lange Gleichungen ohne Überlappung; notwendige
   horizontale Bewegung bleibt auf den Formelbereich begrenzt.
6. `(i)` ist per Touch, Tastatur und Screenreader erreichbar, hat verständliche
   Labels und schließt ohne Fokusverlust.
7. Eine vollständige Mission funktioniert offline, nach App-Neustart und ohne
   VPS-Verbindung.
8. Installation und späteres Update erhalten Kartenidentitäten und persönlichen
   Lernfortschritt.

## Nicht Bestandteil von Chemistry I

- vollständiges Periodensystem; dafür gilt `chemistry_periodic_system.md`
- detaillierte Quantenmechanik und vollständige Molekülorbitaltheorie
- komplexe Puffer-, Löslichkeitsprodukt- oder Nernst-Rechnungen
- praktische Versuchsanleitungen mit gefährlichen Stoffen oder Bedingungen
- rohe HTML-, JavaScript-, SVG- oder MathJax-Templates

