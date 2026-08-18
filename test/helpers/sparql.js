/** Prefixes shared by every test query. */
export const PREFIXES = `
PREFIX geo:     <http://www.opengis.net/ont/geosparql#>
PREFIX geof:    <http://www.opengis.net/def/function/geosparql/>
PREFIX spatial: <http://jena.apache.org/spatial#>
PREFIX uom:     <http://www.opengis.net/def/uom/OGC/1.0/>
PREFIX rdfs:    <http://www.w3.org/2000/01/rdf-schema#>
PREFIX ex:      <https://example.org/>
`

/**
 * Run a SELECT query against a Fuseki endpoint.
 *
 * @param {string} endpoint
 * @param {string} query SPARQL, without prefixes (`PREFIXES` is prepended)
 * @returns {Promise<Record<string, { value: string }>[]>} the result bindings
 */
export async function select(endpoint, query) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/sparql-query',
      Accept: 'application/sparql-results+json',
    },
    body: `${PREFIXES}\n${query}`,
  })

  const body = await response.text()
  if (!response.ok) {
    throw new Error(`Query failed with ${response.status} ${response.statusText}:\n${body}\n\n${query}`)
  }

  return JSON.parse(body).results.bindings
}

/**
 * Run a SELECT query and collect one variable, sorted for stable comparison.
 *
 * @param {string} endpoint
 * @param {string} query
 * @param {string} variable
 * @returns {Promise<string[]>}
 */
export async function selectColumn(endpoint, query, variable) {
  const bindings = await select(endpoint, query)
  return bindings.map((binding) => binding[variable]?.value).sort()
}
