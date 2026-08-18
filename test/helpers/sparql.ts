/** One row of a SPARQL SELECT result. */
export type Binding = Record<string, { value: string } | undefined>;

/** Prefixes shared by every test query. */
export const PREFIXES = `
PREFIX geo:     <http://www.opengis.net/ont/geosparql#>
PREFIX geof:    <http://www.opengis.net/def/function/geosparql/>
PREFIX spatial: <http://jena.apache.org/spatial#>
PREFIX uom:     <http://www.opengis.net/def/uom/OGC/1.0/>
PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#>
PREFIX ex:      <https://example.org/>
`;

/**
 * Run a SELECT query against a Fuseki endpoint.
 *
 * @param query SPARQL, without prefixes (`PREFIXES` is prepended)
 */
export async function select(endpoint: string, query: string): Promise<Binding[]> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/sparql-query",
      Accept: "application/sparql-results+json",
    },
    body: `${PREFIXES}\n${query}`,
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Query failed with ${response.status} ${response.statusText}:\n${body}\n\n${query}`,
    );
  }

  return (JSON.parse(body) as { results: { bindings: Binding[] } }).results.bindings;
}

/** Run a SELECT query and collect one variable, sorted for stable comparison. */
export async function selectColumn(
  endpoint: string,
  query: string,
  variable: string,
): Promise<string[]> {
  const bindings = await select(endpoint, query);
  return bindings
    .map((binding) => binding[variable]?.value)
    .filter((value): value is string => value !== undefined)
    .toSorted();
}
