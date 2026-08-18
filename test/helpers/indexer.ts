import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { run, runOrFail, type ExecResult } from "./exec.ts";
import { PROJECT_ROOT } from "./paths.ts";

const TARGET_DIR = join(PROJECT_ROOT, "target");

async function newestMtime(directory: string): Promise<number> {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true });
  const times = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => (await stat(join(entry.parentPath, entry.name))).mtimeMs),
  );
  return Math.max(0, ...times);
}

async function findJar(): Promise<string | null> {
  const entries = await readdir(TARGET_DIR).catch(() => [] as string[]);
  const jar = entries.find((name) => name.endsWith("-jar-with-dependencies.jar"));
  return jar ? join(TARGET_DIR, jar) : null;
}

/**
 * Build the shaded jar if it is missing or older than the sources it is built from.
 *
 * @returns path to the jar
 */
export async function ensureJar(): Promise<string> {
  const existing = await findJar();

  if (existing) {
    const [jarTime, sourceTime, pomTime] = await Promise.all([
      stat(existing).then((s) => s.mtimeMs),
      newestMtime(join(PROJECT_ROOT, "src", "main")),
      stat(join(PROJECT_ROOT, "pom.xml")).then((s) => s.mtimeMs),
    ]);
    if (jarTime >= sourceTime && jarTime >= pomTime) return existing;
  }

  await runOrFail("mvn", ["--quiet", "--batch-mode", "clean", "package", "-DskipTests"], {
    cwd: PROJECT_ROOT,
  });

  const jar = await findJar();
  if (!jar) throw new Error(`No *-jar-with-dependencies.jar produced in ${TARGET_DIR}`);
  return jar;
}

export interface RunIndexerOptions {
  jar: string;
  datasetPath: string;
  indexPath: string;
  srsUri?: string;
}

/** Run the spatial indexer against a TDB2 dataset. */
export function runIndexer({
  jar,
  datasetPath,
  indexPath,
  srsUri,
}: RunIndexerOptions): Promise<ExecResult> {
  const args = ["-jar", jar, "--dataset", datasetPath, "--index", indexPath];
  if (srsUri) args.push("--srs", srsUri);
  return run("java", args);
}

/** The JSON preamble Jena writes in front of the binary spatial index payload. */
export interface SpatialIndexHeader {
  type: string;
  version: string;
  srs: string;
}

/**
 * Read the header of a spatial index file, which holds the index format version
 * and the SRS the index was built for.
 */
export function parseIndexHeader(contents: Buffer): SpatialIndexHeader {
  const start = contents.indexOf("{");
  const end = contents.indexOf("}", start);
  if (start === -1 || end === -1) throw new Error("No JSON header found in the spatial index file");
  return JSON.parse(contents.subarray(start, end + 1).toString("utf8")) as SpatialIndexHeader;
}
