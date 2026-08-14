import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnkiImportSourceFields } from "./anki-import-source-fields";

describe("Anki import source fields", () => {
  it("shows every original field as inert text", () => {
    const html = renderToStaticMarkup(
      <AnkiImportSourceFields
        fields={{
          Front: '<script>alert("x")</script><b>Question</b>',
          Audio: "[sound:answer.mp3]",
          Empty: "",
        }}
        text={(_english, german) => german}
      />,
    );

    expect(html).toContain("Quellfelder anzeigen");
    expect(html).toContain("Front");
    expect(html).toContain("Audio");
    expect(html).toContain("Empty");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
