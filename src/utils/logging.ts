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
    const results = Array.isArray(result) ? result : [result];
    for (const result of results) {
      if (typeof result === "object" && result !== null && "raw" in result) {
        const { raw, ...cleanResult } = result;
        logArguments.push(JSON.stringify(cleanResult));
      } else {
        logArguments.push(JSON.stringify(result));
      }
    }
    debugLog(...logArguments);
    return result;
  };
};
