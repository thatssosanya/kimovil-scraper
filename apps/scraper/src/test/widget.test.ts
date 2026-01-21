import { describe, it, expect } from "vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "@effect/sql";
import { createTestSqlClient } from "./setup";
import { WidgetService, WidgetServiceLive } from "../services/widget";
import { WidgetDataService, WidgetDataServiceLive } from "../services/widget-data";
import { YandexAffiliateServiceLive } from "../services/yandex-affiliate";
import { PriceUrlRefreshService, PriceUrlRefreshServiceLive } from "../services/price-url-refresh";
import { PriceServiceLive } from "../services/price";
import { PriceRuClientLive } from "../sources/price_ru";

const initTestSchema = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      brand TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS entity_data_raw (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL REFERENCES devices(id),
      source TEXT NOT NULL,
      data_kind TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(device_id, source, data_kind)
    )
  `);

  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS price_quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL REFERENCES devices(id),
      source TEXT NOT NULL,
      seller TEXT,
      price_minor_units INTEGER NOT NULL,
      currency TEXT NOT NULL,
      url TEXT,
      scraped_at INTEGER NOT NULL,
      is_available INTEGER NOT NULL DEFAULT 1,
      affiliate_url TEXT,
      affiliate_url_created_at TEXT,
      affiliate_error TEXT,
      redirect_type TEXT
    )
  `);

  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS widget_creatives (
      device_id TEXT PRIMARY KEY,
      erid TEXT NOT NULL,
      clid INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

const TestSchemaLive = Layer.effectDiscard(initTestSchema);

const createTestLayer = () => {
  const SqlWithSchema = Layer.provideMerge(TestSchemaLive, createTestSqlClient());
  const WidgetDataLayer = Layer.provideMerge(WidgetDataServiceLive, SqlWithSchema);
  const YandexAffiliateLayer = Layer.provideMerge(YandexAffiliateServiceLive, SqlWithSchema);
  const PriceServiceLayer = Layer.provideMerge(PriceServiceLive, SqlWithSchema);
  const PriceUrlRefreshLayer = PriceUrlRefreshServiceLive.pipe(
    Layer.provide(PriceServiceLayer),
    Layer.provide(PriceRuClientLive),
  );
  const WidgetLayer = WidgetServiceLive.pipe(
    Layer.provide(WidgetDataLayer),
    Layer.provide(YandexAffiliateLayer),
    Layer.provide(PriceUrlRefreshLayer),
    Layer.provide(SqlWithSchema),
  );
  return Layer.mergeAll(WidgetLayer, WidgetDataLayer, SqlWithSchema);
};

const runWidgetTest = <A, E>(
  effect: Effect.Effect<A, E, WidgetService | WidgetDataService | SqlClient.SqlClient>,
) => Effect.runPromise(effect.pipe(Effect.provide(createTestLayer())));

const seedTestDevice = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`INSERT INTO devices (id, slug, name, brand, created_at, updated_at) 
             VALUES ('test-device-id', 'test-phone', 'Test Phone', 'TestBrand', unixepoch(), unixepoch())`;

  const specsData = JSON.stringify({
    size_in: 6.5,
    cpu: "Snapdragon 888",
    batteryCapacity_mah: 4500,
    images: ["https://example.com/phone.jpg"],
  });
  yield* sql`INSERT INTO entity_data_raw (device_id, source, data_kind, data, created_at, updated_at)
             VALUES ('test-device-id', 'kimovil', 'specs', ${specsData}, unixepoch(), unixepoch())`;

  yield* sql`INSERT INTO price_quotes (device_id, source, seller, price_minor_units, currency, url, scraped_at, is_available)
             VALUES ('test-device-id', 'yandex_market', 'Test Seller', 1299900, 'RUB', 'https://market.yandex.ru/test', unixepoch(), 1)`;
  yield* sql`INSERT INTO price_quotes (device_id, source, seller, price_minor_units, currency, url, scraped_at, is_available)
             VALUES ('test-device-id', 'price_ru', 'Price Seller', 1199900, 'RUB', 'https://price.ru/test', unixepoch(), 1)`;
});

