import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { features, GRAPH_URI, SRS_URI, toTurtle } from "./fixtures/cities.ts";
import { isAvailable, runOrFail, type ExecResult } from "./helpers/exec.ts";
import {
  fusekiLogs,
  pullFusekiImage,
  startFuseki,
  stopFuseki,
  type FusekiInstance,
} from "./helpers/fuseki.ts";
import { ensureJar, parseIndexHeader, runIndexer } from "./helpers/indexer.ts";
import { ensureJenaTools, loadDataset } from "./helpers/jena.ts";
import { TMP_DIR } from "./helpers/paths.ts";
import { select, selectColumn } from "./helpers/sparql.ts";

// Building the jar, fetching the Jena tools and pulling the Fuseki image can all
// be slow the first time around.
const SETUP_TIMEOUT = 15 * 60 * 1000;

interface TestContext {
  workDir: string;
  databasesPath: string;
  datasetPath: string;
  indexPath: string;
  autoSrsIndexPath: string;
  indexerResult: ExecResult | null;
  autoSrsResult: ExecResult | null;
  fuseki: FusekiInstance | null;
  fusekiError: unknown;
  startupLogs: string;
}

/** Populated by the `before` hook and shared by every assertion below. */
const context: TestContext = {
  workDir: "",
  databasesPath: "",
  datasetPath: "",
  indexPath: "",
  autoSrsIndexPath: "",
  indexerResult: null,
  autoSrsResult: null,
  fuseki: null,
  fusekiError: null,
  startupLogs: "",
};

/**
 * Fail the current test with whatever went wrong while starting Fuseki.
 *
 * Startup happens once in `before`, but a failure there is reported per test, so
 * that a broken container does not hide the results of the index assertions.
 */
function requireFuseki(): FusekiInstance {
  if (context.fusekiError) throw context.fusekiError;
  if (!context.fuseki) throw new Error("Fuseki was never started");
  return context.fuseki;
}

/** The result of a step that the `before` hook is expected to have run. */
function requireResult(result: ExecResult | null): ExecResult {
  if (!result) throw new Error("The indexer was never run");
  return result;
}

async function assertPrerequisites(): Promise<void> {
  const required = ["docker", "java", "mvn"];
  const availability = await Promise.all(
    required.map(async (command) => ({ command, available: await isAvailable(command) })),
  );
  const missing = availability.filter(({ available }) => !available).map(({ command }) => command);
  if (missing.length > 0) {
    throw new Error(
      `These integration tests need ${required.join(", ")} on PATH; missing: ${missing.join(", ")}`,
    );
  }
  await runOrFail("docker", ["info", "--format", "{{.ServerVersion}}"]);
}

before(async () => {
  await assertPrerequisites();

  await mkdir(TMP_DIR, { recursive: true });
  context.workDir = await mkdtemp(join(TMP_DIR, "run-"));
  context.databasesPath = join(context.workDir, "databases");
  context.datasetPath = join(context.databasesPath, "ds");
  context.indexPath = join(context.datasetPath, "spatial.index");
  context.autoSrsIndexPath = join(context.workDir, "auto-srs.index");

  const [jar, jenaHome] = await Promise.all([ensureJar(), ensureJenaTools(), pullFusekiImage()]);

  // 1. Dummy RDF data with geometries.
  const turtlePath = join(context.workDir, "cities.ttl");
  await writeFile(turtlePath, toTurtle());

  // 2. A TDB2 dataset, built with the Apache Jena CLI tools.
  await loadDataset({
    jenaHome,
    datasetPath: context.datasetPath,
    turtlePath,
    graph: GRAPH_URI,
  });

  // 3. The spatial index, built by the tool under test.
  context.indexerResult = await runIndexer({
    jar,
    datasetPath: context.datasetPath,
    indexPath: context.indexPath,
    srsUri: SRS_URI,
  });

  // ... and once more without --srs, to cover the SRS auto-detection path.
  context.autoSrsResult = await runIndexer({
    jar,
    datasetPath: context.datasetPath,
    indexPath: context.autoSrsIndexPath,
  });

  // 4. Fuseki, reading the dataset and the index we just produced.
  //    The container runs as uid 1000, which is not the user running the tests.
  await runOrFail("chmod", ["-R", "a+rwX", context.workDir]);
  try {
    context.fuseki = await startFuseki({ databasesPath: context.databasesPath });
    context.startupLogs = await fusekiLogs(context.fuseki.name);
  } catch (error) {
    // Reported by the Fuseki tests below rather than here, so that a failure to
    // start does not cancel the spatial index assertions.
    context.fusekiError = error;
  }
});

