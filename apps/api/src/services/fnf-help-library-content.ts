export type FnfHelpIntroductionPage = {
  key: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type FnfHelpReferenceExample = {
  key: string;
  title: string;
  summary: string;
  source: string;
  concepts: string[];
};

export const fnfHelpJsxGraphIntroduction: FnfHelpIntroductionPage[] = [
  {
    key: "intro-welcome",
    title: "JSXGraph in Flash-n-Flip",
    paragraphs: [
      "JSXGraph cards turn a compact, text-based description into an interactive mathematical board. The source remains readable, searchable, and easy to copy into your own cards.",
      "The next pages explain the basic structure before the reference continues with thirty complete examples.",
    ],
  },
  {
    key: "intro-structure",
    title: "Source structure",
    paragraphs: [
      "Every source begins with an optional title, a required accessible description, and a board declaration. The following lines define functions, points, constructions, and drawing commands.",
    ],
    bullets: [
      "Use describe to explain what the graph communicates.",
      "Use board to choose ranges, axes, grid, aspect ratio, and trace support.",
      "Give reusable objects short identifiers such as A, f, or curve.",
      "Add drag=true only to objects that learners should move.",
    ],
  },
  {
    key: "intro-safety-display",
    title: "Display, interaction, and safety",
    paragraphs: [
      "The default Markdown fence is ```jsxgraph{w=fill h=50vh}. Width and height accept responsive units. Mouse, trackpad, and touch gestures provide pan and zoom; the information control exposes reset and trace clearing when available.",
      "Flash-n-Flip executes only its bounded JSXGraph language. Arbitrary JavaScript, event handlers, HTML, URLs, remote resources, and 3D objects are rejected.",
    ],
  },
];

export const fnfHelpJsxGraphExamples: FnfHelpReferenceExample[] = [
  {
    key: "points-lines-circles",
    title: "01 · Points, segments, and a circumcircle",
    summary:
      "Movable base objects form a triangle while dependent constructions follow automatically.",
    concepts: ["point", "segment", "polygon", "circumcircle", "drag"],
    source: `title "Dynamic triangle"
describe "Three movable points form a triangle with sides, area, and circumcircle."
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
    title: "02 · Medians and centroid",
    summary:
      "Midpoints and intersections create a classic dependent triangle construction.",
    concepts: ["midpoint", "line", "intersection"],
    source: `title "Centroid of a triangle"
describe "Two medians meet at centroid S and follow the movable vertices."
board x=-6..6 y=-5..5 axes grid aspect=1
A = point(-4, -2, drag=true)
B = point(4, -2, drag=true)
C = point(1, 3, drag=true)
Mab = midpoint(A, B, name="M1")
Mbc = midpoint(B, C, name="M2")
g1 = line(C, Mab, name="")
g2 = line(A, Mbc, name="")
S = intersection(g1, g2, color=red, size=5)
polygon(A, B, C, fill=yellow, fillOpacity=0.1)`,
  },
  {
    key: "parallel-perpendicular-reflection",
    title: "03 · Parallel, perpendicular, and reflection",
    summary:
      "A point is reflected across a movable line while helper lines show the relationships.",
    concepts: ["parallel", "perpendicular", "reflection"],
    source: `title "Lines and reflection"
describe "Point C is reflected across line AB while parallel and perpendicular helpers remain linked."
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
    title: "04 · Ellipse, hyperbola, and parabola",
    summary:
      "The principal conic sections are built from a few movable reference objects.",
    concepts: ["ellipse", "hyperbola", "parabola"],
    source: `title "Conic sections"
describe "Movable focal and reference points change an ellipse, a hyperbola, and a parabola."
board x=-8..8 y=-6..6 axes grid aspect=1
F1 = point(-3, 0, drag=true)
F2 = point(3, 0, drag=true)
P = point(0, 4, drag=true)
E = ellipse(F1, F2, P, name="", color=blue)
H = hyperbola(F1, F2, P, name="", color=purple)
D1 = point(-6, -4, visible=false)
D2 = point(6, -4, visible=false)
d = line(D1, D2, visible=false)
Q = point(0, 1, drag=true)
Pa = parabola(Q, d, name="", color=yellow)`,
  },
  {
    key: "sliders-derivative",
    title: "05 · Function parameters and derivative",
    summary:
      "Three sliders change amplitude, offset, and frequency while the derivative follows immediately.",
    concepts: ["slider", "plot", "derivative"],
    source: `title "Sine function with parameters"
describe "Sliders a, b, and c change the sine function; the yellow curve is its derivative."
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
    title: "06 · Tangent and normal",
    summary:
      "A glider moves along a function graph while tangent and normal update continuously.",
    concepts: ["glider", "tangent", "normal"],
    source: `title "Tangent and normal"
describe "Point P glides along a parabola while its tangent and normal follow the current position."
board x=-5..5 y=-4..8 axes grid
f(x) = 0.5*x^2-2
F = plot(f, name="", color=blue, width=3)
P = glider(F, x=1.5, y=f(1.5), color=red, size=5)
T = tangent(P, name="tangent", color=yellow)
N = normal(P, name="normal", color=purple, dash=true)`,
  },
  {
    key: "dynamic-integral-interpolation",
    title: "07 · Lagrange interpolation and dynamic integral",
    summary:
      "Three points determine a polynomial while a glider controls the area, antiderivative point, and trace curve.",
    concepts: [
      "lagrange",
      "integral",
      "integralArea",
      "trace",
      "tracecurve",
      "random",
    ],
    source: `title "Interpolation and integral trace"
describe "Three movable points determine a Lagrange polynomial. The glider controls the integral area and antiderivative point."
board x=-3..3 y=-3..10 axes traces
A = point(-2, random(5, 10, 11), drag=true, name="", size=2)
B = point(0, 2, drag=true, name="", size=2)
C = point(0.5, random(7, 8, 23), drag=true, name="", size=2)
f = lagrange(A, B, C)
P = plot(f, from=-3, to=3, name="", color=blue, width=3)
S = glider(P, x=0.25, y=f(0.25), name="drag", color=black, size=5)
integralArea(f, from=A.x, to=S.x, color=yellow, fillOpacity=0.2)
G(x) = integral(f, A.x, x)
F = point(S.x, G(S.x), name="F", trace=true, face="square", size=5)
T = tracecurve(S, F, name="", color=purple)`,
  },
  {
    key: "riemann-methods",
    title: "08 · Comparing Riemann sums",
    summary:
      "Left and midpoint rectangles approximate the same area with different colors.",
    concepts: ["riemann", "method", "rectangles"],
    source: `title "Riemann sums"
describe "Two Riemann sums compare left and midpoint samples for the same function."
board x=-1..7 y=-2..5 axes grid
f(x) = 2+sin(x)
F = plot(f, from=0, to=2*pi, name="", color=blue, width=3)
riemann(f, from=0, to=2*pi, rectangles=10, method="left", color=yellow, fillOpacity=0.18)
riemann(f, from=0, to=2*pi, rectangles=10, method="middle", color=green, fillOpacity=0.12)`,
  },
  {
    key: "trace-curve",
    title: "09 · Trace curve of a logarithm",
    summary:
      "A slider moves a point along a logarithm and the trace can be cleared from the information control.",
    concepts: ["trace", "tracecurve", "board traces"],
    source: `title "Logarithmic trace"
describe "The slider moves P along y equals ln x and P leaves a trace that can be cleared."
board x=-1..9 y=-5..5 axes grid traces
s = slider(0.1, 8, value=1, step=0.05)
P = point(s, ln(s), name="P", color=red, trace=true, face="diamond", size=5)
T = tracecurve(s, P, name="", color=purple)`,
  },
  {
    key: "parametric-polar",
    title: "10 · Parametric and polar curves",
    summary:
      "A Lissajous figure and an Archimedean spiral demonstrate two alternative curve descriptions.",
    concepts: ["parametric", "polar"],
    source: `title "Parametric and polar curves"
describe "A Lissajous figure and an Archimedean spiral show parametric and polar representations."
board x=-5..5 y=-5..5 axes grid aspect=1
parametric(t, 3*sin(3*t), 3*sin(4*t), from=0, to=2*pi, color=blue, width=2)
r(t) = 0.18*t
polar(t, r(t), from=0, to=7*pi, color=yellow, width=3)`,
  },
  {
    key: "implicit-inequality",
    title: "11 · Implicit curve and inequality",
    summary:
      "An implicit lemniscate is combined with a shaded function region.",
    concepts: ["implicit", "region"],
    source: `title "Implicit curve and region"
describe "The blue lemniscate is defined implicitly and the yellow region marks y greater than or equal to a parabola."
board x=-5..5 y=-4..4 axes grid aspect=1
implicit((x^2+y^2)^2-8*(x^2-y^2), color=blue, width=3)
f(x) = 0.2*x^2-2
region(y >= f(x), color=yellow, fillOpacity=0.12)`,
  },
  {
    key: "fields",
    title: "12 · Vector and slope fields",
    summary:
      "A rotational vector field and a slope field visualize local change across the plane.",
    concepts: ["vectorfield", "slopefield", "density"],
    source: `title "Fields"
describe "The blue vector field rotates around the origin and the yellow slope field shows the slope cosine x minus y."
board x=-5..5 y=-4..4 axes grid
vectorfield(x, y, -y, x, density=13, color=blue, strokeOpacity=0.65)
slopefield(x, y, cos(x)-y, density=13, color=yellow, strokeOpacity=0.65)`,
  },
  {
    key: "point-presentation",
    title: "13 · Point faces and presentation",
    summary:
      "Safe presentation options control face, size, fill, stroke, and opacity.",
    concepts: ["face", "size", "fillOpacity", "strokeOpacity"],
    source: `title "Point faces"
describe "Several points demonstrate the available faces, sizes, and separate opacity values."
board x=-5..5 y=-3..3 axes grid
A = point(-4, 1, face="circle", size=3, color=blue)
B = point(-2, 1, face="square", size=5, color=yellow)
C = point(0, 1, face="diamond", size=6, color=red)
D = point(2, 1, face="triangleUp", size=7, color=green)
E = point(4, 1, face="cross", size=8, color=purple)
polygon(A, B, C, D, E, fill=blue, fillOpacity=0.1, strokeOpacity=0.7)`,
  },
  {
    key: "circle-radius-slider",
    title: "14 · Circle with a variable radius",
    summary: "A slider changes the radius of a circle around a fixed center.",
    concepts: ["circle", "center", "radius", "slider"],
    source: `title "Variable circle"
describe "Slider r changes the radius of the circle centered at O."
board x=-6..6 y=-5..5 axes grid aspect=1
r = slider(0.5, 4, value=2, step=0.1)
O = point(0, 0, name="O", size=5)
C = circle(center=O, radius=r, name="", color=blue, width=3)`,
  },
  {
    key: "angle-bisector",
    title: "15 · Angle and angle bisector",
    summary: "A movable angle and its bisector remain connected.",
    concepts: ["angle", "bisector"],
    source: `title "Angle bisector"
describe "The angle ABC and its bisector update when A or C is moved."
board x=-6..6 y=-5..5 axes grid aspect=1
A = point(-4, 2, drag=true)
B = point(0, -2, drag=true)
C = point(4, 1, drag=true)
angle(A, B, C, color=yellow, fillOpacity=0.2)
b = bisector(A, B, C, name="bisector", color=purple)
segment(B, A, color=blue)
segment(B, C, color=blue)`,
  },
  {
    key: "arc-sector",
    title: "16 · Arc and sector",
    summary: "Three movable points define a circular arc and its sector.",
    concepts: ["arc", "sector"],
    source: `title "Arc and sector"
describe "Points O, A, and B define a circular arc and a translucent sector."
board x=-6..6 y=-5..5 axes grid aspect=1
O = point(0, 0, drag=true)
A = point(3, 0, drag=true)
B = point(0, 3, drag=true)
arc(O, A, B, color=blue, width=4)
sector(O, A, B, color=yellow, fillOpacity=0.18)`,
  },
  {
    key: "incircle",
    title: "17 · Incircle of a triangle",
    summary:
      "The incircle remains tangent to every side of a movable triangle.",
    concepts: ["incircle", "polygon"],
    source: `title "Triangle incircle"
describe "The incircle follows all three sides when the triangle vertices move."
board x=-6..6 y=-5..5 axes grid aspect=1
A = point(-4, -2, drag=true)
B = point(4, -2, drag=true)
C = point(0, 4, drag=true)
polygon(A, B, C, fill=blue, fillOpacity=0.08)
I = incircle(A, B, C, name="", color=yellow, width=3)`,
  },
  {
    key: "ray-arrow-line",
    title: "18 · Line, ray, and arrow",
    summary:
      "Three related objects demonstrate their different endpoint behavior.",
    concepts: ["line", "ray", "arrow"],
    source: `title "Line, ray, and arrow"
describe "A line, a ray, and an arrow share movable reference points but use different endpoint rules."
board x=-6..6 y=-5..5 axes grid
A = point(-3, -2, drag=true)
B = point(2, 1, drag=true)
line(A, B, name="line", color=blue)
ray(A, B, name="ray", color=yellow)
arrow(B, A, name="", color=purple, width=3)`,
  },
  {
    key: "absolute-piecewise",
    title: "19 · Piecewise absolute value",
    summary: "A conditional expression creates an absolute-value function.",
    concepts: ["if", "plot"],
    source: `title "Piecewise absolute value"
describe "The function uses a conditional expression to return minus x below zero and x otherwise."
board x=-6..6 y=-2..7 axes grid
f(x) = if(x < 0, -x, x)
plot(f, from=-6, to=6, name="", color=blue, width=4)`,
  },
  {
    key: "bounded-function",
    title: "20 · Clamped function values",
    summary: "A sine wave is bounded between two horizontal levels.",
    concepts: ["clamp", "min", "max"],
    source: `title "Clamped wave"
describe "The yellow curve limits a scaled sine wave to values between minus one and one."
board x=-7..7 y=-3..3 axes grid
f(x) = 2*sin(x)
g(x) = clamp(f(x), -1, 1)
plot(f, name="", color=blue, dash=true)
plot(g, name="", color=yellow, width=4)`,
  },
  {
    key: "exponential-logarithm",
    title: "21 · Exponential and logarithm",
    summary: "Inverse exponential and logarithmic curves are shown together.",
    concepts: ["exp", "ln"],
    source: `title "Exponential and logarithm"
describe "The exponential and natural logarithm curves illustrate inverse growth around the line y equals x."
board x=-4..6 y=-4..8 axes grid
plot(exp(x), from=-4, to=2, name="", color=blue, width=3)
plot(ln(x), from=0.05, to=6, name="", color=yellow, width=3)
A = point(-4, -4, visible=false)
B = point(6, 6, visible=false)
line(A, B, name="y=x", color=purple, dash=true)`,
  },
  {
    key: "hyperbolic-functions",
    title: "22 · Hyperbolic functions",
    summary: "Hyperbolic sine and tangent are compared on one board.",
    concepts: ["sinh", "tanh"],
    source: `title "Hyperbolic functions"
describe "The blue hyperbolic sine grows rapidly while the yellow hyperbolic tangent approaches horizontal limits."
board x=-4..4 y=-5..5 axes grid
plot(sinh(x), from=-2.3, to=2.3, name="sinh", color=blue, width=3)
plot(tanh(x), from=-4, to=4, name="tanh", color=yellow, width=3)`,
  },
  {
    key: "parametric-ellipse",
    title: "23 · Parametric ellipse",
    summary:
      "Two parameter equations draw an ellipse without a conic constructor.",
    concepts: ["parametric", "cos", "sin"],
    source: `title "Parametric ellipse"
describe "Cosine controls the horizontal coordinate and sine controls the vertical coordinate of an ellipse."
board x=-5..5 y=-4..4 axes grid aspect=1
parametric(t, 4*cos(t), 2*sin(t), from=0, to=2*pi, color=blue, width=4)`,
  },
  {
    key: "polar-rose",
    title: "24 · Polar rose",
    summary: "A cosine radius generates a five-petal polar rose.",
    concepts: ["polar", "cos"],
    source: `title "Five-petal polar rose"
describe "The radius two times cosine of five t creates a five-petal rose in polar coordinates."
board x=-3..3 y=-3..3 axes grid aspect=1
r(t) = 2*cos(5*t)
polar(t, r(t), from=0, to=2*pi, color=purple, width=3)`,
  },
  {
    key: "implicit-superellipse",
    title: "25 · Implicit superellipse",
    summary: "An implicit fourth-power equation produces a rounded square.",
    concepts: ["implicit", "abs"],
    source: `title "Implicit superellipse"
describe "A fourth-power equation creates a rounded square centered at the origin."
board x=-4..4 y=-4..4 axes grid aspect=1
implicit(x^4+y^4-16, color=blue, width=4)`,
  },
  {
    key: "bounded-region",
    title: "26 · Shaded half-plane",
    summary: "An inequality shades the region above a movable function.",
    concepts: ["region", "slider"],
    source: `title "Shaded half-plane"
describe "Slider a changes a line and the yellow area marks every point above it."
board x=-6..6 y=-5..5 axes grid
a = slider(-2, 2, value=0.5, step=0.1)
f(x) = a*x-1
plot(f, name="", color=blue, width=3)
region(y >= f(x), color=yellow, fillOpacity=0.14)`,
  },
  {
    key: "radial-vector-field",
    title: "27 · Radial vector field",
    summary: "Vectors point away from the origin with normalized length.",
    concepts: ["vectorfield", "sqrt"],
    source: `title "Radial vector field"
describe "Every vector points away from the origin and is normalized by its distance."
board x=-5..5 y=-5..5 axes grid aspect=1
d(x,y) = max(0.5, sqrt(x^2+y^2))
vectorfield(x, y, x/d(x,y), y/d(x,y), density=14, color=blue, strokeOpacity=0.75)`,
  },
  {
    key: "logistic-slope-field",
    title: "28 · Logistic slope field",
    summary: "A slope field visualizes the logistic differential equation.",
    concepts: ["slopefield", "density"],
    source: `title "Logistic slope field"
describe "The direction field represents y prime equals y times one minus y."
board x=-5..5 y=-1..2 axes grid
slopefield(x, y, y*(1-y), density=16, color=purple, strokeOpacity=0.7)`,
  },
  {
    key: "antiderivative-graph",
    title: "29 · Numerical antiderivative",
    summary: "A numerical integral is used as a new function and plotted.",
    concepts: ["integral", "plot"],
    source: `title "Numerical antiderivative"
describe "The yellow graph is the accumulated integral of the blue cosine curve from zero to x."
board x=-7..7 y=-3..3 axes grid
f(x) = cos(x)
F(x) = integral(f, 0, x)
plot(f, name="cosine", color=blue, dash=true)
plot(F, name="integral", color=yellow, width=4)`,
  },
  {
    key: "second-derivative",
    title: "30 · First and second derivatives",
    summary:
      "A polynomial is displayed together with both successive derivatives.",
    concepts: ["derivative", "plot"],
    source: `title "Successive derivatives"
describe "A cubic polynomial, its first derivative, and its second derivative are shown with distinct colors."
board x=-5..5 y=-8..8 axes grid
f(x) = 0.25*x^3-2*x
g = derivative(f)
h = derivative(g)
plot(f, name="f", color=blue, width=3)
plot(g, name="first", color=yellow, width=3)
plot(h, name="second", color=purple, width=3, dash=true)`,
  },
];

export const fnfHelpMermaidIntroduction: FnfHelpIntroductionPage[] = [
  {
    key: "intro-welcome",
    title: "Mermaid diagrams in Flash-n-Flip",
    paragraphs: [
      "Mermaid turns a concise textual description into a diagram. Flash-n-Flip supports flowcharts, sequence diagrams, state diagrams, class diagrams, entity-relationship diagrams, mind maps, and timelines.",
    ],
  },
  {
    key: "intro-structure",
    title: "Choosing a diagram type",
    paragraphs: [
      "Start the source with the exact header for the intended diagram type. Keep identifiers short and place human-readable labels inside the diagram syntax.",
    ],
    bullets: [
      "Use flowchart for processes and decisions.",
      "Use sequenceDiagram for messages over time.",
      "Use stateDiagram-v2 for lifecycle transitions.",
      "Use classDiagram or erDiagram for data structures.",
      "Use mindmap or timeline for hierarchical and chronological summaries.",
    ],
  },
  {
    key: "intro-display-safety",
    title: "Display and safe rendering",
    paragraphs: [
      "The default fence is ```mermaid{w=fill h=50vh}. Responsive widths and heights are supported, as are pan and zoom gestures.",
      "Flash-n-Flip rejects Mermaid configuration directives, callbacks, links, custom styles, HTML, URLs, images, and external resources.",
    ],
  },
];

