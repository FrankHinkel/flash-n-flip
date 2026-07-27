import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { format } from "prettier";
import yauzl from "yauzl";

const sourceUrl =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson";
const expectedSha256 =
  "239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255";
const sourceLocation = process.argv[2] ?? sourceUrl;
const nativeNameQuery =
  "SELECT DISTINCT ?iso ?labelLang ?name WHERE { ?country wdt:P31/wdt:P279* wd:Q6256; wdt:P297 ?iso; wdt:P37 ?language; rdfs:label ?name. ?language (wdt:P218|wdt:P424) ?labelLang. FILTER(LANG(?name) = ?labelLang) } ORDER BY ?iso ?labelLang ?name";
const nativeNameUrl = `https://query.wikidata.org/sparql?${new URLSearchParams({
  query: nativeNameQuery,
}).toString()}`;
const nativeNameSourceLocation = process.argv[3] ?? nativeNameUrl;
const expectedNativeNameSha256 =
  "08845ead09ff472e6fe30efab8dad7cc6f486cfd7d5bea0194ea0531a42274ed";
const capitalQuery =
  'SELECT DISTINCT ?iso ?capitalNameEn ?capitalNameDe ?capitalNameEs ?capitalNameFr WHERE { ?country wdt:P31/wdt:P279* wd:Q6256; wdt:P297 ?iso; wdt:P36 ?capital. OPTIONAL { ?capital rdfs:label ?capitalNameEn. FILTER(LANG(?capitalNameEn) = "en") } OPTIONAL { ?capital rdfs:label ?capitalNameDe. FILTER(LANG(?capitalNameDe) = "de") } OPTIONAL { ?capital rdfs:label ?capitalNameEs. FILTER(LANG(?capitalNameEs) = "es") } OPTIONAL { ?capital rdfs:label ?capitalNameFr. FILTER(LANG(?capitalNameFr) = "fr") } } ORDER BY ?iso ?capitalNameEn';
const capitalUrl = `https://query.wikidata.org/sparql?${new URLSearchParams({
  query: capitalQuery,
}).toString()}`;
const capitalSourceLocation = process.argv[4] ?? capitalUrl;
const expectedCapitalSha256 =
  "e78ba6d118d37eec3d94dde75d5848db6c706d138b5621d10dcc62a0cbe27153";
const populationSourceUrl =
  "https://api.worldbank.org/v2/en/indicator/SP.POP.TOTL?downloadformat=csv";
const expectedPopulationSha256 =
  "faaff4604bb61167c1ec193cb39ccd0d823926093228a9adabd34c9dd9c142b4";
const populationSourceLocation = process.argv[5] ?? populationSourceUrl;
const gdpSourceUrl =
  "https://api.worldbank.org/v2/en/indicator/NY.GDP.MKTP.CD?downloadformat=csv";
const expectedGdpSha256 =
  "1d84cc31fe10526953d5426cd590ced94cf578538f97dcb602d5844404f6f1ad";
const gdpSourceLocation = process.argv[6] ?? gdpSourceUrl;
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
    "AT",
    "BY",
    "BE",
    "BA",
    "BG",
    "HR",
    "CZ",
    "DK",
    "EE",
    "FI",
    "FR",
    "DE",
    "GR",
    "HU",
    "IS",
    "IE",
    "IT",
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
    "SM",
    "RS",
    "SK",
    "SI",
    "ES",
    "SE",
    "CH",
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

const continentByLargestArea = {
  AM: "Asia",
  AZ: "Asia",
  CY: "Asia",
  GE: "Asia",
  KZ: "Asia",
  RU: "Asia",
  TR: "Asia",
};

// Wikidata currently exposes no en/de/fr rdfs:label for these capital items.
const capitalLabelFallbacks = {
  AG: {
    en: ["St. John's"],
    de: ["St. John’s"],
    es: ["Saint John"],
    fr: ["Saint John's"],
  },
  NG: {
    en: ["Abuja"],
    de: ["Abuja"],
    es: ["Abuya"],
    fr: ["Abuja"],
  },
};