const seedXssDevice = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const xssName = '<script>alert("xss")</script>';
  const xssBrand = '"><img src=x onerror=alert(1)>';

  yield* sql`INSERT INTO devices (id, slug, name, brand, created_at, updated_at) 
             VALUES ('xss-device-id', 'xss-phone', ${xssName}, ${xssBrand}, unixepoch(), unixepoch())`;

  const specsData = JSON.stringify({
    size_in: 6.0,
    cpu: '<script>evil()</script>',
    batteryCapacity_mah: 3000,
    images: [],
  });
  yield* sql`INSERT INTO entity_data_raw (device_id, source, data_kind, data, created_at, updated_at)
             VALUES ('xss-device-id', 'kimovil', 'specs', ${specsData}, unixepoch(), unixepoch())`;

  yield* sql`INSERT INTO price_quotes (device_id, source, seller, price_minor_units, currency, url, scraped_at, is_available)
             VALUES ('xss-device-id', 'yandex_market', '<script>bad</script>', 999900, 'RUB', 'https://test.com', unixepoch(), 1)`;
});

describe("WidgetService", () => {
  it("returns valid HTML for known device", async () => {
    const html = await runWidgetTest(
      Effect.gen(function* () {
        yield* seedTestDevice;
        const widgetService = yield* WidgetService;
        return yield* widgetService.getWidgetHtml({ slug: "test-phone" });
      }),
    );

    expect(html).toContain("widget-price-container");
    expect(html).toContain("TestBrand Test Phone");
    expect(html).toContain("6.5");
    expect(html).toContain("Snapdragon 888");
    expect(html).toContain("4500");
    expect(html).toContain("11\u00A0999");
    expect(html).toContain("12\u00A0999");
    expect(html).toContain("Яндекс Маркет");
    expect(html).toContain("Price.ru");
  });

  it("returns not found HTML for unknown slug", async () => {
    const html = await runWidgetTest(
      Effect.gen(function* () {
        const widgetService = yield* WidgetService;
        return yield* widgetService.getWidgetHtml({ slug: "nonexistent-device" });
      }),
    );

    expect(html).toContain("data-widget-status=\"not_found\"");
    expect(html).toContain("visibility:hidden");
  });

  it("cache returns same content on second call", async () => {
    const [html1, html2] = await runWidgetTest(
      Effect.gen(function* () {
        yield* seedTestDevice;
        const widgetService = yield* WidgetService;

        const first = yield* widgetService.getWidgetHtml({ slug: "test-phone" });
        const second = yield* widgetService.getWidgetHtml({ slug: "test-phone" });

        return [first, second] as const;
      }),
    );

    expect(html1).toBe(html2);
  });

  it("invalidateSlug clears cache for slug", async () => {
    await runWidgetTest(
      Effect.gen(function* () {
        yield* seedTestDevice;
        const widgetService = yield* WidgetService;
        const sql = yield* SqlClient.SqlClient;

        const htmlBefore = yield* widgetService.getWidgetHtml({ slug: "test-phone" });
        expect(htmlBefore).toContain("Test Phone");

        yield* sql`UPDATE devices SET name = 'Updated Phone' WHERE slug = 'test-phone'`;

        const htmlCached = yield* widgetService.getWidgetHtml({ slug: "test-phone" });
        expect(htmlCached).toContain("Test Phone");

        yield* widgetService.invalidateSlug("test-phone");

        const htmlAfter = yield* widgetService.getWidgetHtml({ slug: "test-phone" });
        expect(htmlAfter).toContain("Updated Phone");
      }),
    );
  });

  it("invalidateAll clears entire cache", async () => {
    await runWidgetTest(
      Effect.gen(function* () {
        yield* seedTestDevice;
        const widgetService = yield* WidgetService;
        const sql = yield* SqlClient.SqlClient;

        yield* widgetService.getWidgetHtml({ slug: "test-phone" });

        yield* sql`UPDATE devices SET name = 'Changed Phone' WHERE slug = 'test-phone'`;

        const htmlCached = yield* widgetService.getWidgetHtml({ slug: "test-phone" });
        expect(htmlCached).toContain("Test Phone");

        yield* widgetService.invalidateAll();

        const htmlAfter = yield* widgetService.getWidgetHtml({ slug: "test-phone" });
        expect(htmlAfter).toContain("Changed Phone");
      }),
    );
  });

  it("arrowVariant changes output", async () => {
    const [neutralHtml, upHtml, downHtml, hotHtml, newHtml] = await runWidgetTest(
      Effect.gen(function* () {
        yield* seedTestDevice;
        const widgetService = yield* WidgetService;

        const neutral = yield* widgetService.getWidgetHtml({
          slug: "test-phone",
          arrowVariant: "neutral",
        });
        const up = yield* widgetService.getWidgetHtml({
          slug: "test-phone",
          arrowVariant: "up",
        });
        const down = yield* widgetService.getWidgetHtml({
          slug: "test-phone",
          arrowVariant: "down",
        });
        const hot = yield* widgetService.getWidgetHtml({
          slug: "test-phone",
          arrowVariant: "hot",
        });
        const newVariant = yield* widgetService.getWidgetHtml({
          slug: "test-phone",
          arrowVariant: "new",
        });

        return [neutral, up, down, hot, newVariant] as const;
      }),
    );

    expect(neutralHtml).toContain("text-neutral-900");
    expect(neutralHtml).not.toContain("Подорожал");
    expect(neutralHtml).not.toContain("Подешевел");
    expect(neutralHtml).not.toContain("Горячая цена");
    expect(neutralHtml).not.toContain("Новинка");

    expect(upHtml).toContain("hsl(354,100%,64%)");
    expect(upHtml).toContain("Подорожал");

    expect(downHtml).toContain("hsl(158,64%,42%)");
    expect(downHtml).toContain("Подешевел");

    expect(hotHtml).toContain("hsl(25,95%,53%)");
    expect(hotHtml).toContain("Горячая цена");

    expect(newHtml).toContain("hsl(45,93%,47%)");
    expect(newHtml).toContain("Новинка");

    expect(new Set([neutralHtml, upHtml, downHtml, hotHtml, newHtml]).size).toBe(5);
  });

  it("HTML escapes user content", async () => {
    const html = await runWidgetTest(
      Effect.gen(function* () {
        yield* seedXssDevice;
        const widgetService = yield* WidgetService;
        return yield* widgetService.getWidgetHtml({ slug: "xss-phone" });
      }),
    );

    expect(html).not.toContain("<script>");
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;&gt;&lt;img");
    expect(html).toContain("src=x onerror=alert");
    expect(html).not.toContain('"><img');
  });
});

