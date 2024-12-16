import OpenAI from "openai";
import { AutocompleteOption, PhoneData } from "../../types";
import { debugLog } from "../../utils/logging";

export const createOpenaiClient = () => {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not available in env.");
  }

  const openaiClient = new OpenAI({ apiKey: openaiApiKey });

  debugLog(`Initialized OpenAI client.`);

  return openaiClient;
};

export const adaptScrapedData = async (data: PhoneData): Promise<any> => {
  const openaiClient = createOpenaiClient();

  return data;
};

export const pickMatchingSlug = async (
  name: string,
  options: AutocompleteOption[]
): Promise<string> => {
  if (options.length === 0) {
    throw new Error("No autocomplete options available.");
  }
  if (options.length === 1) {
    return options[0].slug;
  }

  const openaiClient = createOpenaiClient();

  const optionList = options
    .map(
      (opt, i) => `Option ${i + 1}: Name=\`${opt.name}\`, Slug=\`${opt.slug}\``
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
    throw new Error(`OpenAI returned slug "${content}" not found in options.`);
  }

  return picked.slug;
};
