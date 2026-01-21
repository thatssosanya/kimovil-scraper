import { chromium } from "playwright";

const URL = "https://www.kimovil.com/en/compare-smartphones/order.dm+unveiledDate";

async function inspect() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  console.log("Navigating to compare page...");
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Check for device links
  const deviceLinks = await page.$$eval("a.device-link", (els) => els.length);
  console.log(`Found ${deviceLinks} device links with selector "a.device-link"`);

  // Check alternative selectors
  const altSelectors = [
    ".device-card",
    ".device-item",
    ".phone-card",
    "[data-device]",
    ".compare-item",
    ".result-item",
    "a[href*='where-to-buy']",
  ];

  for (const sel of altSelectors) {
    const count = await page.$$eval(sel, (els) => els.length).catch(() => 0);
    if (count > 0) {
      console.log(`Found ${count} elements with selector "${sel}"`);
    }
  }

  // Check page structure
  console.log("\n--- Page structure analysis ---");
  
  // Find scrollable containers
  const scrollableContainers = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll("*").forEach((el) => {
      const style = getComputedStyle(el);
      if (
        (style.overflowY === "scroll" || style.overflowY === "auto") &&
        el.scrollHeight > el.clientHeight
      ) {
        const id = el.id ? `#${el.id}` : "";
        const cls = el.className ? `.${el.className.split(" ").join(".")}` : "";
        results.push(`${el.tagName}${id}${cls} (scrollHeight: ${el.scrollHeight})`);
      }
    });
    return results.slice(0, 10);
  });
  console.log("Scrollable containers:", scrollableContainers);

  // Check for load more button
  const loadMoreSelectors = [
    "button:has-text('Load more')",
    "button:has-text('Show more')",
    "button:has-text('More')",
    ".load-more",
    ".show-more",
    "[data-load-more]",
  ];
  
  for (const sel of loadMoreSelectors) {
    const exists = await page.$(sel).catch(() => null);
    if (exists) {
      console.log(`Found load more button: "${sel}"`);
    }
  }

  // Check for infinite scroll trigger element
  const infiniteScrollIndicators = await page.evaluate(() => {
    const indicators: string[] = [];
    // Look for sentinel/observer elements
    document.querySelectorAll("[class*='sentinel'], [class*='observer'], [class*='infinite'], [class*='loader']").forEach((el) => {
      indicators.push(`${el.tagName}.${el.className}`);
    });
    return indicators;
  });
  if (infiniteScrollIndicators.length > 0) {
    console.log("Infinite scroll indicators:", infiniteScrollIndicators);
  }

  // Try scrolling and observe what happens
  console.log("\n--- Testing scroll behavior ---");
  const beforeCount = await page.$$eval("a[href*='where-to-buy']", (els) => els.length);
  console.log(`Before scroll: ${beforeCount} device links`);

  // Method 1: Window scroll
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
  const afterWindowScroll = await page.$$eval("a[href*='where-to-buy']", (els) => els.length);
  console.log(`After window.scrollTo: ${afterWindowScroll} device links`);

  // Method 2: Scroll into view of last element
  await page.evaluate(() => {
    const links = document.querySelectorAll("a[href*='where-to-buy']");
    if (links.length > 0) {
      links[links.length - 1].scrollIntoView({ behavior: "smooth", block: "end" });
    }
  });
  await page.waitForTimeout(2000);
  const afterScrollIntoView = await page.$$eval("a[href*='where-to-buy']", (els) => els.length);
  console.log(`After scrollIntoView last element: ${afterScrollIntoView} device links`);

  // Method 3: Scroll the main content container if exists
  await page.evaluate(() => {
    const main = document.querySelector("main") || document.querySelector(".main-content") || document.body;
    main.scrollTop = main.scrollHeight;
  });
  await page.waitForTimeout(2000);
  const afterMainScroll = await page.$$eval("a[href*='where-to-buy']", (els) => els.length);
  console.log(`After main container scroll: ${afterMainScroll} device links`);

  // Method 4: Multiple smooth scrolls
  console.log("\nTrying multiple gradual scrolls...");
  for (let i = 0; i < 3; i++) {
    await page.evaluate((iteration) => {
      window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
    }, i);
    await page.waitForTimeout(1500);
    const count = await page.$$eval("a[href*='where-to-buy']", (els) => els.length);
    console.log(`After gradual scroll ${i + 1}: ${count} device links`);
  }

  console.log("\n--- Keeping browser open for manual inspection ---");
  console.log("Press Ctrl+C to exit");
  
  // Keep browser open for manual inspection
  await new Promise(() => {});
}

inspect().catch(console.error);
