import { Effect, Option, Array as Arr, pipe } from "effect";
import type { Page } from "playwright";

// Field names for typed extraction
export type FieldName =
  | "name"
  | "brand"
  | "aliases"
  | "releaseDate"
  | "images"
  | "dimensions"
  | "weight"
  | "materials"
  | "ipRating"
  | "colors"
  | "display"
  | "displayFeatures"
  | "cpu"
  | "cpuCores"
  | "gpu"
  | "skus"
  | "sdSlot"
  | "fingerprint"
  | "benchmarks"
  | "nfc"
  | "bluetooth"
  | "sim"
  | "usb"
  | "headphoneJack"
  | "battery"
  | "cameras"
  | "cameraFeatures"
  | "os"
  | "scores"
  | "others";

// Typed extraction errors
export class ExtractionError {
  readonly _tag = "ExtractionError";
  constructor(
    readonly field: FieldName,
    readonly selector: string,
    readonly strategy: string,
    readonly message: string
  ) {}
}

// Extraction issue for partial success tracking
export interface ExtractionIssue {
  field: FieldName;
  selector: string;
  strategy: string;
  message: string;
}

// Extraction result with data and issues
export interface ExtractionResult<T> {
  data: T;
  issues: ExtractionIssue[];
}

// Extraction context - page reference
export interface ExtractionContext {
  page: Page;
}

// Strategy interface - returns Option (missing = None, found = Some)
export interface ExtractionStrategy<A> {
  readonly name: string;
  readonly selector: string;
  readonly run: (
    ctx: ExtractionContext
  ) => Effect.Effect<Option.Option<A>, ExtractionError>;
}

// Combinator: run strategies in order, first Some wins, log failures
export const runStrategies = <A>(
  field: FieldName,
  strategies: ReadonlyArray<ExtractionStrategy<A>>,
  required: boolean
): ((
  ctx: ExtractionContext
) => Effect.Effect<
  { value: Option.Option<A>; issues: ExtractionIssue[] },
  ExtractionError
>) => {
  return (ctx: ExtractionContext) =>
    Effect.gen(function* () {
      const issues: ExtractionIssue[] = [];

      for (const strategy of strategies) {
        const result = yield* strategy.run(ctx).pipe(
          Effect.catchAll((error) => {
            issues.push({
              field: error.field,
              selector: error.selector,
              strategy: error.strategy,
              message: error.message,
            });
            return Effect.succeed(Option.none<A>());
          })
        );

        if (Option.isSome(result)) {
          return { value: result, issues };
        }
      }

      if (required && strategies.length > 0) {
        const lastStrategy = strategies[strategies.length - 1];
        return yield* Effect.fail(
          new ExtractionError(
            field,
            lastStrategy?.selector ?? "",
            lastStrategy?.name ?? "",
            `Required field "${field}" not found after trying all strategies`
          )
        );
      }

      return { value: Option.none<A>(), issues };
    });
};

// Helper: create CSS selector strategy with transform inside $$eval
export const cssStrategy = <A>(
  name: string,
  field: FieldName,
  selector: string,
  evalFn: (elements: Element[]) => A | null
): ExtractionStrategy<A> => ({
  name,
  selector,
  run: (ctx: ExtractionContext) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          const elements = await ctx.page.$$(selector);
          if (elements.length === 0) return null;
          return ctx.page.$$eval(selector, evalFn);
        },
        catch: (e) =>
          new ExtractionError(
            field,
            selector,
            name,
            e instanceof Error ? e.message : String(e)
          ),
      });

      return result !== null ? Option.some(result) : Option.none();
    }),
});

// Helper: create CSS text extraction strategy
export const cssTextStrategy = (
  name: string,
  field: FieldName,
  selector: string,
  transform: (text: string) => string | null = (t) => t
): ExtractionStrategy<string> => ({
  name,
  selector,
  run: (ctx: ExtractionContext) =>
    Effect.gen(function* () {
      const text = yield* Effect.tryPromise({
        try: async () => {
          const element = await ctx.page.$(selector);
          if (!element) return null;
          const textContent = await element.textContent();
          return textContent?.trim() || null;
        },
        catch: (e) =>
          new ExtractionError(
            field,
            selector,
            name,
            e instanceof Error ? e.message : String(e)
          ),
      });

      if (!text) return Option.none();
      const transformed = transform(text);
      return transformed !== null ? Option.some(transformed) : Option.none();
    }),
});

