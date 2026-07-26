import assert from "node:assert/strict";
import test from "node:test";

import { analyzeScenario } from "./check-ui-overlap.mjs";

const viewport = { width: 1000, height: 700 };

test("passes separated elements with required clearance", () => {
  const findings = analyzeScenario({
    viewport,
    elements: [
      {
        id: "progress",
        rect: { left: 100, top: 20, right: 700, bottom: 50 },
      },
      {
        id: "theme",
        rect: { left: 720, top: 10, right: 764, bottom: 54 },
        clearance: 10,
      },
    ],
  });
  assert.deepEqual(findings, []);
});

test("detects overlap and clearance violations", () => {
  const overlap = analyzeScenario({
    viewport,
    elements: [
      {
        id: "progress",
        rect: { left: 100, top: 20, right: 730, bottom: 50 },
      },
      {
        id: "theme",
        rect: { left: 720, top: 10, right: 764, bottom: 54 },
        clearance: 10,
      },
    ],
  });
  assert.equal(overlap[0]?.type, "overlap");

  const clearance = analyzeScenario({
    viewport,
    elements: [
      {
        id: "progress",
        rect: { left: 100, top: 20, right: 715, bottom: 50 },
      },
      {
        id: "theme",
        rect: { left: 720, top: 10, right: 764, bottom: 54 },
        clearance: 10,
      },
    ],
  });
  assert.equal(clearance[0]?.type, "clearance");
});

test("allows intentional containment and verifies its inset", () => {
  const findings = analyzeScenario({
    viewport,
    elements: [
      {
        id: "card",
        rect: { left: 10, top: 80, right: 990, bottom: 690 },
      },
      {
        id: "tools",
        parentId: "card",
        mustFitWithin: "card",
        inset: 10,
        rect: { left: 800, top: 90, right: 980, bottom: 134 },
      },
    ],
  });
  assert.deepEqual(findings, []);
});
