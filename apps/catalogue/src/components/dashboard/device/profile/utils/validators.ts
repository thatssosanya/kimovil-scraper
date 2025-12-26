export function validateField(
  value: unknown,
  type: "text" | "number" | "boolean" | "select" | "textarea",
  required = false
): string | null {
  if (required && (value === null || value === undefined || value === "")) {
    return "This field is required";
  }

  if (value === null || value === undefined || value === "") {
    return null;
  }

  switch (type) {
    case "number":
      if (typeof value !== "number" && isNaN(Number(value))) {
        return "Must be a valid number";
      }
      break;
    case "text":
    case "textarea":
      if (typeof value !== "string") {
        return "Must be a valid text";
      }
      break;
  }

  return null;
}

export function validateRequired(value: unknown): string | null {
  return value === null || value === undefined || value === "" 
    ? "This field is required" 
    : null;
}