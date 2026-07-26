#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const TOLERANCE = 0.5;

const finite = (value) => Number.isFinite(value);

function normalizeRect(rect, id) {
  if (
    !rect ||
    ![rect.left, rect.top, rect.right, rect.bottom].every(finite) ||
    rect.right < rect.left ||
    rect.bottom < rect.top
  ) {
    throw new Error(`${id} has an invalid rect`);
  }
  return rect;
}

function intersection(a, b) {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return {
    width,
    height,
    area: width > TOLERANCE && height > TOLERANCE ? width * height : 0,
  };
}

function expand(rect, amount) {
  return {
    left: rect.left - amount,
    top: rect.top - amount,
    right: rect.right + amount,
    bottom: rect.bottom + amount,
  };
}

function isAncestor(elementsById, possibleAncestorId, childId) {
  let current = elementsById.get(childId);
  const visited = new Set();
  while (current?.parentId && !visited.has(current.parentId)) {
    if (current.parentId === possibleAncestorId) return true;
    visited.add(current.parentId);
    current = elementsById.get(current.parentId);
  }
  return false;
}

function overlapAllowed(a, b) {
  return (
    a.allowOverlapWith?.includes(b.id) || b.allowOverlapWith?.includes(a.id)
  );
}

export function analyzeScenario(scenario) {
  if (
    !scenario?.viewport ||
    !finite(scenario.viewport.width) ||
    !finite(scenario.viewport.height)
  ) {
    throw new Error("scenario viewport must contain finite width and height");
  }
  if (!Array.isArray(scenario.elements)) {
    throw new Error("scenario elements must be an array");
  }

  const elements = scenario.elements
    .filter((element) => element.visible !== false)
    .map((element) => {
      const clearance = Number(element.clearance ?? 0);
      const inset = Number(element.inset ?? 0);
      if (!element.id || !finite(clearance) || clearance < 0) {
        throw new Error("each element needs an ID and non-negative clearance");
      }
      if (!finite(inset) || inset < 0) {
        throw new Error(`${element.id} needs a non-negative inset`);
      }
      return {
        ...element,
        rect: normalizeRect(element.rect, element.id),
        clearance,
        inset,
      };
    });
  const elementsById = new Map(
    elements.map((element) => [element.id, element]),
  );
  if (elementsById.size !== elements.length) {
    throw new Error("element IDs must be unique");
  }

  const findings = [];
  for (const element of elements) {
    const { rect } = element;
    if (
      rect.left < -TOLERANCE ||
      rect.top < -TOLERANCE ||
      rect.right > scenario.viewport.width + TOLERANCE ||
      rect.bottom > scenario.viewport.height + TOLERANCE
    ) {
      findings.push({
        type: "viewport",
        elements: [element.id],
        message: `${element.id} leaves the viewport`,
      });
    }

    if (element.mustFitWithin) {
      const container = elementsById.get(element.mustFitWithin);
      if (!container) {
        findings.push({
          type: "measurement",
          elements: [element.id, element.mustFitWithin],
          message: `${element.id} requires missing container ${element.mustFitWithin}`,
        });
      } else {
        const inset = element.inset;
        const fits =
          rect.left >= container.rect.left + inset - TOLERANCE &&
          rect.top >= container.rect.top + inset - TOLERANCE &&
          rect.right <= container.rect.right - inset + TOLERANCE &&
          rect.bottom <= container.rect.bottom - inset + TOLERANCE;
        if (!fits) {
          findings.push({
            type: "containment",
            elements: [element.id, container.id],
            message: `${element.id} does not fit inside ${container.id} with ${inset}px inset`,
          });
        }
      }
    }
  }

  for (let left = 0; left < elements.length; left += 1) {
    for (let right = left + 1; right < elements.length; right += 1) {
      const a = elements[left];
      const b = elements[right];
      if (
        overlapAllowed(a, b) ||
        isAncestor(elementsById, a.id, b.id) ||
        isAncestor(elementsById, b.id, a.id)
      ) {
        continue;
      }
      const overlap = intersection(a.rect, b.rect);
      if (overlap.area > 0) {
        findings.push({
          type: "overlap",
          elements: [a.id, b.id],
          area: overlap.area,
          message: `${a.id} overlaps ${b.id} by ${overlap.width.toFixed(1)}x${overlap.height.toFixed(1)}px`,
        });
        continue;
      }
      const clearance = Math.max(a.clearance, b.clearance);
      if (
        clearance > 0 &&
        intersection(expand(a.rect, clearance), b.rect).area > 0
      ) {
        findings.push({
          type: "clearance",
          elements: [a.id, b.id],
          message: `${a.id} and ${b.id} violate the required ${clearance}px clearance`,
        });
      }
    }
  }
  return findings;
}

export function analyzeMeasurements(input) {
  const scenarios = Array.isArray(input?.scenarios) ? input.scenarios : [input];
  return scenarios.map((scenario) => ({
    name: scenario.name ?? "unnamed scenario",
    findings: analyzeScenario(scenario),
  }));
}

function runCli() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("usage: check-ui-overlap.mjs MEASUREMENTS.json");
  }
  const results = analyzeMeasurements(
    JSON.parse(readFileSync(inputPath, "utf8")),
  );
  let failed = false;
  for (const result of results) {
    if (result.findings.length === 0) {
      console.log(`PASS ${result.name}: no overlap or clearance violations`);
      continue;
    }
    failed = true;
    for (const finding of result.findings) {
      console.log(`FAIL ${result.name}: ${finding.message}`);
    }
  }
  process.exitCode = failed ? 1 : 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    runCli();
  } catch (error) {
    console.error(`ERROR ${error instanceof Error ? error.message : error}`);
    process.exitCode = 2;
  }
}
