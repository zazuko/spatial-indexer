import { randomUUID } from "node:crypto";
import { createServer } from "node:net";

import { run, runOrFail, UnreachableError, waitFor } from "./exec.ts";
import { FUSEKI_IMAGE } from "./paths.ts";

/** A running Fuseki container. */
export interface FusekiInstance {
  name: string;
  port: number;
  baseUrl: string;
  endpoint: string;
}

/** Ask the OS for a port that is currently free. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("Could not determine a free port"));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

export interface StartFusekiOptions {
  databasesPath: string;
  readyTimeout?: number;
}

/**
 * Start a Fuseki container serving the given databases directory.
 *
 * The directory is mounted at `/fuseki/databases`, which is where the image's
 * bundled `config.ttl` expects the `ds` dataset and its `spatial.index`.
 */
export async function startFuseki({
  databasesPath,
  readyTimeout = 120_000,
}: StartFusekiOptions): Promise<FusekiInstance> {
  const name = `spatial-indexer-test-${randomUUID().slice(0, 8)}`;
  const port = await freePort();

  await runOrFail("docker", [
    "run",
    "--detach",
    "--name",
    name,
    "--publish",
    `${port}:3030`,
    // Without this the image keeps retrying an OTEL collector that is not there,
    // which would drown the log assertions in unrelated stack traces.
    "--env",
    "DISABLE_OTEL=true",
    "--volume",
    `${databasesPath}:/fuseki/databases`,
    FUSEKI_IMAGE,
  ]);

  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await waitFor(
      async () => {
        // A container that died on a bad spatial index will never answer; surface
        // its logs straight away instead of waiting for the full timeout.
        const { stdout: running } = await run("docker", [
          "inspect",
          "--format",
          "{{.State.Running}}",
          name,
        ]);
        if (running.trim() !== "true") {
          throw new UnreachableError(`Container ${name} stopped`);
        }

        const response = await fetch(`${baseUrl}/$/ping`);
        return response.ok;
      },
      { timeout: readyTimeout, description: `Fuseki to answer on ${baseUrl}/$/ping` },
    );
  } catch (cause) {
    const logs = await fusekiLogs(name);
    await stopFuseki(name);
    throw new Error(`Fuseki did not become ready.\n--- container logs ---\n${logs}`, { cause });
  }

  return { name, port, baseUrl, endpoint: `${baseUrl}/ds/sparql` };
}

/** Everything the container wrote to stdout and stderr. */
export async function fusekiLogs(name: string): Promise<string> {
  const { stdout, stderr } = await run("docker", ["logs", name]);
  return `${stdout}${stderr}`;
}

export async function stopFuseki(name: string): Promise<void> {
  if (!name) return;
  await run("docker", ["rm", "--force", name]);
}

/**
 * Pull the Fuseki image up front so a slow download does not eat into the
 * per-test readiness timeout.
 */
export async function pullFusekiImage(): Promise<void> {
  await runOrFail("docker", ["pull", "--quiet", FUSEKI_IMAGE]);
}
