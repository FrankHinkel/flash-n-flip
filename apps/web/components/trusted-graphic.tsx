type TimelineSpec = {
  actionEnd: number;
  actionLabel: string;
  actionStart: number;
  completed?: boolean;
  openEnd?: boolean;
  referenceLabel?: string;
  referenceX?: number;
  relationToNow?: boolean;
};

const timelineSpecs: Record<string, TimelineSpec> = {
  "german-tense-present": {
    actionStart: 270,
    actionEnd: 500,
    actionLabel: "Handlung jetzt",
    openEnd: true,
  },
  "german-tense-perfect": {
    actionStart: 125,
    actionEnd: 270,
    actionLabel: "Handlung",
    completed: true,
    relationToNow: true,
  },
  "german-tense-preterite": {
    actionStart: 120,
    actionEnd: 275,
    actionLabel: "Handlung",
  },
  "german-tense-pluperfect": {
    actionStart: 80,
    actionEnd: 210,
    actionLabel: "Handlung",
    completed: true,
    referenceX: 300,
    referenceLabel: "später vergangen",
  },
  "german-tense-future-one": {
    actionStart: 430,
    actionEnd: 610,
    actionLabel: "Handlung später",
    openEnd: true,
  },
  "german-tense-future-two": {
    actionStart: 410,
    actionEnd: 525,
    actionLabel: "Handlung",
    completed: true,
    referenceX: 620,
    referenceLabel: "zukünftiger Bezug",
  },
};

function TimelineAction({ spec }: { spec: TimelineSpec }) {
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
        {spec.actionLabel}
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
  const spec = timelineSpecs[graphicId];
  if (!spec) {
    return (
      <div className="trusted-graphic" role="img" aria-label={label}>
        {label}
      </div>
    );
  }

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
          Vergangenheit
        </text>
        <text
          className="tense-timeline-now-label"
          x="360"
          y="26"
          textAnchor="middle"
        >
          JETZT
        </text>
        <text className="tense-timeline-period" x="672" y="26" textAnchor="end">
          Zukunft
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
        <TimelineAction spec={spec} />
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
              {spec.referenceLabel}
            </text>
          </>
        ) : null}
      </svg>
      <figcaption>
        Typische Einordnung · Balken: Handlung · ● abgeschlossen · ◆ Bezugspunkt
      </figcaption>
    </figure>
  );
}