// Helper: create $$eval strategy for extracting from multiple elements
export const cssArrayStrategy = <A>(
  name: string,
  field: FieldName,
  selector: string,
  evalFn: (els: Element[]) => A[]
): ExtractionStrategy<A[]> => ({
  name,
  selector,
  run: (ctx: ExtractionContext) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          const elements = await ctx.page.$$(selector);
          if (elements.length === 0) return null;
          return ctx.page.$$eval(selector, evalFn);
        },
        catch: (e) =>
          new ExtractionError(
            field,
            selector,
            name,
            e instanceof Error ? e.message : String(e)
          ),
      });

      return result !== null && result.length > 0
        ? Option.some(result)
        : Option.none();
    }),
});

// Helper: create $eval strategy for single element transform
export const cssSingleStrategy = <A>(
  name: string,
  field: FieldName,
  selector: string,
  evalFn: (el: Element) => A | null
): ExtractionStrategy<A> => ({
  name,
  selector,
  run: (ctx: ExtractionContext) =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          const element = await ctx.page.$(selector);
          if (!element) return null;
          return ctx.page.$eval(selector, evalFn);
        },
        catch: (e) =>
          new ExtractionError(
            field,
            selector,
            name,
            e instanceof Error ? e.message : String(e)
          ),
      });

      return result !== null ? Option.some(result) : Option.none();
    }),
});

// Helper: create attribute extraction strategy
export const cssAttrStrategy = (
  name: string,
  field: FieldName,
  selector: string,
  attribute: string,
  transform: (value: string) => string | null = (v) => v
): ExtractionStrategy<string> => ({
  name,
  selector,
  run: (ctx: ExtractionContext) =>
    Effect.gen(function* () {
      const value = yield* Effect.tryPromise({
        try: async () => {
          const element = await ctx.page.$(selector);
          if (!element) return null;
          return element.getAttribute(attribute);
        },
        catch: (e) =>
          new ExtractionError(
            field,
            selector,
            name,
            e instanceof Error ? e.message : String(e)
          ),
      });

      if (!value) return Option.none();
      const transformed = transform(value);
      return transformed !== null ? Option.some(transformed) : Option.none();
    }),
});

// Helper: fixed image URL (protocol-relative)
export const fixImageUrl = (url: string): string => {
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  return url;
};

// Image extraction strategies
export const imageStrategies: ExtractionStrategy<string[]>[] = [
  cssArrayStrategy(
    "gallery-thumbs",
    "images",
    "header .gallery-thumbs img",
    (els) =>
      els
        .map((el) => el.getAttribute("src") || el.getAttribute("data-src"))
        .filter((src): src is string => Boolean(src))
        .map(fixImageUrl)
  ),
  cssArrayStrategy(
    "main-image",
    "images",
    "header .main-image img",
    (els) =>
      els
        .map((el) => el.getAttribute("src") || el.getAttribute("data-src"))
        .filter((src): src is string => Boolean(src))
        .map(fixImageUrl)
  ),
  cssArrayStrategy("product-gallery", "images", ".product-gallery img", (els) =>
    els
      .map((el) => el.getAttribute("src"))
      .filter((src): src is string => Boolean(src))
      .map(fixImageUrl)
  ),
  {
    name: "og-image",
    selector: 'meta[property="og:image"]',
    run: (ctx: ExtractionContext) =>
      Effect.gen(function* () {
        const content = yield* Effect.tryPromise({
          try: async () => {
            const meta = await ctx.page.$('meta[property="og:image"]');
            if (!meta) return null;
            return await meta.getAttribute("content");
          },
          catch: (e) =>
            new ExtractionError(
              "images",
              'meta[property="og:image"]',
              "og-image",
              e instanceof Error ? e.message : String(e)
            ),
        });

        if (!content) return Option.none();
        return Option.some([fixImageUrl(content)]);
      }),
  },
];

// Scores extraction (pros/cons)
export const scoresStrategies: ExtractionStrategy<string[]>[] = [
  cssArrayStrategy(
    "pros-cons-list",
    "scores",
    ".pros-and-cons-list li",
    (els) =>
      els.map((el) => el.textContent?.trim()).filter((t): t is string => Boolean(t))
  ),
  cssArrayStrategy("pros-list", "scores", ".pros li, .cons li", (els) =>
    els.map((el) => el.textContent?.trim()).filter((t): t is string => Boolean(t))
  ),
  cssArrayStrategy(
    "advantages-disadvantages",
    "scores",
    ".advantages li, .disadvantages li",
    (els) =>
      els.map((el) => el.textContent?.trim()).filter((t): t is string => Boolean(t))
  ),
];

