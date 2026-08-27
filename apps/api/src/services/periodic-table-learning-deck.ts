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
  front: markdown(
    `## ${title}\n\n${question}${
      visual
        ? `\n\n${table({
            mode: "quiz",
            focus: visual.focus,
            highlight: visual.highlight,
            title,
            describe:
              "Das Periodensystem markiert die für diese Lernfrage relevanten Elemente, ohne ein Detailpanel einzublenden.",
            height: "36vh",
          })}`
        : ""
    }`,
  ),
  back: markdown(`## Antwort\n\n${answer}`),
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
    "Was gibt die Ordnungszahl eines Elements an?",
    "Die Ordnungszahl ist die Zahl der **Protonen im Atomkern**. Bei einem neutralen Atom entspricht sie außerdem der Zahl der Elektronen. Sie legt eindeutig fest, um welches Element es sich handelt.",
  ),
  learningCard(
    "group-period",
    "02 · Gruppe und Periode",
    "Was beschreiben Gruppe und Periode im Periodensystem?",
    "Die **Gruppe** ist eine senkrechte Spalte; Elemente einer Gruppe zeigen häufig ähnliche chemische Eigenschaften. Die **Periode** ist eine waagerechte Reihe und entspricht bei Grundzustandsatomen grob der höchsten besetzten Hauptschale.",
  ),
  learningCard(
    "alkali-metals",
    "03 · Alkalimetalle",
    "Welche Gruppe ist markiert und welche gemeinsame Eigenschaft ist typisch?",
    "Markiert sind die **Alkalimetalle der Gruppe 1** ohne Wasserstoff. Sie besitzen ein Valenzelektron, bilden meist einfach positiv geladene Ionen und reagieren – besonders weiter unten in der Gruppe – stark mit Wasser.",
    { highlight: "Li Na K Rb Cs Fr" },
  ),
  learningCard(
    "alkaline-earth",
    "04 · Erdalkalimetalle",
    "Welche Elementfamilie ist markiert?",
    "Das sind die **Erdalkalimetalle der Gruppe 2**: Beryllium, Magnesium, Calcium, Strontium, Barium und Radium. Sie besitzen zwei Valenzelektronen und bilden meist zweifach positive Ionen.",
    { highlight: "Be Mg Ca Sr Ba Ra" },
  ),
  learningCard(
    "halogens",
    "05 · Halogene",
    "Welche Gruppe ist markiert und wie viele Valenzelektronen besitzen ihre Hauptgruppenelemente?",
    "Markiert sind die **Halogene der Gruppe 17**. Sie besitzen sieben Valenzelektronen und nehmen in vielen Verbindungen ein weiteres Elektron auf.",
    { highlight: "F Cl Br I At Ts" },
  ),
  learningCard(
    "noble-gases",
    "06 · Edelgase",
    "Warum sind die markierten Elemente vergleichsweise reaktionsträge?",
    "Die **Edelgase der Gruppe 18** besitzen eine abgeschlossene Außenschale. Deshalb sind sie unter normalen Bedingungen wesentlich reaktionsträger als viele andere Elemente.",
    { highlight: "He Ne Ar Kr Xe Rn Og" },
  ),
  learningCard(
    "transition-metals",
    "07 · Übergangsmetalle",
    "Wo liegen die Übergangsmetalle und was ist für viele ihrer Verbindungen typisch?",
    "Sie liegen im **d-Block in der Mitte** des Periodensystems, hauptsächlich in den Gruppen 3 bis 12. Viele zeigen mehrere Oxidationsstufen und bilden farbige Verbindungen oder wirksame Katalysatoren.",
    { highlight: "Sc Ti V Cr Mn Fe Co Ni Cu Zn Y Zr Nb Mo Tc Ru Rh Pd Ag Cd" },
  ),
  learningCard(
    "f-block",
    "08 · Lanthanoide und Actinoide",
    "Warum stehen die beiden markierten Reihen unterhalb der Haupttabelle?",
    "Lanthanoide und Actinoide gehören zu den Perioden 6 und 7. Sie werden aus Platzgründen ausgelagert dargestellt; chemisch gehören sie an die Stelle nach Lanthan beziehungsweise Actinium in den **f-Block**.",
    {
      highlight:
        "La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr",
    },
  ),
  learningCard(
    "hydrogen",
    "09 · Wasserstoff",
    "Wasserstoff steht über den Alkalimetallen. Warum ist er trotzdem ein Sonderfall?",
    "Wasserstoff besitzt zwar ein Valenzelektron, ist aber ein **Nichtmetall**. Er kann sein Elektron abgeben, ein Elektron aufnehmen oder Elektronen in kovalenten Bindungen teilen. Deshalb passt er nur eingeschränkt in Gruppe 1.",
    { focus: "H" },
  ),
  learningCard(
    "carbon",
    "10 · Kohlenstoff",
    "Welche Ordnungszahl, Gruppe und Periode hat Kohlenstoff?",
    "Kohlenstoff **C** hat die Ordnungszahl **6**, steht in **Gruppe 14** und **Periode 2**. Seine vier Valenzelektronen ermöglichen eine außergewöhnliche Vielfalt kovalenter Verbindungen.",
    { focus: "C" },
  ),
  learningCard(
    "nitrogen",
    "11 · Stickstoff",
    "Wo steht Stickstoff und welches Symbol hat er?",
    "Stickstoff hat das Symbol **N**, die Ordnungszahl **7**, steht in **Gruppe 15** und **Periode 2**.",
    { focus: "N" },
  ),
  learningCard(
    "oxygen",
    "12 · Sauerstoff",
    "Welche Position und Elementfamilie gehören zu Sauerstoff?",
    "Sauerstoff **O** hat die Ordnungszahl **8**, steht in **Gruppe 16**, **Periode 2** und gehört zu den Nichtmetallen.",
    { focus: "O" },
  ),
  learningCard(
    "sodium",
    "13 · Natrium",
    "Welche Position hat Natrium und welche typische Ionenladung bildet es?",
    "Natrium **Na** hat die Ordnungszahl **11**, steht in Gruppe 1 und Periode 3. Als Alkalimetall gibt es häufig ein Elektron ab und bildet **Na⁺**.",
    { focus: "Na" },
  ),
  learningCard(
    "magnesium",
    "14 · Magnesium",
    "Welche Gruppe, Periode und typische Ionenladung gehören zu Magnesium?",
    "Magnesium **Mg** hat die Ordnungszahl **12**, steht in Gruppe 2 und Periode 3. Es bildet häufig das zweifach positive Ion **Mg²⁺**.",
    { focus: "Mg" },
  ),
  learningCard(
    "silicon",
    "15 · Silicium",
    "Warum ist Silicium für Elektronik besonders wichtig?",
    "Silicium **Si** ist ein Halbmetall in Gruppe 14 und Periode 3. Seine gezielt veränderbare elektrische Leitfähigkeit macht es zum grundlegenden **Halbleitermaterial** vieler elektronischer Bauteile.",
    { focus: "Si" },
  ),
  learningCard(
    "chlorine",
    "16 · Chlor",
    "Welche Position hat Chlor und zu welcher Elementfamilie gehört es?",
    "Chlor **Cl** hat die Ordnungszahl **17**, steht in Gruppe 17 und Periode 3. Es gehört zu den **Halogenen**.",
    { focus: "Cl" },
  ),
  learningCard(
    "iron",
    "17 · Eisen",
    "Welche Ordnungszahl und Kategorie gehören zu Eisen?",
    "Eisen **Fe** hat die Ordnungszahl **26**, steht in Gruppe 8 und Periode 4 und ist ein **Übergangsmetall**.",
    { focus: "Fe" },
  ),
  learningCard(
    "copper",
    "18 · Kupfer",
    "Wo steht Kupfer und welche Eigenschaft erklärt eine wichtige Anwendung?",
    "Kupfer **Cu** hat die Ordnungszahl **29**, steht in Gruppe 11 und Periode 4. Seine hohe elektrische Leitfähigkeit erklärt die häufige Verwendung in Leitungen.",
    { focus: "Cu" },
  ),
  learningCard(
    "silver-gold",
    "19 · Silber und Gold",
    "Welche Gemeinsamkeit haben Silber und Gold im Periodensystem?",
    "Silber **Ag** und Gold **Au** stehen beide in **Gruppe 11** und sind Übergangsmetalle. Silber liegt in Periode 5, Gold in Periode 6.",
    { highlight: "Ag Au" },
  ),
  learningCard(
    "mercury",
    "20 · Quecksilber",
    "Was ist an Quecksilbers Aggregatzustand unter üblichen Raumbedingungen auffällig?",
    "Quecksilber **Hg**, Ordnungszahl 80, ist eines der wenigen Elemente, das unter üblichen Raumbedingungen **flüssig** ist.",
    { focus: "Hg" },
  ),
  learningCard(
    "uranium",
    "21 · Uran",
    "Zu welcher Reihe gehört Uran und welche Ordnungszahl besitzt es?",
    "Uran **U** hat die Ordnungszahl **92** und gehört zu den **Actinoiden** im f-Block der Periode 7.",
    { focus: "U" },
  ),
  learningCard(
    "period-trend",
    "22 · Trend innerhalb einer Periode",
    "Wie verändert sich der metallische Charakter im Allgemeinen von links nach rechts innerhalb einer Periode?",
    "Der metallische Charakter nimmt im Allgemeinen **von links nach rechts ab**. Links dominieren Metalle, rechts finden sich zunehmend Halbmetalle und Nichtmetalle. Das ist ein Trend, keine ausnahmslose Einzelregel.",
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
