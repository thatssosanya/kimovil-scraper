export const debugLog = (...args: any[]) => {
  if (process.env.ENV === "development") {
    console.log("[DEBUG]", ...args);
  }
};