export const fnfHelpMermaidExamples: FnfHelpReferenceExample[] = [
  {
    key: "flowchart-linear",
    title: "01 · Linear flowchart",
    summary: "A simple left-to-right process connects three stages.",
    concepts: ["flowchart", "LR", "nodes", "edges"],
    source: `flowchart LR
  idea[Idea] --> draft[Draft]
  draft --> review[Review]
  review --> publish[Publish]`,
  },
  {
    key: "flowchart-decision",
    title: "02 · Flowchart with a decision",
    summary: "A diamond branches into two outcomes and returns to one process.",
    concepts: ["flowchart", "decision", "branch"],
    source: `flowchart TD
  start[Open card] --> know{Know the answer?}
  know -->|Yes| rate[Rate recall]
  know -->|No| reveal[Reveal answer]
  reveal --> rate`,
  },
  {
    key: "sequence-request",
    title: "03 · Request sequence",
    summary: "Three participants exchange a request, lookup, and response.",
    concepts: ["sequenceDiagram", "participant", "message"],
    source: `sequenceDiagram
  participant L as Learner
  participant F as Flash-n-Flip
  participant D as Local store
  L->>F: Open deck
  F->>D: Load cards
  D-->>F: Cards
  F-->>L: Show first card`,
  },
  {
    key: "sequence-alternative",
    title: "04 · Sequence with alternatives",
    summary: "An alternative block documents online and offline behavior.",
    concepts: ["sequenceDiagram", "alt", "else"],
    source: `sequenceDiagram
  participant A as App
  participant P as Peer
  alt Peer available
    A->>P: Request changes
    P-->>A: Send changes
  else Peer unavailable
    A-->>A: Keep changes in outbox
  end`,
  },
  {
    key: "state-learning",
    title: "05 · Learning state machine",
    summary: "A card moves through new, learning, and review states.",
    concepts: ["stateDiagram-v2", "transition"],
    source: `stateDiagram-v2
  [*] --> New
  New --> Learning: first review
  Learning --> Review: successful recall
  Review --> Learning: lapse
  Review --> [*]: suspended`,
  },
  {
    key: "class-deck-card",
    title: "06 · Deck and card classes",
    summary: "A class diagram shows ownership and selected fields.",
    concepts: ["classDiagram", "class", "association"],
    source: `classDiagram
  class Deck {
    +title: string
    +language: string
  }
  class Card {
    +front: content
    +back: content
  }
  Deck "1" --> "many" Card`,
  },
  {
    key: "er-study-data",
    title: "07 · Study data relationships",
    summary: "An ER diagram connects decks, cards, and review events.",
    concepts: ["erDiagram", "cardinality"],
    source: `erDiagram
  DECK ||--o{ CARD : contains
  CARD ||--o{ REVIEW : records
  DEVICE ||--o{ REVIEW : creates`,
  },
  {
    key: "mindmap-content",
    title: "08 · Content mind map",
    summary: "A mind map groups the supported rich-content families.",
    concepts: ["mindmap", "hierarchy"],
    source: `mindmap
  root((Rich content))
    Mathematics
      KaTeX
      JSXGraph
    Diagrams
      Mermaid
    Music
      ABC notation`,
  },
  {
    key: "timeline-history",
    title: "09 · Product timeline",
    summary: "A timeline arranges milestones in chronological order.",
    concepts: ["timeline", "title"],
    source: `timeline
  title Flash-n-Flip content formats
  2025 : Markdown and KaTeX
  2026 : Mermaid diagrams
       : ABC music notation
       : JSXGraph boards`,
  },
  {
    key: "flowchart-subgraphs",
    title: "10 · Flowchart with groups",
    summary: "Subgraphs separate editing, validation, and learning stages.",
    concepts: ["flowchart", "subgraph"],
    source: `flowchart LR
  subgraph Authoring
    edit[Edit source] --> validate[Validate]
  end
  subgraph Learning
    render[Render card] --> interact[Interact]
  end
  validate --> render`,
  },
];

