import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://market.yandex.ru/product--besprovodnyye-naushniki-oneplus-buds-4-e513a/4567728376', { 
    waitUntil: 'networkidle',
    timeout: 60000 
  });
  await page.waitForTimeout(5000);
  
  // Save the HTML for debugging
  const html = await page.content();
  console.log('Page HTML length:', html.length);
  console.log('Contains Product schema:', html.includes('"@type":"Product"') || html.includes('"@type": "Product"'));
  
  // Extract all ld+json scripts
  const ldJsonScripts = await page.$$eval('script[type="application/ld+json"]', scripts => {
    return scripts.map((s, i) => ({
      index: i,
      content: s.textContent,
      parentTagName: s.parentElement?.tagName,
      isInHead: s.closest('head') !== null,
    }));
  });
  
  console.log('Found', ldJsonScripts.length, 'LD+JSON blocks\n');
  
  for (const script of ldJsonScripts) {
    try {
      const parsed = JSON.parse(script.content!);
      console.log('--- Block', script.index, '---');
      console.log('Location: In HEAD:', script.isInHead, '| Parent:', script.parentTagName);
      console.log('@type:', parsed['@type']);
      if (parsed['@type'] === 'Product') {
        console.log('name:', parsed.name?.substring(0, 80));
        console.log('url:', parsed.url);
        console.log('offers:', parsed.offers ? 'YES' : 'NO');
        console.log('aggregateRating:', parsed.aggregateRating ? 'YES' : 'NO');
        console.log('review:', parsed.review ? 'YES (' + (Array.isArray(parsed.review) ? parsed.review.length : 1) + ')' : 'NO');
        if (parsed.offers) {
          const offers = Array.isArray(parsed.offers) ? parsed.offers : [parsed.offers];
          console.log('offers count:', offers.length);
          console.log('first offer price:', offers[0]?.price);
        }
      }
      console.log('');
    } catch (e) {
      console.log('--- Block', script.index, '(parse error) ---');
    }
  }
  
  await browser.close();
})();
