import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { format } from "prettier";

const admin1Url =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson";
const populatedPlacesUrl =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson";
const wikidataQuery = (country, countryCode) =>
  `SELECT DISTINCT ?iso ?capitalNameEn ?capitalNameDe ?capitalNameEs ?capitalNameFr ?coord WHERE { ?subdivision wdt:P17 wd:${country}; wdt:P300 ?iso; wdt:P36 ?capital. FILTER(STRSTARTS(?iso, "${countryCode}-")) ?capital wdt:P625 ?coord. OPTIONAL { ?capital rdfs:label ?capitalNameEn. FILTER(LANG(?capitalNameEn) = "en") } OPTIONAL { ?capital rdfs:label ?capitalNameDe. FILTER(LANG(?capitalNameDe) = "de") } OPTIONAL { ?capital rdfs:label ?capitalNameEs. FILTER(LANG(?capitalNameEs) = "es") } OPTIONAL { ?capital rdfs:label ?capitalNameFr. FILTER(LANG(?capitalNameFr) = "fr") } } ORDER BY ?iso ?capitalNameEn`;
const wikidataUrl = (country, countryCode) =>
  `https://query.wikidata.org/sparql?${new URLSearchParams({
    query: wikidataQuery(country, countryCode),
  }).toString()}`;

const sources = [
  {
    label: "Natural Earth Admin 1",
    location: process.argv[2] ?? admin1Url,
    checksum:
      "22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5",
  },
  {
    label: "Natural Earth populated places",
    location: process.argv[3] ?? populatedPlacesUrl,
    checksum:
      "9b8e3de09048ef00dfc70357dbb9fa324493f214b5e0ae4daf1aa79a8d10116b",
  },
  ...[
    ["DE", "Q183"],
    ["FR", "Q142"],
    ["US", "Q30"],
    ["CO", "Q739"],
    ["IT", "Q38"],
  ].map(([countryCode, country], index) => ({
    label: `Wikidata ${countryCode} subdivision capitals`,
    location: process.argv[index + 4] ?? wikidataUrl(country, countryCode),
    checksum: {
      DE: "2d17b8db0614976c9995bc9d416dbd5333f571a4d944a5211d6c8d49a7a013e7",
      FR: "8172d2d0f4e058f829a34dda798b74d1b2e36979f99e2a07da189003298ef468",
      US: "c02f9aa33f511239943ef43bdbaf7070fa318cd9f5bc0a7838669d9b7421cd61",
      CO: "0da387371cb77cfe1b499c60c55da100a3dfe689724c395be9f66cf163443698",
      IT: "210a2614978d2f8959b15d7447227d5dd08b2628e9b03dcb1f81e3817969ac10",
    }[countryCode],
    countryCode,
  })),
];

const targetPath = resolve(
  import.meta.dirname,
  "../packages/domain/src/geography-subdivisions.generated.ts",
);
const locales = ["en", "de", "es", "fr"];

const readSource = async ({ label, location, checksum }) => {
  const text = /^https:\/\//.test(location)
    ? await fetch(location, {
        headers: {
          accept: "application/sparql-results+json, application/json",
          "user-agent": "Flash-n-Flip/0.5 (flash-n-flip.com)",
        },
      }).then((response) => {
        if (!response.ok) {
          throw new Error(`${label} download failed (${response.status})`);
        }
        return response.text();
      })
    : await readFile(location, "utf8");
  const actual = createHash("sha256").update(text).digest("hex");
  if (actual !== checksum) {
    throw new Error(
      `${label} source changed (${actual}); review it before updating the checksum.`,
    );
  }
  return JSON.parse(text);
};

const [
  admin1,
  populatedPlaces,
  germanyCapitals,
  franceCapitals,
  usaCapitals,
  colombiaCapitals,
  italyCapitals,
] = await Promise.all(sources.map(readSource));

