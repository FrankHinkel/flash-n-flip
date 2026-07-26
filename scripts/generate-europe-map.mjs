import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const defaultSourceUrl =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson";
const expectedSourceSha256 =
  "239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255";
const sourceLocation = process.argv[2] ?? defaultSourceUrl;
const targetPath = resolve(
  import.meta.dirname,
  "../packages/domain/src/europe-map.generated.ts",
);

const countryCodes = new Map(
  [
    ["AL", "AL"],
    ["AD", "AD"],
    ["AM", "AM"],
    ["AT", "AT"],
    ["AZ", "AZ"],
    ["BY", "BY"],
    ["BE", "BE"],
    ["BA", "BA"],
    ["BG", "BG"],
    ["HR", "HR"],
    ["CY", "CY"],
    ["CZ", "CZ"],
    ["DK", "DK"],
    ["EE", "EE"],
    ["FI", "FI"],
    ["-99:FRA", "FR"],
    ["GE", "GE"],
    ["DE", "DE"],
    ["GR", "GR"],
    ["HU", "HU"],
    ["IS", "IS"],
    ["IE", "IE"],
    ["IT", "IT"],
    ["KZ", "KZ"],
    ["-99:KOS", "XK"],
    ["LV", "LV"],
    ["LI", "LI"],
    ["LT", "LT"],
    ["LU", "LU"],
    ["MT", "MT"],
    ["MD", "MD"],
    ["MC", "MC"],
    ["ME", "ME"],
    ["NL", "NL"],
    ["MK", "MK"],
    ["-99:NOR", "NO"],
    ["PL", "PL"],
    ["PT", "PT"],
    ["RO", "RO"],
    ["RU", "RU"],
    ["SM", "SM"],
    ["RS", "RS"],
    ["SK", "SK"],
    ["SI", "SI"],
    ["ES", "ES"],
    ["SE", "SE"],
    ["CH", "CH"],
    ["TR", "TR"],
    ["UA", "UA"],
    ["GB", "GB"],
    ["VA", "VA"],
  ].map(([source, target]) => [source, target]),
);

const width = 800;
const height = 650;
const bounds = { west: -25, east: 50, north: 72, south: 34 };

const project = ([longitude, latitude]) => [
  ((longitude - bounds.west) / (bounds.east - bounds.west)) * width,
  ((bounds.north - latitude) / (bounds.north - bounds.south)) * height,
];

const squaredDistance = (left, right) =>
  (left[0] - right[0]) ** 2 + (left[1] - right[1]) ** 2;

const squaredSegmentDistance = (point, start, end) => {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = end[0];
      y = end[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
};

const simplify = (points, tolerance = 0.55) => {
  if (points.length <= 4) return points;
  const sqTolerance = tolerance * tolerance;
  const radial = [points[0]];
  let previous = points[0];
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    if (
      index === points.length - 1 ||
      squaredDistance(point, previous) > sqTolerance
    ) {
      radial.push(point);
      previous = point;
    }
  }
  const markers = new Uint8Array(radial.length);
  markers[0] = 1;
  markers[radial.length - 1] = 1;
  const stack = [[0, radial.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxDistance = sqTolerance;
    let split = 0;
    for (let index = first + 1; index < last; index += 1) {
      const distance = squaredSegmentDistance(
        radial[index],
        radial[first],
        radial[last],
      );
      if (distance > maxDistance) {
        maxDistance = distance;
        split = index;
      }
    }
    if (split) {
      markers[split] = 1;
      stack.push([first, split], [split, last]);
    }
  }
  return radial.filter((_, index) => markers[index]);
};

const ringPath = (ring) => {
  const points = simplify(ring.map(project));
  if (points.length < 3) return "";
  return `${points
    .map(
      ([x, y], index) =>
        `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`,
    )
    .join("")}Z`;
};

const geometryPath = (geometry) => {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons
    .flatMap((polygon) => polygon.map(ringPath))
    .filter(Boolean)
    .join("");
};

const pointMarkerPath = ([x, y], radius = 3.5) =>
  [
    `M${(x - radius).toFixed(1)} ${y.toFixed(1)}`,
    `a${radius} ${radius} 0 1 0 ${(radius * 2).toFixed(1)} 0`,
    `a${radius} ${radius} 0 1 0 ${(-radius * 2).toFixed(1)} 0Z`,
  ].join("");

const centroid = (geometry) => {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const candidates = polygons
    .map((polygon) => polygon[0])
    .filter(Boolean)
    .map((ring) => {
      const projected = ring.map(project);
      const area =
        Math.abs(
          projected.reduce((sum, point, index) => {
            const next = projected[(index + 1) % projected.length];
            return sum + point[0] * next[1] - next[0] * point[1];
          }, 0),
        ) / 2;
      const center = projected.reduce(
        (sum, point) => [sum[0] + point[0], sum[1] + point[1]],
        [0, 0],
      );
      return {
        area,
        point: [center[0] / projected.length, center[1] / projected.length],
      };
    })
    .sort((left, right) => right.area - left.area);
  return candidates[0]?.point ?? [width / 2, height / 2];
};

const sourceText = /^https:\/\//.test(sourceLocation)
  ? await fetch(sourceLocation).then((response) => {
      if (!response.ok) {
        throw new Error(`Map download failed (${response.status})`);
      }
      return response.text();
    })
  : await readFile(sourceLocation, "utf8");
const sourceSha256 = createHash("sha256").update(sourceText).digest("hex");
if (sourceSha256 !== expectedSourceSha256) {
  throw new Error(
    `Natural Earth source changed (${sourceSha256}); review the map and update the pinned checksum intentionally.`,
  );
}
const source = JSON.parse(sourceText);
const shapes = {};
for (const feature of source.features) {
  const sourceCode =
    feature.properties.ISO_A2 === "-99"
      ? `-99:${feature.properties.ADM0_A3}`
      : feature.properties.ISO_A2;
  const countryCode = countryCodes.get(sourceCode);
  if (!countryCode) continue;
  const center = centroid(feature.geometry);
  const path = geometryPath(feature.geometry);
  shapes[countryCode] = {
    // Very small states can collapse during simplification. Keep them visible
    // and selectable with a deterministic point marker at their map center.
    path: path || pointMarkerPath(center),
    center: center.map((value) => Number(value.toFixed(1))),
  };
}

const missing = [...countryCodes.values()].filter((code) => !shapes[code]);
if (missing.length) throw new Error(`Missing countries: ${missing.join(", ")}`);

const output = `/**
 * Generated by scripts/generate-europe-map.mjs from Natural Earth
 * Admin 0 Countries 1:10m. Natural Earth data is public domain.
 * Source: https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/
 */
export const europeMapViewBox = { width: ${width}, height: ${height} } as const;

export const europeMapShapes = ${JSON.stringify(shapes)} as const;
`;

await writeFile(targetPath, output);
console.log(
  `Generated ${Object.keys(shapes).length} country shapes at ${targetPath}`,
);
