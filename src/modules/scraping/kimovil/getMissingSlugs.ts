import { debugLog, withDebugLog } from "../../../utils/logging.js";
import { withMock } from "../../mocks/util.js";
import {
  mockScrapeMissingSlugs,
  mockScrapeBySlug,
} from "../../mocks/kimovil.js";
import { GetMissingSlugsRequestPayload } from "../../../types/payloads.js";
import {
  createBrightDataBrowser,
  abortExtraResources,
  slugifyName,
  scoreTitleToKey,
} from "./util.js";
import { Browser } from "playwright";
import * as cheerio from "cheerio";
import { PLAYWRIGHT_TIMEOUT } from "../../../utils/consts.js";
import { Sku } from "../../../types/index.js";

export const scrapeMissingSlugs = withMock(
  mockScrapeMissingSlugs,
  withDebugLog(
    async ({
      lastPage = 1,
      targetCount = 40,
      brand,
      name,
      maxDate,
    }: GetMissingSlugsRequestPayload) => {
      let oldSlugs: string[] = [];
      // if searching by name, ignore existing slugs
      if (!name) {
        oldSlugs = await fetch(
          process.env.SCHEDULER_URL! +
            "/api/kimovil/slugs" +
            (brand ? `?brand=${brand}` : ""),
          {
            headers: {
              Authorization: `Basic ${Buffer.from(
                ":" + process.env.COD_SECRET!
              ).toString("base64")}`,
            },
          }
        )
          .then((r) => r.json())
          .then((r) => r.map((s: { slug: string }) => s.slug));
      }

      const newSlugs: {
        name: string;
        slug: string;
        rawSlug: string;
        releaseMonth: string | null;
        scores: string;
        brand?: string;
        skus: Sku[];
      }[] = [];

      // if over target count, only look at page 1; otherwise start at lastPage
      let pageNumber = oldSlugs.length >= targetCount ? 0 : lastPage - 1;
      let baseUrl =
        "https://www.kimovil.com/en/compare-smartphones/order.dm+unveiledDate";

      if (brand) {
        baseUrl += `,i_b+slug.${brand}`;
      }
      if (name) {
        baseUrl += `,name.${name}`;
      }
      if (maxDate) {
        baseUrl += `,f_min_dm+unveileddate.${maxDate}`;
      }

      while (
        oldSlugs.length >= targetCount ||
        oldSlugs.length +
          newSlugs.filter((s) => !oldSlugs.some((os) => os === s.slug)).length <
          targetCount
      ) {
        pageNumber++; // TODO simplify increment
        let browser: Browser | null = null;
        try {
          browser = await createBrightDataBrowser("getMissingSlugs");
          const page = await browser.newPage();
          await abortExtraResources(page);
          const url = `${baseUrl},page.${pageNumber}?xhr=1`;
          await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: PLAYWRIGHT_TIMEOUT,
          });
          debugLog(`Navigated to API endpoint: ${url}.`);

          const content = await page.content();
          const startIndex = content.indexOf("{");
          const endIndex = content.lastIndexOf("}");

          if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
            debugLog("Could not find valid JSON in the response. Stopping.");
            break;
          }

          const jsonString = content.substring(startIndex, endIndex + 1);
          let jsonData;
          try {
            jsonData = JSON.parse(jsonString);
          } catch (error) {
            debugLog(`Error parsing JSON: ${error}`);
            break;
          }
          if (!jsonData.content) {
            debugLog("JSON response does not contain 'content'. Stopping.");
            break;
          }

          const contentHtml = jsonData.content;
          if (contentHtml.indexOf("<") === -1) {
            debugLog(`No items found on page ${pageNumber}. Stopping.`);
            break;
          }

          const $ = cheerio.load(contentHtml);
          const elements = $(".item.smartphone");
          if (elements.length === 0) {
            debugLog(`No items found on page ${pageNumber}. Stopping.`);
            break;
          }

          for (const element of elements) {
            const name =
              $(element).find(".device-name .title").first().text().trim() ||
              "";
            const slug = slugifyName(name);
            if (!slug) {
              continue;
            }

            const encodedHref =
              $(element).find("[data-kdecode]").first().attr("data-kdecode") ||
              "";
            const href = encodedHref ? atob(encodedHref) : "";
            const rawSlug = extractSlugFromUrl(href);
            const relativeReleaseDate =
              $(element).find(".device-name .status").first().text().trim() ||
              "";
            const releaseMonth = parseRelativeDate(relativeReleaseDate);
            const scoresHtml =
              $(element)
                .find(".device-data .miniki")
                .first()
                .attr("data-minikiinfo") || "";
            const scores = parseScores(scoresHtml);

            const marketId = $(element)
              .find(".device-name .version .market")
              .first()
              .text()
              .trim();
            const [ram_gb, storage_gb] = $(element)
              .find(".device-name .version")
              .first()
              .text()
              .split("·")
              .map((t) => {
                const text = t.trim().match(/\d+(?:GB|TB)/)?.[0];
                if (!text) {
                  return 0;
                }
                const value = parseInt(text);
                return text.includes("TB") ? value * 1024 : value;
              });
            const sku: Sku = {
              marketId,
              ram_gb,
              storage_gb,
            };

            const newSlug = newSlugs.find((s) => s.slug === slug);
            if (!newSlug) {
              newSlugs.push({
                name,
                slug,
                rawSlug,
                releaseMonth,
                scores,
                brand,
                skus: [sku],
              });
            } else {
              newSlug.skus.push(sku);
            }
          }

          debugLog(
            `Total ${
              newSlugs.filter((s) => !oldSlugs.some((os) => os === s.slug))
                .length
            } new slugs after processing page ${pageNumber}.`
          );

          // if over target count, only get newly added slugs
          if (
            oldSlugs.length >= targetCount &&
            oldSlugs.some((s) => newSlugs.some((ns) => ns.slug === s))
          ) {
            debugLog(`Found existing slug. Stopping.`);
            break;
          }
        } catch (e) {
          throw e;
        } finally {
          await browser?.close();
        }
      }

      return {
        slugs: newSlugs,
        brand,
        lastPage: oldSlugs.length >= targetCount ? lastPage : pageNumber,
      };
    },
    "scrapeMissingSlugs"
  )
);

