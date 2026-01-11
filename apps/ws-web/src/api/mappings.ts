import type { WidgetMapping } from "../pages/widgets/WidgetDebug.types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:1488";

export async function getMappingById(id: number): Promise<WidgetMapping | null> {
  const res = await fetch(`${API_BASE}/api/widget-mappings/by-id/${id}`, {
    credentials: "include",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch mapping: ${res.status}`);
  return res.json();
}
