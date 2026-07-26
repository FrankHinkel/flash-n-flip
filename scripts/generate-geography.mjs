import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { format } from "prettier";

const sourceUrl =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson";
const expectedSha256 =
  "239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255";
const sourceLocation = process.argv[2] ?? sourceUrl;
const nativeNameQuery =
  "SELECT ?iso ?labelLang ?name WHERE { ?country wdt:P297 ?iso; wdt:P37 ?language; rdfs:label ?name. ?language (wdt:P218|wdt:P424) ?labelLang. FILTER(LANG(?name) = ?labelLang) } ORDER BY ?iso ?labelLang";
const nativeNameUrl = `https://query.wikidata.org/sparql?${new URLSearchParams({
  query: nativeNameQuery,
}).toString()}`;
const nativeNameSourceLocation = process.argv[3] ?? nativeNameUrl;
const expectedNativeNameSha256 =
  "a1f3eee49d1c2701b2d9476cd25702dd5fe40662b17f25357ea1c908eb6ce9e6";
const targetPath = resolve(
  import.meta.dirname,
  "../packages/domain/src/geography.generated.ts",
);

const locales = ["en", "de", "es", "fr"];
const displays = Object.fromEntries(
  locales.map((locale) => [
    locale,
    new Intl.DisplayNames([locale], { type: "region" }),
  ]),
);

const scope = {
  europe: [
    "AL",
    "AD",
    "AM",
    "AT",
    "AZ",
    "BY",
    "BE",
    "BA",
    "BG",
    "HR",
    "CY",
    "CZ",
    "DK",
    "EE",
    "FI",
    "FR",
    "GE",
    "DE",
    "GR",
    "HU",
    "IS",
    "IE",
    "IT",
    "KZ",
    "XK",
    "LV",
    "LI",
    "LT",
    "LU",
    "MT",
    "MD",
    "MC",
    "ME",
    "NL",
    "MK",
    "NO",
    "PL",
    "PT",
    "RO",
    "RU",
    "SM",
    "RS",
    "SK",
    "SI",
    "ES",
    "SE",
    "CH",
    "TR",
    "UA",
    "GB",
    "VA",
  ],
  "north-america": [
    "CA",
    "US",
    "MX",
    "GT",
    "BZ",
    "HN",
    "SV",
    "NI",
    "CR",
    "PA",
    "BS",
    "CU",
    "JM",
    "HT",
    "DO",
    "AG",
    "DM",
    "KN",
    "LC",
    "VC",
    "BB",
    "GD",
    "TT",
  ],
  "south-america": [
    "AR",
    "BO",
    "BR",
    "CL",
    "CO",
    "EC",
    "GY",
    "PY",
    "PE",
    "SR",
    "UY",
    "VE",
  ],
  asia: [
    "AF",
    "AM",
    "AZ",
    "BH",
    "BD",
    "BT",
    "BN",
    "KH",
    "CN",
    "CY",
    "GE",
    "IN",
    "ID",
    "IR",
    "IQ",
    "IL",
    "JP",
    "JO",
    "KZ",
    "KW",
    "KG",
    "LA",
    "LB",
    "MY",
    "MV",
    "MN",
    "MM",
    "NP",
    "KP",
    "OM",
    "PK",
    "PS",
    "PH",
    "QA",
    "RU",
    "SA",
    "SG",
    "KR",
    "LK",
    "SY",
    "TW",
    "TJ",
    "TH",
    "TL",
    "TR",
    "TM",
    "AE",
    "UZ",
    "VN",
    "YE",
  ],
  africa: [
    "DZ",
    "AO",
    "BJ",
    "BW",
    "BF",
    "BI",
    "CV",
    "CM",
    "CF",
    "TD",
    "KM",
    "CD",
    "CG",
    "CI",
    "DJ",
    "EG",
    "GQ",
    "ER",
    "SZ",
    "ET",
    "GA",
    "GM",
    "GH",
    "GN",
    "GW",
    "KE",
    "LS",
    "LR",
    "LY",
    "MG",
    "MW",
    "ML",
    "MR",
    "MU",
    "MA",
    "MZ",
    "NA",
    "NE",
    "NG",
    "RW",
    "ST",
    "SN",
    "SC",
    "SL",
    "SO",
    "ZA",
    "SS",
    "SD",
    "TZ",
    "TG",
    "TN",
    "UG",
    "ZM",
    "ZW",
  ],
  oceania: [
    "AU",
    "FJ",
    "KI",
    "MH",
    "FM",
    "NR",
    "NZ",
    "PW",
    "PG",
    "WS",
    "SB",
    "TO",
    "TV",
    "VU",
  ],
};

