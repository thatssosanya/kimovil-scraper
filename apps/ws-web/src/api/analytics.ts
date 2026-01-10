const ANALYTICS_LOCAL = import.meta.env.VITE_ANALYTICS_URL ?? "http://localhost:1489";
const ANALYTICS_PROD = import.meta.env.VITE_ANALYTICS_PROD_URL ?? "https://api.click-or-die.ru";
const ANALYTICS_API_KEY = import.meta.env.VITE_ANALYTICS_API_KEY ?? "";

export type AnalyticsEnv = "local" | "prod";

let currentEnv: AnalyticsEnv = "prod";

export const setAnalyticsEnv = (env: AnalyticsEnv) => {
  currentEnv = env;
};

export const getAnalyticsEnv = () => currentEnv;

const getBaseUrl = () => (currentEnv === "prod" ? ANALYTICS_PROD : ANALYTICS_LOCAL);

const getHeaders = (): HeadersInit => {
  const headers: HeadersInit = {};
  if (currentEnv === "prod" && ANALYTICS_API_KEY) {
    headers["Authorization"] = `Bearer ${ANALYTICS_API_KEY}`;
  }
  return headers;
};

export interface MappingImpressions {
  mappingId: number;
  impressions: number;
  clicks: number;
}

export interface PostImpressions {
  postId: number;
  impressions: number;
  clicks: number;
}

export async function getMappingStats(
  mappingIds: number[],
  from?: Date,
  to?: Date
): Promise<MappingImpressions[]> {
  if (mappingIds.length === 0) return [];

  const params = new URLSearchParams();
  params.set("from", (from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).toISOString());
  params.set("to", (to ?? new Date()).toISOString());

  const response = await fetch(`${getBaseUrl()}/v1/stats/widgets?${params}`, {
    headers: getHeaders(),
  });
  if (!response.ok) {
    console.error("Failed to fetch mapping stats:", response.status);
    return [];
  }

  const json = await response.json();
  const data = json.data as Array<{
    mapping_id: number;
    widget_impressions: number;
    widget_clicks: number;
  }>;

  // Filter to only requested mapping IDs
  const idSet = new Set(mappingIds);
  return data
    .filter((row) => idSet.has(row.mapping_id))
    .map((row) => ({
      mappingId: row.mapping_id,
      impressions: row.widget_impressions,
      clicks: row.widget_clicks,
    }));
}

export async function getPostStats(
  postIds: number[],
  from?: Date,
  to?: Date
): Promise<PostImpressions[]> {
  if (postIds.length === 0) return [];

  const params = new URLSearchParams();
  params.set("from", (from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).toISOString());
  params.set("to", (to ?? new Date()).toISOString());

  const response = await fetch(`${getBaseUrl()}/v1/stats/posts?${params}`, {
    headers: getHeaders(),
  });
  if (!response.ok) {
    console.error("Failed to fetch post stats:", response.status);
    return [];
  }

  const json = await response.json();
  const data = json.data as Array<{
    post_id: number;
    widget_impressions: number;
    widget_clicks: number;
  }>;

  // Filter to only requested post IDs
  const idSet = new Set(postIds);
  return data
    .filter((row) => idSet.has(row.post_id))
    .map((row) => ({
      postId: row.post_id,
      impressions: row.widget_impressions,
      clicks: row.widget_clicks,
    }));
}
