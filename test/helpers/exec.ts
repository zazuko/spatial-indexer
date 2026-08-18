import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

/** What a finished child process left behind. */
export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface ExecOptions {
  cwd?: string;
  env?: Record<string, string>;
}

/**
 * Thrown by a `waitFor` probe when the awaited outcome has become impossible, so
 * that polling stops immediately instead of running until the deadline.
 */
export class UnreachableError extends Error {}

/** Run a command to completion and capture its output. */
export function run(
  command: string,
  args: string[],
  options: ExecOptions = {},
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

/** Same as `run`, but turns a non-zero exit code into a rejection. */
export async function runOrFail(
  command: string,
  args: string[],
  options: ExecOptions = {},
): Promise<ExecResult> {
  const result = await run(command, args, options);
  if (result.code !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} exited with ${result.code}\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result;
}

export interface WaitOptions {
  timeout?: number;
  interval?: number;
  description?: string;
}

/** Poll until `probe` resolves to a truthy value. */
export async function waitFor<T>(
  probe: () => Promise<T>,
  { timeout = 60_000, interval = 500, description = "condition" }: WaitOptions = {},
): Promise<T> {
  const deadline = Date.now() + timeout;

  // Polling is sequential by definition: each attempt has to observe the state
  // left by the previous one, so the awaits below cannot be batched.
  /* oxlint-disable no-await-in-loop */
  for (;;) {
    try {
      const result = await probe();
      if (result) return result;
    } catch (error) {
      if (error instanceof UnreachableError) throw error;
      // Otherwise: not ready yet, keep polling until the deadline.
    }

    if (Date.now() >= deadline) {
      throw new Error(`Timed out after ${timeout}ms waiting for ${description}`);
    }
    await delay(interval);
  }
  /* oxlint-enable no-await-in-loop */
}

/** Check whether a command is available on this machine. */
export async function isAvailable(command: string): Promise<boolean> {
  const { code } = await run("sh", ["-c", `command -v ${command}`]);
  return code === 0;
}