const mapSpecs = {
  "germany-states": {
    width: 720,
    height: 700,
    bounds: { west: 5, east: 16, north: 56, south: 47 },
  },
  "france-regions": {
    width: 720,
    height: 700,
    bounds: { west: -6, east: 10, north: 52, south: 41 },
  },
  "usa-states": {
    width: 900,
    height: 580,
    bounds: { west: -180, east: -65, north: 72, south: 17 },
  },
  "colombia-departments": {
    width: 700,
    height: 760,
    bounds: { west: -83, east: -65, north: 14, south: -5 },
  },
  "italy-regions": {
    width: 720,
    height: 760,
    bounds: { west: 6, east: 19, north: 48, south: 35 },
  },
};

const baseMapBounds = {
  world: { west: -180, east: 180, north: 85, south: -60 },
  europe: { west: -25, east: 50, north: 72, south: 34 },
  "north-america": { west: -175, east: -50, north: 85, south: 5 },
  "south-america": { west: -85, east: -30, north: 15, south: -60 },
  asia: { west: 20, east: 190, north: 82, south: -15 },
  africa: { west: -25, east: 60, north: 40, south: -40 },
  oceania: { west: 110, east: 210, north: 15, south: -55 },
};

const frenchRegions = {
  "Auvergne-Rhône-Alpes": {
    code: "FR-ARA",
    names: {
      en: "Auvergne-Rhône-Alpes",
      de: "Auvergne-Rhône-Alpes",
      es: "Auvernia-Ródano-Alpes",
      fr: "Auvergne-Rhône-Alpes",
    },
  },
  "Bourgogne-Franche-Comté": {
    code: "FR-BFC",
    names: {
      en: "Bourgogne-Franche-Comté",
      de: "Burgund-Franche-Comté",
      es: "Borgoña-Franco Condado",
      fr: "Bourgogne-Franche-Comté",
    },
  },
  Bretagne: {
    code: "FR-BRE",
    names: { en: "Brittany", de: "Bretagne", es: "Bretaña", fr: "Bretagne" },
  },
  "Centre-Val de Loire": {
    code: "FR-CVL",
    names: {
      en: "Centre-Val de Loire",
      de: "Centre-Val de Loire",
      es: "Centro-Valle del Loira",
      fr: "Centre-Val de Loire",
    },
  },
  Corse: {
    code: "FR-20R",
    names: { en: "Corsica", de: "Korsika", es: "Córcega", fr: "Corse" },
  },
  "Grand Est": {
    code: "FR-GES",
    names: {
      en: "Grand Est",
      de: "Grand Est",
      es: "Gran Este",
      fr: "Grand Est",
    },
  },
  "Hauts-de-France": {
    code: "FR-HDF",
    names: {
      en: "Hauts-de-France",
      de: "Hauts-de-France",
      es: "Alta Francia",
      fr: "Hauts-de-France",
    },
  },
  Normandie: {
    code: "FR-NOR",
    names: {
      en: "Normandy",
      de: "Normandie",
      es: "Normandía",
      fr: "Normandie",
    },
  },
  "Nouvelle-Aquitaine": {
    code: "FR-NAQ",
    names: {
      en: "Nouvelle-Aquitaine",
      de: "Nouvelle-Aquitaine",
      es: "Nueva Aquitania",
      fr: "Nouvelle-Aquitaine",
    },
  },
  Occitanie: {
    code: "FR-OCC",
    names: {
      en: "Occitania",
      de: "Okzitanien",
      es: "Occitania",
      fr: "Occitanie",
    },
  },
  "Pays de la Loire": {
    code: "FR-PDL",
    names: {
      en: "Pays de la Loire",
      de: "Pays de la Loire",
      es: "Países del Loira",
      fr: "Pays de la Loire",
    },
  },
  "Provence-Alpes-Côte-d'Azur": {
    code: "FR-PAC",
    names: {
      en: "Provence-Alpes-Côte d’Azur",
      de: "Provence-Alpes-Côte d’Azur",
      es: "Provenza-Alpes-Costa Azul",
      fr: "Provence-Alpes-Côte d’Azur",
    },
  },
  "Île-de-France": {
    code: "FR-IDF",
    names: {
      en: "Île-de-France",
      de: "Île-de-France",
      es: "Isla de Francia",
      fr: "Île-de-France",
    },
  },
};

