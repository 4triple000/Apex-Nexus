/**
 * Runs user-submitted code outside the API server process.
 *
 * JavaScript runs in a short-lived Node child process with:
 *   - Node's permission model (no filesystem, child processes, workers or addons)
 *   - a small heap limit and a hard kill on timeout
 *   - an empty environment, so no server secrets are reachable
 *   - no require()/import() inside the user code
 *
 * Python cannot be restricted the same way (it can read any file the server user
 * can, including other processes' environments), so it only runs when
 * ALLOW_SERVER_PYTHON=true — set that only when the server itself runs in an
 * isolated container that holds no secrets. It also gets rlimits and an empty env.
 *
 * Note: neither runtime blocks outbound network access. For untrusted users,
 * run this service in a container with egress restricted.
 */
import { spawn } from "node:child_process";

export type SandboxLineType = "log" | "info" | "debug" | "warn" | "error" | "result";

export interface SandboxLine {
  type: SandboxLineType;
  text: string;
}

export interface SandboxResult {
  ok:         boolean;
  result?:    string;
  error?:     string;
  timedOut:   boolean;
  exitCode:   number;
  durationMs: number;
  lines:      SandboxLine[];
}

const MAX_OUTPUT_CHARS = 50_000;
const MAX_CODE_CHARS   = 200_000;
const JS_HEAP_MB       = 64;

const permissionFlag =
  process.allowedNodeEnvironmentFlags.has("--permission") ? "--permission"
  : process.allowedNodeEnvironmentFlags.has("--experimental-permission") ? "--experimental-permission"
  : null;

// Bootstrap executed by the child. Reads user code from stdin, locks down the
// process, runs the code and reports each console call as one JSON line.
const JS_BOOTSTRAP = `
"use strict";
const vm = require("node:vm");
const send = process.stdout.write.bind(process.stdout);
const fmt = (a) => {
  if (a === null || a === undefined) return String(a);
  if (typeof a === "object") { try { return JSON.stringify(a, null, 2); } catch { return String(a); } }
  return String(a);
};
const emit = (type, args) => send(JSON.stringify({ type, text: args.map(fmt).join(" ") }) + "\\n");
const finish = (code) => send("", () => process.exit(code));
const errText = (err) => {
  const msg = err && err.message ? err.message : String(err);
  return /dynamic import callback/i.test(msg) ? "import() and require() are not available in the sandbox" : msg;
};

let src = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => { src += d; });
process.stdin.on("end", () => {
  for (const k of ["binding", "_linkedBinding", "dlopen", "getBuiltinModule", "env", "mainModule"]) {
    try { delete process[k]; } catch {}
  }
  for (const k of ["require", "module", "exports", "fetch", "WebSocket", "EventSource"]) {
    try { globalThis[k] = undefined; } catch {}
  }
  globalThis.console = {
    log:   (...a) => emit("log", a),
    info:  (...a) => emit("info", a),
    debug: (...a) => emit("debug", a),
    warn:  (...a) => emit("warn", a),
    error: (...a) => emit("error", a),
    table: (d) => emit("log", [d]),
  };
  let result;
  try {
    // No importModuleDynamically callback, so import() inside user code throws
    result = vm.runInThisContext("(async () => {\\n" + src + "\\n})()", { filename: "apex-sandbox.js" });
  } catch (err) {
    emit("error", [errText(err)]);
    return finish(1);
  }
  Promise.resolve(result).then(
    (value) => { if (value !== undefined) emit("result", [value]); finish(0); },
    (err) => { emit("error", [errText(err)]); finish(1); },
  );
});
`;

