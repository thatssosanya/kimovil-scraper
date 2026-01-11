import type {
  YandexPreviewParams,
  YandexPreviewResult,
  YandexCreateDeviceParams,
  YandexCreateDeviceResult,
} from "@repo/scraper-protocol";

const WS_URL = "ws://localhost:1488/ws";

interface WsResponse<T> {
  id: string;
  result?: T;
  error?: { message: string };
}

function sendWsRequest<TParams, TResult>(
  method: string,
  params: TParams,
): Promise<TResult> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const requestId = crypto.randomUUID();

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: requestId, method, params }));
    };

    ws.onmessage = (event) => {
      const data: WsResponse<TResult> = JSON.parse(event.data);
      if (data.id === requestId) {
        if (data.error) {
          reject(new Error(data.error.message));
        } else if (data.result) {
          resolve(data.result);
        }
        ws.close();
      }
    };

    ws.onerror = () => {
      reject(new Error("WebSocket connection error"));
      ws.close();
    };
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