const extractSlugFromUrl = (url: string): string => {
  if (!url) return "";
  const dirtySegment = url.split("/").pop();
  const dirtySlug = dirtySegment?.replace("where-to-buy-", "").split("#")[0];
  return dirtySlug || "";
};

const parseRelativeDate = (relativeDateString: string): string | null => {
  const now = new Date();
  const parts = relativeDateString.trim().split(/\s+/);

  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();

  if (parts[0] === "New") {
    const formattedMonth = (month + 1).toString().padStart(2, "0");
    return `${year}-${formattedMonth}`;
  }
  if (["Rumor", "Presell"].includes(parts[0])) {
    return parts[0];
  }

  const value = parseInt(parts[0]);
  const unit = parts[1];

  if (isNaN(value) || value <= 0) {
    return null;
  }

  if (unit.startsWith("year")) {
    year -= value;
  } else if (unit.startsWith("month")) {
    month -= value;
    while (month < 0) {
      month += 12;
      year--;
    }
  } else {
    return null;
  }

  const formattedMonth = (month + 1).toString().padStart(2, "0");
  return `${year}-${formattedMonth}`;
};

const parseScores = (html: string): string => {
  const scoreMap: Record<string, string> = {};

  const $ = cheerio.load(html);
  const scores = $("li");

  scores.each((i, element) => {
    const score = $(element).find(".score").first().text().trim();
    const title = $(element).find(".title").first().text().trim();

    if (!score) {
      return;
    }

    const key = scoreTitleToKey(title);
    if (key) {
      scoreMap[key] = score;
    }
  });

  const scoreString = Object.entries(scoreMap)
    .map(([key, value]) => `${key}=${value}`)
    .join("|");

  return scoreString;
};
