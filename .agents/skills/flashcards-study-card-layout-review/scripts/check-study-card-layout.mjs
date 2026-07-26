#!/usr/bin/env node

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const pair = (name) => {
  const value = args.get(name);
  const match = value?.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (!match) throw new Error(`${name} must use WIDTHxHEIGHT`);
  return [Number(match[1]), Number(match[2])];
};
const viewport = pair("--viewport");
const card = pair("--card");
const map = args.has("--map") ? pair("--map") : null;
const paddingValue = args.get("--padding");
const padding = paddingValue?.split(",").map(Number);
if (!padding || padding.length !== 4 || padding.some(Number.isNaN)) {
  throw new Error("--padding must contain top,right,bottom,left");
}
const scrollHeight = Number(args.get("--scroll-height"));
if (!Number.isFinite(scrollHeight)) {
  throw new Error("--scroll-height must be a number");
}

const checks = [
  {
    label: "card width / viewport",
    actual: card[0] / viewport[0],
    expected: 0.75,
  },
  {
    label: "card height / viewport",
    actual: card[1] / viewport[1],
    expected: 0.75,
  },
];
const innerWidth = card[0] - padding[1] - padding[3];
const innerHeight = card[1] - padding[0] - padding[2];
if (map) {
  checks.push({
    label: "map area / card inner area",
    actual: (map[0] * map[1]) / (innerWidth * innerHeight),
    expected: 0.6,
  });
}

let failed = false;
for (const check of checks) {
  const passed = check.actual >= check.expected;
  failed ||= !passed;
  console.log(
    `${passed ? "PASS" : "FAIL"} ${check.label}: ${(check.actual * 100).toFixed(1)}% (minimum ${(check.expected * 100).toFixed(0)}%)`,
  );
}
for (const [index, value] of padding.entries()) {
  const passed = value >= 10 && value <= 20;
  failed ||= !passed;
  console.log(
    `${passed ? "PASS" : "FAIL"} padding ${["top", "right", "bottom", "left"][index]}: ${value}px (required 10-20px)`,
  );
}
const scrollPassed = scrollHeight <= viewport[1] + 1;
failed ||= !scrollPassed;
console.log(
  `${scrollPassed ? "PASS" : "FAIL"} page scroll: ${scrollHeight}px document / ${viewport[1]}px viewport`,
);

process.exitCode = failed ? 1 : 0;
