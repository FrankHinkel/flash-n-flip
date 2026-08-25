import type { I18nText } from "./i18n-provider";

type Text = I18nText;

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
      <summary>{text("legacy.e1fbe1978149")}</summary>
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
