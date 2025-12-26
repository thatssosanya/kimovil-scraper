import WebSocket from "ws";
import { logger } from "../logger";
import {
  ConnectionState,
  RECONNECT_CONFIG,
  type Response,
  type ErrorResponse,
  type StreamEvent,
  type PendingRequest,
  type ScraperEvent,
} from "./types";

type MessageHandler = (id: string, data: unknown) => void;

declare global {
  // eslint-disable-next-line no-var
  var _scraperWSConnectionInstance: ScraperWSConnection | undefined;
}

export class ScraperWSConnection {
  private ws: WebSocket | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private url: string;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private messageHandlers: Map<string, MessageHandler> = new Map();

  private constructor(url: string) {
    this.url = url;
  }

  static getInstance(url?: string): ScraperWSConnection {
    if (!globalThis._scraperWSConnectionInstance) {
      if (!url) {
        throw new Error("URL required for first ScraperWSConnection initialization");
      }
      globalThis._scraperWSConnectionInstance = new ScraperWSConnection(url);
    }
    return globalThis._scraperWSConnectionInstance;
  }

  async connect(): Promise<void> {
    if (this.state === ConnectionState.CONNECTED) {
      return;
    }

    if (this.state === ConnectionState.CONNECTING) {
      return this.waitForConnection();
    }

    this.state = ConnectionState.CONNECTING;
    logger.info(`Connecting to scraper WebSocket at ${this.url}`);

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on("open", () => {
          this.state = ConnectionState.CONNECTED;
          this.reconnectAttempts = 0;
          logger.info("Scraper WebSocket connected");
          resolve();
        });

        this.ws.on("message", (data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on("close", () => {
          logger.warn("Scraper WebSocket closed");
          this.handleDisconnect();
        });

        this.ws.on("error", (error) => {
          logger.error("Scraper WebSocket error", error);
          if (this.state === ConnectionState.CONNECTING) {
            reject(error);
          }
        });
      } catch (error) {
        this.state = ConnectionState.DISCONNECTED;
        reject(error);
      }
    });
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (this.state === ConnectionState.CONNECTED) {
          clearInterval(checkInterval);
          resolve();
        } else if (this.state === ConnectionState.DISCONNECTED) {
          clearInterval(checkInterval);
          reject(new Error("Connection failed"));
        }
      }, 100);
    });
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as Response | ErrorResponse | StreamEvent;
      const id = message.id;

      if ("event" in message) {
        const pending = this.pendingRequests.get(id);
        if (pending?.onEvent) {
          pending.onEvent(message.event as ScraperEvent);
        }
        return;
      }

      if ("error" in message) {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          clearTimeout(pending.timeoutHandle);
          this.pendingRequests.delete(id);
          pending.reject(new Error(`${message.error.code}: ${message.error.message}`));
        }
        return;
      }

      if ("result" in message) {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          clearTimeout(pending.timeoutHandle);
          this.pendingRequests.delete(id);
          pending.resolve(message.result);
        }
        return;
      }
    } catch (error) {
      logger.error("Failed to parse WebSocket message", error);
    }
  }

  private handleDisconnect(): void {
    const wasConnected = this.state === ConnectionState.CONNECTED;
    this.state = ConnectionState.DISCONNECTED;
    this.ws = null;

    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeoutHandle);
      pending.reject(new Error("Connection lost"));
      this.pendingRequests.delete(id);
    }

    if (wasConnected) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }

    const delay = Math.min(
      RECONNECT_CONFIG.initialDelay * Math.pow(RECONNECT_CONFIG.multiplier, this.reconnectAttempts),
      RECONNECT_CONFIG.maxDelay
    );

    this.state = ConnectionState.RECONNECTING;
    this.reconnectAttempts++;

    logger.info(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      try {
        await this.connect();
      } catch (error) {
        logger.error("Reconnect failed", error);
        this.scheduleReconnect();
      }
    }, delay);
  }

  sendRequest(
    method: string,
    params: unknown,
    timeout: number,
    onEvent?: (event: ScraperEvent) => void
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (this.state !== ConnectionState.CONNECTED || !this.ws) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      const id = crypto.randomUUID();

      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeout);

      this.pendingRequests.set(id, {
        resolve,
        reject,
        onEvent,
        timeoutHandle,
      });

      const request = { id, method, params };
      this.ws.send(JSON.stringify(request));
    });
  }

  isReady(): boolean {
    return this.state === ConnectionState.CONNECTED && this.ws !== null;
  }

  getState(): ConnectionState {
    return this.state;
  }

  async gracefulShutdown(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeoutHandle);
      pending.reject(new Error("Shutting down"));
      this.pendingRequests.delete(id);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.state = ConnectionState.DISCONNECTED;
    logger.info("Scraper WebSocket connection shut down");
  }
}
