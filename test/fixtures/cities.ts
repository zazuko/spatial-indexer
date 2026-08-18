/**
 * Dummy GeoSPARQL dataset used by the integration tests.
 *
 * Coordinates are WGS 84 longitude/latitude pairs (CRS84 axis order), so they can
 * be written straight into WKT literals without any axis swapping.
 */

export const GRAPH_URI = "https://example.org/graph/cities";
export const BASE_URI = "https://example.org/";
export const SRS_URI = "http://www.opengis.net/def/crs/OGC/1.3/CRS84";

/** A feature carrying a geometry, either as a point or as raw WKT. */
export interface Feature {
  id: string;
  label: string;
  lon?: number;
  lat?: number;
  wkt?: string;
}

/** Points, roughly the real locations of a few Swiss cities. */
export const cities: Feature[] = [
  { id: "zurich", label: "Zurich", lon: 8.5417, lat: 47.3769 },
  { id: "basel", label: "Basel", lon: 7.5886, lat: 47.5596 },
  { id: "bern", label: "Bern", lon: 7.4474, lat: 46.948 },
  { id: "geneva", label: "Geneva", lon: 6.1432, lat: 46.2044 },
  { id: "lugano", label: "Lugano", lon: 8.9511, lat: 46.0037 },
];

/** A polygon, so the index does not only ever see points. */
export const areas: Feature[] = [
  {
    id: "lake-zurich",
    label: "Lake Zurich",
    wkt: "POLYGON((8.54 47.36, 8.85 47.22, 8.87 47.19, 8.56 47.34, 8.54 47.36))",
  },
];

/** Every feature that carries a geometry, points and polygons alike. */
export const features: Feature[] = [...cities, ...areas];

const wktLiteral = (wkt: string): string => `"<${SRS_URI}> ${wkt}"^^geo:wktLiteral`;

/**
 * Serialize the fixture as Turtle.
 *
 * @returns the dataset, ready to be handed to a Jena CLI tool
 */
export function toTurtle(): string {
  const prefixes = [
    `@prefix geo:  <http://www.opengis.net/ont/geosparql#> .`,
    `@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .`,
    `@prefix ex:   <${BASE_URI}> .`,
    "",
  ];

  const blocks = features.map(({ id, label, lon, lat, wkt }) => {
    const geometry = wkt ?? `POINT(${lon} ${lat})`;
    const type = wkt ? "ex:Area" : "ex:City";

    return [
      `ex:${id} a ${type} ;`,
      `  rdfs:label ${JSON.stringify(label)} ;`,
      `  geo:hasGeometry ex:${id}-geometry .`,
      "",
      `ex:${id}-geometry a geo:Geometry ;`,
      `  geo:asWKT ${wktLiteral(geometry)} .`,
      "",
    ].join("\n");
  });

  return [...prefixes, ...blocks].join("\n");
}