const readBinarySource = async (location, label) =>
  /^https:\/\//.test(location)
    ? Buffer.from(
        await fetch(location).then(async (response) => {
          if (!response.ok) {
            throw new Error(`${label} download failed (${response.status})`);
          }
          return response.arrayBuffer();
        }),
      )
    : readFile(location);

const csvFromZip = async (archive, label) =>
  new Promise((resolveCsv, reject) => {
    yauzl.fromBuffer(archive, { lazyEntries: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        reject(openError ?? new Error(`${label} ZIP could not be opened`));
        return;
      }
      let settled = false;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        zipFile.close();
        reject(error);
      };
      zipFile.on("error", fail);
      zipFile.on("end", () => {
        if (!settled) fail(new Error(`${label} ZIP contains no data CSV`));
      });
      zipFile.on("entry", (entry) => {
        if (
          !entry.fileName.startsWith("API_") ||
          !entry.fileName.endsWith(".csv")
        ) {
          zipFile.readEntry();
          return;
        }
        zipFile.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            fail(streamError ?? new Error(`${label} CSV could not be read`));
            return;
          }
          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("error", fail);
          stream.on("end", () => {
            if (settled) return;
            settled = true;
            zipFile.close();
            resolveCsv(Buffer.concat(chunks).toString("utf8"));
          });
        });
      });
      zipFile.readEntry();
    });
  });

const parseCsvRows = (text) => {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
};

const indicatorValues = async (
  location,
  expectedChecksum,
  indicatorCode,
  label,
) => {
  const archive = await readBinarySource(location, label);
  const checksum = createHash("sha256").update(archive).digest("hex");
  if (checksum !== expectedChecksum) {
    throw new Error(
      `${label} source changed (${checksum}); review it before updating the checksum.`,
    );
  }
  const rows = parseCsvRows(await csvFromZip(archive, label));
  const headerIndex = rows.findIndex((row) => row[0] === "Country Name");
  if (headerIndex < 0) throw new Error(`${label} CSV header is missing`);
  const header = rows[headerIndex];
  const codeIndex = header.indexOf("Country Code");
  const indicatorIndex = header.indexOf("Indicator Code");
  const yearColumns = header
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => /^\d{4}$/.test(column))
    .reverse();
  const values = new Map();
  for (const row of rows.slice(headerIndex + 1)) {
    if (row[indicatorIndex] !== indicatorCode) continue;
    const latest = yearColumns.find(({ index }) => row[index]?.trim());
    if (!latest) continue;
    const numericValue = Number(row[latest.index]);
    if (!Number.isFinite(numericValue)) continue;
    values.set(row[codeIndex], {
      value: numericValue,
      year: Number(latest.column),
    });
  }
  return values;
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
const capitalText = /^https:\/\//.test(capitalSourceLocation)
  ? await fetch(capitalSourceLocation, {
      headers: {
        accept: "application/sparql-results+json",
        "user-agent": "Flash-n-Flip/0.5 (flash-n-flip.com)",
      },
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`Capital download failed (${response.status})`);
      }
      return response.text();
    })
  : await readFile(capitalSourceLocation, "utf8");
