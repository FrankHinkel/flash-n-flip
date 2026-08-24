import type { CardContent } from "@flashcards/domain/content";

export const fnfHelpLibraryTemplateKey = "fnf:help:v1";
export const fnfHelpJsxGraphTemplateKey = `${fnfHelpLibraryTemplateKey}:jsxgraph`;

type JsxGraphReferenceExample = {
  key: string;
  title: string;
  summary: string;
  source: string;
  concepts: string[];
};

export const fnfHelpJsxGraphExamples: JsxGraphReferenceExample[] = [
  {
    key: "points-lines-circles",
    title: "01 · Punkte, Strecken und Umkreis",
    summary:
      "Bewegliche Grundobjekte bilden ein Dreieck; abhängige Konstruktionen folgen automatisch.",
    concepts: ["point", "segment", "polygon", "circumcircle", "drag"],
    source: `title "Dynamisches Dreieck"
describe "Drei bewegliche Punkte bilden ein Dreieck mit Seiten, Fläche und Umkreis."
board x=-6..6 y=-5..5 axes grid aspect=1
A = point(-3, -1, drag=true, color=blue)
B = point(3, -1, drag=true, color=yellow)
C = point(0, 3, drag=true, color=red)
segment(A, B, color=blue)
segment(B, C, color=blue)
segment(C, A, color=blue)
polygon(A, B, C, fill=blue, fillOpacity=0.12)
K = circumcircle(A, B, C, name="", color=purple)`,
  },
  {
    key: "triangle-centers",
    title: "02 · Seitenhalbierende und Schwerpunkt",
    summary:
      "Mittelpunkte und Schnittpunkte erzeugen eine klassische abhängige Dreieckskonstruktion.",
    concepts: ["midpoint", "line", "intersection"],
    source: `title "Schwerpunkt eines Dreiecks"
describe "Die Seitenhalbierenden schneiden sich im Schwerpunkt S und folgen den beweglichen Eckpunkten."
board x=-6..6 y=-5..5 axes grid aspect=1
A = point(-4, -2, drag=true)
B = point(4, -2, drag=true)
C = point(1, 3, drag=true)
Mab = midpoint(A, B, name="M₁")
Mbc = midpoint(B, C, name="M₂")
g1 = line(C, Mab, name="")
g2 = line(A, Mbc, name="")
S = intersection(g1, g2, color=red, size=5)
polygon(A, B, C, fill=yellow, fillOpacity=0.1)`,
  },
  {
    key: "parallel-perpendicular-reflection",
    title: "03 · Parallele, Senkrechte und Spiegelung",
    summary:
      "Ein Punkt wird an einer beweglichen Geraden gespiegelt; Hilfsgeraden zeigen die Beziehungen.",
    concepts: ["parallel", "perpendicular", "reflection"],
    source: `title "Geraden und Spiegelung"
describe "C wird an der Geraden durch A und B gespiegelt; Parallele und Senkrechte bleiben gekoppelt."
board x=-6..6 y=-5..5 axes grid aspect=1
A = point(-4, -2, drag=true)
B = point(4, 1, drag=true)
C = point(-1, 3, drag=true, color=red)
g = line(A, B, name="g")
D = reflection(C, g, color=blue)
p = parallel(g, C, name="p")
n = perpendicular(g, C, name="n", dash=true)
segment(C, D, color=purple, dash=true)`,
  },
  {
    key: "conic-sections",
    title: "04 · Ellipse, Hyperbel und Parabel",
    summary:
      "Die wichtigsten Kegelschnitte entstehen aus wenigen beweglichen Bezugselementen.",
    concepts: ["ellipse", "hyperbola", "parabola"],
    source: `title "Kegelschnitte"
describe "Bewegliche Brenn- und Bezugspunkte verändern Ellipse, Hyperbel und Parabel."
board x=-8..8 y=-6..6 axes grid aspect=1
F1 = point(-3, 0, drag=true)
F2 = point(3, 0, drag=true)
P = point(0, 4, drag=true)
E = ellipse(F1, F2, P, name="", color=blue)
H = hyperbola(F1, F2, P, name="", color=purple)
d1 = point(-6, -4, visible=false)
d2 = point(6, -4, visible=false)
d = line(d1, d2, visible=false)
Q = point(0, 1, drag=true)
Pa = parabola(Q, d, name="", color=yellow)`,
  },
  {
    key: "sliders-derivative",
    title: "05 · Funktionsparameter und Ableitung",
    summary:
      "Drei Regler verändern Amplitude, Verschiebung und Frequenz; die Ableitung folgt sofort.",
    concepts: ["slider", "plot", "derivative"],
    source: `title "Sinusfunktion mit Parametern"
describe "Die Regler a, b und c verändern die Sinusfunktion; der gelbe Graph zeigt ihre Ableitung."
board x=-7..7 y=-5..5 axes grid
a = slider(0, 4, value=1, step=0.1)
b = slider(-3, 3, value=0, step=0.1)
c = slider(0.2, 4, value=1, step=0.1)
f(x) = a*sin(c*x)+b
F = plot(f, name="", color=blue, width=3)
G = plot(derivative(f), name="", color=yellow, width=2, dash=true)`,
  },
  {
    key: "tangent-normal",
    title: "06 · Tangente und Normale",
    summary:
      "Ein Gleiter bewegt sich auf einem Funktionsgraphen; Tangente und Normale werden nachgeführt.",
    concepts: ["glider", "tangent", "normal"],
    source: `title "Tangente und Normale"
describe "Der Punkt P gleitet auf einer Parabel; Tangente und Normale folgen seiner Position."
board x=-5..5 y=-4..8 axes grid
f(x) = 0.5*x^2-2
F = plot(f, name="", color=blue, width=3)
P = glider(F, x=1.5, y=f(1.5), color=red, size=5)
T = tangent(P, name="Tangente", color=yellow)
N = normal(P, name="Normale", color=purple, dash=true)`,
  },
  {
    key: "dynamic-integral-interpolation",
    title: "07 · Lagrange-Interpolation und dynamisches Integral",
    summary:
      "Drei Punkte bestimmen ein Polynom. Ein Gleiter steuert Integralfläche, Stammfunktionspunkt und Spurkurve.",
    concepts: [
      "lagrange",
      "integral",
      "integralArea",
      "trace",
      "tracecurve",
      "random",
    ],
    source: `title "Interpolation und Integralspur"
describe "Drei bewegliche Punkte bestimmen ein Lagrange-Polynom. Der Gleiter steuert Integralfläche und Stammfunktionspunkt."
board x=-3..3 y=-3..10 axes traces
A = point(-2, random(5, 10, 11), drag=true, name="", size=2)
B = point(0, 2, drag=true, name="", size=2)
C = point(0.5, random(7, 8, 23), drag=true, name="", size=2)
f = lagrange(A, B, C)
P = plot(f, from=-3, to=3, name="", color=blue, width=3)
S = glider(P, x=0.25, y=f(0.25), name="ziehen", color=black, size=5)
integralArea(f, from=A.x, to=S.x, color=yellow, fillOpacity=0.2)
G(x) = integral(f, A.x, x)
F = point(S.x, G(S.x), name="F", trace=true, face="square", size=5)
T = tracecurve(S, F, name="", color=purple)`,
  },
  {
    key: "riemann-methods",
    title: "08 · Riemann-Summen vergleichen",
    summary:
      "Linke und mittlere Rechtecksumme nähern dieselbe Fläche mit unterschiedlicher Farbe an.",
    concepts: ["riemann", "method", "rectangles"],
    source: `title "Riemann-Summen"
describe "Zwei Riemann-Summen vergleichen linke und mittlere Stützstellen für dieselbe Funktion."
board x=-1..7 y=-2..5 axes grid
f(x) = 2+sin(x)
F = plot(f, from=0, to=2*pi, name="", color=blue, width=3)
riemann(f, from=0, to=2*pi, rectangles=10, method="left", color=yellow, fillOpacity=0.18)
riemann(f, from=0, to=2*pi, rectangles=10, method="middle", color=green, fillOpacity=0.12)`,
  },
  {
    key: "trace-curve",
    title: "09 · Spurkurve einer Logarithmusfunktion",
    summary:
      "Ein Regler bewegt einen Punkt auf dem Logarithmusgraphen; die Spur kann über die Infofunktion gelöscht werden.",
    concepts: ["trace", "tracecurve", "board traces"],
    source: `title "Logarithmische Spur"
describe "Der Regler bewegt P auf y gleich ln x; P hinterlässt eine löschbare Spur."
board x=-1..9 y=-5..5 axes grid traces
s = slider(0.1, 8, value=1, step=0.05)
P = point(s, ln(s), name="P", color=red, trace=true, face="diamond", size=5)
T = tracecurve(s, P, name="", color=purple)`,
  },
  {
    key: "parametric-polar",
    title: "10 · Parameter- und Polarkurven",
    summary:
      "Lissajous-Figur und archimedische Spirale demonstrieren zwei alternative Kurvenbeschreibungen.",
    concepts: ["parametric", "polar"],
    source: `title "Parameter- und Polarkurven"
describe "Eine Lissajous-Figur und eine archimedische Spirale zeigen parametrische und polare Darstellung."
board x=-5..5 y=-5..5 axes grid aspect=1
parametric(t, 3*sin(3*t), 3*sin(4*t), from=0, to=2*pi, color=blue, width=2)
r(t) = 0.18*t
polar(t, r(t), from=0, to=7*pi, color=yellow, width=3)`,
  },
  {
    key: "implicit-inequality",
    title: "11 · Implizite Kurve und Ungleichung",
    summary:
      "Eine implizite Lemniskate wird mit einem Funktionsbereich kombiniert.",
    concepts: ["implicit", "region"],
    source: `title "Implizite Kurve und Bereich"
describe "Die blaue Lemniskate ist implizit definiert; der gelbe Bereich markiert y größer gleich einer Parabel."
board x=-5..5 y=-4..4 axes grid aspect=1
implicit((x^2+y^2)^2-8*(x^2-y^2), color=blue, width=3)
f(x) = 0.2*x^2-2
region(y >= f(x), color=yellow, fillOpacity=0.12)`,
  },
  {
    key: "fields",
    title: "12 · Vektor- und Richtungsfelder",
    summary:
      "Ein Rotationsfeld und ein Richtungsfeld visualisieren lokale Änderungen über der Ebene.",
    concepts: ["vectorfield", "slopefield", "density"],
    source: `title "Felder"
describe "Das blaue Vektorfeld rotiert um den Ursprung; das gelbe Richtungsfeld zeigt die Steigung cos x minus y."
board x=-5..5 y=-4..4 axes grid
vectorfield(x, y, -y, x, density=13, color=blue, strokeOpacity=0.65)
slopefield(x, y, cos(x)-y, density=13, color=yellow, strokeOpacity=0.65)`,
  },
  {
    key: "point-presentation",
    title: "13 · Punktformen und Darstellung",
    summary:
      "Sichere Darstellungsoptionen steuern Form, Größe, Füllung, Linie und Transparenz.",
    concepts: ["face", "size", "fillOpacity", "strokeOpacity"],
    source: `title "Punktformen"
describe "Mehrere Punkte zeigen die verfügbaren Formen, Größen und getrennten Transparenzwerte."
board x=-5..5 y=-3..3 axes grid
A = point(-4, 1, face="circle", size=3, color=blue)
B = point(-2, 1, face="square", size=5, color=yellow)
C = point(0, 1, face="diamond", size=6, color=red)
D = point(2, 1, face="triangleUp", size=7, color=green)
E = point(4, 1, face="cross", size=8, color=purple)
polygon(A, B, C, D, E, fill=blue, fillOpacity=0.1, strokeOpacity=0.7)`,
  },
];

