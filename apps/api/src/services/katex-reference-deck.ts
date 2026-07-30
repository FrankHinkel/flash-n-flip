import type { CardContent } from "@flashcards/domain/content";

export const katexReferenceTemplateKey = "developer:katex-reference:v1";

type ReferenceCardSpec = {
  key: string;
  title: string;
  formula: string;
  explanation: string;
  note?: string;
};

type ReferenceDeckSpec = {
  key: string;
  title: string;
  description: string;
  cards: ReferenceCardSpec[];
};

export type KatexReferenceDeckSeed = {
  key: string;
  title: string;
  description: string;
  parentKey: string | null;
  cards: Array<{
    key: string;
    front: CardContent;
    back: CardContent;
  }>;
};

const emptyContent = (): CardContent => ({
  blocks: [{ type: "markdown", revealMode: "ALL", source: "" }],
});

const explanationContent = (card: ReferenceCardSpec): CardContent => ({
  blocks: [
    {
      type: "markdown",
      revealMode: "ALL",
      source: [
        `## ${card.title}`,
        "$$",
        card.formula,
        "$$",
        "### Source",
        "```latex",
        card.formula,
        "```",
        "### What it shows",
        card.explanation,
        ...(card.note ? ["### Flash-n-Flip note", card.note] : []),
      ].join("\n\n"),
    },
  ],
});

const deck = (
  key: string,
  title: string,
  description: string,
  cards: ReferenceCardSpec[],
): ReferenceDeckSpec => ({ key, title, description, cards });

