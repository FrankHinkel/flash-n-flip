# Chemistry – Periodensystem: Inhalts- und Umsetzungsplan

## Zielbild

Das Periodensystem wird als eigenständige, deutschsprachige Sammlung umgesetzt.
Einige Erläuterungskarten führen zuerst in Aufbau, Lesart und periodische Trends
ein. Danach werden alle 118 anerkannten Elemente nach einer ausdrücklich
festgelegten Elementklasse strukturiert gelernt.

Die Kartenrückseiten bleiben auf die konkrete Abrufantwort beschränkt.
Elektronenkonfiguration, Herkunft des Namens, Entdeckung, Vorkommen,
Eigenschaften, wichtige Verbindungen, Anwendungen, Isotope, Gefahren und
fachliche Sonderfälle erscheinen über `(i)` als `supplementalContent`.

## Zielgruppe und Umfang

- Zielgruppe: Sekundarstufe I/II bis Einstieg ins naturwissenschaftliche Studium
- eigenständige Sammlung; keine Abhängigkeit von `Chemistry I`
- 10–12 Einführungskarten
- 2 Identitätskarten pro Element: `Symbol → Name` und `Name → Symbol`
- zusätzliche Klassen-, Trend- und Transferkarten
- Zielumfang: ungefähr 280–310 Karten
- KaTeX/mhchem für Nuklidschreibweise, Ionen, Elektronenkonfigurationen,
  Reaktionsbeispiele und Einheiten

## Sammlungsstruktur

```text
Periodensystem der Elemente
├── 00 · Das Periodensystem lesen
├── 01 · Reaktive Nichtmetalle
├── 02 · Halogene
├── 03 · Edelgase
├── 04 · Alkalimetalle
├── 05 · Erdalkalimetalle
├── 06 · Halbmetalle
├── 07 · Post-Übergangsmetalle
├── 08 · Übergangsmetalle
├── 09 · Lanthanoide
└── 10 · Actinoide
```

Die Klassen sind eine didaktische, versionierte Zuordnung. Grenzfälle werden
nicht als unumstritten dargestellt. Ihre abweichenden Klassifikationen gehören
in `(i) Einordnung`.

## Verbindliche Klassifikation

### 01 · Reaktive Nichtmetalle

`H, C, N, O, P, S, Se`

- Wasserstoff erhält eine eigene Klassen-Einführung innerhalb dieses Decks,
  weil seine Position über Gruppe 1 nicht den Eigenschaften eines Alkalimetalls
  entspricht.
- Kohlenstoff, Stickstoff, Sauerstoff, Phosphor und Schwefel bilden den
  Schwerpunkt für Alltag, Biologie und `Chemistry I`.

### 02 · Halogene

`F, Cl, Br, I, At, Ts`

- Astat und Tenness werden als Elemente der Gruppe 17 geführt.
- `(i) Einordnung` weist darauf hin, dass Eigenschaften sehr schwerer,
  kurzlebiger Elemente teilweise nur vorhergesagt oder indirekt bestimmt sind.

### 03 · Edelgase

`He, Ne, Ar, Kr, Xe, Rn, Og`

- Oganesson wird nach Gruppe 18 einsortiert.
- Die Rückseite behauptet nicht pauschal völlige Reaktionsträgheit.
- Abweichungen bei schweren Edelgasen stehen in `(i) Einordnung`.

### 04 · Alkalimetalle

`Li, Na, K, Rb, Cs, Fr`

- Wasserstoff gehört in dieser Sammlung nicht zu den Alkalimetallen.

### 05 · Erdalkalimetalle

`Be, Mg, Ca, Sr, Ba, Ra`

### 06 · Halbmetalle

`B, Si, Ge, As, Sb, Te`

- Der Begriff Halbmetall/Metalloid und seine nicht vollständig einheitliche
  Abgrenzung werden auf einer Einführungskarte erklärt.
- Polonium wird hier nicht einsortiert, sondern als Post-Übergangsmetall mit
  einem Grenzfallhinweis geführt.

### 07 · Post-Übergangsmetalle

`Al, Ga, In, Sn, Tl, Pb, Bi, Po, Nh, Fl, Mc, Lv`

- Für Po sowie die superschweren Elemente müssen abweichende Klassifikationen
  und die begrenzte experimentelle Datenlage in `(i) Einordnung` erscheinen.

