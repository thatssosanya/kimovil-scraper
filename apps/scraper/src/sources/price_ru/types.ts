export interface PriceRuConfig {
  partnerId: string;
  regionId: number;
  categoryId: string;
}

export interface PriceRuOffer {
  id: number;
  name: string;
  modelId: number;
  price: number;
  shopName: string;
  availability: string;
  redirectTarget: "to_merchant" | "to_price";
}

export interface PriceRuModel {
  id: number;
  name: string;
  priceInfo: { min: number; max: number; avg: number };
  offerCount: number;
}

export interface SearchResult {
  items: PriceRuOffer[];
  total: number;
}

// Raw API response types (for type-safe parsing)
export interface PriceRuSearchResponse {
  items: Array<{
    id: number;
    name: string;
    model_id: number;
    price: number;
    shop_info?: { name?: string };
    availability?: string;
    redirect_target?: "to_merchant" | "to_price";
  }>;
  total: number;
}
