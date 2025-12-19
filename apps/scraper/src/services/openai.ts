import { Effect, Layer, Context, Schedule } from "effect";
import { Schema } from "@effect/schema";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

export class OpenAIError extends Error {
  readonly _tag = "OpenAIError";
}

// Schema for AI normalization response
const CameraTypeSchema = Schema.Literal(
  "ширик",
  "зум",
  "основная",
  "фронтальная",
  "lidar",
  "макро",
  "инфракрасная",
);

const CameraSchema = Schema.Struct({
  resolution_mp: Schema.Number,
  aperture_fstop: Schema.NullOr(Schema.String),
  sensor: Schema.NullOr(Schema.String),
  type: CameraTypeSchema,
  features: Schema.optional(
    Schema.NullOr(
      Schema.Union(
        Schema.Array(Schema.Literal("macro", "monochrome")),
        Schema.Literal(""),
      ),
    ),
  ),
});

const SkuSchema = Schema.Struct({
  marketId: Schema.String,
  ram_gb: Schema.Number,
  storage_gb: Schema.Number,
});

const BenchmarkSchema = Schema.Struct({
  name: Schema.String,
  score: Schema.Number,
});

const NormalizedDataSchema = Schema.Struct({
  slug: Schema.String,
  name: Schema.String,
  brand: Schema.String,
  aliases: Schema.String,
  releaseDate: Schema.NullOr(Schema.String),
  height_mm: Schema.NullOr(Schema.Number),
  width_mm: Schema.NullOr(Schema.Number),
  thickness_mm: Schema.NullOr(Schema.Number),
  weight_g: Schema.NullOr(Schema.Number),
  materials: Schema.String,
  ipRating: Schema.NullOr(Schema.String),
  colors: Schema.String,
  size_in: Schema.NullOr(Schema.Number),
  displayType: Schema.NullOr(Schema.String),
  resolution: Schema.NullOr(Schema.String),
  aspectRatio: Schema.NullOr(Schema.String),
  ppi: Schema.NullOr(Schema.Number),
  displayFeatures: Schema.String,
  cpu: Schema.NullOr(Schema.String),
  cpuManufacturer: Schema.NullOr(Schema.String),
  cpuCores: Schema.NullOr(Schema.String),
  gpu: Schema.NullOr(Schema.String),
  sdSlot: Schema.NullOr(Schema.Boolean),
  skus: Schema.Array(SkuSchema),
  fingerprintPosition: Schema.NullOr(Schema.Literal("screen", "side", "back")),
  benchmarks: Schema.Array(BenchmarkSchema),
  nfc: Schema.NullOr(Schema.Boolean),
  bluetooth: Schema.NullOr(Schema.String),
  sim: Schema.String,
  simCount: Schema.Number,
  usb: Schema.NullOr(Schema.Literal("USB-A", "USB-C", "Lightning")),
  headphoneJack: Schema.NullOr(Schema.Boolean),
  batteryCapacity_mah: Schema.NullOr(Schema.Number),
  batteryFastCharging: Schema.NullOr(Schema.Boolean),
  batteryWattage: Schema.NullOr(Schema.Number),
  cameras: Schema.Array(CameraSchema),
  cameraFeatures: Schema.String,
  os: Schema.NullOr(Schema.String),
  osSkin: Schema.NullOr(Schema.String),
});

export type NormalizedData = Schema.Schema.Type<typeof NormalizedDataSchema>;
export type RawPhoneData = Record<string, unknown>;

export interface OpenAIService {
  readonly adaptScrapedData: (
    data: RawPhoneData,
  ) => Effect.Effect<NormalizedData, OpenAIError>;
}

export const OpenAIService = Context.GenericTag<OpenAIService>("OpenAIService");

const SYSTEM_PROMPT = `Ты — эксперт по мобильным устройствам, пишущий для русскоязычной аудитории технически грамотных, но не профессиональных пользователей (как читатели 4PDA или iXBT).

Твоя задача — нормализовать характеристики смартфонов:
1. Переводить на понятный русский язык, избегая калек с английского
2. Убирать избыточные и очевидные характеристики
3. Оставлять только то, что помогает выбрать телефон
4. Использовать единообразный стиль: не слишком формальный, не слишком разговорный`;

