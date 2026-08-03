type TimelineSpec = {
  actionEnd: number;
  actionLabel: "action" | "actionLater" | "actionNow";
  actionStart: number;
  completed?: boolean;
  openEnd?: boolean;
  referenceLabel?: "futureReference" | "laterPast";
  referenceX?: number;
  relationToNow?: boolean;
};

const timelineSpecs: Record<string, TimelineSpec> = {
  present: {
    actionStart: 270,
    actionEnd: 500,
    actionLabel: "actionNow",
    openEnd: true,
  },
  perfect: {
    actionStart: 125,
    actionEnd: 270,
    actionLabel: "action",
    completed: true,
    relationToNow: true,
  },
  preterite: {
    actionStart: 120,
    actionEnd: 275,
    actionLabel: "action",
  },
  imperfect: {
    actionStart: 105,
    actionEnd: 300,
    actionLabel: "action",
    openEnd: true,
  },
  pluperfect: {
    actionStart: 80,
    actionEnd: 210,
    actionLabel: "action",
    completed: true,
    referenceX: 300,
    referenceLabel: "laterPast",
  },
  "future-one": {
    actionStart: 430,
    actionEnd: 610,
    actionLabel: "actionLater",
    openEnd: true,
  },
  "future-two": {
    actionStart: 410,
    actionEnd: 525,
    actionLabel: "action",
    completed: true,
    referenceX: 620,
    referenceLabel: "futureReference",
  },
};

type TimelineCopy = Record<
  | "action"
  | "actionLater"
  | "actionNow"
  | "caption"
  | "future"
  | "futureReference"
  | "laterPast"
  | "now"
  | "past",
  string
>;

const timelineCopy: Record<"de" | "en" | "es" | "fr", TimelineCopy> = {
  de: {
    past: "Vergangenheit",
    now: "JETZT",
    future: "Zukunft",
    action: "Handlung",
    actionNow: "Handlung jetzt",
    actionLater: "Handlung später",
    laterPast: "später vergangen",
    futureReference: "zukünftiger Bezug",
    caption:
      "Typische Einordnung · Balken: Handlung · ● abgeschlossen · ◆ Bezugspunkt",
  },
  es: {
    past: "Pasado",
    now: "AHORA",
    future: "Futuro",
    action: "Acción",
    actionNow: "Acción actual",
    actionLater: "Acción posterior",
    laterPast: "pasado posterior",
    futureReference: "referencia futura",
    caption:
      "Ubicación típica · barra: acción · ● terminada · ◆ punto de referencia",
  },
  en: {
    past: "Past",
    now: "NOW",
    future: "Future",
    action: "Action",
    actionNow: "Action now",
    actionLater: "Action later",
    laterPast: "later past point",
    futureReference: "future reference",
    caption: "Typical position · bar: action · ● completed · ◆ reference point",
  },
  fr: {
    past: "Passé",
    now: "MAINTENANT",
    future: "Futur",
    action: "Action",
    actionNow: "Action actuelle",
    actionLater: "Action ultérieure",
    laterPast: "passé ultérieur",
    futureReference: "repère futur",
    caption:
      "Repérage typique · barre : action · ● achevée · ◆ point de repère",
  },
};

const resolveTimeline = (graphicId: string) => {
  const match = /^(german|de|es|en|fr)-tense-(.+)$/.exec(graphicId);
  if (!match) return null;
  const locale = match[1] === "german" ? "de" : match[1];
  const spec = timelineSpecs[match[2]!];
  if (!spec || !locale || !(locale in timelineCopy)) return null;
  return {
    spec,
    copy: timelineCopy[locale as keyof typeof timelineCopy],
  };
};

function TimelineAction({
  copy,
  spec,
}: {
  copy: TimelineCopy;
  spec: TimelineSpec;
}) {
  const width = spec.actionEnd - spec.actionStart;
  return (
    <>
      <rect
        className="tense-timeline-action"
        x={spec.actionStart}
        y="84"
        width={width}
        height="34"
        rx="12"
      />
      <line
        className="tense-timeline-cap"
        x1={spec.actionStart}
        x2={spec.actionStart}
        y1="80"
        y2="122"
      />
      {spec.openEnd ? (
        <polygon
          className="tense-timeline-arrow"
          points={`${spec.actionEnd - 3},77 ${spec.actionEnd + 20},101 ${spec.actionEnd - 3},125`}
        />
      ) : (
        <line
          className="tense-timeline-cap"
          x1={spec.actionEnd}
          x2={spec.actionEnd}
          y1="80"
          y2="122"
        />
      )}
      {spec.completed ? (
        <circle
          className="tense-timeline-completion"
          cx={spec.actionEnd}
          cy="101"
          r="10"
        />
      ) : null}
      <text
        className="tense-timeline-action-label"
        x={spec.actionStart + width / 2}
        y="107"
        textAnchor="middle"
      >
        {copy[spec.actionLabel]}
      </text>
    </>
  );
}

export function TrustedGraphic({
  graphicId,
  label,
}: {
  graphicId: string;
  label: string;
}) {
  const timeline = resolveTimeline(graphicId);
  if (!timeline) {
    return (
      <div className="trusted-graphic" role="img" aria-label={label}>
        {label}
      </div>
    );
  }
  const { copy, spec } = timeline;

  const connectorStart = spec.actionEnd + 12;
  const connectorEnd = spec.relationToNow
    ? 348
    : spec.referenceX
      ? spec.referenceX - 13
      : null;

  return (
    <figure
      className="trusted-graphic tense-timeline"
      role="img"
      aria-label={label}
      style={{ flex: "0 0 auto" }}
    >
      <svg viewBox="0 0 720 165" aria-hidden="true" focusable="false">
        <text className="tense-timeline-period" x="48" y="26">
          {copy.past}
        </text>
        <text
          className="tense-timeline-now-label"
          x="360"
          y="26"
          textAnchor="middle"
        >
          {copy.now}
        </text>
        <text className="tense-timeline-period" x="672" y="26" textAnchor="end">
          {copy.future}
        </text>
        <line
          className="tense-timeline-axis"
          x1="48"
          x2="672"
          y1="101"
          y2="101"
        />
        <polygon
          className="tense-timeline-axis-arrow"
          points="672,91 692,101 672,111"
        />
        <line
          className="tense-timeline-now"
          x1="360"
          x2="360"
          y1="42"
          y2="137"
        />
        <TimelineAction copy={copy} spec={spec} />
        {connectorEnd ? (
          <line
            className="tense-timeline-relation"
            x1={connectorStart}
            x2={connectorEnd}
            y1="101"
            y2="101"
          />
        ) : null}
        {spec.referenceX ? (
          <>
            <polygon
              className="tense-timeline-reference"
              points={`${spec.referenceX},87 ${spec.referenceX + 14},101 ${spec.referenceX},115 ${spec.referenceX - 14},101`}
            />
            <text
              className="tense-timeline-reference-label"
              x={spec.referenceX}
              y="146"
              textAnchor="middle"
            >
              {spec.referenceLabel ? copy[spec.referenceLabel] : null}
            </text>
          </>
        ) : null}
      </svg>
      <figcaption>{copy.caption}</figcaption>
    </figure>
  );
}