const capitalSha256 = createHash("sha256").update(capitalText).digest("hex");
if (capitalSha256 !== expectedCapitalSha256) {
  throw new Error(
    `Wikidata capitals changed (${capitalSha256}); review them before updating the checksum.`,
  );
}
const nativeNamesByCode = new Map();
for (const binding of JSON.parse(nativeNameText).results.bindings) {
  const code = binding.iso.value;
  const names = nativeNamesByCode.get(code) ?? new Set();
  names.add(binding.name.value);
  nativeNamesByCode.set(code, names);
}
const capitalsByCode = new Map();
for (const binding of JSON.parse(capitalText).results.bindings) {
  const code = binding.iso.value;
  const byLocale = capitalsByCode.get(code) ?? new Map();
  for (const locale of locales) {
    const capitalName =
      binding[`capitalName${locale[0].toUpperCase()}${locale.slice(1)}`]?.value;
    if (!capitalName) continue;
    const names = byLocale.get(locale) ?? new Set();
    names.add(capitalName);
    byLocale.set(locale, names);
  }
  capitalsByCode.set(code, byLocale);
}
for (const [code, labels] of Object.entries(capitalLabelFallbacks)) {
  const byLocale = capitalsByCode.get(code) ?? new Map();
  for (const locale of locales) {
    const names = byLocale.get(locale) ?? new Set();
    for (const name of labels[locale]) names.add(name);
    byLocale.set(locale, names);
  }
  capitalsByCode.set(code, byLocale);
}

const [populationByWorldBankCode, gdpByWorldBankCode] = await Promise.all([
  indicatorValues(
    populationSourceLocation,
    expectedPopulationSha256,
    "SP.POP.TOTL",
    "World Bank population",
  ),
  indicatorValues(
    gdpSourceLocation,
    expectedGdpSha256,
    "NY.GDP.MKTP.CD",
    "World Bank GDP",
  ),
]);

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

