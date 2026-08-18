import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

/**
 * Run a command to completion and capture its output.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: Record<string, string> }} [options]
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
export function run(command, args, { cwd, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }))
  })
}

/**
 * Same as `run`, but turns a non-zero exit code into a rejection.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: Record<string, string> }} [options]
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
export async function runOrFail(command, args, options) {
  const result = await run(command, args, options)
  if (result.code !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} exited with ${result.code}\n${result.stdout}\n${result.stderr}`,
    )
  }
  return result
}

/**
 * Poll until `probe` resolves to a truthy value.
 *
 * @param {() => Promise<unknown>} probe
 * @param {{ timeout?: number, interval?: number, description?: string }} [options]
 * @returns {Promise<unknown>} whatever `probe` returned
 */
export async function waitFor(probe, { timeout = 60_000, interval = 500, description = 'condition' } = {}) {
  const deadline = Date.now() + timeout

  for (;;) {
    try {
      const result = await probe()
      if (result) return result
    } catch (error) {
      // `fatal` means the thing we are waiting for can no longer happen, so there
      // is no point in polling until the deadline.
      if (error?.fatal) throw error
    }

    if (Date.now() >= deadline) {
      throw new Error(`Timed out after ${timeout}ms waiting for ${description}`)
    }
    await delay(interval)
  }
}

/**
 * Check whether a command is available on this machine.
 *
 * @param {string} command
 * @returns {Promise<boolean>}
 */
export async function isAvailable(command) {
  const { code } = await run('sh', ['-c', `command -v ${command}`])
  return code === 0
}
