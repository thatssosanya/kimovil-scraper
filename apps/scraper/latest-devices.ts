import { Effect } from "effect";
import { LatestDeviceCrawlerService } from "./src/services/latest-device-crawler";
import { LiveRuntime } from "./src/layers/live";

const parseIntSafe = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

const program = Effect.gen(function* () {
  const crawler = yield* LatestDeviceCrawlerService;
  const args = process.argv.slice(2);

  const dryRun = args.includes("--dry-run");
  const maxScrolls = parseIntSafe(
    args.find((a) => a.startsWith("--max-scrolls="))?.split("=")[1],
    20,
  );
  const stopAfterEmptyScrolls = parseIntSafe(
    args.find((a) => a.startsWith("--stop-after-empty="))?.split("=")[1],
    3,
  );

  yield* Effect.logInfo("Starting discovery crawl").pipe(
    Effect.annotateLogs({ dryRun, maxScrolls, stopAfterEmptyScrolls }),
  );

  const result = yield* crawler.crawl({ dryRun, maxScrolls, stopAfterEmptyScrolls });

  yield* Effect.logInfo("Crawl completed").pipe(
    Effect.annotateLogs({
      discovered: result.discovered,
      alreadyKnown: result.alreadyKnown,
      queued: result.queued,
      scrollCount: result.scrollCount,
    }),
  );
});

LiveRuntime.runPromise(program).catch(console.error);
