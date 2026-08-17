import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./i18n-provider", () => ({
  useI18n: () => ({
    text: (_english: string, german: string) => german,
  }),
}));

import { AudioPlayerGainSetting } from "./audio-player-gain-setting";

describe("audio player gain setting", () => {
  it("provides an accessible device-local gain selector", () => {
    const html = renderToStaticMarkup(<AudioPlayerGainSetting />);

    expect(html).toContain("Audio-Grundverstärkung");
    expect(html).toContain('aria-label="Audio-Grundverstärkung"');
    expect(html).toContain("50 %");
    expect(html).toContain("100 %");
    expect(html).toContain("300 %");
    expect(html).toContain("gemeinsame Ziellautstärke");
  });
});
