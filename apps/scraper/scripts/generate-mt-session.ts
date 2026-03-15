import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

// Make script pick up apps/scraper/.env when values are not exported in shell.
loadEnv({ path: path.resolve(scriptDir, "../.env") });

const parseArgValue = (name: string): string | undefined => {
  const index = process.argv.findIndex((arg) => arg === name);
  if (index === -1) {
    return undefined;
  }

  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    return undefined;
  }

  return value.trim();
};

const normalizeApiId = (raw: string): number | null => {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const promptRequired = async (
  rl: readline.Interface,
  prompt: string,
  fallback?: string,
): Promise<string> => {
  if (fallback && fallback.trim().length > 0) {
    return fallback.trim();
  }

  while (true) {
    const value = (await rl.question(prompt)).trim();
    if (value.length > 0) {
      return value;
    }
    console.error("Value is required.");
  }
};

const main = async (): Promise<void> => {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  let client: TelegramClient | null = null;

  try {
    const apiIdRaw =
      parseArgValue("--api-id") ?? process.env.TELEGRAM_API_ID ?? "";
    const apiHashRaw =
      parseArgValue("--api-hash") ?? process.env.TELEGRAM_API_HASH ?? "";
    const phoneRaw =
      parseArgValue("--phone") ?? process.env.TELEGRAM_PHONE ?? "";

    const apiIdInput = await promptRequired(
      rl,
      "Telegram API ID (from my.telegram.org): ",
      apiIdRaw,
    );
    const apiId = normalizeApiId(apiIdInput);
    if (!apiId) {
      throw new Error("Invalid API ID. Expected a positive integer.");
    }

    const apiHash = await promptRequired(
      rl,
      "Telegram API Hash (from my.telegram.org): ",
      apiHashRaw,
    );
    const phone = await promptRequired(
      rl,
      "Phone number in international format (e.g. +79991234567): ",
      phoneRaw,
    );

    client = new TelegramClient(new StringSession(""), apiId, apiHash, {
      connectionRetries: 5,
    });

    await client.start({
      phoneNumber: async () => phone,
      phoneCode: async () => promptRequired(rl, "Code from Telegram app/SMS: "),
      password: async () =>
        (
          await rl.question(
            "2FA password (if enabled, otherwise press Enter): ",
          )
        ).trim(),
      onError: (error) => {
        console.error("Telegram auth error:", error);
      },
    });

    const session = client.session.save();

    console.log("\nSession generated successfully.");
    console.log("Add these values to apps/scraper/.env:\n");
    console.log(`TELEGRAM_API_ID=${apiId}`);
    console.log(`TELEGRAM_API_HASH=${apiHash}`);
    console.log(`TELEGRAM_MT_SESSION=${session}`);
  } finally {
    if (client) {
      await client.disconnect();
    }
    rl.close();
  }
};

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to generate TELEGRAM_MT_SESSION: ${message}`);
  process.exit(1);
});