const referenceDecks: ReferenceDeckSpec[] = [
  deck(
    "basics",
    "01 · Fundamentals and syntax",
    "Inline and display mathematics, grouping, superscripts, and subscripts.",
    [
      {
        key: "inline",
        title: "Inline formula",
        formula: "a^2+b^2=c^2",
        explanation:
          "Wrap a formula in one dollar sign on each side when it belongs inside a sentence.",
      },
      {
        key: "display",
        title: "Display formula",
        formula: "x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}",
        explanation:
          "Two dollar signs on separate lines create a centered display formula.",
      },
      {
        key: "grouping",
        title: "Grouping arguments",
        formula: "x^{n+1}+a_{i,j}",
        explanation:
          "Braces group every character that belongs to a superscript, subscript, or command argument.",
      },
    ],
  ),
  deck(
    "operators-relations",
    "02 · Operators and relations",
    "Comparison signs, binary operators, and named mathematical operators.",
    [
      {
        key: "relations",
        title: "Relations",
        formula: "a\\le b\\ne c\\approx d",
        explanation:
          "Relation commands produce the spacing expected around comparison symbols.",
      },
      {
        key: "binary",
        title: "Binary operators",
        formula: "a\\cdot b\\times c\\div d",
        explanation:
          "Use semantic operator commands instead of visually similar text characters.",
      },
      {
        key: "named",
        title: "Named operators",
        formula: "\\sin(x)+\\log(y)+\\max(S)",
        explanation:
          "Named operators render upright and receive conventional mathematical spacing.",
      },
    ],
  ),
  deck(
    "fractions-roots-powers",
    "03 · Fractions, roots, and powers",
    "Frequently used structures with nested arguments.",
    [
      {
        key: "fraction",
        title: "Nested fraction",
        formula: "\\frac{x+1}{\\frac{a}{b}}",
        explanation:
          "The first brace group is the numerator and the second is the denominator; both may contain formulas.",
      },
      {
        key: "root",
        title: "Indexed root",
        formula: "\\sqrt[n]{x^m}",
        explanation: "An optional square-bracket argument sets the root index.",
      },
      {
        key: "power",
        title: "Combined indices",
        formula: "x_i^{n+1}",
        explanation:
          "Subscripts and superscripts can be combined in either order.",
      },
    ],
  ),
  deck(
    "sums-products-limits",
    "04 · Sums, products, and limits",
    "Large operators with lower and upper limits.",
    [
      {
        key: "sum",
        title: "Finite sum",
        formula: "\\sum_{i=1}^{n} i=\\frac{n(n+1)}{2}",
        explanation:
          "Lower and upper limits are written as subscript and superscript arguments.",
      },
      {
        key: "product",
        title: "Finite product",
        formula: "\\prod_{k=1}^{n} k=n!",
        explanation: "Product notation uses the same limit syntax as sums.",
      },
      {
        key: "limit",
        title: "Limit",
        formula: "\\lim_{x\\to 0}\\frac{\\sin x}{x}=1",
        explanation:
          "The approach expression belongs in the lower argument of the limit operator.",
      },
    ],
  ),
  deck(
    "calculus",
    "05 · Calculus and integrals",
    "Derivatives, integrals, and partial derivatives.",
    [
      {
        key: "derivative",
        title: "Derivative",
        formula: "\\frac{d}{dx}x^n=nx^{n-1}",
        explanation:
          "Leibniz notation is composed from an ordinary fraction and differential symbols.",
      },
      {
        key: "integral",
        title: "Definite integral",
        formula: "\\int_0^1 x^2\\,dx=\\frac{1}{3}",
        explanation:
          "Integral limits use subscripts and superscripts; a thin space separates the integrand from the differential.",
      },
      {
        key: "partial",
        title: "Partial derivative",
        formula: "\\frac{\\partial f}{\\partial x}",
        explanation:
          "Use the partial command inside the numerator and denominator.",
      },
    ],
  ),
  deck(
    "matrices-vectors",
    "06 · Matrices and vectors",
    "Matrix environments, vectors, and piecewise definitions.",
    [
      {
        key: "matrix",
        title: "Bracketed matrix",
        formula: "\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}",
        explanation:
          "Ampersands separate columns and a double backslash starts a new row.",
      },
      {
        key: "vector",
        title: "Vector notation",
        formula: "\\vec v=\\begin{pmatrix}x\\\\y\\\\z\\end{pmatrix}",
        explanation: "Vector accents and matrix environments can be combined.",
      },
      {
        key: "cases",
        title: "Piecewise definition",
        formula: "f(x)=\\begin{cases}x^2&x\\ge0\\\\-x&x<0\\end{cases}",
        explanation:
          "The cases environment aligns each expression with its condition.",
      },
    ],
  ),
  deck(
    "sets-logic",
    "07 · Sets and logic",
    "Set notation, logical connectors, and quantifiers.",
    [
      {
        key: "sets",
        title: "Set operations",
        formula: "A\\cap B\\subseteq A\\cup B",
        explanation:
          "Intersection, union, and subset relations have dedicated commands.",
      },
      {
        key: "logic",
        title: "Logical implication",
        formula: "P\\land Q\\implies P",
        explanation:
          "Logical connectors and implication arrows are spaced as relations.",
      },
      {
        key: "quantifiers",
        title: "Quantifiers",
        formula: "\\forall x\\in\\mathbb{R}\\;\\exists y>x",
        explanation:
          "Blackboard-bold number sets and quantifiers can be combined in one expression.",
      },
    ],
  ),
  deck(
    "probability",
    "08 · Probability",
    "Conditional probability, combinations, and expected values.",
    [
      {
        key: "conditional",
        title: "Conditional probability",
        formula: "P(A\\mid B)=\\frac{P(A\\cap B)}{P(B)}",
        explanation:
          "The mid command creates a conditional bar with relation spacing.",
      },
      {
        key: "binomial",
        title: "Binomial coefficient",
        formula: "\\binom{n}{k}=\\frac{n!}{k!(n-k)!}",
        explanation:
          "The binom command creates a parenthesized two-level coefficient.",
      },
      {
        key: "expectation",
        title: "Expected value",
        formula: "\\mathbb{E}[X]=\\sum_x xP(X=x)",
        explanation:
          "Blackboard-bold E is conventionally used for expectation.",
      },
    ],
  ),
  deck(
    "geometry-trigonometry",
    "09 · Geometry and trigonometry",
    "Angles, trigonometric identities, and distances.",
    [
      {
        key: "identity",
        title: "Trigonometric identity",
        formula: "\\sin^2\\theta+\\cos^2\\theta=1",
        explanation:
          "Powers apply to named trigonometric operators in the usual way.",
      },
      {
        key: "distance",
        title: "Euclidean distance",
        formula: "d(P,Q)=\\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}",
        explanation:
          "Subscripts distinguish coordinates while the radical groups the complete sum.",
      },
      {
        key: "angle",
        title: "Angles and degrees",
        formula: "\\angle ABC=90^\\circ",
        explanation:
          "Angle and degree symbols are mathematical commands rather than plain text glyphs.",
      },
    ],
  ),
  deck(
    "text-spacing",
    "10 · Text, spacing, and alignment",
    "Readable text fragments and deliberate horizontal spacing.",
    [
      {
        key: "text",
        title: "Text inside mathematics",
        formula: "x=0\\quad\\text{if }n\\text{ is even}",
        explanation:
          "The text command keeps words upright and preserves spaces inside its argument.",
      },
      {
        key: "spacing",
        title: "Spacing commands",
        formula: "a\\,b\\;c\\quad d\\qquad e",
        explanation:
          "Thin, medium, quad, and double-quad spaces express deliberate visual separation.",
      },
      {
        key: "operator-name",
        title: "Custom operator name",
        formula: "\\operatorname{rank}(A)=n",
        explanation:
          "Operator names render upright and receive the same spacing as built-in operators.",
      },
    ],
  ),
  deck(
    "colors-emphasis",
    "11 · Colors and emphasis",
    "Color, boxes, and typographic emphasis without executable markup.",
    [
      {
        key: "color",
        title: "Colored expression",
        formula: "\\color{#315da8}{x^2+y^2}",
        explanation:
          "The color command applies a literal color to its grouped expression.",
        note: "Use color sparingly and never as the only carrier of meaning; both themes must remain legible.",
      },
      {
        key: "boxed",
        title: "Boxed result",
        formula: "\\boxed{x=42}",
        explanation:
          "The boxed command draws attention to a final result without requiring HTML.",
      },
      {
        key: "bold",
        title: "Bold mathematical symbols",
        formula: "\\mathbf{A}\\boldsymbol{\\alpha}",
        explanation:
          "Use mathbf for Latin symbols and boldsymbol when a bold Greek symbol is needed.",
      },
    ],
  ),
  deck(
    "multiline",
    "12 · Multiline formulas",
    "Aligned derivations, cases, and arrays.",
    [
      {
        key: "aligned",
        title: "Aligned derivation",
        formula:
          "\\begin{aligned}(a+b)^2&=a^2+2ab+b^2\\\\&=a(a+2b)+b^2\\end{aligned}",
        explanation:
          "Ampersands mark the alignment point and a double backslash starts the next line.",
      },
      {
        key: "cases",
        title: "Cases with text",
        formula:
          "|x|=\\begin{cases}x&\\text{if }x\\ge0\\\\-x&\\text{if }x<0\\end{cases}",
        explanation:
          "Cases combine aligned expressions with readable conditions.",
      },
      {
        key: "array",
        title: "Array with column alignment",
        formula: "\\begin{array}{rcl}a&=&b+c\\\\x+y&=&z\\end{array}",
        explanation:
          "The array preamble chooses right, center, or left alignment for each column.",
      },
    ],
  ),
  deck(
    "commands-macros",
    "13 · Commands and macros",
    "Command arguments, readable overlap helpers, and macro boundaries.",
    [
      {
        key: "arguments",
        title: "Command arguments",
        formula: "\\overbrace{a+b+c}^{\\text{three terms}}",
        explanation:
          "Commands consume the following brace group as an argument; some commands accept more than one.",
      },
      {
        key: "readability-macro",
        title: "Readable overlap helper",
        formula: "\\sum_{\\mathclap{1\\le i\\le n}}x_i",
        explanation:
          "Flash-n-Flip provides readability-safe forms of mathclap, mathllap, and mathrlap so labels do not collapse into each other.",
      },
      {
        key: "custom-macros",
        title: "Custom macro boundary",
        formula: "f(x)=x^2",
        explanation:
          "Macros configured in the KaTeX demo are not part of the formula itself. Write the expanded expression in Flash-n-Flip unless the command is explicitly supported.",
        note: "For example, a demo macro named \\f is local to that demo configuration and is not imported into a card.",
      },
    ],
  ),
  deck(
    "flash-n-flip",
    "14 · Flash-n-Flip tables and clozes",
    "KaTeX inside wiki tables, cloze answers, and alternatives.",
    [
      {
        key: "table",
        title: "Formula in a wiki table",
        formula: "x^2+y^2=z^2",
        explanation:
          "A formula wrapped in dollar signs can be placed in any Flash-n-Flip wiki-table cell.",
        note: "Example row: `| Result | $x^2+y^2=z^2$ |`",
      },
      {
        key: "cloze",
        title: "Formula choices in a cloze",
        formula: "x^2",
        explanation:
          "The first formula is the correct choice; later formulas are distractors shown in random order.",
        note: "Example: `{{$x^2$|$x^0$|$2x$}}`",
      },
      {
        key: "math-bar",
        title: "A bar inside a formula choice",
        formula: "P(A|B)",
        explanation:
          "A vertical bar inside dollar-delimited mathematics stays part of the formula and is not treated as a cloze-choice separator.",
        note: "Example: `{{$P(A|B)$|$P(A\\cap B)$}}`",
      },
    ],
  ),
  deck(
    "errors-limitations",
    "15 · Common errors and limitations",
    "Diagnosing delimiters, grouping mistakes, and unsupported commands.",
    [
      {
        key: "missing-group",
        title: "Group multi-character indices",
        formula: "x^{10}\\ne x^10",
        explanation:
          "Without braces only the next token belongs to a superscript or subscript.",
      },
      {
        key: "delimiter",
        title: "Match delimiters",
        formula: "\\left(\\frac{a}{b}\\right)",
        explanation:
          "Every left delimiter needs a corresponding right delimiter; scalable delimiters should be paired.",
      },
      {
        key: "unsupported",
        title: "Keep formulas declarative",
        formula: "\\mathrm{safe\\ formula}",
        explanation:
          "Unknown or unsafe commands are not executed. Use a supported KaTeX command or write the intended content as text.",
        note: "Flash-n-Flip disables trusted HTML-like commands and limits expansion and formula size.",
      },
    ],
  ),
];

export const createKatexReferenceDeckSeeds = (): KatexReferenceDeckSeed[] => {
  const root: KatexReferenceDeckSeed = {
    key: katexReferenceTemplateKey,
    title: "KaTeX Developer Reference",
    description:
      "A structured formula reference with rendered examples, source syntax, explanations, and Flash-n-Flip integration notes.",
    parentKey: null,
    cards: [],
  };
  return [
    root,
    ...referenceDecks.map((item) => ({
      key: `${katexReferenceTemplateKey}:${item.key}`,
      title: item.title,
      description: item.description,
      parentKey: root.key,
      cards: item.cards.map((card) => ({
        key: card.key,
        front: emptyContent(),
        back: explanationContent(card),
      })),
    })),
  ];
};

export const katexReferenceDeckCount = referenceDecks.length;
export const katexReferenceCardCount = referenceDecks.reduce(
  (total, item) => total + item.cards.length,
  0,
);
