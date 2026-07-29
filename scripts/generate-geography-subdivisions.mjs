import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { format } from "prettier";
import ts from "typescript";

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
const countryGeographyPath = resolve(
  import.meta.dirname,
  "../packages/domain/src/geography.generated.ts",
);
const locales = ["en", "de", "es", "fr"];
const subdivisionPopulationThreshold = 10_000_000;

const staticValue = (node) => {
  if (ts.isAsExpression(node)) return staticValue(node.expression);
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(
      node.properties.map((property) => {
        if (!ts.isPropertyAssignment(property)) {
          throw new Error("Unsupported generated geography property");
        }
        const name =
          ts.isIdentifier(property.name) ||
          ts.isStringLiteral(property.name) ||
          ts.isNumericLiteral(property.name)
            ? property.name.text
            : null;
        if (name === null) {
          throw new Error("Unsupported generated geography property name");
        }
        return [name, staticValue(property.initializer)];
      }),
    );
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map(staticValue);
  }
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return ts.isNumericLiteral(node) ? Number(node.text) : node.text;
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken
  ) {
    return -staticValue(node.operand);
  }
  throw new Error(
    `Unsupported generated geography syntax: ${ts.SyntaxKind[node.kind]}`,
  );
};

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
const countryGeographySource = await readFile(countryGeographyPath, "utf8");
const countryGeographyFile = ts.createSourceFile(
  countryGeographyPath,
  countryGeographySource,
  ts.ScriptTarget.Latest,
  false,
  ts.ScriptKind.TS,
);
const countryRegionsDeclaration = countryGeographyFile.statements
  .filter(ts.isVariableStatement)
  .flatMap((statement) => [...statement.declarationList.declarations])
  .find(
    (declaration) =>
      ts.isIdentifier(declaration.name) &&
      declaration.name.text === "geographyRegions",
  );
if (!countryRegionsDeclaration?.initializer) {
  throw new Error("Could not read country regions from geography.generated.ts");
}
const countryRegions = staticValue(countryRegionsDeclaration.initializer);
const legacyMapIds = {
  DE: "germany-states",
  FR: "france-regions",
  IT: "italy-regions",
  US: "usa-states",
  CO: "colombia-departments",
};
const subdivisionCountries = Object.entries(countryRegions).flatMap(
  ([continentMapId, regions]) =>
    continentMapId === "world"
      ? []
      : regions
          .filter(
            (region) =>
              (region.statistics?.population?.value ?? 0) >
              subdivisionPopulationThreshold,
          )
          .map((country) => ({
            code: country.code,
            continentMapId,
            names: country.names,
            population: country.statistics.population,
            mapId:
              legacyMapIds[country.code] ??
              `${country.code.toLowerCase()}-admin-1`,
          })),
);

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
const geometryPoints = (geometry) => geometryRings(geometry).flat();
const longitudeInterval = (longitudes) => {
  const normalized = longitudes
    .map((longitude) => ((longitude % 360) + 360) % 360)
    .sort((left, right) => left - right);
  let largestGap = -1;
  let intervalStart = normalized[0];
  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    const next =
      index === normalized.length - 1
        ? normalized[0] + 360
        : normalized[index + 1];
    if (next - current > largestGap) {
      largestGap = next - current;
      intervalStart = next % 360;
    }
  }
  let west = intervalStart;
  let east = intervalStart + (360 - largestGap);
  if (west > 180) {
    west -= 360;
    east -= 360;
  }
  return { west, east };
};
const mapSpecFor = (features) => {
  const width = 900;
  const height = 700;
  const points = features.flatMap((feature) =>
    geometryPoints(feature.geometry),
  );
  if (!points.length) throw new Error("Cannot create a map without geometry");
  let { west, east } = longitudeInterval(
    points.map(([longitude]) => longitude),
  );
  let south = 90;
  let north = -90;
  for (const [, latitude] of points) {
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  }
  const horizontalPadding = Math.max((east - west) * 0.06, 0.4);
  const verticalPadding = Math.max((north - south) * 0.06, 0.4);
  west -= horizontalPadding;
  east += horizontalPadding;
  south = Math.max(-90, south - verticalPadding);
  north = Math.min(90, north + verticalPadding);
  const targetAspectRatio = width / height;
  const currentAspectRatio = (east - west) / (north - south);
  if (currentAspectRatio < targetAspectRatio) {
    const expansion = ((north - south) * targetAspectRatio - (east - west)) / 2;
    west -= expansion;
    east += expansion;
  } else {
    const expansion = ((east - west) / targetAspectRatio - (north - south)) / 2;
    south = Math.max(-90, south - expansion);
    north = Math.min(90, north + expansion);
  }
  const rounded = (value) => Number(value.toFixed(4));
  return {
    width,
    height,
    bounds: {
      west: rounded(west),
      east: rounded(east),
      north: rounded(north),
      south: rounded(south),
    },
  };
};
const longitudeForBounds = (longitude, bounds) => {
  let normalized = longitude;
  while (normalized < bounds.west) normalized += 360;
  while (normalized > bounds.east) normalized -= 360;
  return normalized;
};
const projector =
  ({ width, height, bounds }) =>
  ([longitude, latitude]) => [
    ((longitudeForBounds(longitude, bounds) - bounds.west) /
      (bounds.east - bounds.west)) *
      width,
    ((bounds.north - latitude) / (bounds.north - bounds.south)) * height,
  ];
