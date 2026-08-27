import type { CardContent } from "@flashcards/domain/content";

export const statisticsIntroductionTemplateKey =
  "statistics:introduction:de:v1";

const markdown = (source: string): CardContent => ({
  blocks: [{ type: "markdown", revealMode: "ALL", source }],
});

type StatisticsIntroductionCard = {
  key: string;
  front: CardContent;
  back: CardContent;
  kind: "QUESTION";
  usage: "LEARNING";
};

const card = (
  key: string,
  title: string,
  question: string,
  answer: string,
): StatisticsIntroductionCard => ({
  key,
  front: markdown(`## ${title}\n\n${question}`),
  back: markdown(`## Antwort\n\n${answer}`),
  kind: "QUESTION",
  usage: "LEARNING",
});

const cards: StatisticsIntroductionCard[] = [
  card(
    "population-sample",
    "01 · Grundgesamtheit und Stichprobe",
    "Eine Hochschule möchte die durchschnittliche tägliche Lernzeit ihrer 50.000 Studierenden bestimmen und befragt zufällig 2.000 davon. Was sind **Grundgesamtheit**, **Stichprobe**, **Parameter** und **Schätzwert**?",
    `- **Grundgesamtheit:** alle 50.000 Studierenden.
- **Stichprobe:** die 2.000 tatsächlich Befragten.
- **Parameter:** die unbekannte mittlere Lernzeit aller 50.000 Studierenden.
- **Schätzwert:** der aus der Stichprobe berechnete Mittelwert.

Eine große Stichprobe hilft nur dann, wenn sie die Grundgesamtheit möglichst unverzerrt repräsentiert. Eine große, aber einseitig ausgewählte Stichprobe kann schlechter sein als eine kleinere Zufallsstichprobe.

\`\`\`mermaid{w=fill h=36vh}
flowchart LR
  P[Grundgesamtheit: 50000] -->|Zufällige Auswahl| S[Stichprobe: 2000]
  S --> E[Schätzwert: Stichprobenmittel]
  E -. schätzt .-> M[Parameter: Mittelwert aller]
\`\`\``,
  ),
  card(
    "variables-scales",
    "02 · Variablentypen und Skalenniveaus",
    "Ordne diese Merkmale ein: Studienfach, Zufriedenheit von 1 bis 5, Temperatur in °C und Lernzeit in Minuten.",
    `| Merkmal | Typ | Skalenniveau | Sinnvolle Operationen |
| --- | --- | --- | --- |
| Studienfach | kategorial | nominal | zählen, Anteile vergleichen |
| Zufriedenheit 1–5 | kategorial geordnet | ordinal | Rang, Median, Quantile |
| Temperatur in °C | metrisch | Intervallskala | Differenzen, Mittelwert |
| Lernzeit in Minuten | metrisch | Verhältnisskala | auch Verhältnisse wie „doppelt so lang“ |

Das Skalenniveau entscheidet, welche Kennzahlen und Tests sinnvoll sind. Beispielsweise hat 20 °C nicht „doppelt so viel Temperatur“ wie 10 °C, weil der Nullpunkt willkürlich ist.`,
  ),
  card(
    "frequencies-histogram",
    "03 · Häufigkeiten und Histogramm",
    "Die Lernzeiten von zehn Personen sind 1, 1, 2, 2, 2, 3, 3, 4, 4 und 5 Stunden. Was zeigen absolute und relative Häufigkeiten – und was darf man aus einem Histogramm ablesen?",
    `Die **absolute Häufigkeit** zählt Beobachtungen; die **relative Häufigkeit** teilt diese Zahl durch den Stichprobenumfang. Für 2 Stunden gilt also: $3$ Beobachtungen und $3/10=30\\,\\%$.

Ein Histogramm zeigt Lage, Streuung, Schiefe, Häufungen und mögliche Lücken. Seine Form hängt jedoch von der gewählten Klasseneinteilung ab.

\`\`\`jsxgraph{w=fill h=38vh}
title "Häufigkeitsverteilung der Lernzeit"
describe "Fünf Balken zeigen die absoluten Häufigkeiten 2, 3, 2, 2 und 1 für eine bis fünf Lernstunden."
board x=0..6 y=0..4 axes grid
A1 = point(0.6, 0, visible=false)
B1 = point(1.4, 0, visible=false)
C1 = point(1.4, 2, visible=false)
D1 = point(0.6, 2, visible=false)
polygon(A1, B1, C1, D1, fill=blue, fillOpacity=0.45)
A2 = point(1.6, 0, visible=false)
B2 = point(2.4, 0, visible=false)
C2 = point(2.4, 3, visible=false)
D2 = point(1.6, 3, visible=false)
polygon(A2, B2, C2, D2, fill=yellow, fillOpacity=0.5)
A3 = point(2.6, 0, visible=false)
B3 = point(3.4, 0, visible=false)
C3 = point(3.4, 2, visible=false)
D3 = point(2.6, 2, visible=false)
polygon(A3, B3, C3, D3, fill=blue, fillOpacity=0.45)
A4 = point(3.6, 0, visible=false)
B4 = point(4.4, 0, visible=false)
C4 = point(4.4, 2, visible=false)
D4 = point(3.6, 2, visible=false)
polygon(A4, B4, C4, D4, fill=blue, fillOpacity=0.45)
A5 = point(4.6, 0, visible=false)
B5 = point(5.4, 0, visible=false)
C5 = point(5.4, 1, visible=false)
D5 = point(4.6, 1, visible=false)
polygon(A5, B5, C5, D5, fill=blue, fillOpacity=0.45)
\`\`\``,
  ),
  card(
    "center",
    "04 · Mittelwert, Median und Modus",
    "Berechne Mittelwert, Median und Modus für die Werte 2, 3, 3, 4 und 18. Welche Kennzahl beschreibt die typische Lage hier am besten?",
    `- Mittelwert: $\\bar{x}=(2+3+3+4+18)/5=6$
- Median: der mittlere sortierte Wert ist $3$
- Modus: der häufigste Wert ist ebenfalls $3$

Der einzelne Wert 18 zieht den Mittelwert stark nach oben. Für diese schiefe Verteilung beschreibt der **Median** die typische Lage robuster. Der Mittelwert ist dennoch wichtig, weil er sämtliche Werte berücksichtigt und in vielen statistischen Modellen vorkommt.

\`\`\`jsxgraph{w=fill h=30vh}
title "Ausreißer und Lagekennzahlen"
describe "Vier Werte liegen zwischen zwei und vier, ein Ausreißer liegt bei achtzehn; Median drei und Mittelwert sechs sind markiert."
board x=0..20 y=-1..2 axes grid
P1 = point(2, 0, name="2", color=blue)
P2 = point(3, 0.2, name="3", color=blue)
P3 = point(3, -0.2, name="3", color=blue)
P4 = point(4, 0, name="4", color=blue)
P5 = point(18, 0, name="18", color=red)
M = point(3, 1, name="Median", color=yellow, size=5)
A = point(6, 1, name="Mittelwert", color=purple, size=5)
\`\`\``,
  ),
  card(
    "spread",
    "05 · Varianz und Standardabweichung",
    "Die Datensätze A = {4, 5, 6} und B = {1, 5, 9} haben beide den Mittelwert 5. Worin unterscheiden sie sich?",
    `Datensatz B streut wesentlich stärker um den gemeinsamen Mittelwert.

Die Stichprobenvarianz lautet

$$s^2=\\frac{1}{n-1}\\sum_{i=1}^{n}(x_i-\\bar{x})^2$$

und die Standardabweichung $s=\\sqrt{s^2}$. Für A ist $s=1$, für B ist $s=4$. Die Standardabweichung besitzt dieselbe Einheit wie die Messwerte und ist deshalb meist leichter zu interpretieren als die Varianz.

\`\`\`jsxgraph{w=fill h=30vh}
title "Gleicher Mittelwert, unterschiedliche Streuung"
describe "Datensatz A liegt dicht um fünf, Datensatz B reicht von eins bis neun; beide Mittelwerte liegen bei fünf."
board x=0..10 y=-1..3 axes grid
A1 = point(4, 2, name="A", color=blue)
A2 = point(5, 2, name="", color=blue)
A3 = point(6, 2, name="", color=blue)
B1 = point(1, 0.5, name="B", color=yellow)
B2 = point(5, 0.5, name="", color=yellow)
B3 = point(9, 0.5, name="", color=yellow)
M = point(5, 1.25, name="Mittelwert", color=red, size=5)
\`\`\``,
  ),
  card(
    "quartiles-boxplot",
    "06 · Quartile und Boxplot",
    "Ein Boxplot zeigt Minimum 1, erstes Quartil 3, Median 5, drittes Quartil 8 und Maximum 10. Welche 50 % der Daten liegen in der Box und wie groß ist der Interquartilsabstand?",
    `Die Box reicht von $Q_1=3$ bis $Q_3=8$ und enthält die mittleren 50 % der Daten. Der Interquartilsabstand beträgt

$$IQR=Q_3-Q_1=8-3=5.$$

Die Linie in der Box markiert den Median 5. Die „Antennen“ reichen hier bis Minimum und Maximum; in vielen Programmen enden sie stattdessen beim letzten Wert innerhalb von $1{,}5\\cdot IQR$.

\`\`\`jsxgraph{w=fill h=28vh}
title "Anatomie eines Boxplots"
describe "Ein horizontaler Boxplot reicht von eins bis zehn. Die Box liegt zwischen drei und acht, der Median bei fünf."
board x=0..11 y=-2..2 axes grid
L = point(1, 0, visible=false)
Q1 = point(3, -0.8, visible=false)
Q2 = point(3, 0.8, visible=false)
Q3 = point(8, 0.8, visible=false)
Q4 = point(8, -0.8, visible=false)
R = point(10, 0, visible=false)
segment(L, Q1, color=blue, width=3)
polygon(Q1, Q2, Q3, Q4, fill=yellow, fillOpacity=0.35)
segment(Q4, R, color=blue, width=3)
M1 = point(5, -0.8, visible=false)
M2 = point(5, 0.8, visible=false)
segment(M1, M2, color=red, width=4)
point(1, 0, name="Min")
point(3, 1.1, name="Q1")
point(5, 1.1, name="Median")
point(8, 1.1, name="Q3")
point(10, 0, name="Max")
\`\`\``,
  ),
  card(
    "outliers-robustness",
    "07 · Ausreißer und robuste Kennzahlen",
    "Nach der $1{,}5\\cdot IQR$-Regel gelten welche Werte als mögliche Ausreißer, wenn $Q_1=10$ und $Q_3=18$? Soll man solche Werte automatisch löschen?",
    `Es gilt $IQR=8$. Die Grenzen sind

$$10-1{,}5\\cdot8=-2 \\qquad\\text{und}\\qquad 18+1{,}5\\cdot8=30.$$

Werte kleiner als −2 oder größer als 30 werden als **mögliche** Ausreißer markiert. Sie dürfen nicht automatisch gelöscht werden:

- Ein Ausreißer kann ein Mess- oder Eingabefehler sein.
- Er kann aber auch eine echte, fachlich wichtige Beobachtung darstellen.
- Entscheidung und Begründung müssen dokumentiert werden.

Median und IQR sind robuster gegenüber Ausreißern als Mittelwert und Standardabweichung.`,
  ),
  card(
    "probability-basics",
    "08 · Ereignisse und Wahrscheinlichkeit",
    "Ein fairer Würfel wird einmal geworfen. Wie groß sind die Wahrscheinlichkeiten für A = „gerade Zahl“ und B = „Zahl größer als 4“? Wie groß ist $P(A\\cup B)$?",
    `Der Ergebnisraum ist $\\Omega=\\{1,2,3,4,5,6\\}$.

- $A=\\{2,4,6\\}$, also $P(A)=3/6=1/2$
- $B=\\{5,6\\}$, also $P(B)=2/6=1/3$
- $A\\cap B=\\{6\\}$, also $P(A\\cap B)=1/6$

Mit der Additionsregel:

$$P(A\\cup B)=P(A)+P(B)-P(A\\cap B)=\\frac{2}{3}.$$

\`\`\`mermaid{w=fill h=34vh}
flowchart LR
  O[Alle Ergebnisse 1 bis 6] --> A[A: 2, 4, 6]
  O --> B[B: 5, 6]
  A --> I[Schnittmenge: 6]
  B --> I
\`\`\``,
  ),
  card(
    "conditional-bayes",
    "09 · Bedingte Wahrscheinlichkeit und Bayes",
    "Eine Krankheit betrifft 1 % der Bevölkerung. Ein Test erkennt 90 % der Erkrankten korrekt und ist bei 95 % der Gesunden negativ. Wie wahrscheinlich ist die Krankheit nach einem positiven Ergebnis?",
    `Von 10.000 Personen sind ungefähr 100 erkrankt:

- 90 Erkrankte testen positiv.
- Von 9.900 Gesunden testen 5 %, also 495, falsch positiv.
- Insgesamt gibt es 585 positive Tests.

Damit gilt

$$P(\\text{krank}\\mid +)=\\frac{90}{90+495}\\approx15{,}4\\,\\%.$$

Trotz eines guten Tests ist ein positives Ergebnis bei einer seltenen Krankheit nicht automatisch ein fast sicherer Nachweis. Die **Basisrate** ist entscheidend.

\`\`\`mermaid{w=fill h=38vh}
flowchart LR
  P[10000 Personen] --> K[100 krank]
  P --> G[9900 gesund]
  K --> KP[90 positiv]
  K --> KN[10 negativ]
  G --> GP[495 positiv]
  G --> GN[9405 negativ]
  KP --> R[90 von 585 positiven Tests]
  GP --> R
\`\`\``,
  ),
  card(
    "random-variable-expectation",
    "10 · Zufallsvariable und Erwartungswert",
    "Ein Spiel zahlt bei einer Sechs 10 € aus, sonst 0 €. Die Teilnahme kostet 2 €. Wie hoch sind Erwartungswert und erwarteter Nettogewinn?",
    `Die Zufallsvariable $X$ beschreibt die Auszahlung:

$$E(X)=10\\cdot\\frac16+0\\cdot\\frac56=\\frac{10}{6}\\approx1{,}67\\text{ €}.$$

Nach Abzug des Einsatzes beträgt der erwartete Nettogewinn

$$1{,}67-2=-0{,}33\\text{ € pro Spiel}.$$

Der Erwartungswert ist ein langfristiger Durchschnitt über sehr viele Wiederholungen. Er behauptet nicht, dass bei einem einzelnen Spiel 1,67 € ausgezahlt werden.`,
  ),
  card(
    "binomial-distribution",
    "11 · Binomialverteilung",
    "Eine faire Münze wird fünfmal geworfen. Wie groß ist die Wahrscheinlichkeit für genau drei Köpfe? Welche Voraussetzungen hat ein Binomialmodell?",
    `Für $X\\sim B(n=5,p=0{,}5)$ gilt

$$P(X=3)=\\binom{5}{3}(0{,}5)^3(0{,}5)^2=\\frac{10}{32}=31{,}25\\,\\%.$$

Voraussetzungen: feste Anzahl von Versuchen, je zwei mögliche Ausgänge, konstante Erfolgswahrscheinlichkeit und unabhängige Versuche.

\`\`\`jsxgraph{w=fill h=34vh}
title "Binomialverteilung für fünf faire Münzwürfe"
describe "Die Wahrscheinlichkeiten für null bis fünf Köpfe sind symmetrisch und bei zwei sowie drei Köpfen am größten."
board x=-1..6 y=0..0.4 axes grid
P0 = point(0, 0.03125, name="0", color=blue)
P1 = point(1, 0.15625, name="1", color=blue)
P2 = point(2, 0.3125, name="2", color=blue)
P3 = point(3, 0.3125, name="3", color=yellow, size=6)
P4 = point(4, 0.15625, name="4", color=blue)
P5 = point(5, 0.03125, name="5", color=blue)
Z0 = point(0, 0, visible=false)
Z1 = point(1, 0, visible=false)
Z2 = point(2, 0, visible=false)
Z3 = point(3, 0, visible=false)
Z4 = point(4, 0, visible=false)
Z5 = point(5, 0, visible=false)
segment(Z0, P0, color=blue, width=5)
segment(Z1, P1, color=blue, width=5)
segment(Z2, P2, color=blue, width=5)
segment(Z3, P3, color=yellow, width=5)
segment(Z4, P4, color=blue, width=5)
segment(Z5, P5, color=blue, width=5)
\`\`\``,
  ),
  card(
    "normal-distribution",
    "12 · Normalverteilung",
    "Welche Rollen spielen Mittelwert $\\mu$ und Standardabweichung $\\sigma$ bei einer Normalverteilung? Verändere die Regler in der Grafik.",
    `Der Mittelwert $\\mu$ verschiebt das Zentrum. Die Standardabweichung $\\sigma$ steuert die Breite: kleines $\\sigma$ bedeutet eine schmale, hohe Dichte; großes $\\sigma$ eine breite, flache Dichte.

Bei jeder Normalverteilung liegen ungefähr 68 % innerhalb von $\\mu\\pm\\sigma$, 95 % innerhalb von $\\mu\\pm2\\sigma$ und 99,7 % innerhalb von $\\mu\\pm3\\sigma$.

\`\`\`jsxgraph{w=fill h=42vh}
title "Interaktive Normalverteilung"
describe "Regler verändern Mittelwert, Standardabweichung und die gelb markierte Fläche zwischen zwei Grenzen."
board x=-7..7 y=-0.2..1.2 axes grid
m = slider(-2, 2, value=0, step=0.1)
s = slider(0.4, 2.2, value=1, step=0.05)
L = slider(-5, 0, value=-1, step=0.1)
R = slider(0, 5, value=1, step=0.1)
f(x) = exp(-((x-m)^2)/(2*s^2))/(s*sqrt(2*pi))
plot(f, from=-7, to=7, name="Dichte", color=blue, width=4)
integralArea(f, from=L, to=R, color=yellow, fillOpacity=0.3)
\`\`\``,
  ),
  card(
    "z-score",
    "13 · Standardisierung und z-Wert",
    "Ein Testwert beträgt 85 Punkte. Die Vergleichsgruppe hat $\\mu=70$ und $\\sigma=10$. Welchen z-Wert hat das Ergebnis und wie ist er zu interpretieren?",
    `$$z=\\frac{x-\\mu}{\\sigma}=\\frac{85-70}{10}=1{,}5.$$

Der Wert liegt 1,5 Standardabweichungen über dem Mittelwert. Durch Standardisierung lassen sich Werte aus unterschiedlich skalierten Verteilungen vergleichen.

Ein z-Wert ist noch keine Bewertung von „gut“ oder „schlecht“. Die fachliche Bedeutung hängt vom Merkmal und von der passenden Vergleichsgruppe ab.

\`\`\`jsxgraph{w=fill h=32vh}
title "Position eines z-Werts"
describe "Eine Standardnormalverteilung ist zentriert bei null; ein gelber Punkt markiert z gleich eins Komma fünf."
board x=-4..4 y=-0.1..0.6 axes grid
f(x) = exp(-(x^2)/2)/sqrt(2*pi)
plot(f, from=-4, to=4, name="", color=blue, width=4)
Z = point(1.5, f(1.5), name="z=1.5", color=yellow, size=6)
\`\`\``,
  ),
  card(
    "central-limit-theorem",
    "14 · Zentraler Grenzwertsatz",
    "Warum kann der Mittelwert vieler unabhängiger Beobachtungen annähernd normalverteilt sein, obwohl die Einzelwerte selbst nicht normalverteilt sind?",
    `Der zentrale Grenzwertsatz besagt vereinfacht: Für unabhängige, identisch verteilte Beobachtungen mit endlicher Varianz nähert sich die Verteilung des standardisierten Stichprobenmittels mit wachsendem $n$ einer Normalverteilung.

Dabei gilt

$$E(\\bar X)=\\mu,\\qquad SD(\\bar X)=\\frac{\\sigma}{\\sqrt n}.$$

Die konkrete Stichprobengröße, ab der die Näherung gut ist, hängt unter anderem von Schiefe und Ausreißern der Ausgangsverteilung ab.

\`\`\`mermaid{w=fill h=34vh}
flowchart LR
  D[Beliebige geeignete Ausgangsverteilung] --> S1[Viele Stichproben gleicher Größe]
  S1 --> M[Für jede Stichprobe den Mittelwert bilden]
  M --> N[Verteilung der Mittelwerte nähert sich einer Glockenkurve]
  N --> E[Streuung: Sigma durch Wurzel n]
\`\`\``,
  ),
  card(
    "standard-error",
    "15 · Standardfehler",
    "Eine Grundgesamtheit hat ungefähr $\\sigma=12$. Wie verändert sich der Standardfehler des Mittelwerts, wenn die Stichprobe von $n=36$ auf $n=144$ wächst?",
    `$$SE(\\bar X)=\\frac{\\sigma}{\\sqrt n}.$$

- Bei $n=36$: $SE=12/6=2$
- Bei $n=144$: $SE=12/12=1$

Eine Vervierfachung der Stichprobe halbiert hier den Standardfehler. Der Standardfehler beschreibt die erwartete Streuung des **Schätzers** über wiederholte Stichproben – nicht die Streuung der einzelnen Beobachtungen.`,
  ),
  card(
    "confidence-interval",
    "16 · Konfidenzintervall",
    "Eine Stichprobe liefert $\\bar x=100$ und $SE=2$. Wie lautet ein approximatives 95-%-Konfidenzintervall und was bedeutet es korrekt?",
    `Mit der Normalapproximation:

$$100\\pm1{,}96\\cdot2=[96{,}08;103{,}92].$$

Die korrekte häufigkeitsstatistische Interpretation lautet: Würde man das Verfahren sehr oft mit neuen Stichproben wiederholen, enthielten ungefähr 95 % der so konstruierten Intervalle den festen wahren Parameter.

Nicht korrekt ist: „Der Parameter liegt mit 95 % Wahrscheinlichkeit in genau diesem bereits berechneten Intervall.“

\`\`\`jsxgraph{w=fill h=31vh}
title "Konfidenzintervalle aus wiederholten Stichproben"
describe "Vier Intervalle schneiden die wahre vertikale Linie bei hundert, ein rotes Intervall verfehlt sie."
board x=92..108 y=0..6 axes grid
T1 = point(100, 0, visible=false)
T2 = point(100, 6, visible=false)
segment(T1, T2, color=yellow, width=3, dash=true)
A1 = point(96, 5, visible=false)
B1 = point(103, 5, visible=false)
segment(A1, B1, color=blue, width=4)
A2 = point(98, 4, visible=false)
B2 = point(105, 4, visible=false)
segment(A2, B2, color=blue, width=4)
A3 = point(95, 3, visible=false)
B3 = point(101, 3, visible=false)
segment(A3, B3, color=blue, width=4)
A4 = point(99, 2, visible=false)
B4 = point(106, 2, visible=false)
segment(A4, B4, color=blue, width=4)
A5 = point(102, 1, visible=false)
B5 = point(107, 1, visible=false)
segment(A5, B5, color=red, width=4)
\`\`\``,
  ),
  card(
    "hypothesis-p-value",
    "17 · Hypothesentest und p-Wert",
    "Was bedeutet ein p-Wert von 0,03 bei einem vorab gewählten Signifikanzniveau von $\\alpha=0{,}05$?",
    `Der p-Wert ist die Wahrscheinlichkeit, **unter Annahme der Nullhypothese** ein mindestens so extremes Ergebnis wie das beobachtete zu erhalten.

Da $0{,}03<0{,}05$, wird $H_0$ nach der vorab festgelegten Regel verworfen. Der p-Wert ist aber weder

- die Wahrscheinlichkeit, dass $H_0$ wahr ist,
- noch die Größe oder praktische Bedeutung des Effekts.

Berichte deshalb zusätzlich Effektgröße, Konfidenzintervall, Stichprobendesign und Annahmen.

\`\`\`mermaid{w=fill h=38vh}
flowchart TD
  Q[Fragestellung und Hypothesen vorab festlegen] --> D[Daten nach geplantem Design erheben]
  D --> A[Annahmen und Datenqualität prüfen]
  A --> P[p-Wert und Effektgröße berechnen]
  P --> C{p kleiner als Alpha?}
  C -->|Ja| R[H0 verwerfen]
  C -->|Nein| N[H0 nicht verwerfen]
  R --> B[Unsicherheit und praktische Bedeutung berichten]
  N --> B
\`\`\``,
  ),
  card(
    "errors-power-tests",
    "18 · Fehlerarten, Teststärke und Testwahl",
    "Unterscheide Fehler 1. Art, Fehler 2. Art und Teststärke. Welcher einfache Test passt typischerweise zu Mittelwerten, Anteilen beziehungsweise mehr als zwei Mittelwertgruppen?",
    `- **Fehler 1. Art ($\\alpha$):** $H_0$ wird verworfen, obwohl sie wahr ist.
- **Fehler 2. Art ($\\beta$):** $H_0$ wird nicht verworfen, obwohl eine relevante Abweichung besteht.
- **Teststärke ($1-\\beta$):** Wahrscheinlichkeit, einen vorhandenen Effekt zu entdecken.

| Fragestellung | Typisches Verfahren | Wichtige Prüfung |
| --- | --- | --- |
| Mittelwert einer oder zweier Gruppen | t-Test | Unabhängigkeit, Verteilung/Robustheit |
| Zusammenhang kategorialer Merkmale | Chi-Quadrat-Test | erwartete Zellhäufigkeiten |
| mehr als zwei Mittelwertgruppen | ANOVA | Varianzen, Residuen, Unabhängigkeit |

Die Testwahl folgt der Forschungsfrage, dem Design und dem Datentyp – nicht dem gewünschten Ergebnis. Größere Stichproben erhöhen meist die Teststärke, können aber Verzerrungen im Design nicht reparieren.`,
  ),
  card(
    "correlation-causality",
    "19 · Korrelation ist nicht Kausalität",
    "Ein Datensatz zeigt eine starke positive Korrelation zwischen Eisverkauf und Sonnenbränden. Warum beweist das nicht, dass Eis Sonnenbrand verursacht?",
    `Beide Größen werden durch eine **Drittvariable** beeinflusst: warme, sonnige Tage erhöhen sowohl den Eisverkauf als auch die Zeit in der Sonne.

Der Pearson-Korrelationskoeffizient $r$ misst einen linearen Zusammenhang zwischen −1 und 1. Er kann durch Ausreißer stark verändert werden und übersieht nichtlineare Beziehungen.

Kausale Aussagen benötigen ein geeignetes Design, zeitliche Reihenfolge und die Kontrolle plausibler Störfaktoren – idealerweise Randomisierung oder sorgfältige kausale Modellierung.

\`\`\`jsxgraph{w=fill h=34vh}
title "Positive Korrelation ohne Kausalitätsnachweis"
describe "Acht Punkte steigen im Mittel von links unten nach rechts oben; die Grafik zeigt Zusammenhang, aber keine Ursache."
board x=0..10 y=0..10 axes grid
P1 = point(1, 1.5, name="", color=blue)
P2 = point(2, 2.7, name="", color=blue)
P3 = point(3, 2.2, name="", color=blue)
P4 = point(4, 4.8, name="", color=blue)
P5 = point(5, 4.2, name="", color=blue)
P6 = point(6, 6.6, name="", color=blue)
P7 = point(7, 6.1, name="", color=blue)
P8 = point(8, 8.4, name="", color=blue)
A = point(1, 1.2, visible=false)
B = point(8, 8, visible=false)
segment(A, B, color=yellow, width=3, dash=true)
\`\`\``,
  ),
  card(
    "linear-regression",
    "20 · Lineare Regression und Residuen",
    "Was bedeuten Steigung und Residuen in $\\hat y=a x+b$? Verändere Steigung und Achsenabschnitt so, dass die Gerade möglichst gut zu den Punkten passt.",
    `Die Steigung $a$ ist die erwartete Änderung von $y$, wenn $x$ um eine Einheit steigt. Der Achsenabschnitt $b$ ist der geschätzte Wert bei $x=0$; er ist nur sinnvoll, wenn dieser Bereich fachlich relevant ist.

Ein Residuum ist $e_i=y_i-\\hat y_i$, also der vertikale Abstand zwischen beobachtetem und vorhergesagtem Wert. Die Methode der kleinsten Quadrate wählt die Gerade mit minimaler Summe $\\sum e_i^2$.

Ein gutes Modell benötigt außerdem Residuenanalyse, Unsicherheitsangaben und eine Prüfung auf Ausreißer, Nichtlinearität und unzulässige Extrapolation.

\`\`\`jsxgraph{w=fill h=42vh}
title "Regressionsgerade und Residuen"
describe "Regler verändern Steigung und Achsenabschnitt einer Geraden. Vertikale Segmente zeigen die Residuen zu fünf beobachteten Punkten."
board x=-1..7 y=-1..10 axes grid
a = slider(0, 2, value=1.1, step=0.05)
b = slider(-1, 3, value=1, step=0.1)
f(x) = a*x+b
plot(f, from=0, to=6, name="Modell", color=yellow, width=4)
P1 = point(1, 2.5, name="", color=blue)
P2 = point(2, 2.8, name="", color=blue)
P3 = point(3, 5.2, name="", color=blue)
P4 = point(4, 5.5, name="", color=blue)
P5 = point(5, 7.4, name="", color=blue)
F1 = point(1, f(1), visible=false)
F2 = point(2, f(2), visible=false)
F3 = point(3, f(3), visible=false)
F4 = point(4, f(4), visible=false)
F5 = point(5, f(5), visible=false)
segment(P1, F1, color=red, dash=true)
segment(P2, F2, color=red, dash=true)
segment(P3, F3, color=red, dash=true)
segment(P4, F4, color=red, dash=true)
segment(P5, F5, color=red, dash=true)
\`\`\``,
  ),
];

export type StatisticsIntroductionDeckSeed = {
  key: string;
  title: string;
  description: string;
  parentKey: null;
  locale: "de";
  contentLocales: readonly ["de"];
  studyOrder: "SEQUENTIAL";
  tags: string[];
  cards: StatisticsIntroductionCard[];
};

export const createStatisticsIntroductionDeckSeeds =
  (): StatisticsIntroductionDeckSeed[] => [
    {
      key: statisticsIntroductionTemplateKey,
      title: "Statistik · Einführung",
      description:
        "20 deutschsprachige Lernkarten von deskriptiver Statistik und Wahrscheinlichkeit bis Inferenz und Regression.",
      parentKey: null,
      locale: "de",
      contentLocales: ["de"],
      studyOrder: "SEQUENTIAL",
      tags: ["Statistik", "Mathematik", "Einführung"],
      cards,
    },
  ];

export const statisticsIntroductionCardCount = cards.length;
