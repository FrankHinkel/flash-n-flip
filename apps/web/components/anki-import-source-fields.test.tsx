import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  translateUiMessage,
  type UiMessageKey,
  type UiMessageValue,
} from "../../../packages/i18n/src/index";

import { AnkiImportSourceFields } from "./anki-import-source-fields";
import type { I18nText } from "./i18n-provider";

const german = ((key: UiMessageKey, values?: readonly UiMessageValue[]) =>
  translateUiMessage("de", key, values)) as I18nText;

describe("Anki import source fields", () => {
  it("shows every original field as inert text", () => {
    const html = renderToStaticMarkup(
      <AnkiImportSourceFields
        fields={{
          Front: '<script>alert("x")</script><b>Question</b>',
          Audio: "[sound:answer.mp3]",
          Empty: "",
        }}
        text={german}
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
