import { AutocompleteOption, PhoneData } from "../../types/index.js";
import { GetMissingSlugsRequestPayload } from "../../types/payloads.js";
import { kimovilData, kimovilSlugs } from "./data.js";
import { wait } from "./util.js";

export const mockScrapeBySlug = async (slug: string) => {
  await wait(5000);
  return { ...kimovilData, slug };
};

export const mockScrapeMissingSlugs = async (
  args: GetMissingSlugsRequestPayload
) => {
  await wait(5000);
  return {
    slugs: kimovilSlugs.map((slug) => ({
      name: slug,
      slug,
      rawSlug: slug,
    })),
    lastPage: 1,
  };
};

export const mockGetAutocompleteOptions = async (searchString: string) => {
  await wait(5000);
  return [
    { name: searchString, slug: searchString },
    { name: searchString + " Pro", slug: searchString + "-pro" },
    { name: searchString + " Max", slug: searchString + "-max" },
  ];
};

export const mockAdaptScrapedData = async (data: PhoneData) => {
  await wait(5000);
  return data;
};

export const mockPickMatchingSlug = async (
  name: string,
  options: AutocompleteOption[]
) => {
  await wait(5000);
  return options[0].slug;
};
