import { Effect, Layer } from "effect";
import {
  SlugCrawlerService,
  SlugCrawlerServiceLive,
} from "./src/services/slug-crawler";
import { DeviceDiscoveryServiceLive } from "./src/services/device-discovery";
import { DeviceRegistryServiceLive } from "./src/services/device-registry";
import { SqlClientLive, SchemaLive } from "./src/sql";

const SqlLayer = SchemaLive.pipe(Layer.provideMerge(SqlClientLive));
const DiscoveryLayer = DeviceDiscoveryServiceLive.pipe(Layer.provide(SqlLayer));
const DeviceRegistryLayer = DeviceRegistryServiceLive.pipe(Layer.provide(SqlLayer));
const MainLayer = SlugCrawlerServiceLive.pipe(
  Layer.provide(Layer.mergeAll(DiscoveryLayer, DeviceRegistryLayer)),
);

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
