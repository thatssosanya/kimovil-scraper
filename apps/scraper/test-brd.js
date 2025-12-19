#!/usr/bin/env node
const playwright = require('playwright');

const AUTH = 'brd-customer-hl_16d88626-zone-catalogue_scraper:7gxj0v6sf6uq';
const TARGET_URL = 'https://example.com';

async function scrape(url = TARGET_URL) {
    console.log(`Connecting to Browser...`);
    const endpointURL = `wss://${AUTH}@brd.superproxy.io:9222`;
    const browser = await playwright.chromium.connectOverCDP(endpointURL);
    try {
        console.log(`Connected! Navigating to ${url}...`);
        const page = await browser.newPage();
        await page.goto(url, { timeout: 2 * 60 * 1000 });
        console.log(`Navigated! Getting title...`);
        const title = await page.title();
        console.log(`Page title: ${title}`);
    } finally {
        console.log(`Closing session.`);
        await browser.close();
    }
}

scrape().catch(error => {
    console.error(error.stack || error.message || error);
    process.exit(1);
});