export async function runJavaScriptIsolated(
  code: string,
  opts: { timeoutMs: number; onLine?: (line: SandboxLine) => void },
): Promise<SandboxResult> {
  const start = Date.now();
  if (code.length > MAX_CODE_CHARS) {
    return { ok: false, error: "Code is too large to run", timedOut: false, exitCode: 1, durationMs: 0, lines: [] };
  }

  const args = [
    ...(permissionFlag ? [permissionFlag] : []),
    `--max-old-space-size=${JS_HEAP_MB}`,
    "-e", JS_BOOTSTRAP,
  ];
  const child = spawn(process.execPath, args, { env: {}, cwd: "/tmp", stdio: ["pipe", "pipe", "pipe"] });

  const lines: SandboxLine[] = [];
  let outputChars = 0;
  let pending = "";
  let stderr = "";
  let timedOut = false;

  const push = (line: SandboxLine) => {
    if (outputChars >= MAX_OUTPUT_CHARS) return;
    const text = line.text.slice(0, MAX_OUTPUT_CHARS - outputChars);
    outputChars += text.length;
    const l = { ...line, text };
    lines.push(l);
    opts.onLine?.(l);
  };

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    pending += chunk;
    let nl: number;
    while ((nl = pending.indexOf("\n")) >= 0) {
      const raw = pending.slice(0, nl);
      pending = pending.slice(nl + 1);
      try {
        push(JSON.parse(raw) as SandboxLine);
      } catch {
        push({ type: "log", text: raw });
      }
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    if (stderr.length < MAX_OUTPUT_CHARS) stderr += chunk;
  });

  const killer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, opts.timeoutMs);
  child.stdin.on("error", () => { /* child exited before reading all input */ });
  child.stdin.end(code);

  const exitCode = await new Promise<number>((resolve) => {
    child.on("close", (c) => resolve(c ?? 1));
    child.on("error", () => resolve(1));
  });
  clearTimeout(killer);

  const durationMs = Date.now() - start;
  if (timedOut) {
    return { ok: false, error: `Execution timed out after ${opts.timeoutMs}ms`, timedOut, exitCode: 124, durationMs, lines };
  }
  const errorLine = [...lines].reverse().find((l) => l.type === "error");
  const resultLine = lines.find((l) => l.type === "result");
  if (exitCode !== 0) {
    const error = errorLine?.text
      ?? (/heap out of memory/i.test(stderr) ? `Memory limit (${JS_HEAP_MB}MB) exceeded` : stderr.trim().split("\n").pop())
      ?? `Process exited with code ${exitCode}`;
    return { ok: false, error, timedOut, exitCode, durationMs, lines };
  }
  return { ok: true, result: resultLine?.text, timedOut, exitCode, durationMs, lines };
}

// ── Python ────────────────────────────────────────────────────────────────────

export function pythonExecutionEnabled(): boolean {
  return process.env.ALLOW_SERVER_PYTHON === "true";
}

export const PYTHON_DISABLED_MESSAGE =
  "Python execution is disabled on this server. Set ALLOW_SERVER_PYTHON=true only if the server runs in an isolated container.";

// Applies resource limits, then runs the user code read from stdin
const PY_BOOTSTRAP = [
  "import resource, sys",
  "mb = 1024 * 1024",
  "resource.setrlimit(resource.RLIMIT_AS, (256 * mb, 256 * mb))",
  "resource.setrlimit(resource.RLIMIT_FSIZE, (1 * mb, 1 * mb))",
  "resource.setrlimit(resource.RLIMIT_CPU, (10, 10))",
  "src = sys.stdin.read()",
  "exec(compile(src, '<apex>', 'exec'), {'__name__': '__main__'})",
].join("\n");

export interface PythonRunResult {
  stdout:     string;
  stderr:     string;
  exitCode:   number;
  timedOut:   boolean;
  durationMs: number;
}

export async function runPythonIsolated(
  pythonBin: string,
  code: string,
  opts: { timeoutMs: number; onStdout?: (text: string) => void; onStderr?: (text: string) => void },
): Promise<PythonRunResult> {
  const start = Date.now();
  const child = spawn(pythonBin, ["-I", "-c", PY_BOOTSTRAP], {
    env: { PATH: "/usr/bin:/usr/local/bin:/bin", HOME: "/tmp", PYTHONDONTWRITEBYTECODE: "1" },
    cwd: "/tmp",
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let timedOut = false;

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    const text = chunk.slice(0, Math.max(0, MAX_OUTPUT_CHARS - stdout.length));
    stdout += text;
    if (text) opts.onStdout?.(text);
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    const text = chunk.slice(0, Math.max(0, MAX_OUTPUT_CHARS - stderr.length));
    stderr += text;
    if (text) opts.onStderr?.(text);
  });

  const killer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, opts.timeoutMs);
  child.stdin.on("error", () => { /* child exited before reading all input */ });
  child.stdin.end(code.slice(0, MAX_CODE_CHARS));

  const exitCode = await new Promise<number>((resolve) => {
    child.on("close", (c) => resolve(c ?? 1));
    child.on("error", (err) => { stderr += err.message; resolve(1); });
  });
  clearTimeout(killer);

  return { stdout, stderr, exitCode: timedOut ? 124 : exitCode, timedOut, durationMs: Date.now() - start };
}