const USER_PROMPT_TEMPLATE = `Нормализуй характеристики смартфона по правилам ниже.

## Правила

### displayFeatures (особенности экрана)
- Оставь только важные: частота обновления, яркость, HDR, тип матрицы (LTPO/AMOLED)
- Убери: Capacitive, Multi-touch, Frameless, Scratch resistant, Hole-punch (это есть у всех)
- Убери защитные стёкла: Gorilla Glass любой версии
- Переводи сертификации кратко: "TÜV Rheinland Eye Comfort" → "защита глаз TÜV"
- ШИМ важен: "2160 Hz PWM" → "низкий ШИМ 2160 Гц"

### cameraFeatures (особенности камеры)  
- Оставь максимум 6-8 ключевых фич
- Убери стандартные: Autofocus, Face detection, Geotagging, Touch focus, Scene mode, Self-timer (есть везде)
- Объединяй похожие: несколько типов автофокуса → "быстрый фазовый автофокус"
- Дедуплицируй: "Night Mode 2.0" и "Night Mode" → оставь только "ночной режим 2.0"

### materials (материалы корпуса)
- Переводи: Metal → металл, Plastic → пластик, Glass → стекло, Ceramic → керамика
- Убери марки стекла (Gorilla Glass и т.п.)

### colors (цвета)
- Переводи на русский: Silver → серебристый, Green → зелёный, Black → чёрный
- Оставь оригинальные маркетинговые названия если они понятны: "Midnight" → "полночь"

### cpu (процессор)
- Убери технические коды: "Snapdragon 7s Gen2 (SM-7435AB)" → "Snapdragon 7s Gen2"
- Оставь только название и поколение

### cameras[].type (тип камеры)
Используй ТОЛЬКО эти значения:
- "основная" — главная камера
- "ширик" — широкоугольная  
- "зум" — телефото/зум
- "фронтальная" — селфи
- "макро" — для макросъёмки
- "lidar" — лидар/ToF сенсор
- "инфракрасная" — ИК камера

Определяй по контексту: "Wide Angle" или "Ultrawide" → "ширик", "Standard" или "Main" → "основная", "Telephoto" → "зум", "Selfie" или "Front" → "фронтальная"

## Примеры

Вход displayFeatures: "Hole-punch Notch|Refresh rate 120 Hz|Brightness 1000 cd/m²|Corning Gorilla Glass Victus 2|Capacitive|Multi-touch|LTPO"
Выход displayFeatures: ["120 Гц", "яркость 1000 кд/м²", "LTPO"]

Вход cameraFeatures: "Night Mode|4K Video|OIS|Autofocus|Touch focus|Phase detection autofocus|Face detection|Panorama|HDR"
Выход cameraFeatures: ["ночной режим", "4K видео", "оптическая стабилизация", "панорама", "HDR"]

Вход cameras: [{"type": "Standard"}, {"type": "Wide Angle + Macro"}, {"type": "Selfie"}]
Выход cameras: [{"type": "основная"}, {"type": "ширик", "features": ["macro"]}, {"type": "фронтальная"}]

## Данные для обработки

{{DATA}}`;

// Zod schema for Gemini structured output
const CameraTypeZod = z.enum([
  "ширик",
  "зум",
  "основная",
  "фронтальная",
  "lidar",
  "макро",
  "инфракрасная",
]);

const MinimalAIResponseZod = z.object({
  displayFeatures: z.union([z.string(), z.array(z.string())]),
  cameraFeatures: z.union([z.string(), z.array(z.string())]),
  materials: z.union([z.string(), z.array(z.string())]),
  colors: z.union([z.string(), z.array(z.string())]),
  cpu: z.string().nullable(),
  cameras: z.array(
    z.object({
      type: CameraTypeZod,
      features: z
        .array(z.enum(["macro", "monochrome"]))
        .optional()
        .nullable(),
    }),
  ),
});

// Accept both string and array formats from AI
const StringOrArraySchema = Schema.Union(
  Schema.String,
  Schema.Array(Schema.String),
);

// Minimal schema for AI response (only fields that need processing)
const MinimalAIResponseSchema = Schema.Struct({
  displayFeatures: StringOrArraySchema,
  cameraFeatures: StringOrArraySchema,
  materials: StringOrArraySchema,
  colors: StringOrArraySchema,
  cpu: Schema.NullOr(Schema.String),
  cameras: Schema.Array(
    Schema.Struct({
      type: CameraTypeSchema,
      features: Schema.optional(
        Schema.NullOr(
          Schema.Union(
            Schema.Array(Schema.Literal("macro", "monochrome")),
            Schema.Literal(""),
          ),
        ),
      ),
    }),
  ),
});

// Convert array or string to pipe-delimited string
const toPipeString = (value: unknown): string => {
  if (Array.isArray(value)) return value.join("|");
  if (typeof value === "string") return value;
  return "";
};

const decodeNormalizedData = Schema.decodeUnknown(NormalizedDataSchema);
const decodeMinimalResponse = Schema.decodeUnknown(MinimalAIResponseSchema);

// Extract only fields that need AI processing
const extractFieldsForAI = (data: RawPhoneData) => ({
  displayFeatures: data.displayFeatures,
  cameraFeatures: data.cameraFeatures,
  materials: data.materials,
  colors: data.colors,
  cpu: data.cpu,
  cameras:
    (data.cameras as Array<{ type: string }>)?.map((c) => ({ type: c.type })) ??
    [],
});

