import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import config from "../capacitor.config";

const project = readFileSync(
  new URL("../ios/App/App.xcodeproj/project.pbxproj", import.meta.url),
  "utf8",
);

describe("Capacitor iOS delivery configuration", () => {
  it("runs the actual Xcode app target using its auto-generated scheme", () => {
    const targetNames = [
      ...project.matchAll(/isa = PBXNativeTarget;([\s\S]*?)\n\t\t};/g),
    ]
      .map((match) =>
        /\bname = ([^;\n]+);/
          .exec(match[1]!)?.[1]
          ?.trim()
          .replace(/^"|"$/g, ""),
      )
      .filter(Boolean);

    // Capacitor passes this scheme to xcodebuild and also uses it to locate
    // <scheme>.app for installation. The display name is not a build scheme.
    expect(targetNames.length).toBeGreaterThan(0);
    expect(targetNames).toContain(config.ios?.scheme);
  });
});
