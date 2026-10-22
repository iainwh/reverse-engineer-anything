import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const processAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code !== "ESRCH"
    );
  }
};

const isENOENT = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "ENOENT";

const readProcCmdlineWhen = async (
  pid: number,
  ready: (commandLine: string) => boolean,
  deadlineMs: number,
): Promise<string> => {
  const path = `/proc/${String(pid)}/cmdline`;
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    try {
      const commandLine = await readFile(path, "utf8");
      if (ready(commandLine)) return commandLine;
    } catch (error: unknown) {
      if (isENOENT(error))
        throw new Error(
          `process ${String(pid)} exited before cmdline was readable`,
        );
    }
    await delay(25);
  }
  if (!processAlive(pid))
    throw new Error(
      `process ${String(pid)} exited before cmdline was readable`,
    );
  throw new Error(`timed out waiting for ${path} to populate`);
};

/** Wait until /proc/<pid>/cmdline exposes a non-empty argv0. */
export const readProcCmdlineFirstArg = async (
  pid: number,
  deadlineMs = 20_000,
): Promise<string> => {
  const commandLine = await readProcCmdlineWhen(
    pid,
    (value) => (value.split("\0")[0] ?? "").length > 0,
    deadlineMs,
  );
  return commandLine.split("\0")[0] ?? "";
};

/** Wait until /proc/<pid>/cmdline is populated enough for argv inspection. */
export const readProcCmdline = async (
  pid: number,
  deadlineMs = 20_000,
): Promise<string> =>
  readProcCmdlineWhen(
    pid,
    (value) => (value.split("\0")[0] ?? "").length > 0,
    deadlineMs,
  );

/** Wait until ps reports the child reparented away from the spawning parent. */
export const readReparentCoordinates = async (
  pid: number,
  spawningParentPid: number,
  deadlineMs = 20_000,
): Promise<{ currentParent: number; group: number }> => {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    try {
      const { stdout } = await execFileAsync("ps", [
        "-p",
        String(pid),
        "-o",
        "ppid=,pgid=",
      ]);
      const [currentParent, group] = stdout.trim().split(/\s+/u).map(Number);
      if (
        currentParent !== undefined &&
        group !== undefined &&
        Number.isFinite(currentParent) &&
        Number.isFinite(group) &&
        currentParent !== spawningParentPid
      )
        return { currentParent, group };
    } catch {
      if (!processAlive(pid))
        throw new Error(
          `process ${String(pid)} exited before reparent coordinates were readable`,
        );
      // ps can fail transiently while the kernel updates parent links.
    }
    await delay(25);
  }
  if (!processAlive(pid))
    throw new Error(
      `process ${String(pid)} exited before reparent coordinates were readable`,
    );
  throw new Error(
    `timed out waiting for reparented coordinates of pid ${String(pid)}`,
  );
};

/** Wait until ps can report the process state (non-zombie for running fixtures). */
export const readProcessState = async (
  pid: number,
  deadlineMs = 20_000,
): Promise<string> => {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    try {
      const { stdout } = await execFileAsync("ps", [
        "-p",
        String(pid),
        "-o",
        "stat=",
      ]);
      const state = stdout.trim();
      if (state.length > 0) return state;
    } catch {
      // Process may not be visible to ps immediately after reparent.
    }
    await delay(25);
  }
  throw new Error(`timed out waiting for ps state of pid ${String(pid)}`);
};