const italianRegions = {
  Abruzzo: {
    code: "IT-65",
    names: {
      en: "Abruzzo",
      de: "Abruzzen",
      es: "Abruzos",
      fr: "Abruzzes",
    },
    nativeName: "Abruzzo",
  },
  Apulia: {
    code: "IT-75",
    names: {
      en: "Apulia",
      de: "Apulien",
      es: "Apulia",
      fr: "Pouilles",
    },
    nativeName: "Puglia",
  },
  Basilicata: {
    code: "IT-77",
    names: {
      en: "Basilicata",
      de: "Basilikata",
      es: "Basilicata",
      fr: "Basilicate",
    },
    nativeName: "Basilicata",
  },
  Calabria: {
    code: "IT-78",
    names: {
      en: "Calabria",
      de: "Kalabrien",
      es: "Calabria",
      fr: "Calabre",
    },
    nativeName: "Calabria",
  },
  Campania: {
    code: "IT-72",
    names: {
      en: "Campania",
      de: "Kampanien",
      es: "Campania",
      fr: "Campanie",
    },
    nativeName: "Campania",
  },
  "Emilia-Romagna": {
    code: "IT-45",
    names: {
      en: "Emilia-Romagna",
      de: "Emilia-Romagna",
      es: "Emilia-Romaña",
      fr: "Émilie-Romagne",
    },
    nativeName: "Emilia-Romagna",
  },
  "Friuli-Venezia Giulia": {
    code: "IT-36",
    names: {
      en: "Friuli-Venezia Giulia",
      de: "Friaul-Julisch Venetien",
      es: "Friul-Venecia Julia",
      fr: "Frioul-Vénétie Julienne",
    },
    nativeName: "Friuli-Venezia Giulia",
  },
  Lazio: {
    code: "IT-62",
    names: {
      en: "Lazio",
      de: "Latium",
      es: "Lacio",
      fr: "Latium",
    },
    nativeName: "Lazio",
  },
  Liguria: {
    code: "IT-42",
    names: {
      en: "Liguria",
      de: "Ligurien",
      es: "Liguria",
      fr: "Ligurie",
    },
    nativeName: "Liguria",
  },
  Lombardia: {
    code: "IT-25",
    names: {
      en: "Lombardy",
      de: "Lombardei",
      es: "Lombardía",
      fr: "Lombardie",
    },
    nativeName: "Lombardia",
  },
  Marche: {
    code: "IT-57",
    names: {
      en: "Marche",
      de: "Marken",
      es: "Marcas",
      fr: "Marches",
    },
    nativeName: "Marche",
  },
  Molise: {
    code: "IT-67",
    names: {
      en: "Molise",
      de: "Molise",
      es: "Molise",
      fr: "Molise",
    },
    nativeName: "Molise",
  },
  Piemonte: {
    code: "IT-21",
    names: {
      en: "Piedmont",
      de: "Piemont",
      es: "Piamonte",
      fr: "Piémont",
    },
    nativeName: "Piemonte",
  },
  Sardegna: {
    code: "IT-88",
    names: {
      en: "Sardinia",
      de: "Sardinien",
      es: "Cerdeña",
      fr: "Sardaigne",
    },
    nativeName: "Sardegna",
  },
  Sicily: {
    code: "IT-82",
    names: {
      en: "Sicily",
      de: "Sizilien",
      es: "Sicilia",
      fr: "Sicile",
    },
    nativeName: "Sicilia",
  },
  Toscana: {
    code: "IT-52",
    names: {
      en: "Tuscany",
      de: "Toskana",
      es: "Toscana",
      fr: "Toscane",
    },
    nativeName: "Toscana",
  },
  "Trentino-Alto Adige": {
    code: "IT-32",
    names: {
      en: "Trentino-South Tyrol",
      de: "Trentino-Südtirol",
      es: "Trentino-Alto Adigio",
      fr: "Trentin-Haut-Adige",
    },
    nativeName: ["Trentino-Alto Adige", "Trentino-Südtirol"],
  },
  Umbria: {
    code: "IT-55",
    names: {
      en: "Umbria",
      de: "Umbrien",
      es: "Umbría",
      fr: "Ombrie",
    },
    nativeName: "Umbria",
  },
  "Valle d'Aosta": {
    code: "IT-23",
    names: {
      en: "Aosta Valley",
      de: "Aostatal",
      es: "Valle de Aosta",
      fr: "Vallée d’Aoste",
    },
    nativeName: ["Valle d’Aosta", "Vallée d’Aoste"],
  },
  Veneto: {
    code: "IT-34",
    names: {
      en: "Veneto",
      de: "Venetien",
      es: "Véneto",
      fr: "Vénétie",
    },
    nativeName: "Veneto",
  },
};

