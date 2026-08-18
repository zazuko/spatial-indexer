import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

import { run, runOrFail } from './exec.js'
import { PROJECT_ROOT } from './paths.js'

const TARGET_DIR = join(PROJECT_ROOT, 'target')

async function newestMtime(directory) {
  const entries = await readdir(directory, { withFileTypes: true, recursive: true })
  const times = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => (await stat(join(entry.parentPath, entry.name))).mtimeMs),
  )
  return Math.max(0, ...times)
}

async function findJar() {
  const entries = await readdir(TARGET_DIR).catch(() => [])
  const jar = entries.find((name) => name.endsWith('-jar-with-dependencies.jar'))
  return jar ? join(TARGET_DIR, jar) : null
}

/**
 * Build the shaded jar if it is missing or older than the sources it is built from.
 *
 * @returns {Promise<string>} path to the jar
 */
export async function ensureJar() {
  const existing = await findJar()

  if (existing) {
    const [jarTime, sourceTime, pomTime] = await Promise.all([
      stat(existing).then((s) => s.mtimeMs),
      newestMtime(join(PROJECT_ROOT, 'src', 'main')),
      stat(join(PROJECT_ROOT, 'pom.xml')).then((s) => s.mtimeMs),
    ])
    if (jarTime >= sourceTime && jarTime >= pomTime) return existing
  }

  await runOrFail('mvn', ['--quiet', '--batch-mode', 'clean', 'package', '-DskipTests'], {
    cwd: PROJECT_ROOT,
  })

  const jar = await findJar()
  if (!jar) throw new Error(`No *-jar-with-dependencies.jar produced in ${TARGET_DIR}`)
  return jar
}

/**
 * Run the spatial indexer against a TDB2 dataset.
 *
 * @param {{ jar: string, datasetPath: string, indexPath: string, srsUri?: string }} options
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
export function runIndexer({ jar, datasetPath, indexPath, srsUri }) {
  const args = ['-jar', jar, '--dataset', datasetPath, '--index', indexPath]
  if (srsUri) args.push('--srs', srsUri)
  return run('java', args)
}

/**
 * Read the header of a spatial index file.
 *
 * Jena writes a small JSON preamble in front of the binary payload, holding the
 * index format version and the SRS the index was built for.
 *
 * @param {Buffer} contents
 * @returns {{ type: string, version: string, srs: string }}
 */
export function parseIndexHeader(contents) {
  const start = contents.indexOf('{')
  const end = contents.indexOf('}', start)
  if (start === -1 || end === -1) throw new Error('No JSON header found in the spatial index file')
  return JSON.parse(contents.subarray(start, end + 1).toString('utf8'))
}
