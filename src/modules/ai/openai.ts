import OpenAI from "openai";
import { AutocompleteOption, PhoneData } from "../../types";
import { debugLog, withDebugLog } from "../../utils/logging";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

export const createOpenaiClient = () => {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not available in env.");
  }

  const openaiClient = new OpenAI({ apiKey: openaiApiKey });

  debugLog(`Initialized OpenAI client.`);

  return openaiClient;
};

type AnyObject = { [key: string]: any };

export const convertArraysToPipeDelimited = (obj: AnyObject): AnyObject => {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  const result: AnyObject = {};

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      // Check if array contains only strings
      if (value.every((item) => typeof item === "string")) {
        result[key] = value.join("|");
      } else {
        // If array contains objects, recursively process each item
        result[key] = value.map((item) => convertArraysToPipeDelimited(item));
      }
    } else if (typeof value === "object") {
      // Recursively process nested objects
      result[key] = convertArraysToPipeDelimited(value);
    } else {
      result[key] = value;
    }
  }

  return result;
};

const kimovilCameraSchema = z.object({
  resolution_mp: z.number(),
  aperture_fstop: z.string(),
  sensor: z.string().nullable(),
  features: z.enum(["macro", "monochrome"]).array().optional(),
  type: z.enum([
    "ширик",
    "зум",
    "основная",
    "фронтальная",
    "lidar",
    "макро",
    "инфракрасная",
  ]),
});

const kimovilSkuSchema = z.object({
  marketId: z.string(),
  ram_gb: z.number().int(),
  storage_gb: z.number().int(),
});

const benchmarkSchema = z.object({
  name: z.string(),
  score: z.number(),
});

const kimovilDataSchema = z.object({
  deviceId: z.string(),
  slug: z.string(),
  name: z.string(),
  brand: z.string(),
  aliases: z.string(),
  releaseDate: z
    .string()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  height_mm: z.number().nullable(),
  width_mm: z.number().nullable(),
  thickness_mm: z.number().nullable(),
  weight_g: z.number().nullable(),
  materials: z.string(),
  ipRating: z.string().nullable(),
  colors: z.string(),
  size_in: z.number().nullable(),
  displayType: z.string().nullable(),
  resolution: z.string().nullable(),
  aspectRatio: z.string().nullable(),
  ppi: z.number().int().nullable(),
  displayFeatures: z.string(),
  cpu: z.string().nullable(),
  cpuManufacturer: z.string().nullable(),
  cpuCores: z.string().nullable(),
  gpu: z.string().nullable(),
  sdSlot: z.boolean().nullable(),
  skus: z.array(kimovilSkuSchema),
  fingerprintPosition: z.enum(["screen", "side", "back"]).nullable(),
  benchmarks: z.array(benchmarkSchema),
  nfc: z.boolean().nullable(),
  bluetooth: z.string().nullable(),
  sim: z.string(),
  simCount: z.number(),
  usb: z.enum(["USB-C", "Lightning"]).nullable(),
  headphoneJack: z.boolean().nullable(),
  batteryCapacity_mah: z.number().nullable(),
  batteryFastCharging: z.boolean().nullable(),
  batteryWattage: z.number().nullable(),
  cameras: z.array(kimovilCameraSchema),
  cameraFeatures: z.string(),
  os: z.string().nullable(),
  osSkin: z.string().nullable(),
});

export const adaptScrapedData = async (data: PhoneData) => {
  const openaiClient = createOpenaiClient();

  try {
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that is knowledgeable about phones.",
        },
        {
          role: "user",
          /*
TODO:

add raw
- double-check that all features match the raw data
*/
          content: `Your goal is to make phone data consistent with the following requirements:
        - keep the lists of features, i.e. \`displayFeatures\` and \`cameraFeatures\`, informative. omit features that exist in the majority of phones, e.g. multitouch, dual sim, frameless, etc.
        - do not add any new features
        - translate the names of features, as well as the names of \`materials\` and \`colors\`, to russian
        - do not translate features that sound nonsensical in russian such as "hole-punch notch", "dual edge display", etc. leave these as is
        - excluse glass type from \`materials\` if present
        - keep translated names short and concise
        - make sure \`cpu\` is concise, e.g. you should replace "Snapdragon 7s Gen2 (SM-7435AB)" with "Snapdragon 7s Gen2"
        - for \`cameras\`, pick a type that best matches the input type
        - if a camera's primary type is macro, put the type as macro and don't put macro in features. if the primary type is not macro, but macro is mentioned in the type, such as in a "Wide Angle + Macro" type, add macro as a feature
        \`\`\`
        ${JSON.stringify({ ...data, raw: "" })}
        \`\`\``,
        },
      ],
      temperature: 0.5,
      response_format: zodResponseFormat(kimovilDataSchema, "json_schema"),
      max_tokens: 8024,
    });
    debugLog(response);
    return convertArraysToPipeDelimited(
      JSON.parse(response.choices[0].message.content?.trim() || "")
    );
  } catch (e) {
    debugLog(e);
    throw e;
  }
};

export const pickMatchingSlug = withDebugLog(
  async (name: string, options: AutocompleteOption[]): Promise<string> => {
    if (options.length === 0) {
      throw new Error("No autocomplete options available.");
    }
    if (options.length === 1) {
      return options[0].slug;
    }

    const openaiClient = createOpenaiClient();

    const optionList = options
      .map(
        (opt, i) =>
          `Option ${i + 1}: Name=\`${opt.name}\`, Slug=\`${opt.slug}\``
      )
      .join("\n");
    const systemPrompt = `You are a helpful assistant that picks the best matching smartphone name from a list.`;
    const userPrompt =
      "Given the input name: `" +
      name +
      "` and the following options:" +
      "\n```\n" +
      optionList +
      "\n```\n" +
      "Pick the single option that best matches the input name. Reply with just the slug of the chosen option.";

    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 50,
      temperature: 0.0,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("No response from OpenAI.");
    }

    const picked = options.find((opt) => opt.slug === content);
    if (!picked) {
      throw new Error(
        `OpenAI returned slug "${content}" not found in options.`
      );
    }

    return picked.slug;
  }
);