const continentCopy = {
  AF: { en: "Africa", de: "Afrika", es: "África", fr: "Afrique" },
  AS: { en: "Asia", de: "Asien", es: "Asia", fr: "Asie" },
  EU: { en: "Europe", de: "Europa", es: "Europa", fr: "Europe" },
  NA: {
    en: "North America",
    de: "Nordamerika",
    es: "América del Norte",
    fr: "Amérique du Nord",
  },
  SA: {
    en: "South America",
    de: "Südamerika",
    es: "América del Sur",
    fr: "Amérique du Sud",
  },
  OC: {
    en: "Australia and Oceania",
    de: "Australien und Ozeanien",
    es: "Australia y Oceanía",
    fr: "Australie et Océanie",
  },
};

const mapSpecs = {
  world: {
    width: 900,
    height: 460,
    bounds: { west: -180, east: 180, north: 85, south: -60 },
  },
  europe: {
    width: 800,
    height: 650,
    bounds: { west: -25, east: 50, north: 72, south: 34 },
  },
  "north-america": {
    width: 800,
    height: 620,
    bounds: { west: -175, east: -50, north: 85, south: 5 },
  },
  "south-america": {
    width: 650,
    height: 760,
    bounds: { west: -85, east: -30, north: 15, south: -60 },
  },
  asia: {
    width: 900,
    height: 600,
    bounds: { west: 20, east: 190, north: 82, south: -15 },
  },
  africa: {
    width: 720,
    height: 760,
    bounds: { west: -25, east: 60, north: 40, south: -40 },
  },
  oceania: {
    width: 900,
    height: 540,
    bounds: { west: 110, east: 210, north: 15, south: -55 },
  },
};

const sourceText = /^https:\/\//.test(sourceLocation)
  ? await fetch(sourceLocation).then((response) => {
      if (!response.ok)
        throw new Error(`Map download failed (${response.status})`);
      return response.text();
    })
  : await readFile(sourceLocation, "utf8");
const sha256 = createHash("sha256").update(sourceText).digest("hex");
if (sha256 !== expectedSha256) {
  throw new Error(
    `Natural Earth source changed (${sha256}); review it before updating the checksum.`,
  );
}
const source = JSON.parse(sourceText);
const nativeNameText = /^https:\/\//.test(nativeNameSourceLocation)
  ? await fetch(nativeNameSourceLocation, {
      headers: {
        accept: "application/sparql-results+json",
        "user-agent": "Flash-n-Flip/0.5 (flash-n-flip.com)",
      },
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`Native-name download failed (${response.status})`);
      }
      return response.text();
    })
  : await readFile(nativeNameSourceLocation, "utf8");
const nativeNameSha256 = createHash("sha256")
  .update(nativeNameText)
  .digest("hex");
if (nativeNameSha256 !== expectedNativeNameSha256) {
  throw new Error(
    `Wikidata native names changed (${nativeNameSha256}); review them before updating the checksum.`,
  );
}
const nativeNamesByCode = new Map();
for (const binding of JSON.parse(nativeNameText).results.bindings) {
  const code = binding.iso.value;
  const names = nativeNamesByCode.get(code) ?? new Set();
  names.add(binding.name.value);
  nativeNamesByCode.set(code, names);
}

const featureCode = (feature) => {
  if (feature.properties.ISO_A2 === "CN-TW") return "TW";
  if (feature.properties.ISO_A2 !== "-99") return feature.properties.ISO_A2;
  return {
    FRA: "FR",
    KOS: "XK",
    NOR: "NO",
    TAI: "TW",
  }[feature.properties.ADM0_A3];
};

const byCode = new Map(
  source.features
    .map((feature) => [featureCode(feature), feature])
    .filter(([code]) => code),
);

const squaredDistance = (left, right) =>
  (left[0] - right[0]) ** 2 + (left[1] - right[1]) ** 2;
