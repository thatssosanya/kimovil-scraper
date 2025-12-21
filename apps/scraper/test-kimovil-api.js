import { chromium } from "playwright";
const main = async () => {
    const browser = await chromium.launch({
        headless: false,
        args: ['--disable-blink-features=AutomationControlled']
    });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();
    // Hide webdriver flag
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    // First visit the main site to pass Cloudflare
    console.log("Visiting main site to pass CF challenge...");
    await page.goto("https://www.kimovil.com/en/", { waitUntil: "domcontentloaded", timeout: 30000 });
    // Wait for actual page content (not CF challenge)
    await page.waitForSelector('input, .search, [data-search]', { timeout: 15000 }).catch(() => { });
    await page.waitForTimeout(2000);
    // Fetch all 3 smartphone sitemaps and count
    let totalUrls = 0;
    for (let i = 1; i <= 3; i++) {
        console.log(`Fetching sitemap ${i}...`);
        const xml = await page.evaluate(async (num) => {
            const res = await fetch(`https://www.kimovil.com/en/sitemaps/sitemap-datasheets-smartphones-${num}.en.xml`);
            return res.text();
        }, i);
        const count = (xml.match(/<url>/g) || []).length;
        console.log(`Sitemap ${i}: ${count} devices`);
        totalUrls += count;
    }
    console.log(`\n=== TOTAL DEVICES IN KIMOVIL: ${totalUrls} ===`);
    await browser.close();
};
main().catch(console.error);
