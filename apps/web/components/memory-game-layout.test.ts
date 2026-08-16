import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./memory-game.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/styles.css", import.meta.url),
  "utf8",
);

describe("Memory presentation contract", () => {
  it("renders exactly one selected content field with the normal safe renderer", () => {
    expect(source.match(/className="memory-reveal-stage"/g)).toHaveLength(1);
    expect(source).toContain("<ContentView");
    expect(source).toContain("content={displayedTile.content}");
    expect(source).toContain("contentStyles={displayedTile.contentStyles}");
    expect(source).not.toContain("tile.text");
  });

  it("keeps tiles as small borderless logo controls", () => {
    expect(source).toContain('<img src={iconPath} alt="" />');
    expect(styles).toMatch(
      /\.memory-tile\s*\{[^}]*width:\s*58px;[^}]*height:\s*58px;[^}]*padding:\s*0;[^}]*background:\s*transparent;[^}]*border:\s*0;/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 560px\)[\s\S]*?\.memory-tile\s*\{[^}]*width:\s*50px;[^}]*height:\s*50px;/s,
    );
  });

  it("solves matching pairs synchronously without an animation delay", () => {
    const matchingBranch = source.slice(
      source.indexOf("if (matching)"),
      source.indexOf("const failureUpdate"),
    );
    expect(matchingBranch).toContain("setSolvedPairIds");
    expect(matchingBranch).toContain("setSelectedTileIds([])");
    expect(matchingBranch).not.toContain("setTimeout");
  });

  it("keeps a mismatched second card open until another tile is selected", () => {
    expect(source).not.toContain("setTimeout");
    expect(source).not.toContain("timerRef");
    expect(source).toContain("if (selectedTiles.length === 2)");
    expect(source).toContain("setSelectedTileIds([tileId])");
    expect(source).toContain("setDisplayedTileId(tileId)");
    expect(source).toContain("selectedTileIds.length < 2");
  });

  it("counts per tile and only then marks the matching pair as failed", () => {
    expect(source).toContain("const [tileFailures, setTileFailures]");
    expect(source).toContain("const [failedPairIds, setFailedPairIds]");
    expect(source).toContain("countMemoryTileFailures");
    expect(source).toContain("[first.id, tile.id]");
    expect(source).toContain("memoryPairIdsForTileIds");
    expect(source).toContain("failedPairIds.includes(tile.pairId)");
    expect(source).toContain(
      "const completedPairCount = solvedPairIds.length + failedPairIds.length",
    );
    expect(source).not.toContain("forcedPairIds");
    expect(source).not.toContain("pairFailures");
  });

  it("keeps the board and actions in a stable bottom dock", () => {
    expect(source).toContain('className="memory-dock"');
    expect(source).toContain('className="memory-actions"');
    expect(styles).toMatch(
      /\.memory-page\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden;[^}]*display:\s*grid;/s,
    );
    expect(styles).toMatch(
      /\.memory-dock\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*justify-content:\s*flex-end;/s,
    );
  });

  it("places both completion actions side by side below the board", () => {
    const actions = source.slice(
      source.indexOf('<div className="memory-actions">'),
      source.indexOf(
        "</div>",
        source.indexOf('<div className="memory-actions">'),
      ),
    );
    expect(actions).toContain('text("Play again", "Noch einmal")');
    expect(actions).toContain('text("Back to overview", "Zur Übersicht")');
    expect(styles).toMatch(
      /\.memory-actions\s*\{[^}]*margin-top:\s*24px;[^}]*display:\s*flex;[^}]*gap:\s*10px;/s,
    );
  });
});
