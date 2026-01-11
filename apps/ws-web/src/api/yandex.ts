import type {
  YandexPreviewParams,
  YandexPreviewResult,
  YandexCreateDeviceParams,
  YandexCreateDeviceResult,
} from "@repo/scraper-protocol";

// TODO: Use env variable for production
const WS_URL = import.meta.env.VITE_SCRAPER_WS_URL ?? "ws://localhost:1488/ws";

interface WsResponse<T> {
  id: string;
  result?: T;
  error?: { message: string };
  event?: unknown; // StreamEvent - progress/logs
}

function sendWsRequest<TParams, TResult>(
  method: string,
  params: TParams,
): Promise<TResult> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const requestId = crypto.randomUUID();
    let settled = false;

    const cleanup = () => {
      settled = true;
      try {
        ws.close();
      } catch {
        // ignore
      }
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: requestId, method, params }));
    };

    ws.onmessage = (event) => {
      let data: WsResponse<TResult>;
      try {
        data = JSON.parse(event.data);
      } catch {
        return; // Ignore malformed messages
      }

      if (data.id !== requestId) return;

      // Stream events (progress/log/etc.) - ignore, keep socket open
      if ("event" in data && data.event) {
        return;
      }

      // Final response
      if (data.error) {
        if (!settled) {
          reject(new Error(data.error.message ?? "Unknown error"));
          cleanup();
        }
      } else if ("result" in data && data.result !== undefined) {
        if (!settled) {
          resolve(data.result);
          cleanup();
        }
      }
    };

    ws.onerror = () => {
      if (!settled) {
        reject(new Error("WebSocket connection error"));
        cleanup();
      }
    };

    ws.onclose = () => {
      if (!settled) {
        reject(new Error("WebSocket closed before response"));
        settled = true;
      }
    };

    // Hard timeout - 90s for scraping operations
    setTimeout(() => {
      if (!settled) {
        reject(new Error("Request timed out"));
        cleanup();
      }
    }, 90_000);
  });
}

export function previewYandexSpecs(
  params: YandexPreviewParams,
): Promise<YandexPreviewResult> {
  return sendWsRequest("yandex.previewSpecs", params);
}

export function createDeviceFromYandex(
  params: YandexCreateDeviceParams,
): Promise<YandexCreateDeviceResult> {
  return sendWsRequest("yandex.createDeviceFromPreview", params);
}
