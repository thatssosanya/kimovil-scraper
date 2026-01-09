const API_BASE = "http://localhost:1488";

/**
 * Fetch wrapper that includes credentials for auth cookies
 */
export async function apiFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  return fetch(url, {
    ...options,
    credentials: "include",
  });
}
