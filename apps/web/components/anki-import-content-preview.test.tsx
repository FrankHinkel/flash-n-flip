import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  translateUiMessage,
  type UiMessageKey,
  type UiMessageValue,
} from "../../../packages/i18n/src/index";

import { AnkiImportInlineAudio } from "./anki-import-content-preview";
import type { I18nText } from "./i18n-provider";

const german = ((key: UiMessageKey, values?: readonly UiMessageValue[]) =>
  translateUiMessage("de", key, values)) as I18nText;

describe("Anki import audio preview", () => {
  it("uses an accessible Lucide play control without an invented caption", () => {
    const html = renderToStaticMarkup(
      <AnkiImportInlineAudio
        src="blob:local-preview"
        number={1}
        text={german}
      />,
    );

    expect(html).toContain("lucide-play");
    expect(html).toContain('aria-label="Audio 1 abspielen"');
    expect(html).not.toContain("Importiertes Audio");
    expect(html).not.toContain("controls");
  });
});
