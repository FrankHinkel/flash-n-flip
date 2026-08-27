import type { CardContent } from "@flashcards/domain/content";

export const periodicTableLearningTemplateKey = "science:periodic-table:de:v1";

const rootKey = periodicTableLearningTemplateKey;
const referenceKey = `${rootKey}:reference`;
const learningKey = `${rootKey}:learning`;

const markdown = (source: string): CardContent => ({
  blocks: [{ type: "markdown", revealMode: "ALL", source }],
});

const table = (input: {
  mode?: "explore" | "quiz";
  focus?: string;
  highlight?: string;
  title: string;
  describe: string;
  height?: string;
}) => `\`\`\`periodic-table{w=fill h=${input.height ?? "50vh"}}
mode ${input.mode ?? "explore"}
${input.focus ? `focus ${input.focus}\n` : ""}${input.highlight ? `highlight ${input.highlight}\n` : ""}title ${input.title}
describe ${input.describe}
\`\`\``;

type PeriodicTableLearningCard = {
  key: string;
  front: CardContent;
  back: CardContent;
  kind: "QUESTION" | "EXPLANATION";
  usage: "LEARNING" | "REFERENCE";
};

const referenceCard = (
  key: string,
  title: string,
  source: string,
): PeriodicTableLearningCard => ({
  key,
  front: markdown(""),
  back: markdown(`## ${title}\n\n${source}`),
  kind: "EXPLANATION",
  usage: "REFERENCE",
});

const learningCard = (
  key: string,
  title: string,
  question: string,
  answer: string,
  visual?: { focus?: string; highlight?: string },
): PeriodicTableLearningCard => ({
  key,
  front: markdown(`## ${title}\n\n${question}`),
  back: markdown(
    visual
      ? `${table({
            mode: "quiz",
            focus: visual.focus,
            highlight: visual.highlight,
            title: `${title} · Lösung`,
            describe: `Auflösung der Lernfrage. Hervorgehoben: ${visual.focus ?? visual.highlight}. Die Hervorhebung wird zusätzlich durch volle Farbintensität gegenüber den übrigen Elementen dargestellt.`,
            height: "220px",
          })}\n\n${answer}`
      : answer,
  ),
  kind: "QUESTION",
  usage: "LEARNING",
});

const referenceCards: PeriodicTableLearningCard[] = [
  referenceCard(
    "explore",
    "01 · Periodensystem erkunden",
    `Wähle ein Element in der Tabelle oder im Auswahlfeld. Auf einem Computer zeigt bereits das Überfahren mit der Maus eine Vorschau; Klick oder Tap fixieren die Auswahl. Pfeiltasten sind über das Auswahlfeld und die Vor-/Zurück-Schaltflächen ersetzbar.

${table({
  title: "Periodensystem erkunden",
  describe:
    "Interaktives Periodensystem mit Ordnungszahl, Symbol, Atommasse, Gruppe, Periode, Kategorie und Elektronenkonfiguration.",
  height: "62vh",
})}

Die Elementdaten stammen aus der Periodic-Table-Schnittstelle von **PubChem (NIH)**; Benennung und Ordnungszahlen wurden mit der IUPAC-Systematik abgeglichen.`,
  ),
  referenceCard(
    "groups-periods",
    "02 · Gruppen und Perioden lesen",
    `Die **Spalten 1 bis 18** heißen Gruppen. Elemente derselben Gruppe besitzen häufig ähnliche chemische Eigenschaften. Die horizontalen Reihen heißen **Perioden**.

${table({
  focus: "Cl",
  title: "Gruppen und Perioden",
  describe:
    "Chlor ist ausgewählt. Das Detailpanel zeigt Gruppe 17 und Periode 3.",
  height: "54vh",
})}`,
  ),
  referenceCard(
    "families",
    "03 · Wichtige Elementfamilien",
    `Farben helfen bei der Orientierung; die Kategorie steht zusätzlich im Detailpanel und wird daher nie ausschließlich über Farbe vermittelt.

- Gruppe 1: Alkalimetalle – außer Wasserstoff
- Gruppe 2: Erdalkalimetalle
- Gruppe 17: Halogene
- Gruppe 18: Edelgase
- Mitte der Tabelle: Übergangsmetalle
- Ausgelagerte Reihen: Lanthanoide und Actinoide

${table({
  highlight: "Li Na K Rb Cs Fr F Cl Br I At Ts He Ne Ar Kr Xe Rn Og",
  title: "Ausgewählte Elementfamilien",
  describe:
    "Alkalimetalle, Halogene und Edelgase sind gemeinsam hervorgehoben und lassen sich einzeln untersuchen.",
  height: "54vh",
})}`,
  ),
];