// Others extraction (additional features)
export const othersStrategies: ExtractionStrategy<string[]>[] = [
  {
    name: "combined-features",
    selector: "section",
    run: (ctx: ExtractionContext) =>
      Effect.gen(function* () {
        const features: string[] = [];

        // Stereo speakers
        const stereoSpeakers = yield* Effect.tryPromise({
          try: async () => {
            const el = await ctx.page.$(
              'section.container-sheet-connectivity .k-dltable tr:has-text("Speakers") td'
            );
            if (!el) return null;
            const text = await el.textContent();
            return text?.toLowerCase().includes("stereo") ? "Stereo speakers" : null;
          },
          catch: (e) =>
            new ExtractionError(
              "others",
              "section",
              "combined-features",
              e instanceof Error ? e.message : String(e)
            ),
        }).pipe(Effect.catchAll(() => Effect.succeed(null)));
        if (stereoSpeakers) features.push(stereoSpeakers);

        // Video recording
        const videoRecording = yield* Effect.tryPromise({
          try: async () => {
            const el = await ctx.page.$(
              'section.container-sheet-camera .k-dltable tr:has-text("Video") td'
            );
            if (!el) return null;
            const text = await el.textContent();
            if (!text) return null;

            const caps: string[] = [];
            if (text.includes("8K")) caps.push("8K video");
            if (text.includes("4K")) {
              const fps = text.match(/4K\s*@?\s*(\d+)/i);
              caps.push(fps ? `4K@${fps[1]}fps` : "4K video");
            }
            if (text.toLowerCase().includes("slow motion")) caps.push("Slow motion");
            return caps.length > 0 ? caps : null;
          },
          catch: (e) =>
            new ExtractionError(
              "others",
              "section",
              "combined-features",
              e instanceof Error ? e.message : String(e)
            ),
        }).pipe(Effect.catchAll(() => Effect.succeed(null)));
        if (videoRecording) features.push(...videoRecording);

        // Wireless charging
        const wirelessCharging = yield* Effect.tryPromise({
          try: async () => {
            const el = await ctx.page.$(
              'section.container-sheet-battery .k-dltable tr:has-text("Wireless") td'
            );
            if (!el) return null;
            const text = await el.textContent();
            return text?.toLowerCase().includes("yes") ? "Wireless charging" : null;
          },
          catch: (e) =>
            new ExtractionError(
              "others",
              "section",
              "combined-features",
              e instanceof Error ? e.message : String(e)
            ),
        }).pipe(Effect.catchAll(() => Effect.succeed(null)));
        if (wirelessCharging) features.push(wirelessCharging);

        // WiFi version
        const wifiVersion = yield* Effect.tryPromise({
          try: async () => {
            const el = await ctx.page.$(
              'section.container-sheet-connectivity .k-dltable tr:has-text("Wi-Fi") td, section.container-sheet-connectivity .k-dltable tr:has-text("WiFi") td'
            );
            if (!el) return null;
            const text = await el.textContent();
            if (!text) return null;
            const match = text.match(/Wi-Fi\s*(\d+[a-z]*)/i);
            return match ? `WiFi ${match[1]}` : null;
          },
          catch: (e) =>
            new ExtractionError(
              "others",
              "section",
              "combined-features",
              e instanceof Error ? e.message : String(e)
            ),
        }).pipe(Effect.catchAll(() => Effect.succeed(null)));
        if (wifiVersion) features.push(wifiVersion);

        return features.length > 0 ? Option.some(features) : Option.none();
      }),
  },
];

// Extract images with fallback
export const extractImages = (
  ctx: ExtractionContext
): Effect.Effect<
  { value: string[] | null; issues: ExtractionIssue[] },
  ExtractionError
> =>
  Effect.gen(function* () {
    const result = yield* runStrategies("images", imageStrategies, false)(ctx);
    return {
      value: Option.isSome(result.value) ? result.value.value : null,
      issues: result.issues,
    };
  });

// Extract scores (pros/cons)
export const extractScores = (
  ctx: ExtractionContext
): Effect.Effect<
  { value: string | null; issues: ExtractionIssue[] },
  ExtractionError
> =>
  Effect.gen(function* () {
    const result = yield* runStrategies("scores", scoresStrategies, false)(ctx);
    if (Option.isSome(result.value)) {
      // Join as pipe-delimited string
      return {
        value: result.value.value.join("|"),
        issues: result.issues,
      };
    }
    return { value: null, issues: result.issues };
  });

// Extract others (additional features)
export const extractOthers = (
  ctx: ExtractionContext
): Effect.Effect<
  { value: string[] | null; issues: ExtractionIssue[] },
  ExtractionError
> =>
  Effect.gen(function* () {
    const result = yield* runStrategies("others", othersStrategies, false)(ctx);
    return {
      value: Option.isSome(result.value) ? result.value.value : null,
      issues: result.issues,
    };
  });
