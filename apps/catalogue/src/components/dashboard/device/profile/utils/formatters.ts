export function formatDeviceValue(
  value: string | number | boolean | null,
  type: "text" | "number" | "boolean" | "select" | "textarea"
): string {
  if (value === null || value === undefined) return "—";
  
  switch (type) {
    case "boolean":
      return value ? "Да" : "Нет";
    case "number":
      return typeof value === "number" ? value.toString() : "—";
    case "text":
    case "select":
    case "textarea":
      return String(value);
    default:
      return String(value);
  }
}

export function formatPrice(price: number | null): string {
  if (price === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}