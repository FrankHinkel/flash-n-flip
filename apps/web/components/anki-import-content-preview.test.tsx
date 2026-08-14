import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnkiImportInlineAudio } from "./anki-import-content-preview";

describe("Anki import audio preview", () => {
  it("uses an accessible Lucide play control without an invented caption", () => {
    const html = renderToStaticMarkup(
      <AnkiImportInlineAudio
        src="blob:local-preview"
        number={1}
        text={(_english, german) => german}
      />,
    );

    expect(html).toContain("lucide-play");
    expect(html).toContain('aria-label="Audio 1 abspielen"');
    expect(html).not.toContain("Importiertes Audio");
    expect(html).not.toContain("controls");
  });
});
