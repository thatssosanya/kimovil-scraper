import type { InferSelectModel } from "drizzle-orm";
import type { aliExpressItem } from "@/src/server/db/schema";

type AliExpressItem = InferSelectModel<typeof aliExpressItem>;

export type AliExpressTableItem = AliExpressItem;

export type AliExpressSortField =
  | "commissionRate"
  | "name"
  | "createdAt"
  | "updatedAt";
export type SortOrder = "asc" | "desc";

export interface AliExpressFilters {
  search?: string;
  sortBy?: AliExpressSortField;
  sortOrder?: SortOrder;
}

export interface AliExpressStats {
  total: number;
  withCommission: number;
  withNames: number;
  withoutCommission: number;
  withoutNames: number;
}
