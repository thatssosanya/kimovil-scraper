import { AutocompleteOption } from ".";

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
