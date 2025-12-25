/**
 * ⚠️  DANGEROUS DEBUG ENDPOINT - DEV ONLY ⚠️
 *
 * This module provides a /debug/eval endpoint that executes arbitrary JS code
 * with access to the Effect runtime and all services. NEVER enable in production.
 */

import { Elysia, t } from "elysia";
import { Effect } from "effect";

import { LiveRuntime } from "../layers/live";
import { DeviceDiscoveryService } from "../services/device-discovery";
import { HtmlCacheService } from "../services/html-cache";
import { PhoneDataService } from "../services/phone-data";
import { JobQueueService } from "../services/job-queue";
import { DeviceRegistryService } from "../services/device-registry";
import { EntityDataService } from "../services/entity-data";
import { ScrapeRecordService } from "../services/scrape-record";
import { PriceService } from "../services/price";
import { log } from "../utils/logger";

const serialize = (value: unknown): string => {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (_, val) => {
      if (typeof val === "bigint") return val.toString();
      if (typeof val === "function") return `[Function: ${val.name || "anonymous"}]`;
      if (val instanceof Error) return { error: val.message, stack: val.stack };
      if (typeof val === "object" && val !== null) {
        if (seen.has(val)) return "[Circular]";
        seen.add(val);
      }
      return val;
    },
    2,
  );
};

export const createDebugRoutes = () =>
  new Elysia({ prefix: "/debug" })
    .post(
      "/eval",
      async ({ body }) => {
        const { code } = body;
        log.info("Debug", `Evaluating: ${code.slice(0, 100)}${code.length > 100 ? "..." : ""}`);

        const context = {
          Effect,
          LiveRuntime,
          DeviceDiscoveryService,
          HtmlCacheService,
          PhoneDataService,
          JobQueueService,
          DeviceRegistryService,
          EntityDataService,
          ScrapeRecordService,
          PriceService,
        };

        try {
          const keys = Object.keys(context);
          const values = Object.values(context);
          const fn = new Function(
            ...keys,
            `return (async () => { ${code} })()`,
          );
          const result = await fn(...values);
          return { success: true, result };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const stack = error instanceof Error ? error.stack : undefined;
          log.error("Debug", `Eval failed: ${message}`);
          return { success: false, error: message, stack };
        }
      },
      {
        body: t.Object({
          code: t.String(),
        }),
      },
    );
