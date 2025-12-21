export const safeParseJson = (data: string): unknown | null => {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};