### 08 · Übergangsmetalle

`Sc, Ti, V, Cr, Mn, Fe, Co, Ni, Cu, Zn, Y, Zr, Nb, Mo, Tc, Ru, Rh, Pd, Ag, Cd,
Hf, Ta, W, Re, Os, Ir, Pt, Au, Hg, Rf, Db, Sg, Bh, Hs, Mt, Ds, Rg, Cn`

- Scandium und Yttrium werden im Hauptdeck als Übergangsmetalle geführt.
- Zink, Cadmium, Quecksilber und Copernicium bleiben aus didaktischen Gründen
  in der d-Block-/Übergangsmetall-Sammlung; die strengere IUPAC-Definition und
  mögliche Abgrenzung wird in `(i) Einordnung` erläutert.

### 09 · Lanthanoide

`La, Ce, Pr, Nd, Pm, Sm, Eu, Gd, Tb, Dy, Ho, Er, Tm, Yb, Lu`

- Gruppierungs- und Gruppe-3-Konventionen werden in `(i) Einordnung` erklärt.

### 10 · Actinoide

`Ac, Th, Pa, U, Np, Pu, Am, Cm, Bk, Cf, Es, Fm, Md, No, Lr`

- Radioaktivität wird sachlich erklärt, ohne Beschaffung, Aufbereitung oder
  praktische Versuchsanleitungen.

## 00 · Erläuterungskarten am Anfang

Diese Karten führen das System ein, bevor einzelne Elemente gelernt werden.
Sie sind knapp, visuell ruhig und enthalten Details über `(i)`.

1. **Was ordnet das Periodensystem?**
   - sichtbar: steigende Ordnungszahl als Grundordnung
   - `(i) Historie`: Mendelejew und Übergang von Atommasse zu Ordnungszahl
2. **Eine Elementkachel lesen**
   - sichtbar: Ordnungszahl, Symbol, Name und relative Atommasse
   - Beispiel: `$\ce{^{23}_{11}Na}$`
   - `(i) Begriffe`: Nuklidmasse und Standard-Atomgewicht unterscheiden
3. **Perioden**
   - sichtbar: horizontale Zeilen und Zusammenhang mit besetzten Schalen
   - `(i) Modellgrenze`: Schalenmodell ist eine didaktische Näherung
4. **Gruppen**
   - sichtbar: vertikale Spalten und ähnliche Valenzeigenschaften
   - `(i) Weiterdenken`: Ausnahmen und d-/f-Block
5. **Metalle, Halbmetalle und Nichtmetalle**
   - sichtbar: grobe Lage und typische Eigenschaften
   - `(i) Einordnung`: Grenzen sind nicht überall einheitlich
6. **Valenzelektronen und typische Ionen**
   - sichtbar: Hauptgruppentrend an `$\ce{Na+}$`, `$\ce{Mg^2+}$`, `$\ce{Cl-}$`
   - `(i) Teilchenebene`: Elektronenkonfiguration statt Oktettregel als Dogma
7. **Atomradius als Trend**
   - sichtbar: Zunahme nach unten, meist Abnahme nach rechts
   - `(i) Herleitung`: Kernladung, Abschirmung und Definition des Radius
8. **Ionisierungsenergie**
   - sichtbar: grober Periodentrend
   - `(i) Typischer Denkfehler`: Trend ist keine ausnahmslose Rangliste
9. **Elektronegativität**
   - sichtbar: Bedeutung und grober Trend
   - `(i) Einordnung`: Skalenabhängigkeit und fehlende/unsichere Werte
10. **Aggregatzustände bei Referenzbedingungen**
    - sichtbar: fest, flüssig und gasförmig nicht aus der Klasse allein ableiten
    - `(i) Begriffe`: Referenzbedingungen müssen genannt werden
11. **Natürliche und synthetische Elemente**
    - sichtbar: „synthetisch“ nicht mit „unwirklich“ verwechseln
    - `(i) Einordnung`: Spurenvorkommen und Definitionsgrenzen
12. **So lernst du dieses Deck**
    - sichtbar: Symbol, Name und Klasse zuerst; Details gezielt über `(i)`
    - `(i) Lernstrategie`: Klassenmuster nutzen, Ausnahmen separat wiederholen

## Kartenstruktur pro Element

Jedes Element erhält stabile, aus der Ordnungszahl abgeleitete Karten-Keys.