const learningCards: PeriodicTableLearningCard[] = [
  learningCard(
    "atomic-number",
    "01 · Ordnungszahl",
    "Zwei neutrale Atome besitzen jeweils 17 Protonen, aber 18 beziehungsweise 20 Neutronen. Sind es verschiedene Elemente? Begründe.",
    "Nein. Beide Atome sind **Chlor**, denn die Protonenzahl 17 – die Ordnungszahl – legt das Element fest. Die unterschiedliche Neutronenzahl macht sie zu verschiedenen **Isotopen**. Als neutrale Atome besitzen beide außerdem 17 Elektronen.",
    { focus: "Cl" },
  ),
  learningCard(
    "group-period",
    "02 · Gruppe und Periode",
    "Magnesium und Calcium stehen untereinander, Natrium und Magnesium nebeneinander. Bei welchem Paar erwartest du ähnlichere chemische Eigenschaften – und was unterscheidet die Atome trotzdem?",
    "**Magnesium und Calcium** ähneln sich stärker, weil beide in Gruppe 2 stehen und zwei Valenzelektronen besitzen. Calcium liegt eine Periode tiefer und hat daher eine zusätzliche besetzte Elektronenschale. Natrium und Magnesium liegen zwar in derselben Periode, gehören aber verschiedenen Gruppen an.",
    { highlight: "Na Mg Ca" },
  ),
  learningCard(
    "alkali-metals",
    "03 · Alkalimetalle",
    "Lithium und Caesium besitzen beide ein Valenzelektron. Welches reagiert im Allgemeinen heftiger mit Wasser, und welche Ionenladung entsteht bei beiden meist?",
    "**Caesium** reagiert im Allgemeinen heftiger. Nach unten in Gruppe 1 liegt das Valenzelektron weiter vom Kern entfernt und lässt sich leichter abgeben. Beide Elemente bilden dabei typischerweise **einfach positive Ionen (M⁺)**.",
    { highlight: "Li Na K Rb Cs Fr" },
  ),
  learningCard(
    "alkaline-earth",
    "04 · Erdalkalimetalle",
    "Warum bilden Magnesium und Calcium meist zweifach positive Ionen, während Natrium meist nur einfach positiv wird?",
    "Magnesium und Calcium besitzen jeweils **zwei Valenzelektronen** und erreichen durch deren Abgabe eine stabile Elektronenkonfiguration; es entstehen Mg²⁺ beziehungsweise Ca²⁺. Natrium besitzt nur ein Valenzelektron und bildet daher meist Na⁺.",
    { highlight: "Be Mg Ca Sr Ba Ra" },
  ),
  learningCard(
    "halogens",
    "05 · Halogene",
    "Fluor und Iod reagieren beide mit Metallen zu Salzen. Welches zieht ein zusätzliches Elektron stärker an, und welche Ionenladung bilden beide typischerweise?",
    "**Fluor** zieht ein Elektron stärker an; die Elektronegativität nimmt innerhalb der Halogene nach unten im Allgemeinen ab. Beide besitzen sieben Valenzelektronen und bilden in einfachen Salzen meist **X⁻-Ionen**.",
    { highlight: "F Cl Br I At Ts" },
  ),
  learningCard(
    "noble-gases",
    "06 · Edelgase",
    "Neon wird in Leuchtröhren eingesetzt, ohne dabei leicht neue Verbindungen zu bilden. Welche Elektronenstruktur erklärt diese Reaktionsträgheit?",
    "Neon besitzt eine **vollständig besetzte Außenschale**. Dieser energetisch günstige Zustand bietet wenig Antrieb, Elektronen aufzunehmen, abzugeben oder zu teilen. Das erklärt die typische Reaktionsträgheit der Edelgase.",
    { highlight: "He Ne Ar Kr Xe Rn Og" },
  ),
  learningCard(
    "transition-metals",
    "07 · Übergangsmetalle",
    "Eisen kann Fe²⁺ und Fe³⁺ bilden, während Natrium fast nur Na⁺ bildet. Welche typische Eigenschaft der Übergangsmetalle zeigt dieser Vergleich?",
    "Viele Übergangsmetalle besitzen **mehrere stabile Oxidationsstufen**, weil neben den äußeren s-Elektronen auch d-Elektronen an Bindungen beteiligt sein können. Das trägt außerdem zu farbigen Verbindungen und katalytischer Wirkung bei.",
    { highlight: "Sc Ti V Cr Mn Fe Co Ni Cu Zn Y Zr Nb Mo Tc Ru Rh Pd Ag Cd" },
  ),
  learningCard(
    "f-block",
    "08 · Lanthanoide und Actinoide",
    "Würde man Lanthanoide und Actinoide in die Haupttabelle zurückschieben: Wo müssten sie eingefügt werden, und warum werden sie gewöhnlich ausgelagert?",
    "Sie gehören in die **Perioden 6 und 7**, jeweils in den f-Block nach Lanthan beziehungsweise Actinium. Die ausgelagerte Darstellung verkürzt die Tabelle; chemisch sind die beiden Reihen kein separater Anhang.",
    {
      highlight:
        "La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr",
    },
  ),
  learningCard(
    "hydrogen",
    "09 · Wasserstoff",
    "In Säuren tritt Wasserstoff als H⁺ auf, in Metallhydriden kann er H⁻ bilden. Warum macht gerade dieses Verhalten seine Einordnung über den Alkalimetallen unvollständig?",
    "Wasserstoff besitzt zwar wie die Alkalimetalle **ein Valenzelektron**, ist aber ein Nichtmetall und kann Elektronen abgeben, aufnehmen oder in kovalenten Bindungen teilen. Seine vielseitige Bindungschemie passt daher nur teilweise zum typischen Verhalten der Gruppe 1.",
    { focus: "H" },
  ),
  learningCard(
    "carbon",
    "10 · Kohlenstoff",
    "Diamant ist hart und elektrisch isolierend, Graphit weich und leitfähig. Wie können beide Stoffe ausschließlich aus Kohlenstoff bestehen?",
    "Die Kohlenstoffatome sind **unterschiedlich miteinander verknüpft**. Im Diamant bildet jedes Atom ein räumliches Netzwerk aus vier Bindungen; im Graphit entstehen leitfähige Schichten. Die Eigenschaften hängen daher nicht nur vom Element, sondern auch von der Struktur seiner Modifikation ab.",
    { focus: "C" },
  ),
  learningCard(
    "nitrogen",
    "11 · Stickstoff",
    "Stickstoff ist ein Nichtmetall, trotzdem reagiert N₂ bei Raumtemperatur vergleichsweise träge. Was stabilisiert das Molekül?",
    "Die beiden Stickstoffatome sind durch eine sehr starke **Dreifachbindung N≡N** verbunden. Zu ihrer Spaltung ist viel Energie nötig. Darum ist molekularer Stickstoff trotz der Reaktionsmöglichkeiten einzelner Stickstoffverbindungen relativ träge.",
    { focus: "N" },
  ),
  learningCard(
    "oxygen",
    "12 · Sauerstoff",
    "Warum bildet Sauerstoff in vielen Metalloxiden O²⁻, statt zwei Elektronen abzugeben?",
    "Sauerstoff besitzt **sechs Valenzelektronen**. Die Aufnahme von zwei Elektronen vervollständigt seine Außenschale und ist bei der Bindung an elektropositive Metalle günstiger als die Abgabe von sechs Elektronen.",
    { focus: "O" },
  ),
  learningCard(
    "sodium",
    "13 · Natrium",
    "Natrium und Chlor reagieren zu Kochsalz. Welches Teilchen gibt dabei ein Elektron ab, welches nimmt es auf – und warum passt das zu ihren Positionen?",
    "**Natrium gibt** sein einzelnes Valenzelektron ab und wird zu Na⁺; **Chlor nimmt** dieses Elektron auf und wird zu Cl⁻. Damit erreichen beide eine voll besetzte Außenschale. Ihre Positionen in den Gruppen 1 und 17 spiegeln diese komplementären Elektronenzahlen wider.",
    { highlight: "Na Cl" },
  ),
  learningCard(
    "magnesium",
    "14 · Magnesium",
    "Na⁺ und Mg²⁺ besitzen beide zehn Elektronen. Welches Ion ist kleiner, und wodurch entsteht der Unterschied?",
    "**Mg²⁺ ist kleiner.** Beide Ionen sind isoelektronisch, aber der Magnesiumkern besitzt zwölf statt elf Protonen. Seine größere Kernladung zieht dieselbe Zahl von Elektronen stärker an.",
    { highlight: "Na Mg" },
  ),
  learningCard(
    "silicon",
    "15 · Silicium",
    "Warum eignet sich Silicium besser als ein sehr guter Leiter oder ein perfekter Isolator zum gezielten Schalten elektrischer Ströme?",
    "Silicium ist ein **Halbleiter**. Seine Leitfähigkeit lässt sich durch Dotierung, elektrische Felder, Licht und Temperatur kontrolliert verändern. Genau diese Steuerbarkeit ermöglicht Dioden und Transistoren; ein idealer Leiter oder Isolator wäre kaum schaltbar.",
    { focus: "Si" },
  ),
  learningCard(
    "chlorine",
    "16 · Chlor",
    "Chlorid in Kochsalz und elementares Chlorgas haben sehr unterschiedliche Eigenschaften. Warum darf man Cl⁻ nicht mit Cl₂ gleichsetzen?",
    "Cl⁻ ist ein **negativ geladenes Ion** mit voll besetzter Außenschale und Bestandteil eines Ionengitters. Cl₂ ist ein neutrales, kovalent gebundenes Molekül aus zwei Chloratomen und ein reaktives Gas. Gleiches Element bedeutet nicht gleiche Teilchenart oder gleiche Stoffeigenschaften.",
    { highlight: "Na Cl" },
  ),
  learningCard(
    "iron",
    "17 · Eisen",
    "Warum beschleunigen sowohl Wasser als auch Sauerstoff das Rosten von Eisen, obwohl Wasser nicht einfach nur ein weiterer Sauerstofflieferant ist?",
    "Rosten ist ein **elektrochemischer Redoxprozess**. Sauerstoff nimmt Elektronen auf; Wasser ermöglicht als Elektrolyt den Ionentransport und ist an den Teilreaktionen beteiligt. Ohne geeignete Feuchtigkeit läuft der Ladungstransport deutlich langsamer.",
    { focus: "Fe" },
  ),
  learningCard(
    "copper",
    "18 · Kupfer",
    "Kupfer wird für Stromleitungen häufig gegenüber Eisen bevorzugt. Welche Kombination von Eigenschaften ist dafür entscheidend?",
    "Kupfer verbindet **sehr hohe elektrische Leitfähigkeit** mit guter Verformbarkeit zu Drähten und brauchbarer Korrosionsbeständigkeit. Eisen leitet schlechter und rostet unter Alltagsbedingungen leichter.",
    { focus: "Cu" },
  ),
  learningCard(
    "silver-gold",
    "19 · Silber und Gold",
    "Silber und Gold leiten beide sehr gut, Gold bleibt an Luft aber länger unverändert. Was erklärt ihre ähnlichen und zugleich unterschiedlichen Anwendungen?",
    "Als Elemente derselben Gruppe besitzen sie verwandte **Valenzelektronenstrukturen** und eine hohe Leitfähigkeit. Gold ist jedoch edler und korrosionsbeständiger; deshalb eignet es sich besonders für zuverlässige Kontakte, während Silber dort eingesetzt wird, wo maximale Leitfähigkeit wichtiger ist.",
    { highlight: "Ag Au" },
  ),
  learningCard(
    "mercury",
    "20 · Quecksilber",
    "Quecksilber ist ein Metall, bei Raumtemperatur aber flüssig. Welche verbreitete, aber falsche Verallgemeinerung widerlegt dieses Beispiel?",
    "Es widerlegt die Aussage, **alle Metalle seien bei Raumtemperatur fest**. Metallische Eigenschaften beschreiben unter anderem Bindung, Leitfähigkeit und Verformbarkeit; sie legen den Aggregatzustand nicht ausnahmslos fest.",
    { focus: "Hg" },
  ),
  learningCard(
    "uranium",
    "21 · Uran",
    "Warum ist die Radioaktivität von Uran eine Eigenschaft des Atomkerns und nicht seiner Position als Metall im Periodensystem?",
    "Radioaktivität entsteht durch einen **instabilen Atomkern** und dessen Zerfall. Die metallischen chemischen Eigenschaften werden dagegen vor allem durch die Elektronenhülle bestimmt. Uran ist daher zugleich Actinoid und Metall, aber nicht wegen dieser Einordnung radioaktiv.",
    { focus: "U" },
  ),
  learningCard(
    "period-trend",
    "22 · Trend innerhalb einer Periode",
    "Natrium, Magnesium und Chlor liegen in derselben Periode. Warum wird ihr Atomradius von links nach rechts im Allgemeinen kleiner, obwohl die Elektronenzahl steigt?",
    "Die zusätzlichen Elektronen kommen in dieselbe Hauptschale, während zugleich die **Kernladung zunimmt**. Die Abschirmung wächst weniger stark als die Anziehung durch die zusätzlichen Protonen; deshalb wird die Elektronenhülle im Allgemeinen stärker zusammengezogen. Periodische Trends bleiben Näherungsregeln mit Ausnahmen.",
    { highlight: "Na Mg Al Si P S Cl" },
  ),
];