after(async () => {
  if (context.fuseki) await stopFuseki(context.fuseki.name);
  if (context.workDir) await rm(context.workDir, { recursive: true, force: true });
});

describe("spatial index generation", { timeout: SETUP_TIMEOUT }, () => {
  it("exits successfully", () => {
    const { code, stdout, stderr } = requireResult(context.indexerResult);
    assert.equal(code, 0, `indexer failed:\n${stdout}\n${stderr}`);
  });

  it("reports no error", () => {
    const { stdout, stderr } = requireResult(context.indexerResult);
    const output = `${stdout}\n${stderr}`;
    assert.doesNotMatch(output, /Exception|\bERROR\b/, `indexer reported an error:\n${output}`);
    assert.match(output, /Saving Spatial Index - Success/);
  });

  it("writes a spatial index file that is not empty", async () => {
    const contents = await readFile(context.indexPath);
    assert.ok(contents.length > 0, "the spatial index file is empty");
  });

  it("writes an index for the requested SRS", async () => {
    const header = parseIndexHeader(await readFile(context.indexPath));
    assert.equal(header.type, "jena-spatial-index");
    assert.equal(header.srs, SRS_URI);
  });

  it("detects the SRS on its own when --srs is omitted", async () => {
    const { code, stdout, stderr } = requireResult(context.autoSrsResult);
    assert.equal(code, 0, `indexer failed:\n${stdout}\n${stderr}`);

    const contents = await readFile(context.autoSrsIndexPath);
    assert.ok(contents.length > 0, "the auto-detected spatial index file is empty");

    // Every geometry in the fixture is CRS84, so that is what should be picked up.
    assert.equal(parseIndexHeader(contents).srs, SRS_URI);
  });
});

describe("Fuseki serving the generated index", { timeout: SETUP_TIMEOUT }, () => {
  it("starts up and answers its health check", async () => {
    const response = await fetch(`${requireFuseki().baseUrl}/$/ping`);
    assert.ok(response.ok, `ping returned ${response.status}`);
  });

  it("loads the pre-built index instead of rebuilding one", () => {
    requireFuseki();
    assert.match(
      context.startupLogs,
      /Loading Spatial Index - Completed: \/fuseki\/databases\/ds\/spatial\.index/,
      `Fuseki did not load the pre-built index:\n${context.startupLogs}`,
    );
  });

  it("logs no error while starting up", () => {
    requireFuseki();
    const offending = context.startupLogs
      .split("\n")
      .filter((line) => /\bERROR\b|Exception/.test(line));

    assert.deepEqual(offending, [], `Fuseki logged errors:\n${offending.join("\n")}`);
  });
});

describe("GeoSPARQL queries", { timeout: SETUP_TIMEOUT }, () => {
  it("answers a plain SPARQL query over the loaded data", async () => {
    const [binding] = await select(
      requireFuseki().endpoint,
      "SELECT (COUNT(DISTINCT ?feature) AS ?count) WHERE { ?feature geo:hasGeometry ?geometry }",
    );
    assert.equal(binding?.count?.value, String(features.length));
  });

  it("finds nearby features through the spatial index", async () => {
    // spatial:nearby is backed by the spatial index we generated, so an empty or
    // unusable index shows up here as a missing result.
    const { endpoint } = requireFuseki();
    const near = (km: number): Promise<string[]> =>
      selectColumn(
        endpoint,
        `SELECT ?label WHERE {
           ?feature spatial:nearby(47.3769 8.5417 ${km} uom:kilometre) .
           ?feature rdfs:label ?label .
         }`,
        "label",
      );

    assert.deepEqual(await near(50), ["Lake Zurich", "Zurich"]);
    // Basel is ~74 km away and Bern ~95 km, while Lugano stays out at ~156 km.
    assert.deepEqual(await near(100), ["Basel", "Bern", "Lake Zurich", "Zurich"]);
    assert.deepEqual(await near(300), [
      "Basel",
      "Bern",
      "Geneva",
      "Lake Zurich",
      "Lugano",
      "Zurich",
    ]);
  });

  it("evaluates a GeoSPARQL topology function", async () => {
    const labels = await selectColumn(
      requireFuseki().endpoint,
      `SELECT ?label WHERE {
         ?feature geo:hasGeometry/geo:asWKT ?wkt ;
                  rdfs:label ?label .
         FILTER(geof:sfWithin(?wkt, "POLYGON((7.0 47.0, 9.0 47.0, 9.0 48.0, 7.0 48.0, 7.0 47.0))"^^geo:wktLiteral))
       }`,
      "label",
    );

    // Bern sits just south of the box at 46.948, Geneva and Lugano are far outside.
    assert.deepEqual(labels, ["Basel", "Lake Zurich", "Zurich"]);
  });
});
