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
    const logArguments: Array<string | R> = tag ? [tag] : [];
    logArguments.push(result);
    debugLog(JSON.stringify(logArguments));
    return result;
  };
};
