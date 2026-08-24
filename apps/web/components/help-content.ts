export type HelpLocale = "en" | "de";

type LocalizedText = Record<HelpLocale, string>;

export type HelpSection = {
  heading: LocalizedText;
  paragraphs?: LocalizedText[];
  steps?: LocalizedText[];
  bullets?: LocalizedText[];
  code?: string[];
  links?: Array<{
    label: LocalizedText;
    href: string;
  }>;
};

export type HelpTopic = {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  keywords: string[];
  sections: HelpSection[];
};

export const helpTopics: HelpTopic[] = [
  {
    id: "getting-started",
    title: { en: "Getting started", de: "Erste Schritte" },
    summary: {
      en: "Create or import a deck and start your first study session.",
      de: "Erstelle oder importiere ein Lernset und beginne deine erste Lernrunde.",
    },
    keywords: ["start", "overview", "dashboard", "anfang", "übersicht"],
    sections: [
      {
        heading: { en: "Your first session", de: "Deine erste Lernrunde" },
        steps: [
          {
            en: "Open Decks and select New deck, or import an existing Anki package.",
            de: "Öffne Lernsets und wähle Neues Lernset oder importiere ein vorhandenes Anki-Paket.",
          },
          {
            en: "Add at least one question card, cloze card, or explanation.",
            de: "Füge mindestens eine Fragekarte, einen Lückentext oder eine Erläuterung hinzu.",
          },
          {
            en: "Select the deck in Decks to open it directly in Study.",
            de: "Wähle das Lernset unter Lernsets aus, um es direkt in Lernen zu öffnen.",
          },
          {
            en: "Reveal the answer and rate how well you remembered it.",
            de: "Decke die Antwort auf und bewerte, wie gut du dich erinnert hast.",
          },
        ],
      },
      {
        heading: { en: "Where your data lives", de: "Wo deine Daten liegen" },
        paragraphs: [
          {
            en: "Signed-in devices synchronize decks and learning progress with your account. Pending reviews are kept locally until they can be synchronized.",
            de: "Angemeldete Geräte synchronisieren Lernsets und Lernfortschritt mit deinem Konto. Ausstehende Wiederholungen bleiben lokal gespeichert, bis sie synchronisiert werden können.",
          },
        ],
      },
    ],
  },
  {
    id: "decks-and-collections",
    title: { en: "Decks and collections", de: "Lernsets und Collections" },
    summary: {
      en: "Organize content hierarchically and control what appears while studying.",
      de: "Ordne Inhalte hierarchisch und bestimme, was beim Lernen erscheint.",
    },
    keywords: [
      "deck",
      "collection",
      "hierarchy",
      "learning plan",
      "hide",
      "trash",
      "lernset",
      "sammlung",
      "lernplan",
      "papierkorb",
      "reference",
      "referenz",
      "git",
      "docker",
      "kubernetes",
    ],
    sections: [
      {
        heading: { en: "Hierarchy", de: "Hierarchie" },
        paragraphs: [
          {
            en: "A deck can contain cards and any number of subdecks. Collections and parent decks aggregate the card counts and progress of their descendants.",
            de: "Ein Lernset kann Karten und beliebig viele Unterdecks enthalten. Collections und übergeordnete Lernsets fassen Kartenanzahl und Fortschritt ihrer Unterelemente zusammen.",
          },
        ],
        bullets: [
          {
            en: "Use the parent-deck selector while creating or editing a deck.",
            de: "Nutze beim Erstellen oder Bearbeiten die Auswahl Übergeordnetes Lernset.",
          },
          {
            en: "Drag cards in the editor to change their sequence.",
            de: "Ziehe Karten im Editor, um ihre Reihenfolge zu ändern.",
          },
          {
            en: "Hidden decks are excluded from deck lists and All decks study sessions.",
            de: "Ausgeblendete Lernsets werden aus Lernset-Listen und aus Alle Lernsets ausgeschlossen.",
          },
        ],
      },
      {
        heading: { en: "Deck actions", de: "Lernset-Aktionen" },
        paragraphs: [
          {
            en: "Use the graduation cap next to a deck to add it and its subdecks to the learning plan. Open the three-dot menu to edit, hide, or move it to the trash. Trashed personal decks can be restored before they are permanently deleted.",
            de: "Mit der Abschlusskappe neben einem Lernset nimmst du es samt Unterdecks in den Lernplan auf. Im Drei-Punkte-Menü kannst du es bearbeiten, ausblenden oder in den Papierkorb verschieben. Eigene Lernsets können vor dem endgültigen Löschen wiederhergestellt werden.",
          },
        ],
      },
      {
        heading: {
          en: "Curated developer references",
          de: "Kuratierte Entwickler-Referenzen",
        },
        paragraphs: [
          {
            en: "Discover offers one installable English Developer Reference Library with categorized references for 21 technologies: KaTeX, Git, Docker, Kubernetes, CMD, PowerShell, Bash/Zsh, Linux, SSH/SCP/rsync, pip3, Composer, npm/pnpm/Yarn, SQL, PostgreSQL, XPath, JSONPath, jq, YAML, HTTP/cURL, regular expressions, and GitHub Actions. Each tool reference contains Introduction, Advanced, and Practical Samples decks. References open directly on their content without a question filler page and provide Previous and Next controls. Updating the library keeps existing card identities and personal progress. Long reference content scrolls inside the card while the page header and navigation controls stay visible.",
            de: "Unter Entdecken findest du eine installierbare englische Developer Reference Library mit kategorisierten Referenzen für 21 Technologien: KaTeX, Git, Docker, Kubernetes, CMD, PowerShell, Bash/Zsh, Linux, SSH/SCP/rsync, pip3, Composer, npm/pnpm/Yarn, SQL, PostgreSQL, XPath, JSONPath, jq, YAML, HTTP/cURL, reguläre Ausdrücke und GitHub Actions. Jede Werkzeugreferenz enthält die Lernsets Introduction, Advanced und Practical Samples. Referenzen öffnen direkt mit ihrem Inhalt ohne vorgeschaltete Frage-Füllseite und bieten Zurück- und Weiter-Schaltflächen. Beim Aktualisieren der Bibliothek bleiben Karten-Identitäten und dein persönlicher Lernfortschritt erhalten. Lange Referenzinhalte scrollen innerhalb der Karte, während Seitenkopf und Navigation sichtbar bleiben.",
          },
          {
            en: "References are not included in scheduled sessions or Practice all runs. Open the reference library explicitly to browse it in practice mode; moving backward or forward does not change your learning progress. Updating a collection refreshes its authored content without duplicating decks or replacing existing progress.",
            de: "Referenzen sind weder Teil geplanter Lerndurchläufe noch von Alle üben. Öffne die Referenzbibliothek ausdrücklich, um sie im unbewerteten Referenzmodus durchzublättern; Vorwärts und Zurück verändern deinen Lernfortschritt nicht. Beim Aktualisieren wird der redaktionelle Inhalt ohne doppelte Lernsets und ohne Ersetzen vorhandenen Fortschritts erneuert.",
          },
        ],
      },
    ],
  },
  {
    id: "cards-and-markdown",
    title: {
      en: "Cards, Markdown, and clozes",
      de: "Karten, Markdown und Lückentexte",
    },
    summary: {
      en: "Format questions and create interactive clozes with a compact syntax.",
      de: "Formatiere Fragen und erstelle interaktive Lückentexte mit einer kompakten Syntax.",
    },
    keywords: [
      "markdown",
      "cloze",
      "blank",
      "choice",
      "lücke",
      "lückentext",
      "antwort",
      "format",
      "editor",
      "aufdecken",
    ],
    sections: [
      {
        heading: {
          en: "Using the card editor",
          de: "Den Karteneditor verwenden",
        },
        paragraphs: [
          {
            en: "Enter the prompt on the question side and the solution or explanation on the answer side. While typing, the opposite side becomes a live preview; select it to return to editing.",
            de: "Trage die Aufgabe auf der Frageseite und die Lösung oder Erläuterung auf der Antwortseite ein. Während der Eingabe wird die jeweils andere Seite als Live-Vorschau angezeigt; wähle sie aus, um weiterzubearbeiten.",
          },
          {
            en: "Cloze reveal controls whether all blanks are revealed together or one after another. Automatic uses numbered blanks sequentially and unnumbered blanks together. A cloze card can stay without a separate answer; a card without a question is treated as an unrated explanation.",
            de: "Lücken aufdecken bestimmt, ob alle Lücken gemeinsam oder nacheinander aufgedeckt werden. Automatisch verwendet nummerierte Lücken nacheinander und unnummerierte gemeinsam. Eine Lückentextkarte kann ohne separate Antwort bleiben; eine Karte ohne Frage gilt als unbewertete Erläuterung.",
          },
        ],
      },
      {
        heading: { en: "Markdown basics", de: "Markdown-Grundlagen" },
        bullets: [
          {
            en: "# Heading 1, ## Heading 2",
            de: "# Überschrift 1, ## Überschrift 2",
          },
          {
            en: "**bold**, *italic*, ~~struck~~",
            de: "**fett**, *kursiv*, ~~durchgestrichen~~",
          },
          {
            en: "- unordered or 1. ordered lists",
            de: "- ungeordnete oder 1. geordnete Listen",
          },
          {
            en: "[label](https://example.org) for links",
            de: "[Beschriftung](https://example.org) für Links",
          },
        ],
      },
      {
        heading: { en: "Cloze syntax", de: "Lückentext-Syntax" },
        paragraphs: [
          {
            en: "The first value is always correct. Other values are shuffled answer choices. Explicit position numbers must be unique within a card.",
            de: "Der erste Wert ist immer richtig. Weitere Werte werden als Antwortvorschläge gemischt. Explizite Positionsnummern müssen innerhalb einer Karte eindeutig sein.",
          },
        ],
        code: [
          "{{hund}}",
          "{{hund|katze|maus}}",
          "{{1:hund|katze|maus}}",
          "{{hund|+4}}",
          "{{hund|katze|maus|+2}}",
          "{{$x^2$|$x^0$}}",
        ],
        bullets: [
          {
            en: "{{hund}} reveals the word without answer choices.",
            de: "{{hund}} deckt das Wort ohne Antwortauswahl auf.",
          },
          {
            en: "{{1:hund|katze}} fixes this cloze at position 1.",
            de: "{{1:hund|katze}} legt diese Lücke auf Position 1 fest.",
          },
          {
            en: "+N mixes in up to N answers from other clozes on the same card.",
            de: "+N mischt bis zu N Antworten aus anderen Lücken derselben Karte hinzu.",
          },
          {
            en: "Inline KaTeX can be used for the correct answer and every alternative, for example {{$x^2$|$x^0$}}.",
            de: "Inline-KaTeX kann für die richtige Antwort und alle Alternativen verwendet werden, zum Beispiel {{$x^2$|$x^0$}}.",
          },
        ],
      },
      {
        heading: {
          en: "Wiki tables and cell formatting",
          de: "Wiki-Tabellen und Zellformatierung",
        },
        paragraphs: [
          {
            en: "Table cells support clozes, inline formulas, links, and a small safe subset of DokuWiki formatting. Escape a literal column separator as \\|.",
            de: "Tabellenzellen unterstützen Lückentexte, Inline-Formeln, Links und eine kleine sichere Auswahl der DokuWiki-Formatierung. Ein wörtlicher Spaltentrenner wird als \\| geschrieben.",
          },
        ],
        code: [
          "^ Heading ^ Example ^",
          "^ Singular ^^\n|ich | {{gehe|gehst}}|\n|du | {{gehst|gehe}}|",
          "^ Singular |ich | {{bin|bist}}|\n| ::: |du | {{bist|bin}}|",
          "|left aligned   |\n|   right aligned|\n|   centered   |",
          "| Bold | **important** |",
          "| Italic | //careful// |",
          "| Underlined | __central__ |",
          "| Code | ''a | b'' |",
          "| Formula | $\\frac{a}{b}$ |",
        ],
        bullets: [
          {
            en: "**text** is bold, //text// is italic, __text__ is underlined, and ''text'' is code.",
            de: "**Text** ist fett, //Text// ist kursiv, __Text__ ist unterstrichen und ''Text'' ist Code.",
          },
          {
            en: "Wiki formatting is intentionally limited to inline content inside a cell. Headings, lists, block quotes, and display formulas remain separate blocks outside the table.",
            de: "Wiki-Formatierung ist innerhalb einer Zelle bewusst auf Inline-Inhalte begrenzt. Überschriften, Listen, Zitate und abgesetzte Formeln bleiben eigene Blöcke außerhalb der Tabelle.",
          },
          {
            en: "Table rows start with ^ for headings or | for regular cells. ^^ spans columns, and ::: continues the cell above as a side heading. Spaces inside a cell control left, right, or centered alignment; cells are vertically centered.",
            de: "Tabellenzeilen beginnen mit ^ für Überschriften oder | für normale Zellen. ^^ verbindet Spalten und ::: führt die Zelle darüber als seitliche Überschrift fort. Leerzeichen innerhalb einer Zelle steuern linksbündige, rechtsbündige oder zentrierte Ausrichtung; Zellen werden vertikal zentriert.",
          },
        ],
      },
      {
        heading: {
          en: "Embed graphics and scores in tables",
          de: "Grafiken und Noten in Tabellen einbetten",
        },
        paragraphs: [
          {
            en: "Assign a Mermaid diagram, JSXGraph construction, or ABC score to a name by writing name=type after the opening fence. The definition stays hidden at that position. Insert it elsewhere on the same card side with ![[name]].",
            de: "Weise einem Mermaid-Diagramm, einer JSXGraph-Konstruktion oder einem ABC-Notensatz einen Namen zu, indem du nach dem öffnenden Zaun name=typ schreibst. Die Definition bleibt an dieser Stelle unsichtbar. Mit ![[name]] setzt du sie an anderer Stelle derselben Kartenseite ein.",
          },
        ],
        code: [
          '```g1=jsxgraph\ndescribe "Eine Gerade durch A und B."\nA = point(0, 0)\nB = point(2, 2)\ng = line(A, B)\n```\n\n^ Hier der Graph | ![[g1]] |',
          "```m1=mermaid\nflowchart LR\n  A --> B\n```\n\n^ Ablauf | ![[m1]] |",
          "```n1=abc\nX:1\nK:C\nC D E F | G4 |\n```\n\n^ Noten | ![[n1]] |",
        ],
        bullets: [
          {
            en: "Names start with a letter and may contain letters, numbers, underscores, and hyphens.",
            de: "Namen beginnen mit einem Buchstaben und dürfen Buchstaben, Zahlen, Unterstriche und Bindestriche enthalten.",
          },
          {
            en: "A definition may be embedded more than once, but every name may be defined only once per card side.",
            de: "Eine Definition darf mehrfach eingebettet, jeder Name pro Kartenseite aber nur einmal definiert werden.",
          },
          {
            en: "Without an assignment, ordinary ```mermaid, ```jsxgraph, ```abc, and ```music blocks continue to render directly where they are written.",
            de: "Ohne Zuweisung werden normale ```mermaid-, ```jsxgraph-, ```abc- und ```music-Blöcke weiterhin direkt an ihrer Schreibposition gerendert.",
          },
        ],
      },
      {
        heading: {
          en: "Mathematical formulas",
          de: "Mathematische Formeln",
        },
        paragraphs: [
          {
            en: "Flash-n-Flip renders KaTeX-compatible LaTeX. Use $...$ for an inline formula and $$ on separate lines around a display formula. Formulas in table cells must use the inline form.",
            de: "Flash-n-Flip rendert KaTeX-kompatibles LaTeX. Nutze $...$ für eine Formel im Text und $$ in eigenen Zeilen um eine abgesetzte Formel. In Tabellenzellen ist nur die Inline-Form erlaubt.",
          },
          {
            en: "Chemical formulas, equations, and physical units use the bundled mhchem extension with \\ce{...} and \\pu{...}.",
            de: "Chemische Formeln, Reaktionsgleichungen und physikalische Einheiten nutzen die integrierte mhchem-Erweiterung mit \\ce{...} und \\pu{...}.",
          },
        ],
        code: [
          "$x^2 + y^2 = z^2$",
          "$\\frac{a}{b}$",
          "$\\sqrt{x}$",
          "$\\sum_{i=1}^{n} i$",
          "$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$",
          "$\\ce{2 H2 + O2 -> 2 H2O}$",
          "$\\pu{1.23e4 J mol-1}$",
        ],
        bullets: [
          {
            en: "For security, commands that require trusted HTML, external URLs, or script execution are disabled.",
            de: "Aus Sicherheitsgründen sind Befehle deaktiviert, die vertrauenswürdiges HTML, externe URLs oder Skriptausführung benötigen.",
          },
          {
            en: "Zero-width overlap commands such as \\mathclap, \\mathllap, and \\mathrlap are rendered as normal groups so symbols remain legible on cards.",
            de: "Nullbreiten-Befehle wie \\mathclap, \\mathllap und \\mathrlap werden als normale Gruppen dargestellt, damit sich Zeichen auf Karten nicht überlagern.",
          },
        ],
        links: [
          {
            label: {
              en: "KaTeX supported functions",
              de: "Von KaTeX unterstützte Funktionen",
            },
            href: "https://katex.org/docs/supported",
          },
          {
            label: {
              en: "KaTeX function support table",
              de: "KaTeX-Kompatibilitätstabelle",
            },
            href: "https://katex.org/docs/support_table.html",
          },
        ],
      },
      {
        heading: {
          en: "Question, answer, or explanation",
          de: "Frage, Antwort oder Erläuterung",
        },
        paragraphs: [
          {
            en: "A cloze card does not require a separate back. A card without a question is treated as an explanation and advances without a learning rating.",
            de: "Eine Lückentextkarte benötigt keine separate Rückseite. Eine Karte ohne Frage gilt als Erläuterung und wird ohne Lernbewertung weitergeschaltet.",
          },
        ],
      },
    ],
  },
  {
    id: "mermaid-diagrams",
    title: { en: "Mermaid diagrams", de: "Mermaid-Diagramme" },
    summary: {
      en: "Add locally rendered, accessible diagrams to either side of a card.",
      de: "Füge lokal gerenderte, zugängliche Diagramme auf beiden Kartenseiten ein.",
    },
    keywords: [
      "mermaid",
      "diagram",
      "flowchart",
      "sequence",
      "state",
      "mindmap",
      "flussdiagramm",
      "sequenzdiagramm",
      "zustandsdiagramm",
    ],
    sections: [
      {
        heading: { en: "Create a diagram", de: "Ein Diagramm erstellen" },
        steps: [
          {
            en: "Enter a complete ```mermaid code block directly in the normal question or answer field.",
            de: "Gib einen vollständigen ```mermaid-Codeblock direkt in das normale Frage- oder Antwortfeld ein.",
          },
          {
            en: "The source remains unchanged in that field. The opposite live preview renders safe syntax directly as a diagram; incomplete or unsafe syntax remains inert code.",
            de: "Der Quelltext bleibt unverändert in diesem Feld. Die gegenüberliegende Live-Vorschau rendert sichere Syntax direkt als Diagramm; unvollständige oder unsichere Syntax bleibt harmloser Code.",
          },
          {
            en: "Keep the opening and closing triple backticks on their own lines and edit the Mermaid source in place.",
            de: "Setze die öffnenden und schließenden drei Backticks jeweils in eine eigene Zeile und bearbeite den Mermaid-Quelltext direkt an Ort und Stelle.",
          },
          {
            en: "Optionally add short display values to the opening line, for example ```mermaid{w=90% h=70% bg=#18212f80}.",
            de: "Ergänze in der öffnenden Zeile optional kurze Darstellungswerte, zum Beispiel ```mermaid{w=90% h=70% bg=#18212f80}.",
          },
        ],
        bullets: [
          {
            en: "Rendering happens only on the device; no diagram source is sent to an external service.",
            de: "Die Darstellung erfolgt ausschließlich auf dem Gerät; kein Diagrammquelltext wird an einen externen Dienst gesendet.",
          },
          {
            en: "Links, click callbacks, HTML, images, custom CSS, frontmatter, and init directives are rejected.",
            de: "Links, Klick-Callbacks, HTML, Bilder, eigenes CSS, Frontmatter und Init-Direktiven werden abgewiesen.",
          },
          {
            en: "w accepts 1–100%; h accepts 1–100% of the visible height or 120–1200px. bg accepts #RGB, #RGBA, #RRGGBB, or #RRGGBBAA; the final digit or byte controls alpha.",
            de: "w akzeptiert 1–100 %; h akzeptiert 1–100 % der sichtbaren Höhe oder 120–1200 px. bg akzeptiert #RGB, #RGBA, #RRGGBB oder #RRGGBBAA; das letzte Nibble beziehungsweise Byte steuert den Alphawert.",
          },
          {
            en: "Pan by dragging with a mouse or one finger. Zoom with the mouse wheel, trackpad, or a two-finger pinch; double-click or press 0 to reset. Arrow keys pan and plus/minus zoom when the diagram is focused.",
            de: "Verschiebe mit Maus oder einem Finger. Zoome mit Mausrad, Trackpad oder Zwei-Finger-Geste; Doppelklick oder Taste 0 setzt zurück. Bei fokussiertem Diagramm verschieben die Pfeiltasten, Plus und Minus zoomen.",
          },
        ],
      },
      {
        heading: { en: "Flowchart example", de: "Beispiel: Flussdiagramm" },
        code: [
          "flowchart LR\n  glucose[Glucose] --> glycolysis[Glykolyse]\n  glycolysis --> pyruvate[Pyruvat]",
        ],
      },
      {
        heading: {
          en: "Sequence diagram example",
          de: "Beispiel: Sequenzdiagramm",
        },
        code: [
          "sequenceDiagram\n  participant L as Lernende Person\n  participant F as Flash-n-Flip\n  L->>F: Antwort aufdecken\n  F-->>L: Bewertung anbieten",
        ],
      },
      {
        heading: {
          en: "State diagram example",
          de: "Beispiel: Zustandsdiagramm",
        },
        code: [
          "stateDiagram-v2\n  [*] --> Neu\n  Neu --> Lernen\n  Lernen --> Wiederholen\n  Wiederholen --> Lernen",
        ],
      },
      {
        heading: { en: "Mind map example", de: "Beispiel: Mindmap" },
        code: [
          "mindmap\n  root((Biologie))\n    Zelle\n      Zellkern\n      Membran\n    Stoffwechsel\n      Glykolyse",
        ],
      },
    ],
  },
  {
    id: "jsxgraph-graphs",
    title: {
      en: "Interactive graphs (JSXGraph)",
      de: "Interaktive Graphen (JSXGraph)",
    },
    summary: {
      en: "Create interactive 2D geometry and function plots with a readable, locally evaluated notation.",
      de: "Erstelle interaktive 2D-Geometrie und Funktionsgraphen mit einer lesbaren, lokal ausgewerteten Notation.",
    },
    keywords: [
      "jsxgraph",
      "jxg",
      "graph",
      "geometry",
      "function",
      "slider",
      "geometrie",
      "funktion",
      "schieberegler",
    ],
    sections: [
      {
        heading: {
          en: "Write directly in the card",
          de: "Direkt in die Karte schreiben",
        },
        steps: [
          {
            en: "Enter a complete ```jsxgraph code block in the normal question or answer field. There is no secondary editor.",
            de: "Gib einen vollständigen ```jsxgraph-Codeblock in das normale Frage- oder Antwortfeld ein. Es gibt keinen Zusatzeditor.",
          },
          {
            en: "Add one quoted describe line. It is required so the construction remains understandable without sight.",
            de: "Füge eine in Anführungszeichen gesetzte describe-Zeile ein. Sie ist erforderlich, damit die Konstruktion auch ohne Sicht verständlich bleibt.",
          },
          {
            en: "Use drag=true for movable points. Pan with Shift plus mouse drag, zoom with Shift plus the wheel, or use a two-finger gesture on touch screens.",
            de: "Verwende drag=true für bewegliche Punkte. Verschiebe mit Umschalttaste und Maus, zoome mit Umschalttaste und Mausrad oder nutze auf Touchscreens eine Zwei-Finger-Geste.",
          },
        ],
        bullets: [
          {
            en: "The optional opening values w, h, and bg work like Mermaid, for example ```jsxgraph{w=90% h=70% bg=#18212f80}.",
            de: "Die optionalen Werte w, h und bg in der öffnenden Zeile funktionieren wie bei Mermaid, zum Beispiel ```jsxgraph{w=90% h=70% bg=#18212f80}.",
          },
          {
            en: "Supported 2D objects include points, lines, segments, rays, arrows, circles, polygons, angles, arcs, sectors, intersections, parallels, perpendiculars, gliders, conics, tangents, normals, reflections, sliders, function/parametric/polar/implicit curves, inequalities, integrals, Riemann sums, vector fields, and slope fields.",
            de: "Unterstützte 2D-Objekte sind unter anderem Punkte, Geraden, Strecken, Strahlen, Pfeile, Kreise, Polygone, Winkel, Bögen, Sektoren, Schnittpunkte, Parallelen, Senkrechten, Gleiter, Kegelschnitte, Tangenten, Normalen, Spiegelungen, Schieberegler, Funktions-, Parameter-, Polar- und implizite Kurven, Ungleichungen, Integrale, Riemann-Summen, Vektor- und Richtungsfelder.",
          },
          {
            en: "Only the documented notation is evaluated. JavaScript, HTML, links, external data, images, event handlers, and every 3D object are rejected and shown as inert source.",
            de: "Ausgewertet wird nur die dokumentierte Notation. JavaScript, HTML, Links, externe Daten, Bilder, Ereignisbehandler und sämtliche 3D-Objekte werden abgewiesen und als harmloser Quelltext angezeigt.",
          },
        ],
      },
      {
        heading: { en: "Interactive geometry", de: "Interaktive Geometrie" },
        code: [
          'title "Mittelsenkrechte"\ndescribe "Die beweglichen Punkte A und B bestimmen eine Strecke, ihren Mittelpunkt und die Senkrechte durch den Mittelpunkt."\nboard x=-6..6 y=-4..4 axes grid aspect=1\nA = point(-3, -1, drag=true, color=blue)\nB = point(3, 2, drag=true, color=yellow)\ns = segment(A, B)\nM = midpoint(A, B, color=red)\nn = perpendicular(s, M, color=green)',
        ],
      },
      {
        heading: {
          en: "Function family with slider",
          de: "Funktionsschar mit Schieberegler",
        },
        code: [
          'title "Quadratische Funktion"\ndescribe "Der Schieberegler a verändert die Öffnung der Parabel y gleich a mal x zum Quadrat."\nboard x=-5..5 y=-4..6 axes grid\na = slider(-2, 2, value=1, step=0.1)\nf(x) = a*x^2\nplot(f, from=-5, to=5, color=blue, width=3)',
        ],
      },
      {
        heading: { en: "Curves and fields", de: "Kurven und Felder" },
        code: [
          'title "Parameterkurve und Richtungsfeld"\ndescribe "Eine dreiblättrige Parameterkurve liegt über einem Richtungsfeld."\nboard x=-4..4 y=-4..4 axes grid aspect=1\nparametric(t, 3*cos(t), 3*sin(t), from=0, to=2*pi, color=blue)\nslopefield(x, y, x-y, density=10, color=green, alpha=0.55)',
        ],
      },
    ],
  },
  {
    id: "music-notation",
    title: { en: "Music notation", de: "Notensatz" },
    summary: {
      en: "Render bounded ABC notation locally with abcjs.",
      de: "Rendere begrenzte ABC-Notation lokal mit abcjs.",
    },
    keywords: [
      "music",
      "abc",
      "abcjs",
      "notation",
      "score",
      "notes",
      "musik",
      "noten",
      "notensatz",
      "taktart",
      "tonart",
    ],
    sections: [
      {
        heading: { en: "Create a score", de: "Notensatz erstellen" },
        steps: [
          {
            en: "Open Music notation below the normal question or answer field, add a score, and enter its title, accessible description, and ABC source.",
            de: "Öffne unter dem normalen Frage- oder Antwortfeld den Notensatz, füge ein Notenbild hinzu und gib Titel, zugängliche Beschreibung und ABC-Quelltext ein.",
          },
          {
            en: "Start with X:1, add optional title, meter, note length, and tempo fields, then add K: and the notes.",
            de: "Beginne mit X:1, ergänze optional Titel, Taktart, Notenlänge und Tempo, dann K: und die Noten.",
          },
          {
            en: "The editor validates changes and shows a local preview. Existing fenced ```abc and ```music blocks in Markdown remain supported.",
            de: "Der Editor prüft Änderungen und zeigt eine lokale Vorschau. Vorhandene ```abc- und ```music-Blöcke im Markdown bleiben unterstützt.",
          },
          {
            en: "On cards, title, description, score metadata, and the event list stay hidden until you open the information button in the score.",
            de: "Auf Karten bleiben Titel, Beschreibung, Notensatz-Metadaten und Ereignisliste verborgen, bis du die Informationstaste im Notenblatt öffnest.",
          },
        ],
        bullets: [
          {
            en: "Rendering happens locally and offline; the ABC source is not sent to a service.",
            de: "Die Darstellung erfolgt lokal und offline; der ABC-Quelltext wird an keinen Dienst gesendet.",
          },
          {
            en: "Playback uses a bundled CC0 piano sample set. It starts only after pressing Play and does not load a remote Soundfont or use the microphone.",
            de: "Die Wiedergabe verwendet einen mitgelieferten CC0-Klavierklang. Sie startet erst nach einem Druck auf Wiedergabe, lädt keinen entfernten Soundfont und verwendet kein Mikrofon.",
          },
          {
            en: "Comments and supported import directives are removed inertly; unknown directives and fields, HTML, scripts, URLs, and external resources are rejected.",
            de: "Kommentare und unterstützte Importdirektiven werden inert entfernt; unbekannte Direktiven und Felder, HTML, Skripte, URLs und externe Ressourcen werden abgewiesen.",
          },
          {
            en: "Use chords such as [CEG] for simultaneous notes. Up to four independent ABC voices are supported, but a piano score normally uses the two staves RH and LH.",
            de: "Schreibe gleichzeitige Töne als Akkord, zum Beispiel [CEG]. Bis zu vier unabhängige ABC-Stimmen sind möglich; ein Klaviersatz verwendet normalerweise jedoch die zwei Systeme RH und LH.",
          },
          {
            en: "The synchronized 88-key keyboard flashes each attack at full strength and keeps the key highlighted at half strength for its notated duration. keyboard=notes shows note names, keyboard=keys only the keys, and keyboard=off hides it.",
            de: "Die synchronisierte 88-Tasten-Klaviatur zeigt jeden Anschlag zunächst kräftig und die Taste anschließend für ihre notierte Dauer mit halber Intensität. keyboard=notes zeigt Notennamen, keyboard=keys nur die Tasten und keyboard=off blendet sie aus.",
          },
          {
            en: "In standard piano notation the upper staff is usually played by the right hand and the lower staff by the left; hand crossings and exceptions are possible. FNF uses the declared treble and bass voices: dark blue marks the left hand and bright yellow marks the right hand, both in the score and on the keyboard.",
            de: "Im üblichen Klaviersatz spielt die rechte Hand meist das obere und die linke Hand das untere System; Handkreuzungen und Ausnahmen sind möglich. FNF orientiert sich an den deklarierten Violin- und Bassstimmen: Dunkles Blau markiert die linke, helles Gelb die rechte Hand – im Notenbild und auf der Klaviatur.",
          },
          {
            en: "The complete keyboard scales to the available width and never moves sideways. During playback it stays at the lower edge while the score area scrolls only when the active notes would otherwise leave view.",
            de: "Die vollständige Klaviatur skaliert auf die verfügbare Breite und bewegt sich nicht seitlich. Beim Abspielen bleibt sie am unteren Rand, während der Notenbereich nur dann nachführt, wenn die aktiven Noten sonst aus dem Sichtfeld geraten würden.",
          },
          {
            en: "Use A and B while stopped to set a temporary practice start and end at the current note. Navigation stays inside this range, and playback pauses automatically after the B note or at the end of the score. Press an active marker again to clear it.",
            de: "Setze im Stoppmodus mit A und B einen temporären Übungsanfang und ein Übungsende an der aktuellen Note. Die Navigation bleibt in diesem Bereich; nach der B-Note beziehungsweise am Stückende pausiert die Wiedergabe automatisch. Drücke eine aktive Markierung erneut, um sie zu löschen.",
          },
          {
            en: "Flute, guitar, violin and other instruments are planned as separate sound and learning views instead of reusing a piano keyboard.",
            de: "Flöte, Gitarre, Violine und weitere Instrumente sind als eigene Klang- und Lernansichten geplant, nicht als Varianten einer Klaviatur.",
          },
        ],
      },
      {
        heading: {
          en: "Compact Markdown options",
          de: "Kompakte Markdown-Optionen",
        },
        paragraphs: [
          {
            en: "Enable Continue without rating in the card editor when a question should show only Continue. The card then remains scheduler-neutral and does not write learning progress.",
            de: "Aktiviere im Karteneditor Ohne Bewertung fortfahren, wenn eine Frage nur Weiter zeigen soll. Die Karte bleibt dann planungsneutral und schreibt keinen Lernfortschritt.",
          },
          {
            en: "Add options directly to the opening fence, for example ```music{size=70% bars=auto select=RH keyboard=notes}. size accepts 50% to 120%; bars accepts auto or 1 to 12 measures per line; select shows and plays only the named ABC voice.",
            de: "Ergänze Optionen direkt am öffnenden Zaun, zum Beispiel ```music{size=70% bars=auto select=RH keyboard=notes}. size akzeptiert 50% bis 120 %; bars akzeptiert auto oder 1 bis 12 Takte pro Zeile; select zeigt und spielt nur die benannte ABC-Stimme.",
          },
        ],
      },
      {
        heading: { en: "C major example", de: "Beispiel: C-Dur" },
        code: [
          "X:1\nT:C major scale\nM:4/4\nL:1/4\nQ:120\nK:C clef=treble\nC D E F | G A B c |",
        ],
      },
      {
        heading: { en: "Bass clef example", de: "Beispiel: Bassschlüssel" },
        code: [
          "X:1\nT:Bass notes\nM:3/4\nL:1/4\nK:F clef=bass\nF, A, C | F2 z |",
        ],
      },
      {
        heading: {
          en: "Longer example: opening of Für Elise",
          de: "Längeres Beispiel: Anfang von Für Elise",
        },
        paragraphs: [
          {
            en: "A compact two-staff piano transcription with simultaneous notes. Copy the complete block into the ABC source field; use select=RH or select=LH to practise one hand.",
            de: "Eine kompakte Klavierübertragung auf zwei Systemen mit gleichzeitigen Tönen. Kopiere den vollständigen Block in das ABC-Feld; mit select=RH oder select=LH kannst du eine Hand üben.",
          },
        ],
        code: [
          "X:1\nT:Für Elise – Anfang\nM:3/8\nL:1/16\nQ:1/4=60\nV:RH clef=treble\nV:LH clef=bass\nK:Am\n[V:RH] z4 e ^d | e ^d e B d c |\n[V:RH] [EA]2 z C E A | [^GB]2 z E ^G B |\n[V:RH] [Ac]2 z E e ^d | e ^d e B d c |\n[V:RH] [EA]2 z C E A | [^GB]2 z E c B |\n[V:RH] [EA]2 z4 |\n[V:LH] z6 | z6 |\n[V:LH] [A,,E,]2 E,2 A,2 | [E,,B,,]2 B,,2 E,2 |\n[V:LH] [A,,E,]2 E,2 A,2 | z6 |\n[V:LH] [A,,E,]2 E,2 A,2 | [E,,B,,]2 B,,2 E,2 |\n[V:LH] [A,,E,]6 |",
        ],
      },
    ],
  },
  {
    id: "studying-and-ratings",
    title: { en: "Studying and ratings", de: "Lernen und Bewerten" },
    summary: {
      en: "Understand the study order, answer reveal, and rating buttons.",
      de: "Verstehe Lernreihenfolge, Antwortanzeige und Bewertungsbuttons.",
    },
    keywords: [
      "study",
      "rating",
      "again",
      "hard",
      "good",
      "easy",
      "lernen",
      "bewertung",
      "schwer",
      "leicht",
    ],
    sections: [
      {
        heading: { en: "Study order", de: "Lernreihenfolge" },
        paragraphs: [
          {
            en: "Sequential decks keep their defined card order. Other decks are mixed while still respecting the spaced-repetition schedule. Collections can interleave cards from their visible subdecks.",
            de: "Sequenzielle Lernsets behalten ihre festgelegte Kartenreihenfolge. Andere Lernsets werden unter Beachtung des Wiederholungsplans gemischt. Collections können Karten aus ihren sichtbaren Unterdecks abwechseln.",
          },
          {
            en: "The study header and the answer or navigation controls remain visible. If a card is longer than the available space, only its content area scrolls vertically.",
            de: "Der Kopfbereich sowie die Bewertungs- oder Navigationsschaltflächen bleiben beim Lernen sichtbar. Ist eine Karte länger als der verfügbare Platz, scrollt nur ihr Inhaltsbereich vertikal.",
          },
        ],
      },
      {
        heading: { en: "Ratings", de: "Bewertungen" },
        bullets: [
          {
            en: "Again: you did not remember the answer.",
            de: "Nochmal: Du konntest dich nicht erinnern.",
          },
          {
            en: "Hard: correct, but with considerable effort.",
            de: "Schwer: richtig, aber mit deutlicher Anstrengung.",
          },
          {
            en: "Good: correct with normal effort.",
            de: "Gut: richtig mit normalem Aufwand.",
          },
          {
            en: "Easy: immediately and confidently correct.",
            de: "Leicht: sofort und sicher richtig.",
          },
        ],
        paragraphs: [
          {
            en: "Incorrect cloze or map choices progressively disable overly positive ratings. Listening to an individual cloze choice counts as one hint and makes Easy unavailable. A correct first answer without a hint leaves the full rating range available.",
            de: "Falsche Lücken- oder Kartenauswahlen deaktivieren schrittweise zu positive Bewertungen. Das Anhören einer einzelnen Lückenauswahl zählt als ein Hinweis und sperrt Leicht. Bei einer sofort richtigen Antwort ohne Hinweis bleiben alle Bewertungen verfügbar.",
          },
        ],
      },
      {
        heading: {
          en: "Practice all and reset",
          de: "Alle üben und zurücksetzen",
        },
        paragraphs: [
          {
            en: "Practice all goes through every card without changing due dates. Reset progress deliberately starts the selected deck and its subdecks again.",
            de: "Alle üben geht jede Karte durch, ohne Fälligkeiten zu verändern. Fortschritt zurücksetzen startet das gewählte Lernset und seine Unterdecks bewusst neu.",
          },
        ],
      },
      {
        heading: {
          en: "Keep studying after today is complete",
          de: "Nach dem Tagesabschluss weiterlernen",
        },
        paragraphs: [
          {
            en: "When no cards are due, you can start another rated run filtered by each card’s most recent rating. Again, Hard and Good are selected by default; Easy is initially excluded. For example, leave only Again selected to repeat cards you last forgot. These additional ratings continue to update the regular learning schedule.",
            de: "Wenn keine Karten mehr fällig sind, kannst du einen weiteren bewerteten Durchlauf nach der jeweils letzten Einstufung starten. Nochmal, Schwer und Gut sind standardmäßig ausgewählt; Leicht ist zunächst ausgeschlossen. Lasse zum Beispiel nur Nochmal ausgewählt, um zuletzt vergessene Karten erneut zu lernen. Die zusätzlichen Bewertungen aktualisieren weiterhin den regulären Lernplan.",
          },
        ],
      },
    ],
  },
  {
    id: "interactive-maps",
    title: { en: "Interactive maps", de: "Interaktive Karten" },
    summary: {
      en: "Explore countries, practice recognition, and configure map information.",
      de: "Erkunde Länder, übe ihre Erkennung und konfiguriere Karteninformationen.",
    },
    keywords: [
      "map",
      "country",
      "capital",
      "region",
      "zoom",
      "overlay",
      "karte",
      "land",
      "hauptstadt",
      "bundesland",
    ],
    sections: [
      {
        heading: { en: "Explore and study", de: "Erkunden und lernen" },
        bullets: [
          {
            en: "Explore map shows information while hovering or selecting an entry in the country list.",
            de: "Erkunden zeigt Informationen beim Überfahren oder Auswählen eines Eintrags in der Länderliste.",
          },
          {
            en: "Level 1 highlights a region that you name.",
            de: "Stufe 1 hebt eine Region hervor, die du benennst.",
          },
          {
            en: "Level 2 shows a name and asks you to locate the region.",
            de: "Stufe 2 zeigt einen Namen und lässt dich die Region finden.",
          },
          {
            en: "In Card run, the speaker toggle reads the requested region in level 2 and the answer after reveal, so the map remains free for hovering, panning, and selection.",
            de: "Im Kartendurchlauf liest der Lautsprecher-Schalter in Stufe 2 die gesuchte Region und nach dem Aufdecken die Antwort vor. Die Karte bleibt dadurch frei zum Überfahren, Verschieben und Auswählen.",
          },
        ],
      },
      {
        heading: { en: "Map controls", de: "Kartensteuerung" },
        paragraphs: [
          {
            en: "Drag to pan and pinch or use the mouse wheel to zoom around the pointer position. Map gestures affect only the map. Open the cog menu to show or hide names, capitals, country lists, and available administrative levels.",
            de: "Ziehe zum Verschieben und zoome per Pinch oder Mausrad um die Zeigerposition. Kartengesten wirken nur auf die Karte. Im Zahnrad-Menü lassen sich Namen, Hauptstädte, Länderlisten und verfügbare Verwaltungsebenen ein- oder ausblenden.",
          },
        ],
      },
      {
        heading: { en: "Overlay layers", de: "Overlay-Ebenen" },
        paragraphs: [
          {
            en: "Available layers such as the European Union, NATO, or the Schengen Area can be toggled independently. Layer membership is shown in addition to the learning state, not as a replacement for it.",
            de: "Verfügbare Ebenen wie Europäische Union, NATO oder Schengenraum können unabhängig umgeschaltet werden. Die Zugehörigkeit wird zusätzlich zum Lernstatus dargestellt und ersetzt ihn nicht.",
          },
        ],
      },
    ],
  },
  {
    id: "import-export",
    title: { en: "Import and export", de: "Import und Export" },
    summary: {
      en: "Bring in Anki packages and create protected Flash-n-Flip exports.",
      de: "Importiere Anki-Pakete und erstelle geschützte Flash-n-Flip-Exporte.",
    },
    keywords: [
      "anki",
      "apkg",
      "import",
      "export",
      "download",
      "backup",
      "sicherung",
      "profile",
      "profil",
      "wiki",
    ],
    sections: [
      {
        heading: { en: "Anki import", de: "Anki-Import" },
        paragraphs: [
          {
            en: "Open Decks, choose Import, and select an APKG file with up to 256 MB and 50,000 cards. The progress display first shows the uploaded percentage and then the package processing. Decks from one package are grouped in a collection so the complete import can be managed together. Referenced speech audio is safely normalized and stored as compact AAC when beneficial; the original APKG remains unchanged. Import notices identify content that required conversion or could not be preserved.",
            de: "Öffne Lernsets, wähle Importieren und anschließend eine APKG-Datei mit maximal 256 MB und 50.000 Karten. Die Fortschrittsanzeige zeigt zuerst den übertragenen Anteil und danach die Verarbeitung des Pakets. Lernsets aus einem Paket werden in einer Collection zusammengefasst, damit der gesamte Import gemeinsam verwaltet werden kann. Referenzierte Sprachaufnahmen werden sicher normalisiert und bei Vorteil als kompaktes AAC gespeichert; das ursprüngliche APKG bleibt unverändert. Importhinweise nennen Inhalte, die umgewandelt wurden oder nicht erhalten werden konnten.",
          },
          {
            en: "Anki does not provide a dependable standardized source and target language. Select the initial question and answer languages before import. The direction applies to every imported deck and can be corrected per deck afterward under Language direction; choosing the same language marks one-language, non-translation content.",
            de: "Anki liefert keine verlässliche standardisierte Quell- und Zielsprache. Wähle deshalb vor dem Import die anfängliche Sprache der Fragen und Antworten. Die Richtung gilt zunächst für alle importierten Lernsets und kann danach je Lernset unter Sprachrichtung korrigiert werden; die gleiche Sprache kennzeichnet einsprachige Inhalte ohne Übersetzungsrichtung.",
          },
          {
            en: "After analysis, you can create subdecks from up to four Anki fields and arrange their hierarchy. For example, selecting Unit groups all cards below their Unit value; cards without a value are kept in a clearly named fallback subdeck.",
            de: "Nach der Analyse kannst du aus bis zu vier Anki-Feldern Unterdecks erzeugen und ihre Hierarchie ordnen. Die Auswahl Einheit gruppiert zum Beispiel alle Karten unter ihrem Einheitswert; Karten ohne Wert bleiben in einem eindeutig benannten Ersatz-Unterdeck erhalten.",
          },
          {
            en: "Choose an import profile after analysis or create one from the package. In a profile, [[Field]] inserts a sanitized Anki field into a question or answer written with the Flash-n-Flip Wiki syntax. Text fields can use a named style such as [[Field]]{hint} or [[Field]]{accent}; bright and dark appearances follow the active theme. Each note type can generate several normal, reverse, cloze, table, or linked follow-up cards. Saved profiles remain on this device and can be reused with packages whose note-type name and required fields match.",
            de: "Wähle nach der Analyse ein Importprofil oder erstelle eines aus dem Paket. Im Profil setzt [[Feld]] ein bereinigtes Anki-Feld in eine Frage oder Antwort in der Flash-n-Flip-Wiki-Syntax ein. Textfelder können einen benannten Stil wie [[Feld]]{hint} oder [[Feld]]{accent} verwenden; die helle und dunkle Darstellung folgt dem aktiven Theme. Jeder Notiztyp kann mehrere normale, umgekehrte, Lückentext-, Tabellen- oder verknüpfte Folgekarten erzeugen. Gespeicherte Profile bleiben auf diesem Gerät und lassen sich für Pakete mit passendem Notiztypnamen und passenden Pflichtfeldern wiederverwenden.",
          },
        ],
      },
      {
        heading: { en: "Protected export", de: "Geschützter Export" },
        paragraphs: [
          {
            en: "Use Protected export in the deck editor to download a Flash-n-Flip package. You can export a complete hierarchy or an individual deck where offered.",
            de: "Nutze Geschützter Export im Lernset-Editor, um ein Flash-n-Flip-Paket herunterzuladen. Wo angeboten, kannst du eine vollständige Hierarchie oder ein einzelnes Lernset exportieren.",
          },
        ],
      },
    ],
  },
  {
    id: "sync-and-offline",
    title: {
      en: "Synchronization and offline use",
      de: "Synchronisation und Offline-Nutzung",
    },
    summary: {
      en: "Keep progress consistent across devices and understand offline behavior.",
      de: "Halte den Fortschritt auf mehreren Geräten konsistent und verstehe das Offline-Verhalten.",
    },
    keywords: [
      "sync",
      "offline",
      "device",
      "network",
      "gerät",
      "netzwerk",
      "verbindung",
    ],
    sections: [
      {
        heading: { en: "Pair devices", de: "Geräte koppeln" },
        paragraphs: [
          {
            en: "Open Devices in Settings on both devices. Create a pairing code on one device, open it on the other, and compare the displayed confirmation code before accepting it.",
            de: "Öffne auf beiden Geräten unter Einstellungen den Bereich Geräte. Erzeuge auf einem Gerät einen Kopplungscode, öffne ihn auf dem anderen und vergleiche vor dem Bestätigen den angezeigten Bestätigungscode.",
          },
        ],
      },
      {
        heading: { en: "Connection status", de: "Verbindungsstatus" },
        bullets: [
          {
            en: "A green background means the VPS is reachable. A transparent or gray background means it is unavailable.",
            de: "Ein grüner Hintergrund bedeutet, dass der VPS erreichbar ist. Ein transparenter oder grauer Hintergrund bedeutet, dass er nicht erreichbar ist.",
          },
          {
            en: "Globe indicates the internet path, Network a direct local-network path, and Unplug that no device connection is available.",
            de: "Globe kennzeichnet den Internetweg, Network eine direkte Verbindung im lokalen Netzwerk und Unplug eine fehlende Geräteverbindung.",
          },
          {
            en: "Settings explains every icon and background combination. The compact indicator intentionally has no visible caption on other screens.",
            de: "In den Einstellungen werden alle Kombinationen aus Symbol und Hintergrund erklärt. Auf den anderen Ansichten hat die kompakte Anzeige bewusst keine sichtbare Beschriftung.",
          },
        ],
      },
      {
        heading: { en: "Direct transfer", de: "Direkte Übertragung" },
        paragraphs: [
          {
            en: "When Network is shown, use Send to device on a deck. Cards and referenced media travel through the encrypted direct connection and are committed locally only after validation.",
            de: "Wenn Network angezeigt wird, nutze bei einem Lernset An Gerät senden. Karten und referenzierte Medien laufen über die verschlüsselte Direktverbindung und werden erst nach erfolgreicher Prüfung lokal übernommen.",
          },
          {
            en: "Sharing with another account can establish the encrypted WebRTC connection on the local network or directly over the internet. Each transfer is limited to 256 MB; the VPS only coordinates the connection and never carries the deck data.",
            de: "Beim Teilen mit einem anderen Konto kann die verschlüsselte WebRTC-Verbindung im lokalen Netzwerk oder direkt über das Internet entstehen. Jede Übertragung ist auf 256 MB begrenzt; der VPS koordiniert nur den Verbindungsaufbau und transportiert niemals die Lernsetdaten.",
          },
        ],
      },
      {
        heading: { en: "Before signing out", de: "Vor dem Abmelden" },
        paragraphs: [
          {
            en: "Flash-n-Flip tries to synchronize pending reviews first. If synchronization fails, it warns before local account data is removed.",
            de: "Flash-n-Flip versucht zuerst, ausstehende Wiederholungen zu synchronisieren. Schlägt das fehl, erfolgt eine Warnung, bevor lokale Kontodaten entfernt werden.",
          },
        ],
      },
    ],
  },
  {
    id: "settings-and-accessibility",
    title: {
      en: "Settings and accessibility",
      de: "Einstellungen und Barrierefreiheit",
    },
    summary: {
      en: "Choose language, appearance, zoom behavior, and accessible alternatives.",
      de: "Wähle Sprache, Darstellung, Zoomverhalten und barrierefreie Alternativen.",
    },
    keywords: [
      "settings",
      "language",
      "dark",
      "bright",
      "accessibility",
      "text to speech",
      "voice",
      "hint",
      "question",
      "answer",
      "einstellungen",
      "sprache",
      "barrierefreiheit",
      "vorlesen",
      "hinweis",
      "frage",
      "antwort",
    ],
    sections: [
      {
        heading: { en: "Language and theme", de: "Sprache und Darstellung" },
        paragraphs: [
          {
            en: "The interface language is independent from a deck's learning language. The sun icon indicates bright mode; the moon indicates dark mode.",
            de: "Die UI-Sprache ist unabhängig von der Lernsprache eines Lernsets. Das Sonnensymbol zeigt den Hellmodus, der Mond den Dunkelmodus.",
          },
        ],
      },
      {
        heading: {
          en: "Text to speech",
          de: "Vorlesefunktion",
        },
        paragraphs: [
          {
            en: "The speaker uses matching voices installed on the device and automatically switches between the two deck languages inside mixed sentences. If a required voice is missing, the locked speaker explains which language is needed on hover and keyboard focus. Before reveal, clozes are spoken as pauses; after reveal, the complete correct sentence is read.",
            de: "Der Lautsprecher verwendet passende, auf dem Gerät installierte Stimmen und wechselt in gemischten Sätzen automatisch zwischen den beiden Lernset-Sprachen. Fehlt eine benötigte Stimme, nennt der gesperrte Lautsprecher beim Überfahren und per Tastaturfokus die fehlende Sprache. Vor dem Aufdecken werden Lücken als Pausen gesprochen, danach wird der vollständige richtige Satz vorgelesen.",
          },
          {
            en: "Ordinary translation decks use their saved source language for the question and target language for the answer. Set both to the same language for non-translation content.",
            de: "Normale Übersetzungslernsets verwenden die gespeicherte Quellsprache für die Frage und die Zielsprache für die Antwort. Setze beide bei Inhalten ohne Übersetzungsrichtung auf dieselbe Sprache.",
          },
          {
            en: "Language-matrix decks use the actual source language for the question and the target language for the answer. Each side is locked separately when its matching voice is unavailable.",
            de: "Sprachmatrix-Lernsets verwenden für die Frage die tatsächliche Quellsprache und für die Antwort die Zielsprache. Jede Seite wird separat gesperrt, wenn ihre passende Stimme fehlt.",
          },
          {
            en: "Settings offer Off, Sentence only, and Sentence and cloze choices. Listening to a choice is a learning hint and makes Easy unavailable for that card.",
            de: "In den Einstellungen stehen Aus, Nur Satz sowie Satz und Lückenauswahl zur Verfügung. Das Anhören einer Auswahl ist ein Lernhinweis und sperrt Leicht für diese Karte.",
          },
          {
            en: "Text in round parentheses remains visible but is not spoken. Use this for annotations such as (noun), (fem.), or a visible number. Real line breaks create a short speech pause.",
            de: "Text in runden Klammern bleibt sichtbar, wird aber nicht vorgelesen. Nutze dies für Anmerkungen wie (Nomen), (fem.) oder eine sichtbare Zahl. Echte Zeilenumbrüche erzeugen eine kurze Sprechpause.",
          },
        ],
      },
      {
        heading: {
          en: "Question context after reveal",
          de: "Fragekontext nach dem Aufdecken",
        },
        paragraphs: [
          {
            en: "The question remains visible above a revealed answer by default so that both sides can be compared directly. Use the button on the answer card to collapse or restore it. The default can be changed under Settings.",
            de: "Die Frage bleibt standardmäßig oberhalb einer aufgedeckten Antwort sichtbar, damit beide Seiten direkt verglichen werden können. Über den Button auf der Antwortkarte lässt sie sich ein- oder ausklappen. Der Standard kann unter Einstellungen geändert werden.",
          },
        ],
      },
      {
        heading: { en: "Zoom and input", de: "Zoom und Eingabe" },
        paragraphs: [
          {
            en: "Website pinch zoom can be enabled in Settings. Cmd/Ctrl with plus or minus remains available. Dedicated content such as maps keeps its own zoom and pan controls.",
            de: "Der Pinch-Zoom der Website kann in den Einstellungen aktiviert werden. Cmd/Ctrl mit Plus oder Minus bleibt verfügbar. Dedizierte Inhalte wie Karten behalten ihre eigene Zoom- und Verschiebesteuerung.",
          },
        ],
      },
      {
        heading: { en: "Keyboard and media", de: "Tastatur und Medien" },
        bullets: [
          {
            en: "Tab and Shift+Tab move through interactive controls.",
            de: "Tab und Umschalt+Tab bewegen den Fokus durch interaktive Bedienelemente.",
          },
          {
            en: "Enter or Space activates the focused button.",
            de: "Eingabe oder Leertaste aktiviert den fokussierten Button.",
          },
          {
            en: "Space starts or pauses focused media such as audio.",
            de: "Die Leertaste startet oder pausiert fokussierte Medien wie Audio.",
          },
        ],
      },
    ],
  },
  {
    id: "troubleshooting",
    title: { en: "Troubleshooting", de: "Problemlösung" },
    summary: {
      en: "Quick checks for sign-in, saving, importing, and synchronization problems.",
      de: "Schnelle Prüfungen bei Anmelde-, Speicher-, Import- und Synchronisationsproblemen.",
    },
    keywords: [
      "error",
      "failed",
      "login",
      "save",
      "fehler",
      "anmelden",
      "speichern",
    ],
    sections: [
      {
        heading: {
          en: "The app cannot connect",
          de: "Die App kann keine Verbindung herstellen",
        },
        steps: [
          {
            en: "Check whether other Flash-n-Flip pages load on the same device.",
            de: "Prüfe, ob andere Flash-n-Flip-Seiten auf demselben Gerät laden.",
          },
          {
            en: "On local development systems, verify that Docker Desktop and the backend are running.",
            de: "Prüfe auf lokalen Entwicklungssystemen, ob Docker Desktop und das Backend laufen.",
          },
          {
            en: "Retry after switching between Wi-Fi and mobile data, if available.",
            de: "Versuche es nach einem Wechsel zwischen WLAN und Mobilfunk erneut, falls verfügbar.",
          },
        ],
      },
      {
        heading: {
          en: "A card cannot be saved",
          de: "Eine Karte lässt sich nicht speichern",
        },
        paragraphs: [
          {
            en: "Read the validation message above the editor. For numbered clozes, every position from 1 to 500 may occur only once on a card.",
            de: "Lies die Validierungsmeldung über dem Editor. Bei nummerierten Lücken darf jede Position von 1 bis 500 innerhalb einer Karte nur einmal vorkommen.",
          },
        ],
      },
      {
        heading: { en: "An import fails", de: "Ein Import schlägt fehl" },
        paragraphs: [
          {
            en: "Keep the original file and the complete import message. Large or unusual Anki packages may require a format-specific correction instead of another upload attempt.",
            de: "Bewahre die Originaldatei und die vollständige Importmeldung auf. Große oder ungewöhnliche Anki-Pakete benötigen möglicherweise eine formatspezifische Korrektur statt eines weiteren Uploadversuchs.",
          },
        ],
      },
    ],
  },
];

const searchableText = (topic: HelpTopic): string =>
  [
    topic.title.en,
    topic.title.de,
    topic.summary.en,
    topic.summary.de,
    ...topic.keywords,
    ...topic.sections.flatMap((section) => [
      section.heading.en,
      section.heading.de,
      ...(section.paragraphs ?? []).flatMap((item) => [item.en, item.de]),
      ...(section.steps ?? []).flatMap((item) => [item.en, item.de]),
      ...(section.bullets ?? []).flatMap((item) => [item.en, item.de]),
      ...(section.code ?? []),
    ]),
  ]
    .join(" ")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();

export const filterHelpTopics = (
  query: string,
  topics: readonly HelpTopic[] = helpTopics,
): HelpTopic[] => {
  const terms = query
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!terms.length) return [...topics];
  return topics.filter((topic) => {
    const haystack = searchableText(topic);
    return terms.every((term) => haystack.includes(term));
  });
};
