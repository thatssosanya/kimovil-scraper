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

export interface GetMissingSlugsRequestPayload {
  lastPage?: number;
  targetCount?: number;
  brand?: string;
  name?: string;
}