const worldBankCode = (code, feature) => {
  if (code === "XK") return "XKX";
  const candidate =
    feature.properties.WB_A3 === "-99"
      ? feature.properties.ISO_A3
      : feature.properties.WB_A3;
  return candidate === "-99" ? null : candidate;
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

const normalizeRingLongitudes = (ring, bounds) => {
  if (ring.length === 0) return ring;
  const unwrapped = [ring[0]];
  let previousLongitude = ring[0][0];
  for (const [sourceLongitude, latitude] of ring.slice(1)) {
    let longitude = sourceLongitude;
    while (longitude - previousLongitude > 180) longitude -= 360;
    while (longitude - previousLongitude < -180) longitude += 360;
    unwrapped.push([longitude, latitude]);
    previousLongitude = longitude;
  }

  const longitudes = unwrapped.map(([longitude]) => longitude);
  const ringCenter = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;
  const mapCenter = (bounds.west + bounds.east) / 2;
  const shift = Math.round((mapCenter - ringCenter) / 360) * 360;
  return unwrapped.map(([longitude, latitude]) => [
    longitude + shift,
    latitude,
  ]);
};

const projector =
  ({ width, height, bounds }) =>
  ([longitude, latitude]) => [
    ((longitude - bounds.west) / (bounds.east - bounds.west)) * width,
    ((bounds.north - latitude) / (bounds.north - bounds.south)) * height,
  ];

const shapeFor = (features, spec) => {
  const project = projector(spec);
  let largest = { area: 0, center: [spec.width / 2, spec.height / 2] };
  let unsimplifiedLargest = largest;
  const paths = [];
  for (const feature of features) {
    for (const ring of geometryRings(feature.geometry)) {
      const unsimplified = normalizeRingLongitudes(ring, spec.bounds).map(
        project,
      );
      const unsimplifiedArea =
        Math.abs(
          unsimplified.reduce((sum, point, index) => {
            const next = unsimplified[(index + 1) % unsimplified.length];
            return sum + point[0] * next[1] - next[0] * point[1];
          }, 0),
        ) / 2;
      if (unsimplifiedArea > unsimplifiedLargest.area) {
        const total = unsimplified.reduce(
          (sum, point) => [sum[0] + point[0], sum[1] + point[1]],
          [0, 0],
        );
        unsimplifiedLargest = {
          area: unsimplifiedArea,
          center: [
            total[0] / unsimplified.length,
            total[1] / unsimplified.length,
          ],
        };
      }
      const projected = simplify(unsimplified);
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
  if (largest.area === 0) largest = unsimplifiedLargest;
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
const mapContinentCode = {
  europe: "EU",
  "north-america": "NA",
  "south-america": "SA",
  asia: "AS",
  africa: "AF",
  oceania: "OC",
};
const featuresForContinent = (continent) =>
  source.features.filter(
    (feature) =>
      (continentByLargestArea[featureCode(feature)] ??
        feature.properties.CONTINENT) === continent,
  );
const maps = {};
const regions = {
  world: Object.entries(continentCopy).map(([code, names]) => ({
    code,
    names,
    nativeNames: [],
    capitals: null,
    statistics: null,
  })),
};

for (const [mapId, spec] of Object.entries(mapSpecs)) {
  const shapes = {};
  const contextShapes = {};
  if (mapId === "world") {
    for (const [code, continent] of Object.entries(worldContinent)) {
      shapes[code] = shapeFor(featuresForContinent(continent), spec);
    }
  } else {
    for (const [code, continent] of Object.entries(worldContinent)) {
      if (code === mapContinentCode[mapId]) continue;
      contextShapes[code] = shapeFor(featuresForContinent(continent), spec);
    }
    const missing = scope[mapId].filter((code) => !byCode.has(code));
    if (missing.length)
      throw new Error(`${mapId}: missing ${missing.join(", ")}`);
    for (const code of scope[mapId]) {
      shapes[code] = shapeFor([byCode.get(code)], spec);
    }
    regions[mapId] = scope[mapId].map((code) => {
      const feature = byCode.get(code);
      const statisticsCode = worldBankCode(code, feature);
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
        capitals: Object.fromEntries(
          locales.map((locale) => [
            locale,
            [...(capitalsByCode.get(code)?.get(locale) ?? [])],
          ]),
        ),
        statistics: statisticsCode
          ? {
              population: populationByWorldBankCode.get(statisticsCode) ?? null,
              gdpUsd: gdpByWorldBankCode.get(statisticsCode) ?? null,
            }
          : null,
      };
    });
  }
  maps[mapId] = {
    viewBox: { width: spec.width, height: spec.height },
    shapes,
    contextShapes,
  };
}

const worldCountryShapes = Object.fromEntries(
  [...new Set(Object.values(scope).flat())]
    .filter((code) => byCode.has(code))
    .map((code) => [code, shapeFor([byCode.get(code)], mapSpecs.world)]),
);

const output = `/**
 * Generated by scripts/generate-geography.mjs from Natural Earth Admin 0
 * Countries 1:10m (public domain), Wikidata native labels and capitals (CC0), and
 * World Bank World Development Indicators (CC BY 4.0).
 */
export type GeographyMapId = ${Object.keys(mapSpecs)
  .map((value) => JSON.stringify(value))
  .join(" | ")};
export type GeographyContentLocale = "en" | "de" | "es" | "fr";
export type GeographyMapShape = {
  readonly path: string;
  readonly center: readonly [number, number];
  readonly marker: boolean;
};
export type GeographyMapDefinition = {
  readonly viewBox: { readonly width: number; readonly height: number };
  readonly shapes: Readonly<Record<string, GeographyMapShape>>;
  readonly contextShapes: Readonly<Record<string, GeographyMapShape>>;
};
export const geographyContentLocales = ["en", "de", "es", "fr"] as const;
export const geographyMapIds = ${JSON.stringify(Object.keys(mapSpecs))} as const;
export const geographyStatisticsSources = {
  population: {
    indicator: "SP.POP.TOTL",
    label: "Population, total",
    source: "World Bank World Development Indicators",
  },
  gdpUsd: {
    indicator: "NY.GDP.MKTP.CD",
    label: "GDP (current US$)",
    source: "World Bank World Development Indicators",
  },
} as const;
export const geographyMaps: Readonly<
  Record<GeographyMapId, GeographyMapDefinition>
> = ${JSON.stringify(maps)};
export const geographyWorldCountryShapes: Readonly<
  Record<string, GeographyMapShape>
> = ${JSON.stringify(worldCountryShapes)};
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