export const fnfHelpAbcIntroduction: FnfHelpIntroductionPage[] = [
  {
    key: "intro-welcome",
    title: "ABC music notation in Flash-n-Flip",
    paragraphs: [
      "ABC is a compact text notation for sheet music. Flash-n-Flip renders the supported subset locally, provides synchronized playback, highlights the current score position, and can show an 88-key learning keyboard.",
    ],
  },
  {
    key: "intro-structure",
    title: "Tune header and note body",
    paragraphs: [
      "A tune starts with X:1 and usually declares a title, meter, default note length, tempo, and key before the note body. Bar lines divide measures; square brackets create simultaneous notes.",
    ],
    bullets: [
      "Uppercase notes C through B are around middle C; lowercase notes continue above them.",
      "Commas move notes down by octaves and apostrophes move them up.",
      "Use ^, _, and = for sharp, flat, and natural accidentals.",
      "Use z for a rest and [CEG] for a chord.",
    ],
  },
  {
    key: "intro-display-playback",
    title: "Layout, voices, and playback",
    paragraphs: [
      "Use ```abc{size=70% bars=auto keyboard=notes} for a compact responsive score. bars accepts auto or a fixed number from 1 to 12. keyboard can be notes, keys, or off.",
      "Multiple V: declarations create independent voices. A piano score normally uses RH with a treble clef and LH with a bass clef. Playback begins only after a user action and uses bundled local samples.",
      "Flash-n-Flip rejects scripts, HTML, URLs, remote soundfonts, unsupported directives, and oversized scores.",
    ],
  },
];

