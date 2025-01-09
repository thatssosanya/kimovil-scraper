import OpenAI from "openai";
import { AutocompleteOption, PhoneData } from "../../types";
import { debugLog, withDebugLog } from "../../utils/logging";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { features } from "process";

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
  ram_gb: z.number().int(),
  marketId: z.enum(["global", "CN", "RU", "IN", "EU", "USA", "JP"]).array(),
  storage_gb: z.number().int(),
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
  ppi: z.number().int().nullable(),
  displayFeatures: z.string(),
  cpu: z.string().nullable(),
  gpu: z.string().nullable(),
  sdSlot: z.boolean().nullable(),
  skus: z.array(kimovilSkuSchema),
  nfc: z.boolean().nullable(),
  bluetooth: z.string().nullable(),
  sim: z.string(),
  usb: z.string().nullable(),
  headphoneJack: z.boolean().nullable(),
  batteryCapacity_mah: z.number().nullable(),
  batteryFastCharging: z.boolean().nullable(),
  cameras: z.array(kimovilCameraSchema),
  cameraFeatures: z.string(),
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
          content: `Your goal is to make phone data consistent with the following requirements:
        - use russian language for phone features except for the name
        - only keep features that are present in the raw data
        - make features short and concise
        - make sure that the data is consistent with the raw data
        - do not add any new features
        - only keep skus that are unique by combination of ram and storage and store region in correct field
        - write "-" for apertrure when it is unknown
        - write short cpu names: instead of	Qualcomm Snapdragon 7s Gen2 (SM-7435AB) write Qualcomm Snapdragon 7s Gen2
        - keep features relevant and omit any that seem excessive and exist in majority of phones (like multitouch, dual sim, frameless)
        - if cameras main purpose is macro, then it is macro, otherwise type should be wide angle with macro feature included
        - materials should not include glass type
        - Do NOT translate features that sound weird in russian (you should NOT translate hole-punch, dual edge display, etc)
        - Do NOT translate features that sound weird in russian (you should NOT translate hole-punch, dual edge display, etc)
        - Do NOT translate features that sound weird in russian (you should NOT translate hole-punch, dual edge display, etc)
        - Do NOT translate features that sound weird in russian (you should NOT translate hole-punch, dual edge display, etc)
        ${data.name}:\n${JSON.stringify({ ...data, raw: "" })}`,
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
