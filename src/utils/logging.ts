export const debugLog = (...args: unknown[]) => {
  if (process.env.ENV === "development") {
    console.log("[DEBUG]", ...args);
  }
};

export const errorLog = (...args: unknown[]) => {
  console.error("[ERROR]", ...args);
};

export const withDebugLog = <Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  tag?: string
): ((...args: Args) => Promise<R>) => {
  return async (...args: Args) => {
    const result = await fn(...args);
    const logArguments: Array<unknown> = tag ? [`[${tag}]`] : [];

    logArguments.push(JSON.stringify(removeRaw(result)));

    debugLog(...logArguments);
    return result;
  };
};

export const removeRaw = (value: unknown): unknown => {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => removeRaw(item));
  }

  const { raw, ...rest } = value as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(rest)) {
    cleaned[key] = removeRaw(val);
  }

  return cleaned;
};
