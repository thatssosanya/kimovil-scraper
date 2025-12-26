import { Effect } from "effect";
import { registerPipeline, type PipelineContext, type PipelineResult } from "../../pipeline/registry";
import { PriceRuClient } from "./client";
import { DeviceRegistryService } from "../../services/device-registry";

/**
 * price.ru is primarily a search-driven source: for many new devices `model_id` is 0 (not catalogued),
 * but the search response already contains shop-level offers (prices) we can use.
 *
 * We therefore link a single *per-device* "anchor" that enables scheduling price_ru jobs reliably,
 * independent of catalog IDs. Actual offer scraping happens in the `price_ru:prices` pipeline.
 */
const makeAnchorExternalId = (deviceId: string) => `device:${deviceId}`;

const scrapeHandler = (ctx: PipelineContext) =>
  Effect.gen(function* () {
    const client = yield* PriceRuClient;
    const registry = yield* DeviceRegistryService;

    if (!ctx.deviceId) {
      yield* Effect.logWarning("No deviceId in context, skipping link");
      return { outcome: "skipped" as const, message: "No device ID provided" };
    }

    const device = yield* registry.getDeviceById(ctx.deviceId);
    if (!device) {
      yield* Effect.logWarning("Device not found").pipe(
        Effect.annotateLogs({ deviceId: ctx.deviceId }),
      );
      return { outcome: "skipped" as const, message: "Device not found" };
    }

    const anchorExternalId = makeAnchorExternalId(device.id);

    // Ensure a single active anchor per device; deactivate any legacy/mistaken price_ru links (e.g. external_id="0").
    const existing = yield* registry.getSourcesByDeviceAndSource(device.id, "price_ru").pipe(
      Effect.catchAll(() => Effect.succeed([])),
    );
    for (const link of existing) {
      if (link.externalId !== anchorExternalId && link.status === "active") {
        yield* registry.updateSourceStatus("price_ru", link.externalId, "deleted");
      }
    }

    // Probe search once to decide between active vs not_found, and store the query for later scrapes.
    const searchQuery = device.name;
    const result = yield* client.searchOffers(searchQuery, 10).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logWarning("price.ru search failed during linking").pipe(
            Effect.annotateLogs({ deviceId: device.id, error: error.message }),
          );
          return { items: [], total: 0 };
        }),
      ),
    );

    if (result.items.length === 0) {
      yield* registry.markSourceNotFound({
        deviceId: device.id,
        source: "price_ru",
        searchedQuery: searchQuery,
      });
      yield* Effect.logInfo("No price.ru matches found").pipe(
        Effect.annotateLogs({ deviceId: device.id, searchQuery }),
      );
      return { 
        outcome: "not_found" as const, 
        message: `Searched "${searchQuery}" — no matches on price.ru` 
      };
    }

    // Create/update anchor link (used by scheduler to enqueue price_ru jobs).
    yield* registry.linkDeviceToSource({
      deviceId: device.id,
      source: "price_ru",
      externalId: anchorExternalId,
      status: "active",
      metadata: {
        query: searchQuery,
        sample_offer_name: result.items[0]?.name ?? null,
        sample_shop: result.items[0]?.shopName ?? null,
        linked_at: Date.now(),
      },
    });

    yield* Effect.logInfo("Linked price.ru via device anchor").pipe(
      Effect.annotateLogs({ deviceId: device.id, externalId: anchorExternalId }),
    );

    return { 
      outcome: "success" as const, 
      message: `Linked to price.ru (${result.items.length} offers found)` 
    };
  });

registerPipeline({
  source: "price_ru",
  dataKind: "price_links",
  stages: { scrape: scrapeHandler },
});

export {};
