import type { Locale } from "@flashcards/i18n";

export type HelpLocale = Locale;

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
    title: {
      en: "Getting started",
      de: "Erste Schritte",
      es: "Primeros pasos",
      fr: "Commencer",
    },
    summary: {
      en: "Create or import a deck and start your first study session.",
      de: "Erstelle oder importiere ein Lernset und beginne deine erste Lernrunde.",
      es: "Crea o importa un mazo y comienza tu primera sesión de estudio.",
      fr: "Créez ou importez un jeu et lancez votre première session d'étude.",
    },
    keywords: ["start", "overview", "dashboard", "anfang", "übersicht"],
    sections: [
      {
        heading: {
          en: "Your first session",
          de: "Deine erste Lernrunde",
          es: "Tu primera sesión",
          fr: "Votre première séance",
        },
        steps: [
          {
            en: "Open Decks and select New deck, or import an existing Anki package.",
            de: "Öffne Lernsets und wähle Neues Lernset oder importiere ein vorhandenes Anki-Paket.",
            es: "Abre los mazos y selecciona Nuevo mazo, o importa un paquete Anki existente.",
            fr: "Ouvrez les jeux et sélectionnez Nouveau jeu ou importez un paquet Anki existant.",
          },
          {
            en: "Add at least one question card, cloze card, or explanation.",
            de: "Füge mindestens eine Fragekarte, einen Lückentext oder eine Erläuterung hinzu.",
            es: "Añade al menos una tarjeta de pregunta, una tarjeta con huecos o una explicación.",
            fr: "Ajoutez au moins une carte question, une carte à trous ou une explication.",
          },
          {
            en: "Select the deck in Decks to open it directly in Study.",
            de: "Wähle das Lernset unter Lernsets aus, um es direkt in Lernen zu öffnen.",
            es: "Selecciona el mazo en Mazos para abrirlo directamente en Estudio.",
            fr: "Sélectionnez le jeu dans Jeux pour l'ouvrir directement dans Étude.",
          },
          {
            en: "Reveal the answer and rate how well you remembered it.",
            de: "Decke die Antwort auf und bewerte, wie gut du dich erinnert hast.",
            es: "Revela la respuesta y califica qué tan bien te lo recuerdas.",
            fr: "Révélez la réponse et évaluez à quel point vous l'avez retenue.",
          },
        ],
      },
      {
        heading: {
          en: "Where your data lives",
          de: "Wo deine Daten liegen",
          es: "Dónde residen tus datos",
          fr: "L'emplacement de vos données",
        },
        paragraphs: [
          {
            en: "The Apple app stores decks, media, settings, and learning progress only on this device. Until iCloud support is released, create regular FNF backups and restore them explicitly on another device when needed.",
            de: "Die Apple-App speichert Lernsets, Medien, Einstellungen und Lernfortschritt ausschließlich auf diesem Gerät. Erstelle bis zur Einführung von iCloud regelmäßig FNF-Sicherungen und stelle sie bei Bedarf ausdrücklich auf einem anderen Gerät wieder her.",
            es: "Las tiendas de aplicaciones Apple guardan los mazo, medios, configuraciones y el progreso del aprendizaje únicamente en este dispositivo. Hasta que se publique el soporte para iCloud, crea copias de seguridad regulares de FNF y restaura explícitamente las mismas en otro dispositivo cuando sea necesario.",
            fr: "Les magasins d'applications Apple stockent les paquets, médias, paramètres et la progression d'apprentissage uniquement sur cet appareil. Jusqu'à ce que le support iCloud soit disponible, créez régulièrement des sauvegardes FNF et restaurez-les explicitement sur un autre appareil si nécessaire.",
          },
        ],
      },
    ],
  },
  {
    id: "decks-and-collections",
    title: {
      en: "Decks and collections",
      de: "Lernsets und Collections",
      es: "Mazos y colecciones",
      fr: "Paquets et collections",
    },
    summary: {
      en: "Organize content hierarchically and control what appears while studying.",
      de: "Ordne Inhalte hierarchisch und bestimme, was beim Lernen erscheint.",
      es: "Organiza el contenido jerárquicamente y controla lo que aparece durante los estudios.",
      fr: "Organisez le contenu hiérarchiquement et contrôlez ce qui s'affiche pendant l'étude.",
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
        heading: {
          en: "Hierarchy",
          de: "Hierarchie",
          es: "Jerarquía",
          fr: "Hiérarchie",
        },
        paragraphs: [
          {
            en: "A deck can contain cards and any number of subdecks. Collections and parent decks aggregate the card counts and progress of their descendants.",
            de: "Ein Lernset kann Karten und beliebig viele Unterdecks enthalten. Collections und übergeordnete Lernsets fassen Kartenanzahl und Fortschritt ihrer Unterelemente zusammen.",
            es: "Un mazo puede contener tarjetas y cualquier número de submazos. Las colecciones y los mazos padres agregan el conteo de tarjetas y el progreso de sus descendientes.",
            fr: "Un paquet peut contenir des cartes et n'importe quel nombre de sous-paquets. Les collections et les paquets parents agrègent le comptage de cartes et la progression de leurs éléments descendants.",
          },
        ],
        bullets: [
          {
            en: "Use the parent-deck selector while creating or editing a deck.",
            de: "Nutze beim Erstellen oder Bearbeiten die Auswahl Übergeordnetes Lernset.",
            es: "Utiliza el selector del mazo padre al crear o editar un mazo.",
            fr: "Utilisez le sélecteur de paquet parent lors de la création ou de l'édition d'un paquet.",
          },
          {
            en: "Drag cards in the editor to change their sequence.",
            de: "Ziehe Karten im Editor, um ihre Reihenfolge zu ändern.",
            es: "Arrastra las tarjetas en el editor para cambiar su secuencia.",
            fr: "Glissez les cartes dans l'éditeur pour modifier leur séquence.",
          },
          {
            en: "Hidden decks are excluded from deck lists and All decks study sessions.",
            de: "Ausgeblendete Lernsets werden aus Lernset-Listen und aus Alle Lernsets ausgeschlossen.",
            es: "Los mazos ocultos se excluyen de las listas de mazos y de la sesión de estudio Todos los mazos.",
            fr: "Les paquets masqués sont exclus des listes de paquets et de la session d'étude Tous les paquets.",
          },
        ],
      },
      {
        heading: {
          en: "Deck actions",
          de: "Lernset-Aktionen",
          es: "Acciones del mazo",
          fr: "Actions du paquet",
        },
        paragraphs: [
          {
            en: "Use the graduation cap next to a deck to add it and its subdecks to the learning plan. Open the three-dot menu to edit, hide, or move it to the trash. Trashed personal decks can be restored before they are permanently deleted.",
            de: "Mit der Abschlusskappe neben einem Lernset nimmst du es samt Unterdecks in den Lernplan auf. Im Drei-Punkte-Menü kannst du es bearbeiten, ausblenden oder in den Papierkorb verschieben. Eigene Lernsets können vor dem endgültigen Löschen wiederhergestellt werden.",
            es: "Usa la gorra de graduación junto a un mazo para añadirlo y sus submazos al plan de aprendizaje. Abre el menú de tres puntos para editarlo, ocultarlo o moverlo a la papelera. Los mazos personales en la papelera pueden restaurarse antes de su eliminación permanente.",
            fr: "Utilisez le bonnet de diplômé à côté d'un paquet pour l'ajouter avec ses sous-paquets au plan d'apprentissage. Ouvrez le menu à trois points pour modifier, masquer ou déplacer vers la corbeille. Les paquets personnels dans la corbeille peuvent être restaurés avant leur suppression définitive.",
          },
        ],
      },
      {
        heading: {
          en: "Curated developer references",
          de: "Kuratierte Entwickler-Referenzen",
          es: "Referencias de desarrolladores curadas",
          fr: "Références pour développeurs curated",
        },
        paragraphs: [
          {
            en: "Discover offers one installable English Developer Reference Library with categorized references for 21 technologies: KaTeX, Git, Docker, Kubernetes, CMD, PowerShell, Bash/Zsh, Linux, SSH/SCP/rsync, pip3, Composer, npm/pnpm/Yarn, SQL, PostgreSQL, XPath, JSONPath, jq, YAML, HTTP/cURL, regular expressions, and GitHub Actions. Each tool reference contains Introduction, Advanced, and Practical Samples decks. References open directly on their content without a question filler page and provide Previous and Next controls. Updating the library keeps existing card identities and personal progress. Long reference content scrolls inside the card while the page header and navigation controls stay visible.",
            de: "Unter Entdecken findest du eine installierbare englische Developer Reference Library mit kategorisierten Referenzen für 21 Technologien: KaTeX, Git, Docker, Kubernetes, CMD, PowerShell, Bash/Zsh, Linux, SSH/SCP/rsync, pip3, Composer, npm/pnpm/Yarn, SQL, PostgreSQL, XPath, JSONPath, jq, YAML, HTTP/cURL, reguläre Ausdrücke und GitHub Actions. Jede Werkzeugreferenz enthält die Lernsets Introduction, Advanced und Practical Samples. Referenzen öffnen direkt mit ihrem Inhalt ohne vorgeschaltete Frage-Füllseite und bieten Zurück- und Weiter-Schaltflächen. Beim Aktualisieren der Bibliothek bleiben Karten-Identitäten und dein persönlicher Lernfortschritt erhalten. Lange Referenzinhalte scrollen innerhalb der Karte, während Seitenkopf und Navigation sichtbar bleiben.",
            es: "Descubrir ofrece una biblioteca en inglés instalable de referencias para desarrolladores con referencias categorizadas para 21 tecnologías: KaTeX, Git, Docker, Kubernetes, CMD, PowerShell, Bash/Zsh, Linux, SSH/SCP/rsync, pip3, Composer, npm/pnpm/Yarn, SQL, PostgreSQL, XPath, JSONPath, jq, YAML, HTTP/cURL, expresiones regulares y GitHub Actions. Cada referencia de herramienta contiene los mazos Introducción, Avanzado y Muestras prácticas. Las referencias se abren directamente en su contenido sin una página rellena de preguntas y proporcionan controles Anterior y Siguiente. Actualizar la biblioteca mantiene las identidades existentes de las tarjetas y el progreso personal. El contenido largo de referencia hace scroll dentro de la tarjeta mientras que el encabezado de página y los controles de navegación permanecen visibles.",
            fr: "Découvrir propose une bibliothèque anglaise installable de références pour développeurs avec des références catégorisées pour 21 technologies : KaTeX, Git, Docker, Kubernetes, CMD, PowerShell, Bash/Zsh, Linux, SSH/SCP/rsync, pip3, Composer, npm/pnpm/Yarn, SQL, PostgreSQL, XPath, JSONPath, jq, YAML, HTTP/cURL, expressions régulières et GitHub Actions. Chaque référence d'outil contient les paquets Introduction, Avancé et Échantillons pratiques. Les références s'ouvrent directement sur leur contenu sans page de remplissage de questions et offrent des contrôles Précédent et Suivant. La mise à jour de la bibliothèque conserve les identités existantes des cartes et la progression personnelle. Le long contenu de référence fait défiler à l'intérieur de la carte tandis que l'en-tête de page et les contrôles de navigation restent visibles.",
          },
          {
            en: "References are not included in scheduled sessions or Practice all runs. Open the reference library explicitly to browse it in practice mode; moving backward or forward does not change your learning progress. Updating a collection refreshes its authored content without duplicating decks or replacing existing progress.",
            de: "Referenzen sind weder Teil geplanter Lerndurchläufe noch von Alle üben. Öffne die Referenzbibliothek ausdrücklich, um sie im unbewerteten Referenzmodus durchzublättern; Vorwärts und Zurück verändern deinen Lernfortschritt nicht. Beim Aktualisieren wird der redaktionelle Inhalt ohne doppelte Lernsets und ohne Ersetzen vorhandenen Fortschritts erneuert.",
            es: "Las referencias no están incluidas en las sesiones programadas ni en Ejercitar todo. Abre la biblioteca de referencias explícitamente para navegar por ella en modo práctica; avanzar o retroceder no cambia tu progreso de aprendizaje. Actualizar una colección renueva su contenido redactado sin duplicar mazos ni reemplazar el progreso existente.",
            fr: "Les références ne sont pas incluses dans les sessions planifiées ou Exercice tout. Ouvrez explicitement la bibliothèque de références pour naviguer en mode pratique ; avancer ou reculer ne change pas votre progression d'apprentissage. La mise à jour d'une collection renouvelle son contenu rédigé sans dupliquer des paquets ni remplacer une progression existante.",
          },
          {
            en: "The separate Flash-n-Flip Help collection starts with a JSXGraph topic deck containing interactive, copyable references. Later Mermaid and ABC topic decks can be added below the same collection without changing its installed identity.",
            de: "Die separate Collection „Flash-n-Flip Help“ startet mit einem JSXGraph-Themen-Deck aus interaktiven, kopierbaren Referenzen. Später können Mermaid- und ABC-Themen-Decks unter derselben Collection ergänzt werden, ohne ihre installierte Identität zu ändern.",
            es: "La colección de ayuda Flash-n-Flip separada comienza con un mazo del tema JSXGraph que contiene referencias interactivas y copiables. Más tarde, se pueden añadir mazos de temas Mermaid y ABC debajo de la misma colección sin cambiar su identidad instalada.",
            fr: "La collection d'aide Flash-n-Flip séparée commence avec un paquet du thème JSXGraph contenant des références interactives et copiables. Plus tard, les paquets de thèmes Mermaid et ABC peuvent être ajoutés sous la même collection sans modifier son identité installée.",
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
      es: "Tarjetas, Markdown y clozes",
      fr: "Cartes, Markdown et lacunes",
    },
    summary: {
      en: "Format questions and create interactive clozes with a compact syntax.",
      de: "Formatiere Fragen und erstelle interaktive Lückentexte mit einer kompakten Syntax.",
      es: "Formatea preguntas y crea clozes interactivos con una sintaxis compacta.",
      fr: "Formattez les questions et créez des lacunes interactives avec une syntaxe concise.",
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
          es: "Usando el editor de tarjetas",
          fr: "Utilisation de l'éditeur de cartes",
        },
        paragraphs: [
          {
            en: "Enter the prompt on the question side and the solution or explanation on the answer side. While typing, the opposite side becomes a live preview; select it to return to editing.",
            de: "Trage die Aufgabe auf der Frageseite und die Lösung oder Erläuterung auf der Antwortseite ein. Während der Eingabe wird die jeweils andere Seite als Live-Vorschau angezeigt; wähle sie aus, um weiterzubearbeiten.",
            es: "Ingresa la pregunta en el lado de la pregunta y la solución o explicación en el lado de la respuesta. Mientras escribes, el lado opuesto se convierte en una vista previa en vivo; selecciónalo para volver a editar.",
            fr: "Entrez la question du côté question et la solution ou l'explication du côté réponse. Pendant la saisie, le côté opposé devient une prévisualisation en direct ; sélectionnez-le pour revenir à l'édition.",
          },
          {
            en: "Cloze reveal controls whether all blanks are revealed together or one after another. Automatic uses numbered blanks sequentially and unnumbered blanks together. A cloze card can stay without a separate answer; a card without a question is treated as an unrated explanation.",
            de: "Lücken aufdecken bestimmt, ob alle Lücken gemeinsam oder nacheinander aufgedeckt werden. Automatisch verwendet nummerierte Lücken nacheinander und unnummerierte gemeinsam. Eine Lückentextkarte kann ohne separate Antwort bleiben; eine Karte ohne Frage gilt als unbewertete Erläuterung.",
            es: "Los controles de revelación de cloze determinan si todas las casillas se revelan a la vez o una tras otra. Automático usa las casillas numeradas secuencialmente y las no numeradas juntas. Una tarjeta de cloze puede permanecer sin respuesta separada; una tarjeta sin pregunta se trata como una explicación sin calificar.",
            fr: "Les contrôles de révélation Cloze déterminent si tous les espaces blancs sont révélés ensemble ou l'un après l'autre. Automatique utilise les espaces numérotés séquentiellement et les non-numérotés ensemble. Une carte Cloze peut rester sans réponse séparée ; une carte sans question est traitée comme une explication non notée.",
          },
        ],
      },
      {
        heading: {
          en: "Markdown basics",
          de: "Markdown-Grundlagen",
          es: "Fundamentos de Markdown",
          fr: "Bases du Markdown",
        },
        bullets: [
          {
            en: "# Heading 1, ## Heading 2",
            de: "# Überschrift 1, ## Überschrift 2",
            es: "# Título 1, ## Título 2",
            fr: "# Titre 1, ## Titre 2",
          },
          {
            en: "**bold**, *italic*, ~~struck~~",
            de: "**fett**, *kursiv*, ~~durchgestrichen~~",
            es: "**negrita**, *cursiva*, ~~tachado~~",
            fr: "**gras**, *italique*, ~~barré~~",
          },
          {
            en: "- unordered or 1. ordered lists",
            de: "- ungeordnete oder 1. geordnete Listen",
            es: "- listas sin ordenar o 1. listas con ordenación",
            fr: "- listes non ordonnées ou 1. listes ordonnées",
          },
          {
            en: "[label](https://example.org) for links",
            de: "[Beschriftung](https://example.org) für Links",
            es: "[etiqueta](https://example.org) para enlaces",
            fr: "[libellé](https://example.org) pour les liens",
          },
        ],
      },
      {
        heading: {
          en: "Cloze syntax",
          de: "Lückentext-Syntax",
          es: "Sintaxis de cloze",
          fr: "Syntaxe Cloze",
        },
        paragraphs: [
          {
            en: "The first value is always correct. Other values are shuffled answer choices. Explicit position numbers must be unique within a card.",
            de: "Der erste Wert ist immer richtig. Weitere Werte werden als Antwortvorschläge gemischt. Explizite Positionsnummern müssen innerhalb einer Karte eindeutig sein.",
            es: "El primer valor siempre es correcto. Los demás valores son opciones de respuesta mezcladas. Las posiciones numéricas explícitas deben ser únicas dentro de una tarjeta.",
            fr: "La première valeur est toujours correcte. Les autres valeurs sont des choix de réponse mélangés. Les numéros de position explicites doivent être uniques au sein d'une carte.",
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
            es: "{{hund}} revela la palabra sin opciones de respuesta.",
            fr: "{{chien}} révèle le mot sans choix de réponse.",
          },
          {
            en: "{{1:hund|katze}} fixes this cloze at position 1.",
            de: "{{1:hund|katze}} legt diese Lücke auf Position 1 fest.",
            es: "{{1:hund|katze}} fija esta cloze en la posición 1.",
            fr: "{{1:chien|chat}} fixe cet espace blanc à la position 1.",
          },
          {
            en: "+N mixes in up to N answers from other clozes on the same card.",
            de: "+N mischt bis zu N Antworten aus anderen Lücken derselben Karte hinzu.",
            es: "+N mezcla hasta N respuestas de otras clozes en la misma tarjeta.",
            fr: "+N mélange jusqu'à N réponses provenant d'autres espaces blancs sur la même carte.",
          },
          {
            en: "Inline KaTeX can be used for the correct answer and every alternative, for example {{$x^2$|$x^0$}}.",
            de: "Inline-KaTeX kann für die richtige Antwort und alle Alternativen verwendet werden, zum Beispiel {{$x^2$|$x^0$}}.",
            es: "Se puede usar KaTeX en línea para la respuesta correcta y cada alternativa, por ejemplo {{$x^2$|$x^0$}}.",
            fr: "KaTeX en ligne peut être utilisé pour la réponse correcte et chaque alternative, par exemple {{$x^2$|$x^0$}}.",
          },
        ],
      },
      {
        heading: {
          en: "Wiki tables and cell formatting",
          de: "Wiki-Tabellen und Zellformatierung",
          es: "Tablas Wiki y formato de celdas",
          fr: "Tables Wiki et formatage des cellules",
        },
        paragraphs: [
          {
            en: "Table cells support clozes, inline formulas, links, and a small safe subset of DokuWiki formatting. Escape a literal column separator as \\|.",
            de: "Tabellenzellen unterstützen Lückentexte, Inline-Formeln, Links und eine kleine sichere Auswahl der DokuWiki-Formatierung. Ein wörtlicher Spaltentrenner wird als \\| geschrieben.",
            es: "Las celdas de tabla soportan clozes, fórmulas en línea, enlaces y un pequeño subconjunto seguro del formato DokuWiki. Escapa un separador de columna literal como \\|.",
            fr: "Les cellules de tableau prennent en charge les espaces blancs Cloze, les formules en ligne, les liens et un petit sous-ensemble sûr du formatage DokuWiki. Échappez un séparateur de colonne littéral comme \\|.",
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
            es: "**texto** es negrita, //texto// es cursiva, __texto__ está subrayado y ''texto'' es código.",
            fr: "**texte** est en gras, //texte// est en italique, __texte__ est souligné et ''texte'' est du code.",
          },
          {
            en: "Wiki formatting is intentionally limited to inline content inside a cell. Headings, lists, block quotes, and display formulas remain separate blocks outside the table.",
            de: "Wiki-Formatierung ist innerhalb einer Zelle bewusst auf Inline-Inhalte begrenzt. Überschriften, Listen, Zitate und abgesetzte Formeln bleiben eigene Blöcke außerhalb der Tabelle.",
            es: "El formato Wiki está intencionalmente limitado al contenido en línea dentro de una celda. Los títulos, listas, citas y fórmulas mostradas permanecen como bloques separados fuera de la tabla.",
            fr: "Le formatage Wiki est intentionnellement limité au contenu en ligne à l'intérieur d'une cellule. Les titres, les listes, les citations et les formules affichées restent des blocs séparés en dehors du tableau.",
          },
          {
            en: "Table rows start with ^ for headings or | for regular cells. ^^ spans columns, and ::: continues the cell above as a side heading. Spaces inside a cell control left, right, or centered alignment; cells are vertically centered.",
            de: "Tabellenzeilen beginnen mit ^ für Überschriften oder | für normale Zellen. ^^ verbindet Spalten und ::: führt die Zelle darüber als seitliche Überschrift fort. Leerzeichen innerhalb einer Zelle steuern linksbündige, rechtsbündige oder zentrierte Ausrichtung; Zellen werden vertikal zentriert.",
            es: "Las filas de tabla comienzan con ^ para títulos o | para celdas regulares. ^^ abarca columnas y ::: continúa la celda anterior como un título lateral. Los espacios dentro de una celda controlan el alineamiento a izquierda, derecha o centrado; las celdas están verticalmente centradas.",
            fr: "Les lignes de tableau commencent par ^ pour les titres ou | pour les cellules normales. ^^ étend sur plusieurs colonnes et ::: continue la cellule ci-dessus comme un titre latéral. Les espaces à l'intérieur d'une cellule contrôlent l'alignement gauche, droit ou centré ; les cellules sont verticalement centrées.",
          },
        ],
      },
      {
        heading: {
          en: "Embed graphics and scores in tables",
          de: "Grafiken und Noten in Tabellen einbetten",
          es: "Incrustar gráficos y puntuaciones en tablas",
          fr: "Intégrer des graphiques et des scores dans les tableaux",
        },
        paragraphs: [
          {
            en: "Assign a Mermaid diagram, JSXGraph construction, or ABC score to a name by writing name=type after the opening fence. The definition stays hidden at that position. Insert it elsewhere on the same card side with ![[name]].",
            de: "Weise einem Mermaid-Diagramm, einer JSXGraph-Konstruktion oder einem ABC-Notensatz einen Namen zu, indem du nach dem öffnenden Zaun name=typ schreibst. Die Definition bleibt an dieser Stelle unsichtbar. Mit ![[name]] setzt du sie an anderer Stelle derselben Kartenseite ein.",
            es: "Asigna un diagrama Mermaid, una construcción JSXGraph o una puntuación ABC a un nombre escribiendo name=tipo después de la primera llave. La definición permanece oculta en esa posición. Insertala en otro lugar del mismo lado de la tarjeta con ![[name]].",
            fr: "Attribuez un diagramme Mermaid, une construction JSXGraph ou un score ABC à un nom en écrivant nom=type après l'ouverture d'une accolade. La définition reste cachée à cet endroit. Insérez-la ailleurs sur le même côté de la carte avec ![[name]].",
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
            es: "Los nombres comienzan con una letra y pueden contener letras, números, guiones bajos y guiones.",
            fr: "Les noms commencent par une lettre et peuvent contenir des lettres, des chiffres, des soulignements et des tirets.",
          },
          {
            en: "A definition may be embedded more than once, but every name may be defined only once per card side.",
            de: "Eine Definition darf mehrfach eingebettet, jeder Name pro Kartenseite aber nur einmal definiert werden.",
            es: "Una definición puede estar incrustada más de una vez, pero cada nombre solo puede definirse una vez por lado de la tarjeta.",
            fr: "Une définition peut être intégrée plusieurs fois, mais chaque nom ne peut être défini qu'une seule fois par côté de carte.",
          },
          {
            en: "Without an assignment, ordinary ```mermaid, ```jsxgraph, ```abc, and ```music blocks continue to render directly where they are written.",
            de: "Ohne Zuweisung werden normale ```mermaid-, ```jsxgraph-, ```abc- und ```music-Blöcke weiterhin direkt an ihrer Schreibposition gerendert.",
            es: "Sin asignación, los bloques normales ```mermaid, ```jsxgraph, ```abc y ```music continúan renderizándose directamente donde se escriben.",
            fr: "Sans affectation, les blocs normaux ```mermaid, ```jsxgraph, ```abc et ```music continuent de s'afficher directement là où ils sont écrits.",
          },
        ],
      },
      {
        heading: {
          en: "Mathematical formulas",
          de: "Mathematische Formeln",
          es: "Fórmulas matemáticas",
          fr: "Formules mathématiques",
        },
        paragraphs: [
          {
            en: "Flash-n-Flip renders KaTeX-compatible LaTeX. Use $...$ for an inline formula and $$ on separate lines around a display formula. Formulas in table cells must use the inline form.",
            de: "Flash-n-Flip rendert KaTeX-kompatibles LaTeX. Nutze $...$ für eine Formel im Text und $$ in eigenen Zeilen um eine abgesetzte Formel. In Tabellenzellen ist nur die Inline-Form erlaubt.",
            es: "Flash-n-Flip renderiza LaTeX compatible con KaTeX. Usa $...$ para una fórmula en línea y $$ en líneas separadas alrededor de una fórmula a pantalla completa. Las fórmulas en celdas de tabla deben usar la forma en línea.",
            fr: "Flash-n-Flip rendert du LaTeX compatible avec KaTeX. Utilisez $...$ pour une formule en ligne et $$ sur des lignes séparées autour d'une formule à l'écran complet. Les formules dans les cellules de tableau doivent utiliser la forme en ligne.",
          },
          {
            en: "Chemical formulas, equations, and physical units use the bundled mhchem extension with \\ce{...} and \\pu{...}.",
            de: "Chemische Formeln, Reaktionsgleichungen und physikalische Einheiten nutzen die integrierte mhchem-Erweiterung mit \\ce{...} und \\pu{...}.",
            es: "Las fórmulas químicas, ecuaciones y unidades físicas utilizan la extensión mhchem integrada con \\ce{...} y \\pu{...}.",
            fr: "Les formules chimiques, équations et unités physiques utilisent l'extension mhchem intégrée avec \\ce{...} et \\pu{...}.",
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
            es: "Por seguridad, los comandos que requieren HTML de confianza, URLs externas o ejecución de scripts están deshabilitados.",
            fr: "Pour des raisons de sécurité, les commandes nécessitant un HTML de confiance, des URL externes ou l'exécution de scripts sont désactivées.",
          },
          {
            en: "Zero-width overlap commands such as \\mathclap, \\mathllap, and \\mathrlap are rendered as normal groups so symbols remain legible on cards.",
            de: "Nullbreiten-Befehle wie \\mathclap, \\mathllap und \\mathrlap werden als normale Gruppen dargestellt, damit sich Zeichen auf Karten nicht überlagern.",
            es: "Los comandos de superposición sin ancho como \\mathclap, \\mathllap y \\mathrlap se renderizan como grupos normales para que los símbolos permanezcan legibles en las tarjetas.",
            fr: "Les commandes de chevauchement sans largeur comme \\mathclap, \\mathllap et \\mathrlap sont rendues sous forme de groupes normaux afin que les symboles restent lisibles sur les cartes.",
          },
        ],
        links: [
          {
            label: {
              en: "KaTeX supported functions",
              de: "Von KaTeX unterstützte Funktionen",
              es: "Funciones compatibles con KaTeX",
              fr: "Fonctions prises en charge par KaTeX",
            },
            href: "https://katex.org/docs/supported",
          },
          {
            label: {
              en: "KaTeX function support table",
              de: "KaTeX-Kompatibilitätstabelle",
              es: "Tabla de compatibilidad de funciones de KaTeX",
              fr: "Tableau de compatibilité des fonctions KaTeX",
            },
            href: "https://katex.org/docs/support_table.html",
          },
        ],
      },
      {
        heading: {
          en: "Question, answer, or explanation",
          de: "Frage, Antwort oder Erläuterung",
          es: "Pregunta, respuesta o explicación",
          fr: "Question, réponse ou explication",
        },
        paragraphs: [
          {
            en: "A cloze card does not require a separate back. A card without a question is treated as an explanation and advances without a learning rating.",
            de: "Eine Lückentextkarte benötigt keine separate Rückseite. Eine Karte ohne Frage gilt als Erläuterung und wird ohne Lernbewertung weitergeschaltet.",
            es: "Una tarjeta de relleno no requiere una parte trasera separada. Una tarjeta sin pregunta se trata como una explicación y avanza sin calificación de aprendizaje.",
            fr: "Une carte à trous ne nécessite pas d'arrière-plan séparé. Une carte sans question est traitée comme une explication et avance sans notation d'apprentissage.",
          },
        ],
      },
    ],
  },
  {
    id: "mermaid-diagrams",
    title: {
      en: "Mermaid diagrams",
      de: "Mermaid-Diagramme",
      es: "Diagramas Mermaid",
      fr: "Diagrammes Mermaid",
    },
    summary: {
      en: "Add locally rendered, accessible diagrams to either side of a card.",
      de: "Füge lokal gerenderte, zugängliche Diagramme auf beiden Kartenseiten ein.",
      es: "Agrega diagramas renderizados localmente y accesibles a cualquiera de los lados de una tarjeta.",
      fr: "Ajoutez des diagrammes rendus localement et accessibles sur l'un ou l'autre côté d'une carte.",
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
        heading: {
          en: "Create a diagram",
          de: "Ein Diagramm erstellen",
          es: "Crear un diagrama",
          fr: "Créer un diagramme",
        },
        steps: [
          {
            en: "Enter a complete ```mermaid code block directly in the normal question or answer field.",
            de: "Gib einen vollständigen ```mermaid-Codeblock direkt in das normale Frage- oder Antwortfeld ein.",
            es: "Introduce un bloque de código ```mermaid completo directamente en el campo normal de pregunta o respuesta.",
            fr: "Entrez un bloc de code ```mermaid complet directement dans le champ normal de question ou de réponse.",
          },
          {
            en: "The source remains unchanged in that field. The opposite live preview renders safe syntax directly. Invalid presentation values use safe defaults and are reported beside the object.",
            de: "Der Quelltext bleibt unverändert in diesem Feld. Die gegenüberliegende Live-Vorschau rendert sichere Syntax direkt. Ungültige Darstellungswerte verwenden sichere Standards und werden am Objekt gemeldet.",
            es: "El código fuente permanece sin cambios en ese campo. La vista previa en vivo opuesta renderiza la sintaxis segura directamente. Los valores de presentación inválidos usan predeterminados seguros y se reportan junto al objeto.",
            fr: "Le code source reste inchangé dans ce champ. L'aperçu en direct opposé rend directement une syntaxe sûre. Les valeurs d'affichage invalides utilisent des par défaut sécurisés et sont signalées à côté de l'objet.",
          },
          {
            en: "Keep the opening and closing triple backticks on their own lines and edit the Mermaid source in place.",
            de: "Setze die öffnenden und schließenden drei Backticks jeweils in eine eigene Zeile und bearbeite den Mermaid-Quelltext direkt an Ort und Stelle.",
            es: "Mantén las tres comillas invertidas de apertura y cierre en líneas separadas y edita el código fuente Mermaid directamente.",
            fr: "Gardez les trois backticks d'ouverture et de fermeture sur des lignes séparées et éditez le code source Mermaid directement.",
          },
          {
            en: "Mermaid, JSXGraph, and ABC share the default size=100% w=100% h=50vh bg=auto. For example: ```mermaid{size=80 w=90% h=500px bg=#18212f80}.",
            de: "Mermaid, JSXGraph und ABC verwenden gemeinsam den Standard size=100% w=100% h=50vh bg=auto. Beispiel: ```mermaid{size=80 w=90% h=500px bg=#18212f80}.",
            es: "Mermaid, JSXGraph y ABC comparten el tamaño predeterminado size=100% w=100% h=50vh bg=auto. Por ejemplo: ```mermaid{size=80 w=90% h=500px bg=#18212f80}.",
            fr: "Mermaid, JSXGraph et ABC partagent la taille par défaut size=100% w=100% h=50vh bg=auto. Par exemple : ```mermaid{size=80 w=90% h=500px bg=#18212f80}.",
          },
        ],
        bullets: [
          {
            en: "Rendering happens only on the device; no diagram source is sent to an external service.",
            de: "Die Darstellung erfolgt ausschließlich auf dem Gerät; kein Diagrammquelltext wird an einen externen Dienst gesendet.",
            es: "El renderizado ocurre solo en el dispositivo; no se envía ningún código fuente de diagrama a un servicio externo.",
            fr: "Le rendu n'a lieu que sur l'appareil ; aucun code source de schéma n'est envoyé à un service externe.",
          },
          {
            en: "Links, click callbacks, HTML, images, custom CSS, frontmatter, and init directives are rejected.",
            de: "Links, Klick-Callbacks, HTML, Bilder, eigenes CSS, Frontmatter und Init-Direktiven werden abgewiesen.",
            es: "Se rechazan los enlaces, las llamadas a devolución de clics, el HTML, las imágenes, el CSS personalizado, la frontmatter y las directivas init.",
            fr: "Les liens, les callbacks au clic, le HTML, les images, le CSS personnalisé, la frontmatter et les directives init sont rejetés.",
          },
          {
            en: "size scales only the content and accepts 25–300. Unitless size, w, and h values are percentages. w and h also accept %, px, vw, and vh; percentage height refers to the available preview or study-card height. bg accepts auto, transparent, #RGB, #RGBA, #RRGGBB, or #RRGGBBAA; the final digit or byte controls alpha.",
            de: "size skaliert nur den Inhalt und akzeptiert 25–300. Einheitenlose Werte für size, w und h sind Prozentwerte. w und h akzeptieren außerdem %, px, vw und vh; eine prozentuale Höhe bezieht sich auf die verfügbare Vorschau- oder Lernkartenhöhe. bg akzeptiert auto, transparent, #RGB, #RGBA, #RRGGBB oder #RRGGBBAA; das letzte Nibble beziehungsweise Byte steuert den Alphawert.",
            es: "size escala solo el contenido y acepta 25–300. Los valores unitless de size, w y h son porcentajes. w y h también aceptan %, px, vw y vh; la altura en porcentaje se refiere a la altura disponible del panel de vista previa o de la tarjeta de estudio. bg acepta auto, transparente, #RGB, #RGBA, #RRGGBB o #RRGGBBAA; el último dígito controla el alfa.",
            fr: "size n'échelle que le contenu et accepte 25–300. Les valeurs sans unité pour size, w et h sont des pourcentages. w et h acceptent également %, px, vw et vh ; une hauteur en pourcentage fait référence à la hauteur disponible de l'aperçu ou de la carte d'étude. bg accepte auto, transparent, #RGB, #RGBA, #RRGGBB ou #RRGGBBAA ; le dernier chiffre contrôle l'alpha.",
          },
          {
            en: "Pan by dragging with a mouse or one finger. Zoom with the mouse wheel, trackpad, or a two-finger pinch; double-click or press 0 to reset. Arrow keys pan and plus/minus zoom when the diagram is focused.",
            de: "Verschiebe mit Maus oder einem Finger. Zoome mit Mausrad, Trackpad oder Zwei-Finger-Geste; Doppelklick oder Taste 0 setzt zurück. Bei fokussiertem Diagramm verschieben die Pfeiltasten, Plus und Minus zoomen.",
            es: "Desplaza arrastrando con el ratón o un dedo. Acércate/aleja con la rueda del ratón, el trackpad o pellizco de dos dedos; haz doble clic o presiona 0 para reiniciar. Las flechas desplazan y + / - acercan/aleján cuando el diagrama está enfocado.",
            fr: "Déplacez en glissant avec la souris ou un doigt. Zoomez avec la molette de la souris, le trackpad ou une pincée à deux doigts ; double-cliquez ou appuyez sur 0 pour réinitialiser. Les flèches déplacent et + / - zoombent lorsque le schéma est au premier plan.",
          },
        ],
      },
      {
        heading: {
          en: "Flowchart example",
          de: "Beispiel: Flussdiagramm",
          es: "Ejemplo de diagrama de flujo",
          fr: "Exemple : diagramme de flux",
        },
        code: [
          "flowchart LR\n  glucose[Glucose] --> glycolysis[Glykolyse]\n  glycolysis --> pyruvate[Pyruvat]",
        ],
      },
      {
        heading: {
          en: "Sequence diagram example",
          de: "Beispiel: Sequenzdiagramm",
          es: "Ejemplo de diagrama de secuencia",
          fr: "Exemple : diagramme de séquence",
        },
        code: [
          "sequenceDiagram\n  participant L as Lernende Person\n  participant F as Flash-n-Flip\n  L->>F: Antwort aufdecken\n  F-->>L: Bewertung anbieten",
        ],
      },
      {
        heading: {
          en: "State diagram example",
          de: "Beispiel: Zustandsdiagramm",
          es: "Ejemplo de diagrama de estados",
          fr: "Exemple : diagramme d'état",
        },
        code: [
          "stateDiagram-v2\n  [*] --> Neu\n  Neu --> Lernen\n  Lernen --> Wiederholen\n  Wiederholen --> Lernen",
        ],
      },
      {
        heading: {
          en: "Mind map example",
          de: "Beispiel: Mindmap",
          es: "Ejemplo de mapa mental",
          fr: "Exemple : carte mentale",
        },
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
      es: "Gráficos interactivos (JSXGraph)",
      fr: "Graphiques interactifs (JSXGraph)",
    },
    summary: {
      en: "Create interactive 2D geometry and function plots with a readable, locally evaluated notation.",
      de: "Erstelle interaktive 2D-Geometrie und Funktionsgraphen mit einer lesbaren, lokal ausgewerteten Notation.",
      es: "Crea geometría 2D y gráficos de funciones interactivos con una notación legible evaluada localmente.",
      fr: "Créez une géométrie plane et des graphiques de fonctions interactifs avec une notation lisible évaluée localement.",
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
          es: "Escribe directamente en la tarjeta",
          fr: "Écrivez directement dans la carte",
        },
        steps: [
          {
            en: "Enter a complete ```jsxgraph code block in the normal question or answer field. There is no secondary editor.",
            de: "Gib einen vollständigen ```jsxgraph-Codeblock in das normale Frage- oder Antwortfeld ein. Es gibt keinen Zusatzeditor.",
            es: "Introduce un bloque de código ```jsxgraph completo en el campo normal de pregunta o respuesta. No hay editor secundario.",
            fr: "Entrez un bloc de code ```jsxgraph complet dans le champ question ou réponse habituel. Il n'y a pas d'éditeur secondaire.",
          },
          {
            en: "Add one quoted describe line. It is required so the construction remains understandable without sight.",
            de: "Füge eine in Anführungszeichen gesetzte describe-Zeile ein. Sie ist erforderlich, damit die Konstruktion auch ohne Sicht verständlich bleibt.",
            es: "Añade una línea describe entre comillas. Es necesaria para que la construcción siga siendo comprensible sin visión.",
            fr: "Ajoutez une ligne de description entre guillemets. Elle est requise pour que la construction reste compréhensible sans vision.",
          },
          {
            en: "Use drag=true for movable points. Pan with Shift plus mouse drag, zoom with Shift plus the wheel, or use a two-finger gesture on touch screens.",
            de: "Verwende drag=true für bewegliche Punkte. Verschiebe mit Umschalttaste und Maus, zoome mit Umschalttaste und Mausrad oder nutze auf Touchscreens eine Zwei-Finger-Geste.",
            es: "Usa drag=true para puntos móviles. Desplaza con Shift + arrastre del ratón, acércate/aleja con Shift + rueda o usa un gesto de dos dedos en pantallas táctiles.",
            fr: "Utilisez drag=true pour les points mobiles. Déplacez avec Maj + glissement de la souris, zoomez avec Maj + molette ou utilisez un geste à deux doigts sur les écrans tactiles.",
          },
        ],
        bullets: [
          {
            en: "size, w, h, and bg work exactly like Mermaid and ABC; for example ```jsxgraph{size=125% w=80% h=40vh bg=auto}.",
            de: "size, w, h und bg funktionieren genauso wie bei Mermaid und ABC, zum Beispiel ```jsxgraph{size=125% w=80% h=40vh bg=auto}.",
            es: "size, w, h y bg funcionan exactamente como en Mermaid y ABC; por ejemplo ```jsxgraph{size=125% w=80% h=40vh bg=auto}.",
            fr: "size, w, h et bg fonctionnent exactement comme dans Mermaid et ABC ; par exemple ```jsxgraph{size=125% w=80% h=40vh bg=auto}.",
          },
          {
            en: "Supported 2D objects include points, lines, segments, rays, arrows, circles, polygons, angles, arcs, sectors, intersections, parallels, perpendiculars, gliders, conics, tangents, normals, reflections, trace curves, sliders, function/parametric/polar/implicit curves, inequalities, dynamic integrals, Riemann sums, Lagrange interpolation, vector fields, and slope fields.",
            de: "Unterstützte 2D-Objekte sind unter anderem Punkte, Geraden, Strecken, Strahlen, Pfeile, Kreise, Polygone, Winkel, Bögen, Sektoren, Schnittpunkte, Parallelen, Senkrechten, Gleiter, Kegelschnitte, Tangenten, Normalen, Spiegelungen, Spurkurven, Schieberegler, Funktions-, Parameter-, Polar- und implizite Kurven, Ungleichungen, dynamische Integrale, Riemann-Summen, Lagrange-Interpolation, Vektor- und Richtungsfelder.",
            es: "Los objetos 2D soportados incluyen puntos, líneas, segmentos, rayos, flechas, círculos, polígonos, ángulos, arcos, sectores, intersecciones, paralelas, perpendiculares, deslizadores, cónicas, tangentes, normales, reflexiones, curvas de rastro, controles deslizantes, curvas funcionales/paramétricas/polares/explicitas, desigualdades, integrales dinámicas, sumas de Riemann, interpolación de Lagrange, campos vectoriales y pendientes.",
            fr: "Les objets 2D pris en charge incluent des points, lignes, segments, rayons, flèches, cercles, polygones, angles, arcs, secteurs, intersections, parallèles, perpendiculaires, curseurs, coniques, tangentes, normales, réflexions, courbes de trace, curseurs, courbes fonctionnelles/paramétriques/polares/explicites, inégalités, intégrales dynamiques, sommes de Riemann, interpolation de Lagrange, champs vectoriels et pentes.",
          },
          {
            en: "Use trace=true on a point and board traces to expose the accessible Clear traces action. Point presentation supports size, face, fillOpacity, and strokeOpacity. random(min, max, seed) is reproducible on every device.",
            de: "Mit trace=true an einem Punkt und board traces erscheint in der Infofunktion die zugängliche Aktion „Spuren löschen“. Punkte unterstützen size, face, fillOpacity und strokeOpacity. random(min, max, seed) liefert auf jedem Gerät reproduzierbare Startwerte.",
            es: "Utilice trace=true en un punto y trazas de tablero para mostrar la acción accesible Eliminar trazas. La presentación del punto admite tamaño, cara, fillOpacity y strokeOpacity. random(min, max, seed) es reproducible en cada dispositivo.",
            fr: "Utilisez trace=true sur un point et des traces de planche pour révéler l'action accessible Supprimer les tracés. La présentation du point prend en charge la taille, la face, fillOpacity et strokeOpacity. random(min, max, seed) est reproductible sur chaque appareil.",
          },
          {
            en: "Only the documented notation is evaluated. JavaScript, HTML, links, external data, images, event handlers, and every 3D object are rejected and shown as inert source.",
            de: "Ausgewertet wird nur die dokumentierte Notation. JavaScript, HTML, Links, externe Daten, Bilder, Ereignisbehandler und sämtliche 3D-Objekte werden abgewiesen und als harmloser Quelltext angezeigt.",
            es: "Solo se evalúa la notación documentada. JavaScript, HTML, enlaces, datos externos, imágenes, manejadores de eventos y cada objeto 3D son rechazados y mostrados como fuente inerte.",
            fr: "Seule la notation documentée est évaluée. Le JavaScript, le HTML, les liens, les données externes, les images, les gestionnaires d'événements et tous les objets 3D sont rejetés et affichés comme source inactive.",
          },
        ],
      },
      {
        heading: {
          en: "Interpolation, dynamic integral, and trace",
          de: "Interpolation, dynamisches Integral und Spur",
          es: "Interpolación, integral dinámica y traza",
          fr: "Interpolation, intégrale dynamique et tracé",
        },
        code: [
          'title "Interpolation und Integralspur"\ndescribe "Drei bewegliche Punkte bestimmen ein Lagrange-Polynom. Der Gleiter steuert Integralfläche und Stammfunktionspunkt."\nboard x=-3..3 y=-3..10 axes traces\nA = point(-2, random(5, 10, 11), drag=true, name="", size=2)\nB = point(0, 2, drag=true, name="", size=2)\nC = point(0.5, random(7, 8, 23), drag=true, name="", size=2)\nf = lagrange(A, B, C)\nP = plot(f, from=-3, to=3, name="", color=blue)\nS = glider(P, x=0.25, y=f(0.25), name="ziehen", color=black)\nintegralArea(f, from=A.x, to=S.x, color=yellow, fillOpacity=0.2)\nG(x) = integral(f, A.x, x)\nF = point(S.x, G(S.x), name="F", trace=true, face="square", size=5)\nT = tracecurve(S, F, name="", color=purple)',
        ],
      },
      {
        heading: {
          en: "Interactive geometry",
          de: "Interaktive Geometrie",
          es: "Geometría interactiva",
          fr: "Géométrie interactive",
        },
        code: [
          'title "Mittelsenkrechte"\ndescribe "Die beweglichen Punkte A und B bestimmen eine Strecke, ihren Mittelpunkt und die Senkrechte durch den Mittelpunkt."\nboard x=-6..6 y=-4..4 axes grid aspect=1\nA = point(-3, -1, drag=true, color=blue)\nB = point(3, 2, drag=true, color=yellow)\ns = segment(A, B)\nM = midpoint(A, B, color=red)\nn = perpendicular(s, M, color=green)',
        ],
      },
      {
        heading: {
          en: "Function family with slider",
          de: "Funktionsschar mit Schieberegler",
          es: "Familia de funciones con control deslizante",
          fr: "Famille de fonctions avec curseur",
        },
        code: [
          'title "Quadratische Funktion"\ndescribe "Der Schieberegler a verändert die Öffnung der Parabel y gleich a mal x zum Quadrat."\nboard x=-5..5 y=-4..6 axes grid\na = slider(-2, 2, value=1, step=0.1)\nf(x) = a*x^2\nplot(f, from=-5, to=5, color=blue, width=3)',
        ],
      },
      {
        heading: {
          en: "Curves and fields",
          de: "Kurven und Felder",
          es: "Curvas y campos",
          fr: "Courbes et champs",
        },
        code: [
          'title "Parameterkurve und Richtungsfeld"\ndescribe "Eine dreiblättrige Parameterkurve liegt über einem Richtungsfeld."\nboard x=-4..4 y=-4..4 axes grid aspect=1\nparametric(t, 3*cos(t), 3*sin(t), from=0, to=2*pi, color=blue)\nslopefield(x, y, x-y, density=10, color=green, alpha=0.55)',
        ],
      },
    ],
  },
  {
    id: "music-notation",
    title: {
      en: "Music notation",
      de: "Notensatz",
      es: "Notación musical",
      fr: "Partiture musicale",
    },
    summary: {
      en: "Render bounded ABC notation locally with abcjs.",
      de: "Rendere begrenzte ABC-Notation lokal mit abcjs.",
      es: "Renderice localmente la notación ABC acotada con abcjs.",
      fr: "Rendez localement une notation ABC bornée avec abcjs.",
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
        heading: {
          en: "Create a score",
          de: "Notensatz erstellen",
          es: "Crear una partitura",
          fr: "Créer une partition",
        },
        steps: [
          {
            en: "Open Music notation below the normal question or answer field, add a score, and enter its title, accessible description, and ABC source.",
            de: "Öffne unter dem normalen Frage- oder Antwortfeld den Notensatz, füge ein Notenbild hinzu und gib Titel, zugängliche Beschreibung und ABC-Quelltext ein.",
            es: "Abra la notación musical debajo del campo de pregunta o respuesta normal, añada una partitura e introduzca su título, descripción accesible y fuente ABC.",
            fr: "Ouvrez la notation musicale sous le champ de question ou de réponse normal, ajoutez une partition et entrez son titre, sa description accessible et sa source ABC.",
          },
          {
            en: "Start with X:1, add optional title, meter, note length, and tempo fields, then add K: and the notes.",
            de: "Beginne mit X:1, ergänze optional Titel, Taktart, Notenlänge und Tempo, dann K: und die Noten.",
            es: "Comience con X:1, añada opcionalmente campos de título, compás, duración de la nota y tempo, luego añada K: y las notas.",
            fr: "Commencez par X:1, ajoutez optionnellement des champs de titre, mesure, durée de note et tempo, puis ajoutez K: et les notes.",
          },
          {
            en: "The editor validates changes and shows a local preview. Existing fenced ```abc and ```music blocks in Markdown remain supported.",
            de: "Der Editor prüft Änderungen und zeigt eine lokale Vorschau. Vorhandene ```abc- und ```music-Blöcke im Markdown bleiben unterstützt.",
            es: "El editor valida los cambios y muestra una vista previa local. Los bloques ```abc y ```music delimitados existentes en Markdown siguen siendo compatibles.",
            fr: "L'éditeur valide les modifications et affiche un aperçu local. Les blocs ```abc et ```music délimités existants dans le Markdown restent pris en charge.",
          },
          {
            en: "On cards, title, description, score metadata, and the event list stay hidden until you open the information button in the score.",
            de: "Auf Karten bleiben Titel, Beschreibung, Notensatz-Metadaten und Ereignisliste verborgen, bis du die Informationstaste im Notenblatt öffnest.",
            es: "En las tarjetas, el título, la descripción, los metadatos de la partitura y la lista de eventos permanecen ocultos hasta que abres el botón de información en la partitura.",
            fr: "Sur les cartes, le titre, la description, les métadonnées de partition et la liste des événements restent cachés jusqu'à ce que vous ouvriez le bouton d'information dans la partition.",
          },
        ],
        bullets: [
          {
            en: "Rendering happens locally and offline; the ABC source is not sent to a service.",
            de: "Die Darstellung erfolgt lokal und offline; der ABC-Quelltext wird an keinen Dienst gesendet.",
            es: "El renderizado ocurre localmente y sin conexión; el código fuente ABC no se envía a un servicio.",
            fr: "Le rendu s'effectue localement et hors ligne ; la source ABC n'est pas envoyée à un service.",
          },
          {
            en: "Playback uses a bundled CC0 piano sample set. It starts only after pressing Play and does not load a remote Soundfont or use the microphone.",
            de: "Die Wiedergabe verwendet einen mitgelieferten CC0-Klavierklang. Sie startet erst nach einem Druck auf Wiedergabe, lädt keinen entfernten Soundfont und verwendet kein Mikrofon.",
            es: "La reproducción utiliza un conjunto de muestras de piano CC0 incluido. Solo comienza después de presionar Reproducir y no carga un Soundfont remoto ni usa el micrófono.",
            fr: "La lecture utilise un ensemble d'échantillons de piano CC0 inclus. Elle ne démarre qu'après avoir appuyé sur Lecture et ne charge pas de Soundfont distant ni n'utilise le microphone.",
          },
          {
            en: "Comments and supported import directives are removed inertly; unknown directives and fields, HTML, scripts, URLs, and external resources are rejected.",
            de: "Kommentare und unterstützte Importdirektiven werden inert entfernt; unbekannte Direktiven und Felder, HTML, Skripte, URLs und externe Ressourcen werden abgewiesen.",
            es: "Los comentarios y las directivas de importación compatibles se eliminan inertemente; las directivas y campos desconocidos, HTML, scripts, URLs y recursos externos son rechazados.",
            fr: "Les commentaires et les directives d'importation prises en charge sont supprimés inerte ; les directives et champs inconnus, le HTML, les scripts, les URL et les ressources externes sont rejetés.",
          },
          {
            en: "Use chords such as [CEG] for simultaneous notes. Up to four independent ABC voices are supported, but a piano score normally uses the two staves RH and LH.",
            de: "Schreibe gleichzeitige Töne als Akkord, zum Beispiel [CEG]. Bis zu vier unabhängige ABC-Stimmen sind möglich; ein Klaviersatz verwendet normalerweise jedoch die zwei Systeme RH und LH.",
            es: "Utilice acordes como [CEG] para notas simultáneas. Se admiten hasta cuatro voces ABC independientes, pero una partitura de piano normalmente usa los dos pentagramas RH y LH.",
            fr: "Utilisez des accords comme [CEG] pour les notes simultanées. Jusqu'à quatre voix ABC indépendantes sont prises en charge, mais une partition de piano utilise normalement deux portées RH et GH.",
          },
          {
            en: "The synchronized 88-key keyboard flashes each attack at full strength and keeps the key highlighted at half strength for its notated duration. keyboard=notes shows note names, keyboard=keys only the keys, and keyboard=off hides it.",
            de: "Die synchronisierte 88-Tasten-Klaviatur zeigt jeden Anschlag zunächst kräftig und die Taste anschließend für ihre notierte Dauer mit halber Intensität. keyboard=notes zeigt Notennamen, keyboard=keys nur die Tasten und keyboard=off blendet sie aus.",
            es: "El teclado sincronizado de 88 teclas parpadea cada ataque a plena potencia y mantiene la tecla resaltada a mitad de intensidad durante su duración anotada. keyboard=notes muestra los nombres de las notas, keyboard=keys solo las teclas y keyboard=off lo oculta.",
            fr: "Le clavier synchronisé à 88 touches fait clignoter chaque attaque à pleine puissance et maintient la touche surlignée à mi-intensité pendant sa durée notée. keyboard=notes affiche les noms des notes, keyboard=keys uniquement les touches et keyboard=off le masque.",
          },
          {
            en: "In standard piano notation the upper staff is usually played by the right hand and the lower staff by the left; hand crossings and exceptions are possible. FNF uses the declared treble and bass voices: dark blue marks the left hand and bright yellow marks the right hand, both in the score and on the keyboard.",
            de: "Im üblichen Klaviersatz spielt die rechte Hand meist das obere und die linke Hand das untere System; Handkreuzungen und Ausnahmen sind möglich. FNF orientiert sich an den deklarierten Violin- und Bassstimmen: Dunkles Blau markiert die linke, helles Gelb die rechte Hand – im Notenbild und auf der Klaviatur.",
            es: "En la notación de piano estándar, el pentagrama superior suele tocarse con la mano derecha y el inferior con la izquierda; son posibles los cruces de manos y las excepciones. FNF utiliza las voces declaradas de solfeo y bajo: azul oscuro marca la mano izquierda y amarillo brillante la mano derecha, tanto en la partitura como en el teclado.",
            fr: "Dans une notation pianistique standard, le système supérieur est généralement joué par la main droite et le inférieur par la gauche ; les croisements de mains et exceptions sont possibles. FNF utilise les voix déclarées d'alto et de basse : bleu foncé marque la main gauche et jaune vif la main droite, tant dans la partition que sur le clavier.",
          },
          {
            en: "The complete keyboard scales to the available width and never moves sideways. During playback it stays at the lower edge while the score area scrolls only when the active notes would otherwise leave view.",
            de: "Die vollständige Klaviatur skaliert auf die verfügbare Breite und bewegt sich nicht seitlich. Beim Abspielen bleibt sie am unteren Rand, während der Notenbereich nur dann nachführt, wenn die aktiven Noten sonst aus dem Sichtfeld geraten würden.",
            es: "El teclado completo se escala al ancho disponible y nunca se desplaza lateralmente. Durante la reproducción, permanece en el borde inferior mientras que el área de partitura solo hace scroll cuando las notas activas dejarían de estar visibles.",
            fr: "Le clavier complet s'adapte à la largeur disponible et ne défile jamais latéralement. Lors du lecture, il reste au bas de l'écran tandis que la zone de partition fait défiler uniquement lorsque les notes actives risqueraient de sortir du champ visuel.",
          },
          {
            en: "Use A and B while stopped to set a temporary practice start and end at the current note. Navigation stays inside this range, and playback pauses automatically after the B note or at the end of the score. Press an active marker again to clear it.",
            de: "Setze im Stoppmodus mit A und B einen temporären Übungsanfang und ein Übungsende an der aktuellen Note. Die Navigation bleibt in diesem Bereich; nach der B-Note beziehungsweise am Stückende pausiert die Wiedergabe automatisch. Drücke eine aktive Markierung erneut, um sie zu löschen.",
            es: "Usa A y B en pausa para establecer un inicio y fin temporales de práctica en la nota actual. La navegación se mantiene dentro de este rango, y la reproducción se detiene automáticamente tras la nota B o al final de la pieza. Pulsa una marca activa nuevamente para eliminarla.",
            fr: "Utilisez A et B à l'arrêt pour définir un début et une fin d'exercice temporaires sur la note actuelle. La navigation reste dans cette plage, et la lecture se met en pause automatiquement après la note B ou à la fin de la pièce. Appuyez à nouveau sur une marque active pour la supprimer.",
          },
          {
            en: "Flute, guitar, violin and other instruments are planned as separate sound and learning views instead of reusing a piano keyboard.",
            de: "Flöte, Gitarre, Violine und weitere Instrumente sind als eigene Klang- und Lernansichten geplant, nicht als Varianten einer Klaviatur.",
            es: "Se planifican flauta, guitarra, violín y otros instrumentos como vistas de sonido y aprendizaje separadas en lugar de reutilizar un teclado de piano.",
            fr: "La flute, la guitare, le violon et d'autres instruments sont prévus comme des vues sonores et d'apprentissage séparées plutôt que comme des variantes d'un clavier de piano.",
          },
        ],
      },
      {
        heading: {
          en: "Compact Markdown options",
          de: "Kompakte Markdown-Optionen",
          es: "Opciones Markdown compactas",
          fr: "Options Markdown compactes",
        },
        paragraphs: [
          {
            en: "Enable Continue without rating in the card editor when a question should show only Continue. The card then remains scheduler-neutral and does not write learning progress.",
            de: "Aktiviere im Karteneditor Ohne Bewertung fortfahren, wenn eine Frage nur Weiter zeigen soll. Die Karte bleibt dann planungsneutral und schreibt keinen Lernfortschritt.",
            es: "Activa Continuar sin calificar en el editor de tarjetas cuando una pregunta debe mostrar solo Continuar. La tarjeta permanece entonces neutral al planificador y no escribe progreso de aprendizaje.",
            fr: "Active « Continuer sans noter » dans l'éditeur de cartes lorsqu'une question doit afficher uniquement la suite. La carte reste alors neutre pour le planning et n'enregistre pas les progrès d'apprentissage.",
          },
          {
            en: "Add shared options directly to the opening fence, for example ```music{size=70 w=100% h=50vh bg=auto bars=auto select=RH keyboard=notes}. size accepts 25–300 with or without %; bars accepts auto or 1 to 12 measures per line; select shows and plays only the named ABC voice.",
            de: "Ergänze die gemeinsamen Optionen direkt am öffnenden Zaun, zum Beispiel ```music{size=70 w=100% h=50vh bg=auto bars=auto select=RH keyboard=notes}. size akzeptiert 25–300 mit oder ohne %; bars akzeptiert auto oder 1 bis 12 Takte pro Zeile; select zeigt und spielt nur die benannte ABC-Stimme.",
            es: "Añade opciones compartidas directamente a la valla de apertura, por ejemplo ```music{size=70 w=100% h=50vh bg=auto bars=auto select=RH keyboard=notes}. size acepta 25–300 con o sin %; bars acepta auto o 1 hasta 16 compases por línea; select muestra y reproduce solo la voz ABC nombrada.",
            fr: "Ajoutez les options partagées directement à l'enceinte d'ouverture, par exemple ```music{size=70 w=100% h=50vh bg=auto bars=auto select=RH keyboard=notes}. size accepte 25–300 avec ou sans % ; bars accepte auto ou de 1 à 16 mesures par ligne ; select affiche et joue uniquement la voix ABC nommée.",
          },
        ],
      },
      {
        heading: {
          en: "C major example",
          de: "Beispiel: C-Dur",
          es: "Ejemplo en Do mayor",
          fr: "Exemple : Ut majeur",
        },
        code: [
          "X:1\nT:C major scale\nM:4/4\nL:1/4\nQ:120\nK:C clef=treble\nC D E F | G A B c |",
        ],
      },
      {
        heading: {
          en: "Bass clef example",
          de: "Beispiel: Bassschlüssel",
          es: "Ejemplo con clave de bajo",
          fr: "Exemple avec clé de basse",
        },
        code: [
          "X:1\nT:Bass notes\nM:3/4\nL:1/4\nK:F clef=bass\nF, A, C | F2 z |",
        ],
      },
      {
        heading: {
          en: "Longer example: opening of Für Elise",
          de: "Längeres Beispiel: Anfang von Für Elise",
          es: "Ejemplo más largo: apertura de Für Elise",
          fr: "Exemple plus long : début de Pour Élise",
        },
        paragraphs: [
          {
            en: "A compact two-staff piano transcription with simultaneous notes. Copy the complete block into the ABC source field; use select=RH or select=LH to practise one hand.",
            de: "Eine kompakte Klavierübertragung auf zwei Systemen mit gleichzeitigen Tönen. Kopiere den vollständigen Block in das ABC-Feld; mit select=RH oder select=LH kannst du eine Hand üben.",
            es: "Una transcripción compacta para piano en dos pentagramas con notas simultáneas. Copia el bloque completo al campo de origen ABC; usa select=RH o select=LH para practicar una mano.",
            fr: "Une transcription pianistique compacte sur deux systèmes avec des notes simultanées. Copiez le bloc complet dans le champ source ABC ; utilisez select=RH ou select=LH pour pratiquer une main.",
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
    title: {
      en: "Studying and ratings",
      de: "Lernen und Bewerten",
      es: "Estudio y calificaciones",
      fr: "Étude et notation",
    },
    summary: {
      en: "Understand the study order, answer reveal, and rating buttons.",
      de: "Verstehe Lernreihenfolge, Antwortanzeige und Bewertungsbuttons.",
      es: "Comprende el orden de estudio, la revelación de respuestas y los botones de calificación.",
      fr: "Comprenez l'ordre d'étude, le dévoilement des réponses et les boutons de notation.",
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
        heading: {
          en: "Study order",
          de: "Lernreihenfolge",
          es: "Orden de estudio",
          fr: "Ordre d'étude",
        },
        paragraphs: [
          {
            en: "Sequential decks keep their defined card order. Other decks are mixed while still respecting the spaced-repetition schedule. Collections can interleave cards from their visible subdecks.",
            de: "Sequenzielle Lernsets behalten ihre festgelegte Kartenreihenfolge. Andere Lernsets werden unter Beachtung des Wiederholungsplans gemischt. Collections können Karten aus ihren sichtbaren Unterdecks abwechseln.",
            es: "Los mazo secuenciales mantienen su orden definido de tarjetas. Otros mazos se mezclan respetando el plan de repetición espaciada. Las colecciones pueden intercalar tarjetas de sus submazos visibles.",
            fr: "Les paquets séquentiels conservent leur ordre défini de cartes. Les autres paquets sont mélangés tout en respectant le planning de répétition espacée. Les collections peuvent alterner des cartes issues de leurs sous-paquets visibles.",
          },
          {
            en: "The study header and the answer or navigation controls remain visible. If a card is longer than the available space, only its content area scrolls vertically.",
            de: "Der Kopfbereich sowie die Bewertungs- oder Navigationsschaltflächen bleiben beim Lernen sichtbar. Ist eine Karte länger als der verfügbare Platz, scrollt nur ihr Inhaltsbereich vertikal.",
            es: "El encabezado del estudio y los controles de respuesta o navegación permanecen visibles. Si una tarjeta es más larga que el espacio disponible, solo su área de contenido hace scroll verticalmente.",
            fr: "L'en-tête d'étude ainsi que les boutons de réponse ou de navigation restent visibles pendant l'apprentissage. Si une carte est plus longue que l'espace disponible, seule sa zone de contenu défile verticalement.",
          },
        ],
      },
      {
        heading: {
          en: "Ratings",
          de: "Bewertungen",
          es: "Calificaciones",
          fr: "Notations",
        },
        bullets: [
          {
            en: "Again: you did not remember the answer.",
            de: "Nochmal: Du konntest dich nicht erinnern.",
            es: "Nuevamente: no te acordaste de la respuesta.",
            fr: "Encore : vous ne vous souvenez pas de la réponse.",
          },
          {
            en: "Hard: correct, but with considerable effort.",
            de: "Schwer: richtig, aber mit deutlicher Anstrengung.",
            es: "Difícil: correcto, pero con considerable esfuerzo.",
            fr: "Difficile : correct, mais avec un effort considérable.",
          },
          {
            en: "Good: correct with normal effort.",
            de: "Gut: richtig mit normalem Aufwand.",
            es: "Bueno: correcto con el esfuerzo normal.",
            fr: "Bien : correct avec l'effort habituel.",
          },
          {
            en: "Easy: immediately and confidently correct.",
            de: "Leicht: sofort und sicher richtig.",
            es: "Fácil: inmediatamente y seguro que es correcto.",
            fr: "Facile : immédiatement et sûrement correct.",
          },
        ],
        paragraphs: [
          {
            en: "Incorrect cloze or map choices progressively disable overly positive ratings. Listening to an individual cloze choice counts as one hint and makes Easy unavailable. A correct first answer without a hint leaves the full rating range available.",
            de: "Falsche Lücken- oder Kartenauswahlen deaktivieren schrittweise zu positive Bewertungen. Das Anhören einer einzelnen Lückenauswahl zählt als ein Hinweis und sperrt Leicht. Bei einer sofort richtigen Antwort ohne Hinweis bleiben alle Bewertungen verfügbar.",
            es: "Las selecciones incorrectas de relleno o mapas desactivan progresivamente las calificaciones excesivamente positivas. Escuchar una opción individual de relleno cuenta como un consejo y hace no disponible Fácil. Una respuesta correcta inicial sin consejos deja toda la gama de calificaciones disponible.",
            fr: "Les choix d'interpolation ou de carte incorrects désactivent progressivement les évaluations trop positives. L'écoute d'un seul choix d'interpolation compte comme une indication et rend Facile indisponible. Une première réponse correcte sans indice laisse toute la gamme des notes disponible.",
          },
        ],
      },
      {
        heading: {
          en: "Practice all and reset",
          de: "Alle üben und zurücksetzen",
          es: "Practicar todo y reiniciar",
          fr: "S'entraîner à tout et réinitialiser",
        },
        paragraphs: [
          {
            en: "Practice all goes through every card without changing due dates. Reset progress deliberately starts the selected deck and its subdecks again.",
            de: "Alle üben geht jede Karte durch, ohne Fälligkeiten zu verändern. Fortschritt zurücksetzen startet das gewählte Lernset und seine Unterdecks bewusst neu.",
            es: "Practicar todo recorre cada tarjeta sin cambiar las fechas de vencimiento. Reiniciar el progreso inicia deliberadamente la baraja seleccionada y sus subbarajas nuevamente.",
            fr: "S'entraîner à tout parcourt chaque carte sans modifier les dates d'échéance. Réinitialiser le progrès redémarbe intentionnellement l'étude sélectionnée et ses sous-études.",
          },
        ],
      },
      {
        heading: {
          en: "Keep studying after today is complete",
          de: "Nach dem Tagesabschluss weiterlernen",
          es: "Continuar estudiando después de completar hoy",
          fr: "Continuer à étudier après avoir terminé la journée",
        },
        paragraphs: [
          {
            en: "When no cards are due, you can start another rated run filtered by each card’s most recent rating. Again, Hard and Good are selected by default; Easy is initially excluded. For example, leave only Again selected to repeat cards you last forgot. These additional ratings continue to update the regular learning schedule.",
            de: "Wenn keine Karten mehr fällig sind, kannst du einen weiteren bewerteten Durchlauf nach der jeweils letzten Einstufung starten. Nochmal, Schwer und Gut sind standardmäßig ausgewählt; Leicht ist zunächst ausgeschlossen. Lasse zum Beispiel nur Nochmal ausgewählt, um zuletzt vergessene Karten erneut zu lernen. Die zusätzlichen Bewertungen aktualisieren weiterhin den regulären Lernplan.",
            es: "Cuando no hay tarjetas pendientes, puedes iniciar otra sesión de calificación filtrada por la última clasificación de cada tarjeta. De nuevo, Difícil y Bueno están seleccionados por defecto; Fácil se excluye inicialmente. Por ejemplo, deja solo seleccionado Repetir para volver a estudiar las que olvidaste recientemente. Estas clasificaciones adicionales siguen actualizando el horario de aprendizaje regular.",
            fr: "Lorsqu'aucune carte n'est due, vous pouvez démarrer une autre session d'évaluation filtrée par la dernière note de chaque carte. Encore une fois, Difficile et Bien sont sélectionnés par défaut ; Facile est initialement exclu. Par exemple, laissez seulement Répéter sélectionné pour réétudier les cartes que vous avez oubliées récemment. Ces évaluations supplémentaires continuent à mettre à jour le calendrier d'apprentissage régulier.",
          },
        ],
      },
    ],
  },
  {
    id: "interactive-maps",
    title: {
      en: "Interactive maps",
      de: "Interaktive Karten",
      es: "Mapas interactivos",
      fr: "Cartes interactives",
    },
    summary: {
      en: "Explore countries, practice recognition, and configure map information.",
      de: "Erkunde Länder, übe ihre Erkennung und konfiguriere Karteninformationen.",
      es: "Explora países, practica el reconocimiento y configura la información del mapa.",
      fr: "Explorez les pays, pratiquez leur reconnaissance et configurez les informations de carte.",
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
        heading: {
          en: "Explore and study",
          de: "Erkunden und lernen",
          es: "Explorar y estudiar",
          fr: "Explorer et étudier",
        },
        bullets: [
          {
            en: "Explore map shows information while hovering or selecting an entry in the country list.",
            de: "Erkunden zeigt Informationen beim Überfahren oder Auswählen eines Eintrags in der Länderliste.",
            es: "El modo Explorar muestra información al pasar el cursor o seleccionar una entrada en la lista de países.",
            fr: "L'option Explorer affiche des informations au survol ou lors de la sélection d'une entrée dans la liste des pays.",
          },
          {
            en: "Level 1 highlights a region that you name.",
            de: "Stufe 1 hebt eine Region hervor, die du benennst.",
            es: "El nivel 1 resalta una región que tú nombras.",
            fr: "Le niveau 1 met en surbrillance une région que vous nommez.",
          },
          {
            en: "Level 2 shows a name and asks you to locate the region.",
            de: "Stufe 2 zeigt einen Namen und lässt dich die Region finden.",
            es: "El nivel 2 muestra un nombre y te pide localizar la región.",
            fr: "Le niveau 2 affiche un nom et vous demande de situer la région.",
          },
          {
            en: "In Card run, the speaker toggle reads the requested region in level 2 and the answer after reveal, so the map remains free for hovering, panning, and selection.",
            de: "Im Kartendurchlauf liest der Lautsprecher-Schalter in Stufe 2 die gesuchte Region und nach dem Aufdecken die Antwort vor. Die Karte bleibt dadurch frei zum Überfahren, Verschieben und Auswählen.",
            es: "En el modo Tarjeta, el interruptor de voz lee la región solicitada en el nivel 2 y la respuesta tras revelar, por lo que el mapa permanece libre para pasar el cursor, desplazarse y seleccionar.",
            fr: "Dans le mode Carte, l'interrupteur audio lit la région demandée au niveau 2 et la réponse après révélation ; ainsi, la carte reste libre pour survoler, dépanner et sélectionner.",
          },
        ],
      },
      {
        heading: {
          en: "Map controls",
          de: "Kartensteuerung",
          es: "Controles del mapa",
          fr: "Contrôles de la carte",
        },
        paragraphs: [
          {
            en: "Drag to pan and pinch or use the mouse wheel to zoom around the pointer position. Map gestures affect only the map. Open the cog menu to show or hide names, capitals, country lists, and available administrative levels.",
            de: "Ziehe zum Verschieben und zoome per Pinch oder Mausrad um die Zeigerposition. Kartengesten wirken nur auf die Karte. Im Zahnrad-Menü lassen sich Namen, Hauptstädte, Länderlisten und verfügbare Verwaltungsebenen ein- oder ausblenden.",
            es: "Arrastra para desplazarte y pellizca o usa la rueda del ratón para hacer zoom alrededor de la posición del puntero. Los gestos del mapa solo afectan al mapa. Abre el menú engranaje para mostrar u ocultar nombres, capitales, listas de países y niveles administrativos disponibles.",
            fr: "Glissez pour déplacer et pincez ou utilisez la molette de la souris pour zoomer autour de l'emplacement du pointeur. Les gestes carte n'affectent que la carte. Ouvrez le menu engrenage pour afficher ou masquer les noms, capitales, listes de pays et niveaux administratifs disponibles.",
          },
        ],
      },
      {
        heading: {
          en: "Overlay layers",
          de: "Overlay-Ebenen",
          es: "Capas superpuestas",
          fr: "Couches superposées",
        },
        paragraphs: [
          {
            en: "Available layers such as the European Union, NATO, or the Schengen Area can be toggled independently. Layer membership is shown in addition to the learning state, not as a replacement for it.",
            de: "Verfügbare Ebenen wie Europäische Union, NATO oder Schengenraum können unabhängig umgeschaltet werden. Die Zugehörigkeit wird zusätzlich zum Lernstatus dargestellt und ersetzt ihn nicht.",
            es: "Las capas disponibles, como la Unión Europea, la OTAN o el Espacio Schengen, pueden activarse de forma independiente. La pertenencia a una capa se muestra junto al estado de aprendizaje y no lo sustituye.",
            fr: "Les couches disponibles, telles que l'Union européenne, l'OTAN ou l'Espace Schengen, peuvent être activées indépendamment. L'appartenance à une couche est affichée en plus de l'état d'apprentissage et ne le remplace pas.",
          },
        ],
      },
    ],
  },
  {
    id: "import-export",
    title: {
      en: "Import and export",
      de: "Import und Export",
      es: "Importar y exportar",
      fr: "Importer et exporter",
    },
    summary: {
      en: "Bring in Anki packages and create protected Flash-n-Flip exports.",
      de: "Importiere Anki-Pakete und erstelle geschützte Flash-n-Flip-Exporte.",
      es: "Importa paquetes de Anki y crea exportaciones Flash-n-Flip protegidas.",
      fr: "Importez des paquets Anki et créez des exports Flash-n-Flip protégés.",
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
        heading: {
          en: "Anki import",
          de: "Anki-Import",
          es: "Importar de Anki",
          fr: "Importer depuis Anki",
        },
        paragraphs: [
          {
            en: "Open Decks, choose Import, and select an APKG file with up to 256 MB and 50,000 cards. The progress display first shows the uploaded percentage and then the package processing. Decks from one package are grouped in a collection so the complete import can be managed together. Referenced speech audio is safely normalized and stored as compact AAC when beneficial; the original APKG remains unchanged. Import notices identify content that required conversion or could not be preserved.",
            de: "Öffne Lernsets, wähle Importieren und anschließend eine APKG-Datei mit maximal 256 MB und 50.000 Karten. Die Fortschrittsanzeige zeigt zuerst den übertragenen Anteil und danach die Verarbeitung des Pakets. Lernsets aus einem Paket werden in einer Collection zusammengefasst, damit der gesamte Import gemeinsam verwaltet werden kann. Referenzierte Sprachaufnahmen werden sicher normalisiert und bei Vorteil als kompaktes AAC gespeichert; das ursprüngliche APKG bleibt unverändert. Importhinweise nennen Inhalte, die umgewandelt wurden oder nicht erhalten werden konnten.",
            es: "Abre los mazo, elige Importar y selecciona un archivo APKG de hasta 256 MB con 50.000 tarjetas. La visualización del progreso muestra primero el porcentaje cargado y luego el procesamiento del paquete. Los mazos de un mismo paquete se agrupan en una colección para gestionar la importación completa junto. Las grabaciones de audio referenciadas se normalizan de forma segura y se almacenan como AAC compacto cuando es beneficioso; el APKG original permanece sin cambios. Los avisos de importación identifican los contenidos que requirieron conversión o no pudieron conservarse.",
            fr: "Ouvrez les decks, choisissez Importer puis sélectionnez un fichier APKG d'un maximum de 256 Mo et 50 000 cartes. L'affichage des progrès montre d'abord le pourcentage téléchargé, puis le traitement du paquet. Les decks provenant d'un même paquet sont regroupés dans une collection afin que l'importation complète puisse être gérée ensemble. Les enregistrements audio référencés sont normalisés de manière sécurisée et stockés sous format AAC compact lorsque cela est bénéfique ; le fichier APKG original reste inchangé. Les notifications d'import identifient les contenus ayant nécessité une conversion ou qui n'ont pas pu être conservés.",
          },
          {
            en: "Anki does not provide a dependable standardized source and target language. Select the initial question and answer languages before import. The direction applies to every imported deck and can be corrected per deck afterward under Language direction; choosing the same language marks one-language, non-translation content.",
            de: "Anki liefert keine verlässliche standardisierte Quell- und Zielsprache. Wähle deshalb vor dem Import die anfängliche Sprache der Fragen und Antworten. Die Richtung gilt zunächst für alle importierten Lernsets und kann danach je Lernset unter Sprachrichtung korrigiert werden; die gleiche Sprache kennzeichnet einsprachige Inhalte ohne Übersetzungsrichtung.",
            es: "Anki no proporciona una fuente y un idioma objetivo estandarizados fiables. Selecciona los idiomas inicial de pregunta y respuesta antes de importar. La dirección se aplica a cada mazo importado y puede corregirse posteriormente por mazo bajo Dirección del lenguaje; elegir el mismo idioma marca contenidos monolingües sin traducción.",
            fr: "Anki ne fournit pas une source et une langue cible standardisées fiables. Sélectionnez donc les langues initiales des questions et réponses avant l'importation. La direction s'applique d'abord à tous les decks importés et peut être corrigée par deck ultérieurement sous Direction de la langue ; choisir la même langue indique un contenu monolingue sans traduction.",
          },
          {
            en: "After analysis, you can create subdecks from up to four Anki fields and arrange their hierarchy. For example, selecting Unit groups all cards below their Unit value; cards without a value are kept in a clearly named fallback subdeck.",
            de: "Nach der Analyse kannst du aus bis zu vier Anki-Feldern Unterdecks erzeugen und ihre Hierarchie ordnen. Die Auswahl Einheit gruppiert zum Beispiel alle Karten unter ihrem Einheitswert; Karten ohne Wert bleiben in einem eindeutig benannten Ersatz-Unterdeck erhalten.",
            es: "Después del análisis, puedes crear submazos a partir de hasta cuatro campos de Anki y organizar su jerarquía. Por ejemplo, seleccionar Unidad agrupa todas las tarjetas bajo su valor de Unidad; las tarjetas sin valor se mantienen en un submazo alternativo claramente nombrado.",
            fr: "Après l'analyse, vous pouvez créer des sous-paquets à partir d'un maximum de quatre champs Anki et organiser leur hiérarchie. Par exemple, sélectionner Unité regroupe toutes les cartes situées sous sa valeur ; les cartes sans valeur restent dans un sous-paquet alternatif clairement nommé.",
          },
          {
            en: "Choose an import profile after analysis or create one from the package. In a profile, [[Field]] inserts a sanitized Anki field into a question or answer written with the Flash-n-Flip Wiki syntax. Text fields can use a named style such as [[Field]]{hint} or [[Field]]{accent}; bright and dark appearances follow the active theme. Each note type can generate several normal, reverse, cloze, table, or linked follow-up cards. Saved profiles remain on this device and can be reused with packages whose note-type name and required fields match.",
            de: "Wähle nach der Analyse ein Importprofil oder erstelle eines aus dem Paket. Im Profil setzt [[Feld]] ein bereinigtes Anki-Feld in eine Frage oder Antwort in der Flash-n-Flip-Wiki-Syntax ein. Textfelder können einen benannten Stil wie [[Feld]]{hint} oder [[Feld]]{accent} verwenden; die helle und dunkle Darstellung folgt dem aktiven Theme. Jeder Notiztyp kann mehrere normale, umgekehrte, Lückentext-, Tabellen- oder verknüpfte Folgekarten erzeugen. Gespeicherte Profile bleiben auf diesem Gerät und lassen sich für Pakete mit passendem Notiztypnamen und passenden Pflichtfeldern wiederverwenden.",
            es: "Elige un perfil de importación después del análisis o crea uno desde el paquete. En un perfil, [[Campo]] inserta un campo Anki depurado en una pregunta o respuesta escrita con la sintaxis Wiki Flash-n-Flip. Los campos de texto pueden usar un estilo nombrado como [[Campo]{hint} o [[Campo]{accent}; los aspectos claro y oscuro siguen el tema activo. Cada tipo de nota puede generar varias tarjetas normales, inversas, cloze, tabulares o seguidoras vinculadas. Los perfiles guardados permanecen en este dispositivo y se pueden reutilizar con paquetes cuyo nombre de tipo de nota y campos requeridos coincidan.",
            fr: "Choisissez un profil d'importation après l'analyse ou créez-en un à partir du paquet. Dans le profil, [[Champ]] insère un champ Anki épuré dans une question ou réponse rédigée avec la syntaxe Wiki Flash-n-Flip. Les champs de texte peuvent utiliser un style nommé comme [[Champ]{hint} ou [[Champ]{accent} ; les aspects clair et sombre suivent le thème actif. Chaque type de note peut générer plusieurs cartes normales, inverses, à trous, sous forme de tableau ou liées en suite. Les profils sauvegardés restent sur cet appareil et peuvent être réutilisés avec des paquets dont le nom du type de note et les champs requis correspondent.",
          },
        ],
      },
      {
        heading: {
          en: "Protected export",
          de: "Geschützter Export",
          es: "Exportación protegida",
          fr: "Exportation protégée",
        },
        paragraphs: [
          {
            en: "Use Protected export in the deck editor to download a Flash-n-Flip package. You can export a complete hierarchy or an individual deck where offered.",
            de: "Nutze Geschützter Export im Lernset-Editor, um ein Flash-n-Flip-Paket herunterzuladen. Wo angeboten, kannst du eine vollständige Hierarchie oder ein einzelnes Lernset exportieren.",
            es: "Usa la exportación protegida en el editor de mazos para descargar un paquete Flash-n-Flip. Puedes exportar una jerarquía completa o un mazo individual si está disponible.",
            fr: "Utilisez l'exportation protégée dans l'éditionneur de decks pour télécharger un paquet Flash-n-Flip. Si proposé, vous pouvez exporter une hiérarchie complète ou un deck individuel.",
          },
        ],
      },
    ],
  },
  {
    id: "sync-and-offline",
    title: {
      en: "Offline use and device transfer",
      de: "Offline-Nutzung und Geräteübertragung",
      es: "Uso offline y transferencia de dispositivos",
      fr: "Utilisation hors ligne et transfert d'appareil",
    },
    summary: {
      en: "Understand local storage and move a complete FNF backup explicitly.",
      de: "Verstehe die lokale Speicherung und übertrage eine vollständige FNF-Sicherung ausdrücklich.",
      es: "Comprende el almacenamiento local y mueve una copia de seguridad FNF completa explícitamente.",
      fr: "Comprennez le stockage local et transférez explicitement une sauvegarde FNF complète.",
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
        heading: {
          en: "Local by default",
          de: "Standardmäßig lokal",
          es: "Local por defecto",
          fr: "Par défaut, local",
        },
        paragraphs: [
          {
            en: "The Apple app starts and remains usable without flash-n-flip.com. Creating, editing, studying, media playback, and local recovery use the bundled application and local SQLite storage.",
            de: "Die Apple-App startet und bleibt ohne flash-n-flip.com nutzbar. Erstellen, Bearbeiten, Lernen, Medienwiedergabe und lokale Wiederherstellung verwenden die gebündelte Anwendung und den lokalen SQLite-Speicher.",
            es: "La aplicación de Apple inicia y permanece utilizable sin flash-n-flip.com. Crear, editar, estudiar, reproducir medios y recuperar datos locales utilizan la aplicación integrada y el almacenamiento SQLite local.",
            fr: "L'application Apple démarre et reste utilisable sans flash-n-flip.com. La création, l'édition, les études, la lecture multimédia et la récupération locale utilisent l'application intégrée et le stockage SQLite local.",
          },
        ],
      },
      {
        heading: {
          en: "Create a backup",
          de: "Sicherung erstellen",
          es: "Crear una copia de seguridad",
          fr: "Créer une sauvegarde",
        },
        bullets: [
          {
            en: "Open Settings and choose Download data to export decks, cards, media, settings, and learning progress.",
            de: "Öffne die Einstellungen und wähle Daten herunterladen, um Lernsets, Karten, Medien, Einstellungen und Lernfortschritt zu exportieren.",
            es: "Abre Configuración y elige Descargar datos para exportar mazos, tarjetas, medios, configuraciones y progreso de aprendizaje.",
            fr: "Ouvrez Paramètres et choisissez Télécharger les données pour exporter des decks, cartes, médias, paramètres et progrès d'apprentissage.",
          },
          {
            en: "Keep the exported FNF backup in a location you control. It is the recovery and device-transfer path until iCloud is released.",
            de: "Bewahre die exportierte FNF-Sicherung an einem von dir kontrollierten Ort auf. Sie ist bis zur Einführung von iCloud der Wiederherstellungs- und Geräteübertragungsweg.",
            es: "Mantén la copia de seguridad FNF exportada en un lugar que controles. Es el camino para recuperar datos y transferir dispositivos hasta que se lance iCloud.",
            fr: "Conservez la sauvegarde FNF exportée dans un endroit sous votre contrôle. C'est le chemin de récupération et de transfert d'appareil jusqu'à ce qu'iCloud soit disponible.",
          },
        ],
      },
      {
        heading: {
          en: "Restore on another device",
          de: "Auf anderem Gerät wiederherstellen",
          es: "Restaurar en otro dispositivo",
          fr: "Rétablir sur un autre appareil",
        },
        paragraphs: [
          {
            en: "Use Restore backup on the destination device and select the exported file. Review the destination library before deleting the source copy or its backup.",
            de: "Nutze auf dem Zielgerät Sicherung wiederherstellen und wähle die exportierte Datei. Prüfe die Zielbibliothek, bevor du die Ausgangskopie oder deren Sicherung löschst.",
            es: "Usa Restaurar copia de seguridad en el dispositivo destino y selecciona el archivo exportado. Revisa la biblioteca de destino antes de eliminar la copia original o su respaldo.",
            fr: "Utilisez Restaurer sauvegarde sur l'appareil cible et sélectionnez le fichier exporté. Vérifiez la bibliothèque cible avant d'effacer la copie source ou sa sauvegarde.",
          },
        ],
      },
      {
        heading: {
          en: "No automatic synchronization yet",
          de: "Noch kein automatischer Abgleich",
          es: "Sincronización automática no disponible aún",
          fr: "Pas encore de synchronisation automatique",
        },
        paragraphs: [
          {
            en: "Changes made independently on two devices are not merged automatically. iCloud backup and synchronization will be designed and released after the remaining Apple V1 gates are complete.",
            de: "Unabhängige Änderungen auf zwei Geräten werden nicht automatisch zusammengeführt. iCloud-Backup und -Synchronisation werden nach Abschluss der übrigen Apple-V1-Gates konzipiert und veröffentlicht.",
            es: "Los cambios realizados independientemente en dos dispositivos no se fusionan automáticamente. La copia de seguridad y la sincronización con iCloud estarán diseñadas y lanzadas tras completar las restantes restricciones Apple V1.",
            fr: "Les modifications effectuées indépendamment sur deux appareils ne sont pas fusionnées automatiquement. Le sauvegarde et la synchronisation iCloud seront conçues et publiées après l'achèvement des dernières contraintes Apple V1.",
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
      es: "Configuración y accesibilidad",
      fr: "Paramètres et accessibilité",
    },
    summary: {
      en: "Choose language, appearance, zoom behavior, and accessible alternatives.",
      de: "Wähle Sprache, Darstellung, Zoomverhalten und barrierefreie Alternativen.",
      es: "Elige idioma, apariencia, comportamiento de zoom y alternativas accesibles.",
      fr: "Choisissez la langue, l'apparence, le comportement du zoom et les alternatives accessibles.",
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
        heading: {
          en: "Language and theme",
          de: "Sprache und Darstellung",
          es: "Idioma y tema",
          fr: "Langue et thème",
        },
        paragraphs: [
          {
            en: "The interface language is independent from a deck's learning language. The sun icon indicates bright mode; the moon indicates dark mode.",
            de: "Die UI-Sprache ist unabhängig von der Lernsprache eines Lernsets. Das Sonnensymbol zeigt den Hellmodus, der Mond den Dunkelmodus.",
            es: "El idioma de la interfaz es independiente del idioma de aprendizaje de una baraja. El icono del sol indica el modo claro; la luna, el modo oscuro.",
            fr: "La langue d'interface est indépendante de la langue d'apprentissage d'un jeu. L'icône du soleil indique le mode clair ; la lune, le mode sombre.",
          },
        ],
      },
      {
        heading: {
          en: "Text to speech",
          de: "Vorlesefunktion",
          es: "Texto a voz",
          fr: "Synthèse vocale",
        },
        paragraphs: [
          {
            en: "The speaker uses matching voices installed on the device and automatically switches between the two deck languages inside mixed sentences. If a required voice is missing, the locked speaker explains which language is needed on hover and keyboard focus. Before reveal, clozes are spoken as pauses; after reveal, the complete correct sentence is read.",
            de: "Der Lautsprecher verwendet passende, auf dem Gerät installierte Stimmen und wechselt in gemischten Sätzen automatisch zwischen den beiden Lernset-Sprachen. Fehlt eine benötigte Stimme, nennt der gesperrte Lautsprecher beim Überfahren und per Tastaturfokus die fehlende Sprache. Vor dem Aufdecken werden Lücken als Pausen gesprochen, danach wird der vollständige richtige Satz vorgelesen.",
            es: "El altavoz utiliza voces coincidentes instaladas en el dispositivo y cambia automáticamente entre los dos idiomas de la baraja dentro de las oraciones mixtas. Si falta una voz necesaria, el altavoz bloqueado explica qué idioma se necesita al pasar el cursor o enfocarlo con teclado. Antes del revelado, las clozes se leen como pausas; después del revelado, se lee la frase completa y correcta.",
            fr: "Le haut-parleur utilise des voix correspondantes installées sur l'appareil et bascule automatiquement entre les deux langues du jeu dans les phrases mélangées. Si une voix requise manque, le haut-parleur verrouillé explique quelle langue est nécessaire au survol ou à la mise au point clavier. Avant le dévoilement, les lacunes sont prononcées comme des pauses ; après le dévoilement, la phrase complète et correcte est lue.",
          },
          {
            en: "Ordinary translation decks use their saved source language for the question and target language for the answer. Set both to the same language for non-translation content.",
            de: "Normale Übersetzungslernsets verwenden die gespeicherte Quellsprache für die Frage und die Zielsprache für die Antwort. Setze beide bei Inhalten ohne Übersetzungsrichtung auf dieselbe Sprache.",
            es: "Las barajas de traducción ordinarias usan su idioma guardado como fuente para la pregunta y como destino para la respuesta. Establece ambos en el mismo idioma para contenidos no traducidos.",
            fr: "Les jeux de traduction classiques utilisent leur langue source enregistrée pour la question et leur langue cible pour la réponse. Définissez les deux sur une même langue pour le contenu non traduit.",
          },
          {
            en: "Language-matrix decks use the actual source language for the question and the target language for the answer. Each side is locked separately when its matching voice is unavailable.",
            de: "Sprachmatrix-Lernsets verwenden für die Frage die tatsächliche Quellsprache und für die Antwort die Zielsprache. Jede Seite wird separat gesperrt, wenn ihre passende Stimme fehlt.",
            es: "Las barajas de matriz lingüística usan el idioma fuente real para la pregunta y el idioma destino para la respuesta. Cada lado se bloquea por separado si su voz correspondiente no está disponible.",
            fr: "Les jeux à matrice linguistique utilisent la langue source réelle pour la question et la langue cible pour la réponse. Chaque côté est verrouillé séparément lorsque sa voix correspondante n'est pas disponible.",
          },
          {
            en: "Settings offer Off, Sentence only, and Sentence and cloze choices. Listening to a choice is a learning hint and makes Easy unavailable for that card.",
            de: "In den Einstellungen stehen Aus, Nur Satz sowie Satz und Lückenauswahl zur Verfügung. Das Anhören einer Auswahl ist ein Lernhinweis und sperrt Leicht für diese Karte.",
            es: "La configuración ofrece Apagado, Solo oración y Oración con opciones de cloze. Escuchar una opción es un indicio de aprendizaje e inhabilita Fácil para esa tarjeta.",
            fr: "Les paramètres proposent Éteint, Phrase uniquement et Phrase avec choix lacunes. L'écoute d'un choix est une indication d'apprentissage et rend Facile indisponible pour cette carte.",
          },
          {
            en: "Text in round parentheses remains visible but is not spoken. Use this for annotations such as (noun), (fem.), or a visible number. Real line breaks create a short speech pause.",
            de: "Text in runden Klammern bleibt sichtbar, wird aber nicht vorgelesen. Nutze dies für Anmerkungen wie (Nomen), (fem.) oder eine sichtbare Zahl. Echte Zeilenumbrüche erzeugen eine kurze Sprechpause.",
            es: "El texto entre paréntesis redondos permanece visible pero no se lee. Úsalo para anotaciones como (nombre), (fem.) o un número visible. Los saltos de línea reales crean una breve pausa en la lectura.",
            fr: "Le texte dans des parenthèses rondes reste visible mais n'est pas lu. Utilisez-le pour les annotations comme (nom), (féminin) ou un numéro visible. Les sauts de ligne réels créent une brève pause à l'oral.",
          },
        ],
      },
      {
        heading: {
          en: "Question context after reveal",
          de: "Fragekontext nach dem Aufdecken",
          es: "Contexto de la pregunta tras el revelado",
          fr: "Contexte de la question après le dévoilement",
        },
        paragraphs: [
          {
            en: "The question remains visible above a revealed answer by default so that both sides can be compared directly. Use the button on the answer card to collapse or restore it. The default can be changed under Settings.",
            de: "Die Frage bleibt standardmäßig oberhalb einer aufgedeckten Antwort sichtbar, damit beide Seiten direkt verglichen werden können. Über den Button auf der Antwortkarte lässt sie sich ein- oder ausklappen. Der Standard kann unter Einstellungen geändert werden.",
            es: "La pregunta permanece visible por encima de una respuesta revelada para poder comparar ambos lados directamente. Usa el botón en la tarjeta de respuesta para colapsar o restaurarla. El valor predeterminado puede cambiarse en Configuración.",
            fr: "La question reste par défaut visible au-dessus d'une réponse dévoilée afin que les deux côtés puissent être comparés directement. Utilisez le bouton sur la carte de réponse pour réduire ou rétablir l'affichage. La valeur par défaut peut être modifiée dans Paramètres.",
          },
        ],
      },
      {
        heading: {
          en: "Zoom and input",
          de: "Zoom und Eingabe",
          es: "Zoom y entrada",
          fr: "Zoom et saisie",
        },
        paragraphs: [
          {
            en: "Website pinch zoom can be enabled in Settings. Cmd/Ctrl with plus or minus remains available. Dedicated content such as maps keeps its own zoom and pan controls.",
            de: "Der Pinch-Zoom der Website kann in den Einstellungen aktiviert werden. Cmd/Ctrl mit Plus oder Minus bleibt verfügbar. Dedizierte Inhalte wie Karten behalten ihre eigene Zoom- und Verschiebesteuerung.",
            es: "El zoom por pellizco del sitio web puede activarse en Configuración. Cmd/Ctrl con más o menos sigue disponible. El contenido dedicado, como los mapas, mantiene sus propios controles de zoom y desplazamiento.",
            fr: "Le zoom par pincement du site Web peut être activé dans Paramètres. Cmd/Ctrl avec plus ou moins reste disponible. Le contenu dédié comme les cartes conserve ses propres contrôles de zoom et de défilement.",
          },
        ],
      },
      {
        heading: {
          en: "Keyboard and media",
          de: "Tastatur und Medien",
          es: "Teclado y medios",
          fr: "Clavier et multimédia",
        },
        bullets: [
          {
            en: "Tab and Shift+Tab move through interactive controls.",
            de: "Tab und Umschalt+Tab bewegen den Fokus durch interaktive Bedienelemente.",
            es: "Tab y Shift+Tab mueven el foco entre los controles interactivos.",
            fr: "Tab et Maj+Tab déplacent le focus entre les éléments interactifs.",
          },
          {
            en: "Enter or Space activates the focused button.",
            de: "Eingabe oder Leertaste aktiviert den fokussierten Button.",
            es: "Intro o Espacio activa el botón enfocado.",
            fr: "Entrée ou Espace active le bouton mis en surbrillance.",
          },
          {
            en: "Space starts or pauses focused media such as audio.",
            de: "Die Leertaste startet oder pausiert fokussierte Medien wie Audio.",
            es: "Espacio inicia o pausa los medios enfocados, como el audio.",
            fr: "Espace démarre ou met en pause les médias mis en surbrillance, tels que l'audio.",
          },
        ],
      },
    ],
  },
  {
    id: "troubleshooting",
    title: {
      en: "Troubleshooting",
      de: "Problemlösung",
      es: "Solución de problemas",
      fr: "Dépannage",
    },
    summary: {
      en: "Quick checks for saving, importing, exporting, and local recovery problems.",
      de: "Schnelle Prüfungen bei Speicher-, Import-, Export- und lokalen Wiederherstellungsproblemen.",
      es: "Comprobaciones rápidas para guardar, importar, exportar y recuperar localmente.",
      fr: "Vérifications rapides pour la sauvegarde, l'importation, l'exportation et la récupération locale.",
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
          es: "La aplicación no puede conectarse.",
          fr: "L'application ne peut pas se connecter.",
        },
        steps: [
          {
            en: "Check whether other Flash-n-Flip pages load on the same device.",
            de: "Prüfe, ob andere Flash-n-Flip-Seiten auf demselben Gerät laden.",
            es: "Comprueba si otras páginas de Flash-n-Flip cargan en el mismo dispositivo.",
            fr: "Vérifiez que d'autres pages Flash-n-Flip se chargent sur le même appareil.",
          },
          {
            en: "On local development systems, verify that Docker Desktop and the backend are running.",
            de: "Prüfe auf lokalen Entwicklungssystemen, ob Docker Desktop und das Backend laufen.",
            es: "En sistemas de desarrollo local, verifica que Docker Desktop y el backend estén ejecutándose.",
            fr: "Sur les systèmes de développement locaux, vérifiez que Docker Desktop et le back-end sont en cours d'exécution.",
          },
          {
            en: "Retry after switching between Wi-Fi and mobile data, if available.",
            de: "Versuche es nach einem Wechsel zwischen WLAN und Mobilfunk erneut, falls verfügbar.",
            es: "Reinténtalo después de cambiar entre Wi-Fi y datos móviles, si está disponible.",
            fr: "Réessayez après un basculement entre le Wi-Fi et les données mobiles, si disponibles.",
          },
        ],
      },
      {
        heading: {
          en: "A card cannot be saved",
          de: "Eine Karte lässt sich nicht speichern",
          es: "No se puede guardar una tarjeta.",
          fr: "Impossible de sauvegarder une carte.",
        },
        paragraphs: [
          {
            en: "Read the validation message above the editor. For numbered clozes, every position from 1 to 500 may occur only once on a card.",
            de: "Lies die Validierungsmeldung über dem Editor. Bei nummerierten Lücken darf jede Position von 1 bis 500 innerhalb einer Karte nur einmal vorkommen.",
            es: "Lee el mensaje de validación por encima del editor. Para las clozes numeradas, cada posición del 1 al 500 puede aparecer solo una vez en una tarjeta.",
            fr: "Lisez le message de validation au-dessus de l'éditeur. Pour les intercalaires numérotées, chaque position de 1 à 500 ne peut apparaître qu'une seule fois dans une carte.",
          },
        ],
      },
      {
        heading: {
          en: "An import fails",
          de: "Ein Import schlägt fehl",
          es: "Un importación falla.",
          fr: "L'importation échoue.",
        },
        paragraphs: [
          {
            en: "Keep the original file and the complete import message. Large or unusual Anki packages may require a format-specific correction instead of another upload attempt.",
            de: "Bewahre die Originaldatei und die vollständige Importmeldung auf. Große oder ungewöhnliche Anki-Pakete benötigen möglicherweise eine formatspezifische Korrektur statt eines weiteren Uploadversuchs.",
            es: "Conserva el archivo original y el mensaje de importación completo. Los paquetes Anki grandes o inusuales pueden requerir una corrección específica del formato en lugar de otro intento de carga.",
            fr: "Conservez le fichier original et le message d'importation complet. Les paquets Anki volumineux ou inhabituels peuvent nécessiter une correction spécifique au format plutôt qu'une autre tentative de téléchargement.",
          },
        ],
      },
    ],
  },
];

const searchableText = (topic: HelpTopic): string =>
  [
    ...Object.values(topic.title),
    ...Object.values(topic.summary),
    ...topic.keywords,
    ...topic.sections.flatMap((section) => [
      ...Object.values(section.heading),
      ...(section.paragraphs ?? []).flatMap((item) => Object.values(item)),
      ...(section.steps ?? []).flatMap((item) => Object.values(item)),
      ...(section.bullets ?? []).flatMap((item) => Object.values(item)),
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