export const fnfHelpAbcExamples: FnfHelpReferenceExample[] = [
  {
    key: "c-major-scale",
    title: "01 · C major scale",
    summary: "A one-octave scale introduces pitches, durations, and bar lines.",
    concepts: ["X", "M", "L", "Q", "K", "bar line"],
    source: `X:1
T:C major scale
M:4/4
L:1/4
Q:100
K:C clef=treble
C D E F | G A B c |`,
  },
  {
    key: "g-major-key",
    title: "02 · G major key signature",
    summary: "The key signature supplies F sharp without explicit accidentals.",
    concepts: ["K:G", "key signature"],
    source: `X:1
T:G major phrase
M:4/4
L:1/8
Q:112
K:G clef=treble
G2 A2 B2 c2 | d2 e2 f2 g2 |`,
  },
  {
    key: "three-four-meter",
    title: "03 · Three-four meter",
    summary: "A short waltz phrase demonstrates three beats per measure.",
    concepts: ["M:3/4", "duration"],
    source: `X:1
T:Simple waltz
M:3/4
L:1/4
Q:92
K:C clef=treble
E G c | B G E | F A d | c3 |`,
  },
  {
    key: "rests",
    title: "04 · Notes and rests",
    summary: "Quarter and half rests create audible space in a phrase.",
    concepts: ["z", "rest", "duration"],
    source: `X:1
T:Notes and rests
M:4/4
L:1/4
Q:88
K:C clef=treble
C z E z | G2 z2 | c B A G | C4 |`,
  },
  {
    key: "chords",
    title: "05 · Simultaneous notes and chords",
    summary: "Square brackets play several notes at the same time.",
    concepts: ["chord", "simultaneous notes"],
    source: `X:1
T:Triad progression
M:4/4
L:1/2
Q:76
K:C clef=treble
[CEG] [DFA] | [EGB] [FAC] | [GBd] [CEc] |`,
  },
  {
    key: "accidentals",
    title: "06 · Accidentals",
    summary: "Sharp, flat, and natural signs alter individual pitches.",
    concepts: ["sharp", "flat", "natural"],
    source: `X:1
T:Accidentals
M:4/4
L:1/4
Q:84
K:C clef=treble
C ^C D _E | E =E F ^F | G _A A _B | B4 |`,
  },
  {
    key: "octaves",
    title: "07 · Octave marks",
    summary: "Commas and apostrophes move pitches across octaves.",
    concepts: ["comma", "apostrophe", "octave"],
    source: `X:1
T:Octave range
M:4/4
L:1/4
Q:90
K:C clef=treble
C, C c c' | B, B b b' | A, A a a' | G,4 |`,
  },
  {
    key: "lyrics",
    title: "08 · Melody with lyrics",
    summary: "A w: field aligns simple lyric syllables with the melody.",
    concepts: ["w", "lyrics", "syllables"],
    source: `X:1
T:Four-note song
M:4/4
L:1/4
Q:80
K:C clef=treble
C D E C | E F G2 |
w: Sing the notes to-day`,
  },
  {
    key: "two-voice-piano",
    title: "09 · Two-voice piano score",
    summary: "Treble and bass voices create a compact two-hand piano texture.",
    concepts: ["V", "treble", "bass", "RH", "LH"],
    source: `X:1
T:Two-hand piano pattern
M:4/4
L:1/4
Q:84
V:RH clef=treble
V:LH clef=bass
K:C
[V:RH] [CE] [DF] [EG] [FA] | [GB] [Ac] [Bd] [ce] |
[V:LH] C, G, C G, | D, A, D A, |`,
  },
  {
    key: "four-voice-harmony",
    title: "10 · Four independent voices",
    summary:
      "Four voices demonstrate simultaneous soprano, alto, tenor, and bass lines.",
    concepts: ["V", "four voices", "harmony"],
    source: `X:1
T:Four-part cadence
M:4/4
L:1/2
Q:72
V:S clef=treble
V:A clef=treble
V:T clef=bass
V:B clef=bass
K:C
[V:S] e d | c2 |
[V:A] c B | G2 |
[V:T] G F | E2 |
[V:B] C, G, | C,2 |`,
  },
];
