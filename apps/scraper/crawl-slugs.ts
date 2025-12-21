import { Effect, Layer } from "effect";
import {
  SlugCrawlerService,
  SlugCrawlerServiceLive,
} from "./src/services/slug-crawler";
import { DeviceServiceLive } from "./src/services/device";
import { DatabaseServiceLive } from "./src/services/db";

const DeviceLayer = DeviceServiceLive.pipe(Layer.provide(DatabaseServiceLive));
const MainLayer = SlugCrawlerServiceLive.pipe(Layer.provide(DeviceLayer));

const program = Effect.gen(function* () {
  const crawler = yield* SlugCrawlerService;

  const args = process.argv.slice(2);

  if (args.includes("--stats")) {
    const stats = yield* crawler.getCrawlStats();
    console.log(`Devices: ${stats.devices}`);
    console.log(`Pending prefixes: ${stats.pendingPrefixes}`);
    return;
  }

  console.log("Starting full slug crawl...");
  console.log("Press Ctrl+C to stop (progress is saved automatically)\n");

  yield* crawler.runFullCrawl();
});

Effect.runPromise(program.pipe(Effect.provide(MainLayer))).catch(console.error);