### Karte A: Symbol → Name

Vorderseite:

```markdown
## `Na`

Wie heißt dieses Element?
```

Rückseite:

```markdown
**Natrium** · Ordnungszahl **11** · Alkalimetall
```

### Karte B: Name → Symbol

Vorderseite:

```markdown
Welches Elementsymbol gehört zu **Natrium**?
```

Rückseite:

```markdown
**Na** · Ordnungszahl **11**
```

Die beiden Richtungen dürfen nicht auf derselben Note gegenseitig ausgeblendet
werden, wenn dadurch eine unnötige oder fachlich sinnlose Karte entsteht. Ihre
Kartenidentitäten bleiben über Updates stabil.

### Verpflichtende `(i)`-Bereiche

Nicht jedes Element braucht gleich lange Texte, aber das Schema bleibt
einheitlich:

1. `Position im Periodensystem`
   - Periode, Gruppe, Block und festgelegte Klasse
2. `Elektronenstruktur`
   - gekürzte Elektronenkonfiguration in KaTeX
   - Beispiel: `$\mathrm{[Ne]\,3s^1}$`
3. `Eigenschaften`
   - Aggregatzustand bei explizit genannten Bedingungen
   - ausgewählte, lernrelevante Eigenschaften mit Einheit
4. `Vorkommen und Bedeutung`
   - natürliche Vorkommen, biologische oder technische Relevanz
5. `Typische Verbindungen und Ionen`
   - sichere mhchem-Beispiele, etwa `$\ce{Na+}$`, `$\ce{NaCl}$`
6. `Name und Entdeckung`
   - Namensherkunft und historischer Kontext, sofern belastbar
7. `Isotope und Besonderheiten`
   - nur fachlich relevante Auswahl, keine unstrukturierte Isotopenliste
8. `Sicherheit`
   - sachliche Gefahreneinordnung ohne praktische riskante Anweisung
9. `Einordnung`
   - Klassifikations- oder Messunsicherheiten, insbesondere bei Grenzfällen und
     superschweren Elementen

### Beispiel für mhchem/KaTeX im `(i)`-Inhalt

```markdown
### Elektronenstruktur

$$
\mathrm{Na: [Ne]\,3s^1}
$$

### Typisches Ion

$$
\ce{Na -> Na+ + e-}
$$

Natrium erreicht durch Abgabe seines Valenzelektrons eine energetisch günstige
Elektronenkonfiguration. Das ist ein Modell für die Ionenbildung, keine isolierte
praktische Versuchsanleitung.
```

## Klassenkarten

Jedes Klassendeck beginnt vor den Elementkarten mit zwei bis vier Karten:

1. **Klasse erkennen** – typische Position und gemeinsames Muster
2. **Trend innerhalb der Klasse** – eine konkrete, nicht übergeneralisierte
   Vorhersage
3. **Ausnahme erklären** – mindestens ein Element, das ein einfaches Muster
   begrenzt
4. **Transfer** – unbekanntes Element anhand seiner Position einordnen

Beispiele:

- Warum wird Wasserstoff trotz seiner Position nicht als Alkalimetall gelernt?
- Welches Halogen ist bei üblichen Referenzbedingungen flüssig?
- Warum bedeutet „Edelgas“ nicht „unter allen Bedingungen vollständig inert“?
- Welche Eigenschaften von Silicium erklären seine technische Bedeutung?
- Warum sind viele Aussagen über Oganesson Vorhersagen statt Alltagsmesswerte?

Die ausführlichen Trendbegründungen gehören in `(i) Herleitung`; die Rückseite
nennt nur die konkrete Antwort und eine knappe Begründung.

## Zusätzliche Transferkarten

Nach den Klassen folgen keine weiteren Unterdecks, sondern verteilte
Wiederholungskarten innerhalb der passenden Klasse:

- Element aus Ordnungszahl bestimmen
- Klasse aus Symbol und Position bestimmen
- zwei Elemente nach Atomradius ordnen
- typische Ionenladung einer Hauptgruppe vorhersagen
- Elektronenkonfiguration einem Element zuordnen
- reale Ausnahme zu einer Trendregel erkennen
- stabile und ausschließlich radioaktive Elemente unterscheiden
- Messwert, Modellvorhersage und unbekannte Eigenschaft auseinanderhalten

## Visuelles Konzept

