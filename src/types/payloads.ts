import { AutocompleteOption } from ".";

export interface BasePayload {
  user: string;
  device: string;
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
