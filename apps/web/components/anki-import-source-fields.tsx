type Text = (english: string, german: string) => string;

export function AnkiImportSourceFields({
  fields,
  text,
}: {
  fields: Record<string, string>;
  text: Text;
}) {
  const entries = Object.entries(fields);
  if (!entries.length) return null;

  return (
    <details className="anki-live-source-fields">
      <summary>{text("Show source fields", "Quellfelder anzeigen")}</summary>
      <dl>
        {entries.map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
