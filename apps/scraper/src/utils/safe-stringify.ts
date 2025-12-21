export const safeStringify = (data: unknown): string => {
  try {
    return JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );
  } catch {
    try {
      return String(data);
    } catch {
      return `[Unserializable: ${typeof data}]`;
    }
  }
};