const squaredSegmentDistance = (point, start, end) => {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx || dy) {
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
const simplify = (points, tolerance = 0.65) => {
  if (points.length <= 4) return points;
  const squaredTolerance = tolerance * tolerance;
  const radial = [points[0]];
  let previous = points[0];
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    if (
      index === points.length - 1 ||
      squaredDistance(point, previous) > squaredTolerance
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
    let maxDistance = squaredTolerance;
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

const geometryRings = (geometry) =>
  (geometry.type === "Polygon"
    ? [geometry.coordinates]
    : geometry.coordinates
  ).flatMap((polygon) => polygon);

const projector =
  ({ width, height, bounds }) =>
  ([longitude, latitude]) => {
    let normalized = longitude;
    if (bounds.east > 180 && normalized < bounds.west) normalized += 360;
    return [
      ((normalized - bounds.west) / (bounds.east - bounds.west)) * width,
      ((bounds.north - latitude) / (bounds.north - bounds.south)) * height,
    ];
  };

const shapeFor = (features, spec) => {
  const project = projector(spec);
  let largest = { area: 0, center: [spec.width / 2, spec.height / 2] };
  const paths = [];
  for (const feature of features) {
    for (const ring of geometryRings(feature.geometry)) {
      const projected = simplify(ring.map(project));
      if (projected.length < 3) continue;
      const path = `${projected
        .map(
          ([x, y], index) =>
            `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`,
        )
        .join("")}Z`;
      paths.push(path);
      const area =
        Math.abs(
          projected.reduce((sum, point, index) => {
            const next = projected[(index + 1) % projected.length];
            return sum + point[0] * next[1] - next[0] * point[1];
          }, 0),
        ) / 2;
      if (area > largest.area) {
        const total = projected.reduce(
          (sum, point) => [sum[0] + point[0], sum[1] + point[1]],
          [0, 0],
        );
        largest = {
          area,
          center: [total[0] / projected.length, total[1] / projected.length],
        };
      }
    }
  }
  const [x, y] = largest.center;
  return {
    path:
      paths.join("") ||
      `M${(x - 4).toFixed(1)} ${y.toFixed(1)}a4 4 0 1 0 8 0a4 4 0 1 0-8 0Z`,
    center: largest.center.map((value) => Number(value.toFixed(1))),
    marker: largest.area < 13,
  };
};

const worldContinent = {
  AF: "Africa",
  AS: "Asia",
  EU: "Europe",
  NA: "North America",
  SA: "South America",
  OC: "Oceania",
};
const maps = {};
const regions = {
  world: Object.entries(continentCopy).map(([code, names]) => ({
    code,
    names,
    nativeNames: [],
  })),
};

for (const [mapId, spec] of Object.entries(mapSpecs)) {
  const shapes = {};
  if (mapId === "world") {
    for (const [code, continent] of Object.entries(worldContinent)) {
      const features = source.features.filter(
        (feature) => feature.properties.CONTINENT === continent,
      );
      shapes[code] = shapeFor(features, spec);
    }
  } else {
    const missing = scope[mapId].filter((code) => !byCode.has(code));
    if (missing.length)
      throw new Error(`${mapId}: missing ${missing.join(", ")}`);
    for (const code of scope[mapId]) {
      shapes[code] = shapeFor([byCode.get(code)], spec);
    }
    regions[mapId] = scope[mapId].map((code) => {
      const feature = byCode.get(code);
      return {
        code,
        names: Object.fromEntries(
          locales.map((locale) => [locale, displays[locale].of(code) ?? code]),
        ),
        nativeNames: [
          ...(nativeNamesByCode.get(code) ?? [
            feature.properties.NAME_LONG || feature.properties.NAME || code,
          ]),
        ],
      };
    });
  }
  maps[mapId] = {
    viewBox: { width: spec.width, height: spec.height },
    shapes,
  };
}

const output = `/**
 * Generated by scripts/generate-geography.mjs from Natural Earth Admin 0
 * Countries 1:10m (public domain) and Wikidata native labels (CC0).
 */
export type GeographyMapId = ${Object.keys(mapSpecs)
  .map((value) => JSON.stringify(value))
  .join(" | ")};
export type GeographyContentLocale = "en" | "de" | "es" | "fr";
export const geographyContentLocales = ["en", "de", "es", "fr"] as const;
export const geographyMapIds = ${JSON.stringify(Object.keys(mapSpecs))} as const;
export const geographyMaps = ${JSON.stringify(maps)} as const;
export const geographyRegions = ${JSON.stringify(regions)} as const;

export const getGeographyRegion = (mapId: GeographyMapId, code: string) =>
  geographyRegions[mapId].find((region) => region.code === code);
export const getGeographyRegionName = (
  mapId: GeographyMapId,
  code: string,
  locale: GeographyContentLocale,
): string => getGeographyRegion(mapId, code)?.names[locale] ?? code;
`;

await writeFile(targetPath, await format(output, { parser: "typescript" }));
console.log(`Generated geography maps at ${targetPath}`);
