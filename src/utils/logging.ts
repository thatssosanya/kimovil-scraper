export const debugLog = (...args: unknown[]) => {
  if (process.env.ENV === "development") {
    console.log("[DEBUG]", ...args);
  }
};

export const errorLog = (...args: unknown[]) => {
  console.error("[ERROR]", ...args);
};

export const withDebugLog = <Args extends unknown[], R>(
  fn: (...args: Args) => R,
  tag?: string
): ((...args: Args) => R) => {
  return (...args: Args) => {
    const result = fn(...args);
    const logArguments: Array<string | R> = tag ? [tag] : [];
    logArguments.push(result);
    debugLog(...logArguments);
    return result;
  };
};
