#!/usr/bin/env bun
/**
 * Debug eval CLI - Query app state via /debug/eval endpoint
 *
 * Usage:
 *   debug-eval <code>                    # Run arbitrary JS code
 *   debug-eval jobs                      # List all jobs
 *   debug-eval jobs --status paused      # Filter by status
 *   debug-eval devices                   # Get device count
 *   debug-eval queue <jobId>             # Get queue items for job
 *
 * Options:
 *   --url <url>       Override endpoint (default: http://localhost:1488)
 *   --show-code       Print generated code before running
 *   --raw             Output raw result only (no wrapper)
 */

const BASE_URL = process.env.DEBUG_EVAL_URL ?? "http://localhost:1488";

type Result = { success: true; result: unknown } | { success: false; error: string; stack?: string };

async function evalCode(code: string): Promise<Result> {
  const res = await fetch(`${BASE_URL}/debug/eval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
  }
  return res.json();
}

function run(service: string, method: string): string {
  return `return await LiveRuntime.runPromise(${service}.pipe(Effect.flatMap(svc => svc.${method})))`;
}

const PRESETS: Record<string, (args: string[]) => string> = {
  jobs: (args) => {
    const statusIdx = args.indexOf("--status");
    if (statusIdx !== -1 && args[statusIdx + 1]) {
      const status = args[statusIdx + 1];
      return `${run("JobQueueService", "getAllJobs()")}.then(jobs => jobs.filter(j => j.status === "${status}"))`;
    }
    return run("JobQueueService", "getAllJobs()");
  },

  devices: () => {
    return `${run("DeviceService", "getAllDevices()")}.then(d => ({ count: d.length }))`;
  },

  queue: (args) => {
    const jobId = args[0];
    if (!jobId) return `return { error: "queue requires jobId argument" }`;
    return `${run("JobQueueService", `getQueueItems("${jobId}")`)}`;
  },

  html: (args) => {
    const slug = args[0];
    if (!slug) return `return { error: "html requires slug argument" }`;
    return `return await LiveRuntime.runPromise(HtmlCacheService.pipe(Effect.flatMap(svc => svc.getHtml("${slug}"))))`;
  },

  stats: () => {
    return `return await LiveRuntime.runPromise(Effect.gen(function* () {
      const devices = yield* DeviceService.pipe(Effect.flatMap(s => s.getAllDevices()));
      const jobs = yield* JobQueueService.pipe(Effect.flatMap(s => s.getAllJobs()));
      return {
        devices: devices.length,
        jobs: { total: jobs.length, active: jobs.filter(j => j.status !== "done").length }
      };
    }))`;
  },
};

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
Debug eval CLI - Query app state via /debug/eval endpoint

Usage:
  debug-eval <code>                    Run arbitrary JS code
  debug-eval jobs                      List all jobs
  debug-eval jobs --status <status>    Filter jobs by status
  debug-eval devices                   Get device count
  debug-eval queue <jobId>             Get queue items for job
  debug-eval html <slug>               Get cached HTML for slug
  debug-eval stats                     Get overall stats

Options:
  --url <url>       Override endpoint (default: http://localhost:1488)
  --show-code       Print generated code before running
  --raw             Output raw result only (no success wrapper)

Examples:
  debug-eval jobs | jq '.result | length'
  debug-eval jobs --status paused | jq '.result'
  debug-eval 'return await LiveRuntime.runPromise(DeviceService.pipe(Effect.flatMap(s => s.getAllDevices()))).then(d => d.length)'
`);
    process.exit(0);
  }

  const showCode = args.includes("--show-code");
  const rawOutput = args.includes("--raw");
  const filteredArgs = args.filter((a) => a !== "--show-code" && a !== "--raw");

  let code: string;
  const command = filteredArgs[0];

  if (command && PRESETS[command]) {
    code = PRESETS[command](filteredArgs.slice(1));
  } else {
    code = filteredArgs.join(" ");
  }

  if (showCode) {
    console.error("Code:", code);
  }

  try {
    const result = await evalCode(code);

    if (!result.success) {
      console.error("Error:", result.error);
      if (result.stack) console.error(result.stack);
      process.exit(2);
    }

    const output = rawOutput ? result.result : result;
    console.log(JSON.stringify(output, null, 2));
  } catch (err) {
    console.error("Request failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