- Elementkarten verwenden eine einheitliche, kontrastreiche Kachelstruktur.
- Farbe unterstützt die Elementklasse, ist aber niemals das einzige Merkmal;
  Klassenname und zugängliches Textlabel bleiben sichtbar.
- Ordnungszahl, Symbol und Name dürfen auf iPhone-Größe nicht überlappen.
- Ein vollständiges Periodensystem kann als strukturierter, zoombarer
  Grafikblock ergänzt werden; jede Kachel benötigt zugänglichen Namen,
  Ordnungszahl und Klasse.
- Kein unbereinigtes SVG aus externen Quellen. Bevorzugt wird eine intern
  generierte, datengetriebene Darstellung.
- `(i)` darf lange Inhalte intern scrollen, ohne die Kartensteuerung zu
  verdecken.

## Technische Umsetzung

- stabile Template-ID: `science:periodic-system:v1`
- Ordnungszahl ist die kanonische interne Sortierung
- stabile Element-IDs, zum Beispiel `element:011:na`
- stabile Karten-IDs, zum Beispiel `element:011:symbol-to-name` und
  `element:011:name-to-symbol`
- Klassenzuordnung als explizites versioniertes Datenfeld, nicht aus Farben oder
  UI-Positionen ableiten
- lokalisierbare Namen und `(i)`-Labels; Symbol und Ordnungszahl bleiben
  sprachunabhängig
- atomare Daten aus einer geprüften, eingecheckten statischen Datenquelle
- Inhaltsupdate muss Kartenidentitäten und Lernfortschritt erhalten
- mhchem lokal verwenden; keine CDN- oder Laufzeitabhängigkeit

## Quellenstrategie

Vor der Inhaltserzeugung wird eine versionierte Quellenmatrix festgelegt:

- IUPAC: anerkannte Elementnamen, Symbole und Ordnungszahlen
- IUPAC/CIAAW: Standard-Atomgewichte und Intervalle, wo anwendbar
- belastbare Fachquellen für Elektronenkonfigurationen, Aggregatzustände und
  ausgewählte Eigenschaften
- für superschwere Elemente klar zwischen Messung, indirekter Evidenz und
  theoretischer Vorhersage unterscheiden
- Quellenstand und Lizenz jeder Datenquelle dokumentieren

Standard-Atomgewichte dürfen nicht als zeitlose, überall exakt gültige
Einzelwerte behandelt werden. Wo ein Intervall oder kein Standard-Atomgewicht
vorliegt, zeigt die Kachel eine fachlich korrekte, erklärte Darstellung.

## Verifikation und Abnahme

1. Alle 118 Ordnungszahlen, Symbole und deutschen Namen sind vollständig und
   eindeutig.
2. Jedes Element gehört genau einer Hauptklasse dieser Sammlung an; Grenzfälle
   besitzen einen sichtbaren `(i) Einordnung`-Hinweis.
3. Die Zuordnung zählt exakt 118 Elemente und enthält keine Duplikate.
4. Symbol→Name- und Name→Symbol-Karten funktionieren für alle Elemente.
5. mhchem rendert Isotope, Ionen und Reaktionsbeispiele in Web und iOS-WebView.
6. Lange Namen wie Rutherfordium und Darmstadtium funktionieren auf
   iPhone-Viewport, bei vergrößerter Schrift und im `(i)`-Dialog ohne
   Überlappung.
7. Klassen sind in Hell- und Dunkelmodus anhand Text und Kontrast erkennbar,
   nicht nur anhand Farbe.
8. Screenreader erhalten Symbol nicht als unverständliches Wort, sondern
   zusätzlich den ausgeschriebenen Elementnamen und die Ordnungszahl.
9. Superschwere Elemente enthalten keine ungesicherten Eigenschaften als
   bestätigte Tatsachen.
10. Installation, Offline-Nutzung, App-Neustart und Inhaltsupdate bewahren
    Kartenidentitäten und Lernfortschritt.

## Abgrenzung

- keine vollständige Nuklidkarte
- keine Sammlung sämtlicher physikalischer Messwerte
- keine Labor- oder Syntheseanleitungen für reaktive, toxische oder radioaktive
  Elemente
- keine Behauptung, dass jede Klassifikationsgrenze naturwissenschaftlich
  unumstritten ist
- keine Abhängigkeit von externen Webinhalten während Lernen oder Installation

