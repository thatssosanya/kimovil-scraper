export async function register() {
  console.log("[Instrumentation] register() called, NEXT_RUNTIME:", process.env.NEXT_RUNTIME);
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      console.log("[Instrumentation] Initializing scraper WebSocket...");
      const { initScrapingWS } = await import("./server/api/routers/scraping");
      await initScrapingWS();
      console.log("[Instrumentation] Scraper WebSocket initialized successfully");
    } catch (error) {
      console.error("[Instrumentation] Failed to initialize scraper WebSocket:", error);
    }
  }
}
