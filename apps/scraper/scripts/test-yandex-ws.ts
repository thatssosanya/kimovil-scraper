#!/usr/bin/env npx tsx
/**
 * Test Yandex scraping through WebSocket to verify cookie injection works
 */

import WebSocket from "ws";

const TEST_URL = "https://market.yandex.ru/card/smartfon-apple-iphone-14-pro-256gb-dual-nano-sim--esim-fioletovyy-bez-rustore/4805374145";

async function main() {
  const ws = new WebSocket("ws://localhost:1488/ws");
  const requestId = "test-" + Date.now();

  ws.on("open", () => {
    console.log("Connected to WebSocket");
    console.log(`Sending yandex.scrape request for: ${TEST_URL}`);
    
    ws.send(JSON.stringify({
      id: requestId,
      method: "yandex.scrape",
      params: {
        url: TEST_URL,
        deviceId: "test-device",
      },
    }));
  });

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    
    if (msg.event) {
      console.log(`Event: ${msg.event.type} - ${msg.event.stage || ""} ${msg.event.percent || ""}%`);
    }
    
    if (msg.result) {
      console.log("\n=== Result ===");
      console.log(JSON.stringify(msg.result, null, 2));
      ws.close();
    }
    
    if (msg.error) {
      console.error("\n=== Error ===");
      console.error(msg.error);
      ws.close();
    }
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });

  ws.on("close", () => {
    console.log("Connection closed");
    process.exit(0);
  });
}

main().catch(console.error);
