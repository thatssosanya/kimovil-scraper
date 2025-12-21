import { Effect } from "effect";
import {
  registerPipeline,
  type PipelineContext,
} from "../../pipeline/registry";

const scrapeHandler = (_ctx: PipelineContext) =>
  Effect.gen(function* () {
    // This stage fetches HTML and saves to raw_html
    // The existing ScrapeService.scrapeFast handles this
    // For now, just mark that this stage exists - actual integration
    // will use existing scrape-kimovil code
    yield* Effect.void;
  });

const processRawHandler = (_ctx: PipelineContext) =>
  Effect.gen(function* () {
    // Extract structured data from HTML
    // Save to entity_data_raw
    yield* Effect.void;
  });

const processAiHandler = (_ctx: PipelineContext) =>
  Effect.gen(function* () {
    // Run AI normalization
    // Save to entity_data
    yield* Effect.void;
  });

registerPipeline({
  source: "kimovil",
  dataKind: "specs",
  stages: {
    scrape: scrapeHandler,
    process_raw: processRawHandler,
    process_ai: processAiHandler,
  },
});

export {};
