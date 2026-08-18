import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { runOrFail } from "./exec.ts";
import { CACHE_DIR, PROJECT_ROOT } from "./paths.ts";

const MIRROR = "https://archive.apache.org/dist/jena/binaries";

/**
 * The Jena version the tool itself is built against, read from `pom.xml`.
 *
 * Using the very same version for the CLI tools keeps the TDB2 database format
 * aligned with what the indexer expects.
 */
export async function jenaVersion(): Promise<string> {
  const pom = await readFile(join(PROJECT_ROOT, "pom.xml"), "utf8");
  const version = pom.match(/<jena\.version>([^<]+)<\/jena\.version>/)?.[1];
  if (!version) throw new Error("Could not read <jena.version> from pom.xml");
  return version;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Download and unpack the Apache Jena CLI tools, caching them between runs.
 *
 * The archive is checked against the SHA-512 digest published by Apache before
 * anything is extracted.
 *
 * @returns path to the Jena distribution directory
 */
export async function ensureJenaTools(): Promise<string> {
  const version = await jenaVersion();
  const home = join(CACHE_DIR, `apache-jena-${version}`);

  if (await exists(join(home, "bin", "tdb2.tdbloader"))) return home;

  const archiveName = `apache-jena-${version}.tar.gz`;
  const [archive, checksumFile] = await Promise.all([
    download(`${MIRROR}/${archiveName}`),
    download(`${MIRROR}/${archiveName}.sha512`).then((buffer) => buffer.toString("utf8")),
  ]);

  const expected = checksumFile.trim().split(/\s+/)[0]?.toLowerCase();
  const actual = createHash("sha512").update(archive).digest("hex");
  if (actual !== expected) {
    throw new Error(`Checksum mismatch for ${archiveName}: expected ${expected}, got ${actual}`);
  }

  await mkdir(CACHE_DIR, { recursive: true });
  const archivePath = join(CACHE_DIR, archiveName);
  await writeFile(archivePath, archive);
  await runOrFail("tar", ["xzf", archivePath, "-C", CACHE_DIR]);
  await rm(archivePath, { force: true });

  return home;
}

export interface LoadDatasetOptions {
  jenaHome: string;
  datasetPath: string;
  turtlePath: string;
  graph: string;
}

/**
 * Load a Turtle file into a fresh TDB2 dataset using `tdb2.tdbloader`.
 *
 * The data goes into a named graph on purpose: the Fuseki dataset is configured
 * with `tdb2:unionDefaultGraph true`, which makes the default graph the union of
 * the *named* graphs. Triples loaded into the real default graph would be
 * invisible to queries.
 */
export async function loadDataset({
  jenaHome,
  datasetPath,
  turtlePath,
  graph,
}: LoadDatasetOptions): Promise<void> {
  await mkdir(datasetPath, { recursive: true });
  await runOrFail(
    join(jenaHome, "bin", "tdb2.tdbloader"),
    [`--loc=${datasetPath}`, `--graph=${graph}`, turtlePath],
    { env: { JENA_HOME: jenaHome } },
  );
}
