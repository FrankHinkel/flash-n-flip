import type { CardContent } from "@flashcards/domain/content";

export const katexReferenceTemplateKey = "developer:katex-reference:v1";

type ReferenceCardSpec = {
  key: string;
  title: string;
  formula: string;
  source?: string;
  buildsOn?: string;
  syntax?: string[];
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

const referencePromptContent = (card: ReferenceCardSpec): CardContent => ({
  blocks: [
    {
      type: "markdown",
      revealMode: "ALL",
      source: [
        `## ${card.title}`,
        "Open the answer to view the rendered formula, its KaTeX source, and an explanation.",
      ].join("\n\n"),
    },
  ],
});

const defaultSyntaxSteps = (card: ReferenceCardSpec): string[] => [
  "Read the source from left to right and first identify commands beginning with a backslash.",
  "Match every opening brace with its closing brace; the enclosed source forms one command argument or index.",
  `Compare the source with the rendered ${card.title.toLowerCase()} and change one part at a time when adapting it.`,
];

const explanationContent = (card: ReferenceCardSpec): CardContent => ({
  blocks: [
    {
      type: "markdown",
      revealMode: "ALL",
      source: [
        `## ${card.title}`,
        `$$\n${card.formula}\n$$`,
        `### Source\n\n\`\`\`latex\n${card.source ?? card.formula}\n\`\`\``,
        `### Builds on\n\n${card.buildsOn ?? "No previous KaTeX command is required for this card."}`,
        `### Syntax, step by step\n\n${(card.syntax ?? defaultSyntaxSteps(card)).map((step) => `- ${step}`).join("\n")}`,
        `### What it shows\n\n${card.explanation}`,
        ...(card.note ? [`### Flash-n-Flip note\n\n${card.note}`] : []),
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
        source: "$a^2+b^2=c^2$",
        syntax: [
          "A single `$` starts inline mathematics and the closing `$` returns to normal text.",
          "The caret in `a^2` applies the following token, `2`, as a superscript.",
          "Ordinary characters such as `+` and `=` may be written directly.",
        ],
        explanation:
          "Use inline mathematics when a short formula belongs inside a sentence. The delimiters decide where mathematics starts and ends; they are not part of the rendered formula.",
      },
      {
        key: "display",
        title: "Display formula",
        formula: "a+b=c",
        source: "$$\na+b=c\n$$",
        buildsOn:
          "Inline formula: mathematical delimiters and ordinary symbols.",
        syntax: [
          "A pair of dollar signs, `$$`, starts a display-math block; another pair closes it.",
          "Put the delimiters on their own lines so the formula remains readable in Markdown source.",
          "The formula is centered on a separate line instead of flowing inside a sentence.",
        ],
        explanation:
          "Display mathematics is intended for an important or longer expression that should stand on its own. This introductory example deliberately uses no commands that have not been explained yet.",
      },
      {
        key: "grouping",
        title: "Grouping arguments",
        formula: "x^{n+1}+a_{i,j}",
        buildsOn: "Inline formula: the caret introduces a superscript.",
        syntax: [
          "Braces `{...}` combine several source tokens into one argument and are not rendered.",
          "`^{n+1}` places the whole group `n+1` in the superscript.",
          "`_{i,j}` places the whole group `i,j` in the subscript.",
        ],
        explanation:
          "Without braces, `^` and `_` affect only the next token. Grouping is therefore the foundation for fractions, roots, limits, colors, and most other KaTeX commands used later in this course.",
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
        buildsOn:
          "Fundamentals: ordinary symbols and grouped command arguments.",
        syntax: [
          "A backslash starts a named KaTeX command.",
          "`\\le`, `\\ne`, and `\\approx` render ≤, ≠, and ≈ with relation spacing.",
          "A command name ends before the following space or non-letter token.",
        ],
        explanation:
          "Use relation commands when comparing the expression on their left with the expression on their right. KaTeX supplies spacing appropriate for mathematical relations.",
      },
      {
        key: "binary",
        title: "Binary operators",
        formula: "a\\cdot b\\times c\\div d",
        buildsOn: "Relations: a backslash starts a named command.",
        syntax: [
          "`\\cdot` renders a centered multiplication dot.",
          "`\\times` renders × and `\\div` renders ÷.",
          "Each operator combines the expression before it with the expression after it.",
        ],
        explanation:
          "Choose the operator that communicates the intended operation rather than copying a visually similar text glyph. This keeps spacing and meaning consistent.",
      },
      {
        key: "named",
        title: "Named operators",
        formula: "\\sin(x)+\\log(y)+\\max(S)",
        buildsOn: "Relations: named commands and Fundamentals: grouping.",
        syntax: [
          "`\\sin`, `\\log`, and `\\max` are built-in operator names.",
          "The following parentheses contain the value or expression on which the operator acts.",
          "KaTeX renders operator names upright, unlike ordinary italic variables.",
        ],
        explanation:
          "Use built-in names for standard functions so readers can distinguish an operator such as sine from a product of variables named s, i, and n.",
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
        buildsOn: "Fundamentals: braces group complete command arguments.",
        syntax: [
          "`\\frac` consumes two brace groups in order: numerator, then denominator.",
          "In `\\frac{x+1}{...}`, `x+1` is the complete numerator.",
          "The denominator contains another `\\frac`, demonstrating that command arguments may be nested.",
        ],
        explanation:
          "A fraction command always needs both arguments. Read the source from left to right and match each opening brace with its closing brace before interpreting nested content.",
      },
      {
        key: "root",
        title: "Indexed root",
        formula: "\\sqrt[n]{x^m}",
        buildsOn: "Fundamentals: grouping and superscripts.",
        syntax: [
          "`\\sqrt{...}` places its required brace argument under a radical.",
          "The optional square-bracket argument `[n]` sets the root index.",
          "Inside the radicand, `x^m` applies the superscript `m` to `x`.",
        ],
        explanation: "An optional square-bracket argument sets the root index.",
      },
      {
        key: "power",
        title: "Combined indices",
        formula: "x_i^{n+1}",
        buildsOn: "Fundamentals: grouped superscripts and subscripts.",
        syntax: [
          "`_i` attaches the single-token subscript `i` to `x`.",
          "`^{n+1}` attaches the grouped superscript `n+1` to the same base.",
          "Subscript and superscript may appear in either source order.",
        ],
        explanation:
          "Both indices belong to the same base symbol. Use braces whenever an index contains more than one token, even when a one-token index would work without them.",
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
        buildsOn:
          "Fundamentals: grouping. This card introduces environment rows and columns.",
        syntax: [
          "`\\begin{bmatrix}` opens a matrix with square brackets; `\\end{bmatrix}` closes it.",
          "Each `&` separates two cells in the same row.",
          "Each `\\\\` ends the current row and starts the next one.",
          "Both rows must contain the same number of column entries.",
        ],
        explanation:
          "The source describes a two-by-two matrix: `a` and `b` form the first row, while `c` and `d` form the second. The ampersands and line break are structural separators and are not rendered as characters.",
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
        buildsOn:
          "Matrices: `&` separates aligned cells and `\\\\` starts a new row.",
        syntax: [
          "`\\begin{aligned}` opens an alignment environment and `\\end{aligned}` closes it.",
          "The `&` before each equals sign marks the shared horizontal alignment point.",
          "`\\\\` ends the first derivation line; the second line begins with `&` so its equals sign uses the same alignment point.",
        ],
        explanation:
          "Use `aligned` for derivation steps that should line up at a relation such as `=`. The alignment marker belongs in the source only; it tells KaTeX where columns meet.",
      },
      {
        key: "cases",
        title: "Cases with text",
        formula:
          "|x|=\\begin{cases}x&\\text{if }x\\ge0\\\\-x&\\text{if }x<0\\end{cases}",
        buildsOn:
          "Matrices: row and column separators; Text inside mathematics: `\\text{...}`.",
        syntax: [
          "`\\begin{cases}` opens a piecewise layout with a left brace.",
          "On each row, `&` separates the mathematical value from its condition.",
          "`\\text{if }` inserts readable words and preserves the trailing space inside its braces.",
          "`\\\\` starts the second case and `\\end{cases}` closes the environment.",
        ],
        explanation:
          "Each row defines one result and the condition under which it applies. Keeping the condition in a separate aligned column makes the piecewise rule easier to scan.",
      },
      {
        key: "array",
        title: "Array with column alignment",
        formula: "\\begin{array}{rcl}a&=&b+c\\\\x+y&=&z\\end{array}",
        buildsOn:
          "Matrices: `&` separates columns and `\\\\` starts a new row.",
        syntax: [
          "`\\begin{array}{rcl}` opens an array and declares three columns.",
          "In `{rcl}`, `r` means right-aligned, `c` centered, and `l` left-aligned.",
          "Each `&` moves to the next declared column: left expression, equals sign, then right expression.",
          "`\\\\` starts the second row, and `\\end{array}` closes the array.",
        ],
        explanation:
          "The first row places `a`, `=`, and `b+c` into the three columns; the second does the same with `x+y`, `=`, and `z`. The column declaration and separators control layout and do not appear in the rendered formula.",
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
        front: referencePromptContent(card),
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