export type PeriodicTableLearningDeckSeed = {
  key: string;
  parentKey: string | null;
  title: string;
  description: string;
  locale: "de";
  contentLocales: readonly ["de"];
  studyOrder: "SEQUENTIAL";
  tags: string[];
  cards: PeriodicTableLearningCard[];
};

export const createPeriodicTableLearningDeckSeeds =
  (): PeriodicTableLearningDeckSeed[] => [
    {
      key: rootKey,
      parentKey: null,
      title: "Periodensystem",
      description:
        "Interaktive Referenz und ein geführter Lernkurs zu Aufbau, Elementfamilien und wichtigen Elementen.",
      locale: "de",
      contentLocales: ["de"],
      studyOrder: "SEQUENTIAL",
      tags: ["Chemie", "Periodensystem", "Naturwissenschaft"],
      cards: [],
    },
    {
      key: referenceKey,
      parentKey: rootKey,
      title: "01 · Entdecken",
      description:
        "Drei frei durchblätterbare Referenzkarten mit dem interaktiven Periodensystem.",
      locale: "de",
      contentLocales: ["de"],
      studyOrder: "SEQUENTIAL",
      tags: ["Chemie", "Referenz", "Developer reference"],
      cards: referenceCards,
    },
    {
      key: learningKey,
      parentKey: rootKey,
      title: "02 · Grundlagen lernen",
      description:
        "22 Lernkarten zu Gruppen, Perioden, Elementfamilien und ausgewählten Elementen.",
      locale: "de",
      contentLocales: ["de"],
      studyOrder: "SEQUENTIAL",
      tags: ["Chemie", "Lernen"],
      cards: learningCards,
    },
  ];

export const periodicTableLearningCardCount =
  referenceCards.length + learningCards.length;
export const periodicTableLearningQuestionCount = learningCards.length;