// Lazy initialization - only fails when actually called
export const OpenAIServiceLive = Layer.succeed(
  OpenAIService,
  OpenAIService.of({
    adaptScrapedData: (data: RawPhoneData) =>
      Effect.gen(function* () {
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!apiKey) {
          return yield* Effect.fail(
            new OpenAIError(
              "GOOGLE_GENERATIVE_AI_API_KEY is not available in env",
            ),
          );
        }

        // Only send fields that need AI processing
        const minimalData = extractFieldsForAI(data);
        const userPrompt = USER_PROMPT_TEMPLATE.replace(
          "{{DATA}}",
          JSON.stringify(minimalData),
        );

        const startTime = Date.now();
        console.log(
          `[Gemini] Starting normalization for ${data.slug} (~${Math.ceil(userPrompt.length / 4)} tokens)`,
        );
        console.log(`[Gemini] Sending:`, JSON.stringify(minimalData));

        const result = yield* Effect.tryPromise({
          try: async () => {
            const response = await generateObject({
              model: google("gemini-3-flash-preview"),
              schema: MinimalAIResponseZod,
              system: SYSTEM_PROMPT,
              prompt: userPrompt,
            });
            const elapsed = Date.now() - startTime;
            console.log(
              `[Gemini] Completed in ${elapsed}ms (input: ${response.usage?.inputTokens}, output: ${response.usage?.outputTokens})`,
            );
            return response.object;
          },
          catch: (error) =>
            new OpenAIError(
              `Gemini API call failed: ${error instanceof Error ? error.message : String(error)}`,
            ),
        });

        // Validate with Effect schema
        const aiResult = yield* decodeMinimalResponse(result).pipe(
          Effect.mapError(
            (e) => new OpenAIError(`Validation failed: ${JSON.stringify(e)}`),
          ),
        );

        // Merge AI result with original data (pass-through fields)
        const originalCameras =
          (data.cameras as Array<{
            resolution_mp: number;
            aperture_fstop: string | null;
            sensor: string | null;
          }>) ?? [];

        const mergedData = {
          slug: data.slug as string,
          name: data.name as string,
          brand: data.brand as string,
          aliases: data.aliases as string,
          releaseDate: data.releaseDate as string | null,
          height_mm: data.height_mm as number | null,
          width_mm: data.width_mm as number | null,
          thickness_mm: data.thickness_mm as number | null,
          weight_g: data.weight_g as number | null,
          materials: toPipeString(aiResult.materials),
          ipRating: data.ipRating as string | null,
          colors: toPipeString(aiResult.colors),
          size_in: data.size_in as number | null,
          displayType: data.displayType as string | null,
          resolution: data.resolution as string | null,
          aspectRatio: data.aspectRatio as string | null,
          ppi: data.ppi as number | null,
          displayFeatures: toPipeString(aiResult.displayFeatures),
          cpu: aiResult.cpu,
          cpuManufacturer: data.cpuManufacturer as string | null,
          cpuCores: data.cpuCores as string | null,
          gpu: data.gpu as string | null,
          sdSlot: data.sdSlot as boolean | null,
          skus: data.skus as Array<{
            marketId: string;
            ram_gb: number;
            storage_gb: number;
          }>,
          fingerprintPosition: data.fingerprintPosition as
            | "screen"
            | "side"
            | "back"
            | null,
          benchmarks: data.benchmarks as Array<{ name: string; score: number }>,
          nfc: data.nfc as boolean | null,
          bluetooth: data.bluetooth as string | null,
          sim: data.sim as string,
          simCount: data.simCount as number,
          usb: data.usb as "USB-A" | "USB-C" | "Lightning" | null,
          headphoneJack: data.headphoneJack as boolean | null,
          batteryCapacity_mah: data.batteryCapacity_mah as number | null,
          batteryFastCharging: data.batteryFastCharging as boolean | null,
          batteryWattage: data.batteryWattage as number | null,
          cameras: aiResult.cameras.map((aiCam, i) => ({
            resolution_mp: originalCameras[i]?.resolution_mp ?? 0,
            aperture_fstop: originalCameras[i]?.aperture_fstop ?? null,
            sensor: originalCameras[i]?.sensor ?? null,
            type: aiCam.type,
            features: aiCam.features,
          })),
          cameraFeatures: toPipeString(aiResult.cameraFeatures),
          os: data.os as string | null,
          osSkin: data.osSkin as string | null,
        };

        // Final validation
        const decoded = yield* decodeNormalizedData(mergedData).pipe(
          Effect.mapError(
            (e) =>
              new OpenAIError(`Final validation failed: ${JSON.stringify(e)}`),
          ),
        );

        console.log("[Gemini] Successfully normalized data for:", data.slug);
        return decoded;
      }).pipe(
        Effect.tapError((e) =>
          Effect.sync(() =>
            console.log(`[Gemini] Error, will retry: ${e.message}`),
          ),
        ),
        Effect.retry(
          Schedule.exponential("1 second").pipe(
            Schedule.compose(Schedule.recurs(2)),
          ),
        ),
      ),
  }),
);

// Helper to convert arrays to pipe-delimited strings
export const convertArraysToPipeDelimited = (
  obj: Record<string, unknown>,
): Record<string, unknown> => {
  if (obj === null || typeof obj !== "object") return obj;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      if (value.every((item) => typeof item === "string")) {
        result[key] = value.join("|");
      } else {
        result[key] = value.map((item) =>
          typeof item === "object" && item !== null
            ? convertArraysToPipeDelimited(item as Record<string, unknown>)
            : item,
        );
      }
    } else if (typeof value === "object" && value !== null) {
      result[key] = convertArraysToPipeDelimited(
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
};
