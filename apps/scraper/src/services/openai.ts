import { Effect, Layer, Context, Schedule } from "effect";
import { Schema } from "@effect/schema";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import {
  CameraTypeSchema,
  CameraFeaturesArraySchema,
  Phone,
} from "@repo/scraper-domain";
import type { PhoneData, RawPhoneData } from "@repo/scraper-domain";

export class OpenAIError extends Error {
  readonly _tag = "OpenAIError";
}

export type { PhoneData as NormalizedData };

export interface OpenAIService {
  readonly adaptScrapedData: (
    data: RawPhoneData,
  ) => Effect.Effect<PhoneData, OpenAIError>;
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

// Zod schema for Gemini structured output (must use Zod for Vercel AI SDK)
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

// Effect schema for validating AI response
const StringOrArraySchema = Schema.Union(
  Schema.String,
  Schema.Array(Schema.String),
);

const MinimalAIResponseSchema = Schema.Struct({
  displayFeatures: StringOrArraySchema,
  cameraFeatures: StringOrArraySchema,
  materials: StringOrArraySchema,
  colors: StringOrArraySchema,
  cpu: Schema.NullOr(Schema.String),
  cameras: Schema.Array(
    Schema.Struct({
      type: CameraTypeSchema,
      features: Schema.NullOr(CameraFeaturesArraySchema),
    }),
  ),
});

// Use domain Phone schema directly (shapes are identical)

const toPipeString = (value: unknown): string => {
  if (Array.isArray(value)) return value.join("|");
  if (typeof value === "string") return value;
  return "";
};

const decodePhoneData = Schema.decodeUnknown(Phone);
const decodeMinimalResponse = Schema.decodeUnknown(MinimalAIResponseSchema);

const extractFieldsForAI = (data: RawPhoneData) => ({
  displayFeatures: data.displayFeatures,
  cameraFeatures: data.cameraFeatures,
  materials: data.materials,
  colors: data.colors,
  cpu: data.cpu,
  cameras: data.cameras?.map((c) => ({ type: c.type })) ?? [],
});

const callGeminiAPI = (
  minimalData: ReturnType<typeof extractFieldsForAI>,
  slug: string,
) =>
  Effect.gen(function* () {
    const userPrompt = USER_PROMPT_TEMPLATE.replace(
      "{{DATA}}",
      JSON.stringify(minimalData),
    );
    const startTime = Date.now();
    yield* Effect.logInfo(
      `Starting normalization (~${Math.ceil(userPrompt.length / 4)} tokens)`,
    ).pipe(Effect.annotateLogs({ service: "Gemini", slug }));
    yield* Effect.logDebug(`Sending: ${JSON.stringify(minimalData)}`).pipe(
      Effect.annotateLogs({ service: "Gemini", slug }),
    );

    const response = yield* Effect.tryPromise({
      try: () =>
        generateObject({
          model: google("gemini-3-flash-preview"),
          schema: MinimalAIResponseZod,
          system: SYSTEM_PROMPT,
          prompt: userPrompt,
        }),
      catch: (error) =>
        new OpenAIError(
          `Gemini API call failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
    });

    const elapsed = Date.now() - startTime;
    yield* Effect.logInfo(
      `Completed in ${elapsed}ms (input: ${response.usage?.inputTokens}, output: ${response.usage?.outputTokens})`,
    ).pipe(Effect.annotateLogs({ service: "Gemini", slug }));
    return response.object;
  });

const validateAndMerge = (
  aiResult: Schema.Schema.Type<typeof MinimalAIResponseSchema>,
  data: RawPhoneData,
) =>
  Effect.gen(function* () {
    const originalCameras = data.cameras ?? [];

    const mergedData = {
      slug: data.slug,
      name: data.name,
      brand: data.brand,
      aliases: data.aliases,
      releaseDate: data.releaseDate,
      height_mm: data.height_mm,
      width_mm: data.width_mm,
      thickness_mm: data.thickness_mm,
      weight_g: data.weight_g,
      materials: toPipeString(aiResult.materials),
      ipRating: data.ipRating,
      colors: toPipeString(aiResult.colors),
      size_in: data.size_in,
      displayType: data.displayType,
      resolution: data.resolution,
      aspectRatio: data.aspectRatio,
      ppi: data.ppi,
      displayFeatures: toPipeString(aiResult.displayFeatures),
      cpu: aiResult.cpu,
      cpuManufacturer: data.cpuManufacturer,
      cpuCores: data.cpuCores,
      gpu: data.gpu,
      sdSlot: data.sdSlot,
      skus: data.skus,
      fingerprintPosition: data.fingerprintPosition,
      benchmarks: data.benchmarks,
      nfc: data.nfc,
      bluetooth: data.bluetooth,
      sim: data.sim,
      simCount: data.simCount,
      usb: data.usb,
      headphoneJack: data.headphoneJack,
      batteryCapacity_mah: data.batteryCapacity_mah,
      batteryFastCharging: data.batteryFastCharging,
      batteryWattage: data.batteryWattage,
      cameras: aiResult.cameras.map((aiCam, i) => ({
        resolution_mp: originalCameras[i]?.resolution_mp ?? 0,
        aperture_fstop: originalCameras[i]?.aperture_fstop ?? null,
        sensor: originalCameras[i]?.sensor ?? null,
        type: aiCam.type,
        features: aiCam.features,
      })),
      cameraFeatures: toPipeString(aiResult.cameraFeatures),
      os: data.os,
      osSkin: data.osSkin,
    };

    return yield* decodePhoneData(mergedData).pipe(
      Effect.mapError(
        (e) => new OpenAIError(`Final validation failed: ${JSON.stringify(e)}`),
      ),
    );
  });

const adaptScrapedDataImpl = (data: RawPhoneData) =>
  Effect.gen(function* () {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return yield* Effect.fail(
        new OpenAIError("GOOGLE_GENERATIVE_AI_API_KEY is not available in env"),
      );
    }

    const minimalData = extractFieldsForAI(data);
    const rawResult = yield* callGeminiAPI(minimalData, data.slug);

    const aiResult = yield* decodeMinimalResponse(rawResult).pipe(
      Effect.mapError(
        (e) => new OpenAIError(`Validation failed: ${JSON.stringify(e)}`),
      ),
    );

    const decoded = yield* validateAndMerge(aiResult, data);
    yield* Effect.logInfo("Successfully normalized data").pipe(
      Effect.annotateLogs({ service: "Gemini", slug: data.slug }),
    );
    return decoded;
  }).pipe(
    Effect.tapError((e) =>
      Effect.logWarning(`Error, will retry: ${e.message}`).pipe(
        Effect.annotateLogs({ service: "Gemini" }),
      ),
    ),
    Effect.retry(
      Schedule.exponential("1 second").pipe(
        Schedule.compose(Schedule.recurs(2)),
      ),
    ),
  );

export const OpenAIServiceLive = Layer.succeed(
  OpenAIService,
  OpenAIService.of({
    adaptScrapedData: adaptScrapedDataImpl,
  }),
);

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
