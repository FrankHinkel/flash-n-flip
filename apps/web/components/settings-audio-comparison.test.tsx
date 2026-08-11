import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AudioComparisonList } from "./settings";

describe("audio comparison list", () => {
  it("renders original and optimized audio below each other with rounded KB sizes", () => {
    const html = renderToStaticMarkup(
      <AudioComparisonList
        locale="de"
        comparisons={[
          {
            mediaId: "00000000-0000-4000-8000-000000000001",
            originalUrl: "blob:original",
            optimizedUrl: "blob:optimized",
            originalBytes: 842 * 1024,
            optimizedBytes: 126 * 1024,
          },
        ]}
      />,
    );

    expect(html).toContain("Original · 842 KB");
    expect(html).toContain("Optimiert · 126 KB");
    expect(html).toContain('aria-label="Originalaudio 1 abspielen"');
    expect(html).toContain('aria-label="Optimiertes Audio 1 abspielen"');
    expect(html.match(/<audio/g)).toHaveLength(2);
    expect(html.indexOf("blob:original")).toBeLessThan(
      html.indexOf("blob:optimized"),
    );
  });
});
