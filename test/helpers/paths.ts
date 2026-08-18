import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Repository root. */
export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Where the Jena CLI tools are cached between runs (git-ignored, cached in CI). */
export const CACHE_DIR = join(PROJECT_ROOT, "test", ".cache");

/**
 * Scratch space for a single test run (git-ignored).
 *
 * Kept inside the repository rather than in the system temp directory so the
 * Fuseki bind mount works regardless of which paths Docker is allowed to share,
 * and kept out of `CACHE_DIR` so run artifacts never end up in the CI cache.
 */
export const TMP_DIR = join(PROJECT_ROOT, "test", ".tmp");

/** The Fuseki image the generated index has to be compatible with. */
export const FUSEKI_IMAGE = "ghcr.io/zazuko/fuseki-geosparql:latest";
