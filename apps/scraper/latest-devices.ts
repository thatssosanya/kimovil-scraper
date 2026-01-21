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
  const maxPages = parseIntSafe(
    args.find((a) => a.startsWith("--max-pages="))?.split("=")[1],
    20,
  );
  const stopAfterKnown = parseIntSafe(
    args.find((a) => a.startsWith("--stop-after-known="))?.split("=")[1],
    50,
  );

  yield* Effect.logInfo("Starting discovery crawl").pipe(
    Effect.annotateLogs({ dryRun, maxPages, stopAfterKnown }),
  );

  const result = yield* crawler.crawl({ dryRun, maxPages, stopAfterKnown });

  yield* Effect.logInfo("Crawl completed").pipe(
    Effect.annotateLogs({
      discovered: result.discovered,
      alreadyKnown: result.alreadyKnown,
      queued: result.queued,
      pagesScanned: result.pagesScanned,
    }),
  );
});

LiveRuntime.runPromise(program).catch(console.error);