const emptyContent = (): CardContent => ({
  blocks: [{ type: "markdown", revealMode: "ALL", source: "" }],
});

const referenceContent = (example: JsxGraphReferenceExample): CardContent => ({
  blocks: [
    {
      type: "markdown",
      revealMode: "ALL",
      source: [
        `## ${example.title}`,
        example.summary,
        `\`\`\`jsxgraph{w=fill h=50vh}`,
        example.source,
        "```",
      ].join("\n\n"),
    },
    {
      type: "markdown",
      revealMode: "ALL",
      source: [
        "### Verwendete Bausteine",
        example.concepts.map((concept) => `- \`${concept}\``).join("\n"),
        "### Quelltext zum Kopieren",
        "```text",
        example.source,
        "```",
        "Die Beschreibung ist verpflichtend. Interne Berechnungen bleiben lokal; JavaScript, URLs und Ereigniscode werden nicht ausgeführt.",
      ].join("\n\n"),
    },
  ],
});

export type FnfHelpDeckSeed = {
  key: string;
  title: string;
  description: string;
  parentKey: string | null;
  cards: Array<{
    key: string;
    front: CardContent;
    back: CardContent;
    kind: "QUESTION";
  }>;
};

export const createFnfHelpLibraryDeckSeeds = (): FnfHelpDeckSeed[] => [
  {
    key: fnfHelpLibraryTemplateKey,
    title: "Flash-n-Flip Help",
    description:
      "Installierbare Referenzsammlung für die erweiterten Flash-n-Flip-Inhaltsformate.",
    parentKey: null,
    cards: [],
  },
  {
    key: fnfHelpJsxGraphTemplateKey,
    title: "JSXGraph · Interaktive Mathematik",
    description:
      "Kopierbare, interaktive Referenzen für Geometrie, Analysis, Kurven und Felder.",
    parentKey: fnfHelpLibraryTemplateKey,
    cards: fnfHelpJsxGraphExamples.map((example) => ({
      key: example.key,
      front: emptyContent(),
      back: referenceContent(example),
      kind: "QUESTION" as const,
    })),
  },
];

export const fnfHelpLibraryTopicCount = 1;
export const fnfHelpLibraryCardCount = fnfHelpJsxGraphExamples.length;
