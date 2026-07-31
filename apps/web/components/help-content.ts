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
            en: "Open My decks and select New deck, or import an existing Anki package.",
            de: "Öffne Meine Lernsets und wähle Neues Lernset oder importiere ein vorhandenes Anki-Paket.",
          },
          {
            en: "Add at least one question card, cloze card, or explanation.",
            de: "Füge mindestens eine Fragekarte, einen Lückentext oder eine Erläuterung hinzu.",
          },
          {
            en: "Select the deck in My decks to open it directly in Study.",
            de: "Wähle das Lernset unter Meine Lernsets aus, um es direkt in Lernen zu öffnen.",
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
      "favorite",
      "hide",
      "trash",
      "lernset",
      "sammlung",
      "favorit",
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
            en: "Open the three-dot menu next to a deck to edit, hide, favorite, or move it to the trash. Trashed personal decks can be restored before they are permanently deleted.",
            de: "Öffne das Drei-Punkte-Menü neben einem Lernset, um es zu bearbeiten, auszublenden, zu favorisieren oder in den Papierkorb zu verschieben. Eigene Lernsets können vor dem endgültigen Löschen wiederhergestellt werden.",
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
            en: "Discover offers installable English reference collections for KaTeX, Git, Docker, Kubernetes, CMD, PowerShell, Bash/Zsh, pip3, Composer, XPath, and JSONPath. Every developer collection contains Introduction, Advanced, and Practical Samples decks.",
            de: "Unter Entdecken findest du installierbare englische Referenzsammlungen für KaTeX, Git, Docker, Kubernetes, CMD, PowerShell, Bash/Zsh, pip3, Composer, XPath und JSONPath. Jede Entwickler-Sammlung enthält die Lernsets Introduction, Advanced und Practical Samples.",
          },
          {
            en: "References always open in practice mode: revealing an explanation and selecting Next does not change your learning progress. Updating a collection refreshes its authored content without duplicating decks or replacing existing progress.",
            de: "Referenzen öffnen immer im Übungsmodus: Das Anzeigen einer Erläuterung und Weiter mit Nächste Karte verändern deinen Lernfortschritt nicht. Beim Aktualisieren wird der redaktionelle Inhalt ohne doppelte Lernsets und ohne Ersetzen vorhandenen Fortschritts erneuert.",
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
    ],
    sections: [
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
        ],
        code: [
          "$x^2 + y^2 = z^2$",
          "$\\frac{a}{b}$",
          "$\\sqrt{x}$",
          "$\\sum_{i=1}^{n} i$",
          "$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$",
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
    ],
    sections: [
      {
        heading: { en: "Anki import", de: "Anki-Import" },
        paragraphs: [
          {
            en: "Open My decks, choose Import, and select an APKG file. Decks from one package are grouped in a collection so the complete import can be managed together. Import notices identify content that required conversion or could not be preserved.",
            de: "Öffne Meine Lernsets, wähle Importieren und anschließend eine APKG-Datei. Lernsets aus einem Paket werden in einer Collection zusammengefasst, damit der gesamte Import gemeinsam verwaltet werden kann. Importhinweise nennen Inhalte, die umgewandelt wurden oder nicht erhalten werden konnten.",
          },
          {
            en: "Anki does not provide a dependable standardized source and target language. Select the initial question and answer languages before import. The direction applies to every imported deck and can be corrected per deck afterward under Language direction; choosing the same language marks one-language, non-translation content.",
            de: "Anki liefert keine verlässliche standardisierte Quell- und Zielsprache. Wähle deshalb vor dem Import die anfängliche Sprache der Fragen und Antworten. Die Richtung gilt zunächst für alle importierten Lernsets und kann danach je Lernset unter Sprachrichtung korrigiert werden; die gleiche Sprache kennzeichnet einsprachige Inhalte ohne Übersetzungsrichtung.",
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
        heading: { en: "Multiple devices", de: "Mehrere Geräte" },
        paragraphs: [
          {
            en: "Sign in with the same account on each device. Reviews created without a connection are queued and synchronized when the API is reachable again.",
            de: "Melde dich auf jedem Gerät mit demselben Konto an. Wiederholungen ohne Verbindung werden vorgemerkt und synchronisiert, sobald die API wieder erreichbar ist.",
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
            en: "The speaker only reads a sentence when a matching voice is installed on the device. If it is missing, the locked speaker explains the required language on hover and keyboard focus. Before reveal, clozes are spoken as pauses; after reveal, the complete correct sentence is read.",
            de: "Der Lautsprecher liest einen Satz nur mit einer passenden, auf dem Gerät installierten Stimme vor. Fehlt sie, nennt der gesperrte Lautsprecher beim Überfahren und per Tastaturfokus die benötigte Sprache. Vor dem Aufdecken werden Lücken als Pausen gesprochen, danach wird der vollständige richtige Satz vorgelesen.",
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