const shapeFor = (features, spec) => {
  const project = projector(spec);
  const firstPoint = features
    .flatMap((feature) => geometryPoints(feature.geometry))
    .at(0);
  let largest = {
    area: 0,
    center: firstPoint
      ? project(firstPoint)
      : [spec.width / 2, spec.height / 2],
  };
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
  const [centerX, centerY] = largest.center;
  return {
    path:
      paths.join("") ||
      `M${(centerX - 4).toFixed(1)} ${centerY.toFixed(1)}a4 4 0 1 0 8 0a4 4 0 1 0-8 0Z`,
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
const countryFeatures = (countryCode) =>
  admin1.features.filter(
    (feature) => feature.properties.iso_a2 === countryCode,
  );
const genericSubdivisionRows = (countryCode) =>
  [
    ...featureGroups(
      countryFeatures(countryCode),
      (feature) => feature.properties.iso_3166_2,
    ),
  ].map(([code, features]) => ({
    code,
    names: localizedFeatureNames(features[0]),
    nativeNames: [
      ...new Set(
        features
          .flatMap((feature) => [
            feature.properties.name_local,
            feature.properties.name,
          ])
          .filter(Boolean),
      ),
    ],
    countryCode,
    features,
  }));

const italyRegionFeatures = featureGroups(
  admin1.features.filter((feature) => feature.properties.adm0_a3 === "ITA"),
  (feature) => feature.properties.region,
);
const subdivisionRows = Object.fromEntries(
  subdivisionCountries.map((country) => [
    country.mapId,
    genericSubdivisionRows(country.code),
  ]),
);
Object.assign(subdivisionRows, {
  "germany-states": admin1.features
    .filter((feature) => feature.properties.adm0_a3 === "DEU")
    .map((feature) => ({
      code: feature.properties.iso_3166_2,
      names: localizedFeatureNames(feature),
      nativeNames: [feature.properties.name_de || feature.properties.name],
      countryCode: "DE",
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
    countryCode: "FR",
    features,
  })),
  "usa-states": admin1.features
    .filter((feature) => feature.properties.adm0_a3 === "USA")
    .map((feature) => ({
      code: feature.properties.iso_3166_2,
      names: localizedFeatureNames(feature),
      nativeNames: [feature.properties.name],
      countryCode: "US",
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
        countryCode: "CO",
        features: [feature],
      };
    }),
  "italy-regions": Object.entries(italianRegions).map(
    ([region, { code, names, nativeName }]) => ({
      code,
      names,
      nativeNames: Array.isArray(nativeName) ? nativeName : [nativeName],
      countryCode: "IT",
      features: requireFeatureGroup(italyRegionFeatures, region),
    }),
  ),
});

for (const country of subdivisionCountries) {
  const rows = subdivisionRows[country.mapId];
  if (!rows?.length) {
    throw new Error(
      `Missing Admin 1 features for ${country.names.en} (${country.code})`,
    );
  }
}
const mapSpecs = Object.fromEntries(
  subdivisionCountries.map((country) => [
    country.mapId,
    mapSpecFor(subdivisionRows[country.mapId].flatMap((row) => row.features)),
  ]),
);

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

const pointInRing = ([x, y], ring) => {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index, index += 1
  ) {
    const [currentX, currentY] = ring[index];
    const [previousX, previousY] = ring[previous];
    if (
      currentY > y !== previousY > y &&
      x <
        ((previousX - currentX) * (y - currentY)) / (previousY - currentY) +
          currentX
    ) {
      inside = !inside;
    }
  }
  return inside;
};
const pointInGeometry = (point, geometry) => {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(
    (polygon) =>
      pointInRing(point, polygon[0]) &&
      !polygon.slice(1).some((hole) => pointInRing(point, hole)),
  );
};
const normalizeName = (value) =>
  value
    ?.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "")
    .toLowerCase();