describe("WidgetDataService", () => {
  it("returns null for unknown slug", async () => {
    const result = await runWidgetTest(
      Effect.gen(function* () {
        const dataService = yield* WidgetDataService;
        return yield* dataService.getWidgetData("nonexistent-device");
      }),
    );

    expect(result).toBeNull();
  });

  it("returns device data with specs and prices", async () => {
    const result = await runWidgetTest(
      Effect.gen(function* () {
        yield* seedTestDevice;
        const dataService = yield* WidgetDataService;
        return yield* dataService.getWidgetData("test-phone");
      }),
    );

    expect(result).not.toBeNull();
    expect(result?.device.slug).toBe("test-phone");
    expect(result?.device.name).toBe("Test Phone");
    expect(result?.device.brand).toBe("TestBrand");
    expect(result?.specs.screenSize).toBe(6.5);
    expect(result?.specs.cpu).toBe("Snapdragon 888");
    expect(result?.specs.battery).toBe(4500);
    expect(result?.specs.image).toBe("https://example.com/phone.jpg");
    expect(result?.prices).toHaveLength(2);

    const yandexPrice = result?.prices.find((p) => p.source === "yandex_market");
    expect(yandexPrice?.minPrice).toBe(1299900);
    expect(yandexPrice?.sourceName).toBe("Яндекс Маркет");

    const priceRu = result?.prices.find((p) => p.source === "price_ru");
    expect(priceRu?.minPrice).toBe(1199900);
    expect(priceRu?.sourceName).toBe("Price.ru");
  });
});