const squaredDistance = (left, right) =>
  (left[0] - right[0]) ** 2 + (left[1] - right[1]) ** 2;
const squaredSegmentDistance = (point, start, end) => {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx || dy) {
    const ratio =
      ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (ratio > 1) {
      x = end[0];
      y = end[1];
    } else if (ratio > 0) {
      x += dx * ratio;
      y += dy * ratio;
    }
  }
  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
};
const simplify = (points, tolerance = 0.25) => {
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
    let maximum = squaredTolerance;
    let split = 0;
    for (let index = first + 1; index < last; index += 1) {
      const distance = squaredSegmentDistance(
        radial[index],
        radial[first],
        radial[last],
      );
      if (distance > maximum) {
        maximum = distance;
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
  ([longitude, latitude]) => [
    ((longitude - bounds.west) / (bounds.east - bounds.west)) * width,
    ((bounds.north - latitude) / (bounds.north - bounds.south)) * height,
  ];
const shapeFor = (features, spec) => {
  const project = projector(spec);
  let largest = { area: 0, center: [spec.width / 2, spec.height / 2] };
  const paths = [];
  for (const feature of features) {
    for (const ring of geometryRings(feature.geometry)) {
      const projected = simplify(ring.map(project));
      if (projected.length < 3) continue;
      paths.push(
        `${projected
          .map(
            ([x, y], index) =>
              `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`,
          )
          .join("")}Z`,
      );
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
  return {
    path: paths.join(""),
    center: largest.center.map((value) => Number(value.toFixed(1))),
    marker: largest.area < 13,
  };
};

const localizedFeatureNames = (feature) =>
  Object.fromEntries(
    locales.map((locale) => [
      locale,
      feature.properties[`name_${locale}`] ||
        feature.properties.name ||
        feature.properties.iso_3166_2,
    ]),
  );
const featureGroups = (features, key) => {
  const groups = new Map();
  for (const feature of features) {
    const value = key(feature);
    if (!value) continue;
    groups.set(value, [...(groups.get(value) ?? []), feature]);
  }
  return groups;
};
const requireFeatureGroup = (groups, name) => {
  const features = groups.get(name);
  if (!features?.length) {
    throw new Error(`Missing Admin 1 features for ${name}`);
  }
  return features;
};

const italyRegionFeatures = featureGroups(
  admin1.features.filter((feature) => feature.properties.adm0_a3 === "ITA"),
  (feature) => feature.properties.region,
);
const subdivisionRows = {
  "germany-states": admin1.features
    .filter((feature) => feature.properties.adm0_a3 === "DEU")
    .map((feature) => ({
      code: feature.properties.iso_3166_2,
      names: localizedFeatureNames(feature),
      nativeNames: [feature.properties.name_de || feature.properties.name],
      features: [feature],
    })),
  "france-regions": [
    ...featureGroups(
      admin1.features.filter(
        (feature) =>
          feature.properties.adm0_a3 === "FRA" &&
          feature.properties.geonunit === "France",
      ),
      (feature) => feature.properties.region,
    ),
  ].map(([name, features]) => ({
    code: frenchRegions[name].code,
    names: frenchRegions[name].names,
    nativeNames: [name],
    features,
  })),
  "usa-states": admin1.features
    .filter((feature) => feature.properties.adm0_a3 === "USA")
    .map((feature) => ({
      code: feature.properties.iso_3166_2,
      names: localizedFeatureNames(feature),
      nativeNames: [feature.properties.name],
      features: [feature],
    })),
  "colombia-departments": admin1.features
    .filter(
      (feature) =>
        feature.properties.adm0_a3 === "COL" && feature.properties.name,
    )
    .map((feature) => {
      const capitalDistrict = feature.properties.type_en === "Federal District";
      return {
        code: capitalDistrict ? "CO-DC" : feature.properties.iso_3166_2,
        names: capitalDistrict
          ? {
              en: "Bogotá, Capital District",
              de: "Bogotá, Hauptstadtdistrikt",
              es: "Bogotá, Distrito Capital",
              fr: "Bogotá, district capitale",
            }
          : localizedFeatureNames(feature),
        nativeNames: [
          capitalDistrict
            ? "Bogotá, Distrito Capital"
            : feature.properties.name,
        ],
        features: [feature],
      };
    }),
  "italy-regions": Object.entries(italianRegions).map(
    ([region, { code, names, nativeName }]) => ({
      code,
      names,
      nativeNames: Array.isArray(nativeName) ? nativeName : [nativeName],
      features: requireFeatureGroup(italyRegionFeatures, region),
    }),
  ),
};

const parsePoint = (value) => {
  const match = /^Point\((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)$/.exec(value);
  return match ? [Number(match[1]), Number(match[2])] : null;
};
const capitalRows = new Map();
for (const source of [
  germanyCapitals,
  franceCapitals,
  usaCapitals,
  colombiaCapitals,
  italyCapitals,
]) {
  for (const binding of source.results.bindings) {
    const coordinates = parsePoint(binding.coord.value);
    if (!coordinates) continue;
    const names = Object.fromEntries(
      locales.map((locale) => {
        const key = `capitalName${locale[0].toUpperCase()}${locale.slice(1)}`;
        return [
          locale,
          binding[key]?.value ?? binding.capitalNameEn?.value ?? "",
        ];
      }),
    );
    capitalRows.set(binding.iso.value, [
      ...(capitalRows.get(binding.iso.value) ?? []),
      { names, coordinates },
    ]);
  }
}

const fallbackCapitals = {
  "DE-BE": {
    names: { en: "Berlin", de: "Berlin", es: "Berlín", fr: "Berlin" },
    coordinates: [13.405, 52.52],
  },
  "DE-HH": {
    names: { en: "Hamburg", de: "Hamburg", es: "Hamburgo", fr: "Hambourg" },
    coordinates: [9.9937, 53.5511],
  },
  "CO-BOL": {
    names: {
      en: "Cartagena",
      de: "Cartagena",
      es: "Cartagena",
      fr: "Carthagène",
    },
    coordinates: [-75.5144, 10.391],
  },
  "CO-DC": {
    names: { en: "Bogotá", de: "Bogotá", es: "Bogotá", fr: "Bogota" },
    coordinates: [-74.08175, 4.60971],
  },
};
for (const [code, capital] of Object.entries(fallbackCapitals)) {
  capitalRows.set(code, [capital]);
}
capitalRows.set(
  "FR-BFC",
  (capitalRows.get("FR-BFC") ?? []).filter(
    (capital) => capital.names.en === "Dijon",
  ),
);
capitalRows.set(
  "US-LA",
  (capitalRows.get("US-LA") ?? []).filter(
    (capital) => capital.names.en === "Baton Rouge",
  ),
);
capitalRows.set(
  "IT-88",
  (capitalRows.get("IT-88") ?? []).filter(
    (capital) => capital.coordinates[0] === 9.109522,
  ),
);

const maps = {};
const regions = {};
for (const [mapId, rows] of Object.entries(subdivisionRows)) {
  const spec = mapSpecs[mapId];
  maps[mapId] = {
    viewBox: { width: spec.width, height: spec.height },
    shapes: Object.fromEntries(
      rows.map((row) => [row.code, shapeFor(row.features, spec)]),
    ),
    contextShapes: {},
  };
  regions[mapId] = rows.map(({ code, names, nativeNames }) => ({
    code,
    names,
    nativeNames,
    capitals: Object.fromEntries(
      locales.map((locale) => [
        locale,
        (capitalRows.get(code) ?? [])
          .map((capital) => capital.names[locale])
          .filter(Boolean),
      ]),
    ),
    capitalMarkers: capitalRows.get(code) ?? [],
    statistics: null,
  }));
}

const countryCapitalMarkers = {};
for (const feature of populatedPlaces.features) {
  const code = feature.properties.ISO_A2;
  if (feature.properties.ADM0CAP !== 1 || !/^[A-Z]{2}$/.test(code)) continue;
  const marker = {
    names: Object.fromEntries(
      locales.map((locale) => [
        locale,
        feature.properties[`NAME_${locale.toUpperCase()}`] ||
          feature.properties.NAME,
      ]),
    ),
    coordinates: feature.geometry.coordinates,
  };
  countryCapitalMarkers[code] = [
    ...(countryCapitalMarkers[code] ?? []),
    marker,
  ];
}
Object.assign(countryCapitalMarkers, {
  XK: [
    {
      names: {
        en: "Pristina",
        de: "Pristina",
        es: "Pristina",
        fr: "Pristina",
      },
      coordinates: [21.1662, 42.6629],
    },
  ],
  PS: [
    {
      names: {
        en: "East Jerusalem",
        de: "Ostjerusalem",
        es: "Jerusalén Este",
        fr: "Jérusalem-Est",
      },
      coordinates: [35.2137, 31.7683],
    },
    {
      names: {
        en: "Ramallah",
        de: "Ramallah",
        es: "Ramala",
        fr: "Ramallah",
      },
      coordinates: [35.2034, 31.9038],
    },
  ],
  SS: [
    {
      names: { en: "Juba", de: "Juba", es: "Yuba", fr: "Djouba" },
      coordinates: [31.5825, 4.8594],
    },
  ],
  NR: [
    {
      names: {
        en: "Yaren District",
        de: "Yaren",
        es: "Yaren",
        fr: "Yaren",
      },
      coordinates: [166.9211, -0.5477],
    },
  ],
});

const output = `/**
 * Generated by scripts/generate-geography-subdivisions.mjs from Natural Earth
 * Admin 1 and populated places (public domain) plus Wikidata subdivision
 * capitals (CC0).
 */
export const geographySubdivisionMapIds = ${JSON.stringify(Object.keys(mapSpecs))} as const;
export type GeographySubdivisionMapId =
  (typeof geographySubdivisionMapIds)[number];
export const geographyMapBounds = ${JSON.stringify({
  ...baseMapBounds,
  ...Object.fromEntries(
    Object.entries(mapSpecs).map(([mapId, spec]) => [mapId, spec.bounds]),
  ),
})} as const;
export const geographySubdivisionMaps = ${JSON.stringify(maps)} as const;
export const geographySubdivisionRegions = ${JSON.stringify(regions)} as const;
export const geographyCountryCapitalMarkers = ${JSON.stringify(countryCapitalMarkers)} as const;
`;

await writeFile(targetPath, await format(output, { parser: "typescript" }));
console.log(`Generated geography subdivisions at ${targetPath}`);
