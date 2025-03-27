import { AutocompleteOption } from "./index.js";

export interface BasePayload {
  userId: string;
  deviceId: string;
}

export interface GetAutocompleteOptionsRequestPayload extends BasePayload {
  searchString: string;
}

export interface GetMatchingSlugRequestPayload extends BasePayload {
  searchString: string;
  options: AutocompleteOption[];
}

export interface GetKimovilDataRequestPayload extends BasePayload {
  slug: string;
}

export interface GetKimovilDatasRequestPayload {
  slugs: string[];
}

export interface GetMissingSlugsRequestPayload {
  lastPage?: number;
  targetCount?: number;
  brand?: string;
  name?: string;
  maxDate?: string; // 7 = 3 years; 6 = 2 years; 5 = 1.5 years; 4 = 1 year; 3 = 6 months; 2 = 3 months
}
