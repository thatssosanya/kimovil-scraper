import { abortExtraResources, createBrightDataBrowser } from "./util.js";
import { withMock } from "../../mocks/util.js";
import { mockGetAutocompleteOptions } from "../../mocks/kimovil.js";
import { AutocompleteOption } from "../../../types/index.js";
import { Browser } from "playwright";
import { withDebugLog } from "../../../utils/logging.js";
import { PLAYWRIGHT_TIMEOUT } from "../../../utils/consts.js";
import { scrapeMissingSlugs } from "./getMissingSlugs.js";

export const getAutocompleteOptions = withMock(
  mockGetAutocompleteOptions,
  withDebugLog(async (name: string): Promise<AutocompleteOption[]> => {
    let browser: Browser | null = null;
    try {
      browser = await createBrightDataBrowser("getAutocompleteOptions");
      const page = await browser.newPage();
      await abortExtraResources(page);
      await page.goto(
        "https://www.kimovil.com/_json/autocomplete_devicemodels_joined.json?device_type=0&name=" +
          encodeURIComponent(name),
        { waitUntil: "load", timeout: PLAYWRIGHT_TIMEOUT }
      );

      const dirtyJson = await page.content();
      const json = dirtyJson.slice(
        dirtyJson.indexOf("{"),
        dirtyJson.lastIndexOf("}") + 1
      );

      const response = JSON.parse(json) as {
        results: { full_name: string; url: string }[];
      };

      return response.results.length < 8
        ? response.results.map(({ full_name: name, url: slug }) => ({
            name,
            slug,
          }))
        : await scrapeMissingSlugs({
            name,
          }).then(({ slugs }) =>
            slugs.map(({ name, slug }) => ({ name, slug }))
          );
    } catch (e) {
      throw e;
    } finally {
      browser?.close();
    }
  }, "getAutocompleteOptions")
);