const naturalEarthAdminCapitals = populatedPlaces.features.filter((feature) =>
  feature.properties.FEATURECLA?.startsWith("Admin-1"),
);
const naturalEarthCapitalsFor = (row) => {
  const featureNames = new Set(
    row.features
      .flatMap((feature) => [
        feature.properties.name,
        feature.properties.name_en,
        feature.properties.name_local,
        feature.properties.gn_name,
        feature.properties.woe_name,
      ])
      .map(normalizeName)
      .filter(Boolean),
  );
  const matches = naturalEarthAdminCapitals.filter(
    (capital) =>
      capital.properties.ISO_A2 === row.countryCode &&
      (row.features.some((feature) =>
        pointInGeometry(capital.geometry.coordinates, feature.geometry),
      ) ||
        featureNames.has(normalizeName(capital.properties.ADM1NAME))),
  );
  const seen = new Set();
  return matches
    .map((feature) => ({
      names: Object.fromEntries(
        locales.map((locale) => [
          locale,
          feature.properties[`NAME_${locale.toUpperCase()}`] ||
            feature.properties.NAME,
        ]),
      ),
      coordinates: feature.geometry.coordinates,
    }))
    .filter((capital) => {
      const key = `${capital.coordinates.join(",")}:${capital.names.en}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};
const capitalsForRow = (row) => {
  const curated = capitalRows.get(row.code);
  return curated?.length ? curated : naturalEarthCapitalsFor(row);
};

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
  regions[mapId] = rows.map((row) => {
    const capitalMarkers = capitalsForRow(row);
    return {
      code: row.code,
      names: row.names,
      nativeNames: row.nativeNames,
      capitals: Object.fromEntries(
        locales.map((locale) => [
          locale,
          capitalMarkers
            .map((capital) => capital.names[locale])
            .filter(Boolean),
        ]),
      ),
      capitalMarkers,
      statistics: null,
    };
  });
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
export const geographySubdivisionCountries = ${JSON.stringify(subdivisionCountries)} as const;
export type GeographySubdivisionCapitalMarker = {
  readonly names: Readonly<Record<"en" | "de" | "es" | "fr", string>>;
  readonly coordinates: readonly [number, number];
};
export type GeographySubdivisionMapDefinition = {
  readonly viewBox: { readonly width: number; readonly height: number };
  readonly shapes: Readonly<
    Record<
      string,
      {
        readonly path: string;
        readonly center: readonly [number, number];
        readonly marker: boolean;
      }
    >
  >;
  readonly contextShapes: Readonly<Record<string, never>>;
};
export type GeographySubdivisionRegion = {
  readonly code: string;
  readonly names: Readonly<Record<"en" | "de" | "es" | "fr", string>>;
  readonly nativeNames: readonly string[];
  readonly capitals: Readonly<
    Record<"en" | "de" | "es" | "fr", readonly string[]>
  >;
  readonly capitalMarkers: readonly GeographySubdivisionCapitalMarker[];
  readonly statistics: null;
};
export const geographyMapBounds = ${JSON.stringify({
  ...baseMapBounds,
  ...Object.fromEntries(
    Object.entries(mapSpecs).map(([mapId, spec]) => [mapId, spec.bounds]),
  ),
})} as const;
export const geographySubdivisionMaps: Readonly<
  Record<GeographySubdivisionMapId, GeographySubdivisionMapDefinition>
> = ${JSON.stringify(maps)};
export const geographySubdivisionRegions: Readonly<
  Record<GeographySubdivisionMapId, readonly GeographySubdivisionRegion[]>
> = ${JSON.stringify(regions)};
export const geographyCountryCapitalMarkers: Readonly<
  Record<string, readonly GeographySubdivisionCapitalMarker[]>
> = ${JSON.stringify(countryCapitalMarkers)};
`;

await writeFile(targetPath, await format(output, { parser: "typescript" }));
console.log(`Generated geography subdivisions at ${targetPath}`);
