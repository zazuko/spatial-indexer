import { createServer } from 'node:net'
import { randomUUID } from 'node:crypto'

import { run, runOrFail, waitFor } from './exec.js'
import { FUSEKI_IMAGE } from './paths.js'

/**
 * Ask the OS for a port that is currently free.
 *
 * @returns {Promise<number>}
 */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

/**
 * Start a Fuseki container serving the given databases directory.
 *
 * The directory is mounted at `/fuseki/databases`, which is where the image's
 * bundled `config.ttl` expects the `ds` dataset and its `spatial.index`.
 *
 * @param {{ databasesPath: string, readyTimeout?: number }} options
 * @returns {Promise<{ name: string, port: number, baseUrl: string, endpoint: string }>}
 */
export async function startFuseki({ databasesPath, readyTimeout = 120_000 }) {
  const name = `spatial-indexer-test-${randomUUID().slice(0, 8)}`
  const port = await freePort()

  await runOrFail('docker', [
    'run',
    '--detach',
    '--name', name,
    '--publish', `${port}:3030`,
    // Without this the image keeps retrying an OTEL collector that is not there,
    // which would drown the log assertions in unrelated stack traces.
    '--env', 'DISABLE_OTEL=true',
    '--volume', `${databasesPath}:/fuseki/databases`,
    FUSEKI_IMAGE,
  ])

  const baseUrl = `http://127.0.0.1:${port}`

  try {
    await waitFor(
      async () => {
        // A container that died on a bad spatial index will never answer; surface
        // its logs straight away instead of waiting for the full timeout.
        const { stdout: running } = await run('docker', [
          'inspect', '--format', '{{.State.Running}}', name,
        ])
        if (running.trim() !== 'true') {
          throw Object.assign(new Error(`Container ${name} stopped`), { fatal: true })
        }

        const response = await fetch(`${baseUrl}/$/ping`)
        return response.ok
      },
      { timeout: readyTimeout, description: `Fuseki to answer on ${baseUrl}/$/ping` },
    )
  } catch (cause) {
    const logs = await fusekiLogs(name)
    await stopFuseki(name)
    throw new Error(`Fuseki did not become ready.\n--- container logs ---\n${logs}`, { cause })
  }

  return { name, port, baseUrl, endpoint: `${baseUrl}/ds/sparql` }
}

/**
 * @param {string} name container name
 * @returns {Promise<string>} everything the container wrote to stdout and stderr
 */
export async function fusekiLogs(name) {
  const { stdout, stderr } = await run('docker', ['logs', name])
  return `${stdout}${stderr}`
}

/**
 * @param {string} name container name
 * @returns {Promise<void>}
 */
export async function stopFuseki(name) {
  if (!name) return
  await run('docker', ['rm', '--force', name])
}

/**
 * Pull the Fuseki image up front so a slow download does not eat into the
 * per-test readiness timeout.
 *
 * @returns {Promise<void>}
 */
export async function pullFusekiImage() {
  await runOrFail('docker', ['pull', '--quiet', FUSEKI_IMAGE])
}
