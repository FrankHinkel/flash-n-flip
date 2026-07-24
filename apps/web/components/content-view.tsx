import type { CardContent } from "@flashcards/domain/content";

export function ContentView({ content }: { content: CardContent }) {
  return (
    <div className="card-content">
      {content.blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        if (block.type === "heading") {
          return block.level === 2 ? (
            <h2 key={key}>{block.text}</h2>
          ) : (
            <h3 key={key}>{block.text}</h3>
          );
        }
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={key}>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </List>
          );
        }
        if (block.type === "formula") {
          return (
            <code className="formula" key={key}>
              {block.latex}
            </code>
          );
        }
        if (block.type === "image") {
          return (
            <span className="media-placeholder" key={key}>
              Bild · {block.alt || "ohne Beschreibung"}
            </span>
          );
        }
        if (block.type === "audio") {
          return (
            <span className="media-placeholder" key={key}>
              Audio · {block.label}
            </span>
          );
        }
        if (block.type === "cloze") {
          return <p key={key}>{block.text}</p>;
        }
        return (
          <p
            className={[
              block.marks?.bold ? "bold" : "",
              block.marks?.italic ? "italic" : "",
            ].join(" ")}
            key={key}
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
