import type { InferSelectModel } from "drizzle-orm";
import type {
  ratingsGroup,
  ratingsPage,
  ratingsGroupPosition as ratingsGroupPositionTable,
  ratingsPagePosition as ratingsPagePositionTable,
  rating as ratingTable,
  ratingType,
} from "@/src/server/db/schema";
import type { DeviceWithFullDetails } from "./rating";

type RatingsGroup = InferSelectModel<typeof ratingsGroup>;
type RatingsPage = InferSelectModel<typeof ratingsPage>;
type RatingsGroupPosition = InferSelectModel<typeof ratingsGroupPositionTable>;
type RatingsPagePosition = InferSelectModel<typeof ratingsPagePositionTable>;
type Rating = InferSelectModel<typeof ratingTable>;
type RatingType = InferSelectModel<typeof ratingType>;

// Simplified rating type for dashboard - only basic info needed
export type SimplifiedRating = Pick<Rating, "id" | "name"> & {
  ratingType: Pick<RatingType, "id" | "name" | "displayName">;
};

export type RatingsGroupWithRatings = RatingsGroup & {
  ratings: (RatingsGroupPosition & {
    rating: SimplifiedRating;
  })[];
};

export type RatingsPageWithGroups = RatingsPage & {
  groups: (RatingsPagePosition & {
    group: RatingsGroupWithRatings;
  })[];
};

export type RatingsGroupPositionData = {
  ratingId: string;
  position: number;
  isOriginal: boolean;
  isAddition?: boolean;
  replacedDevice?: DeviceWithFullDetails;
};

export type RatingsPagePositionData = {
  groupId: string;
  position: number;
  isOriginal: boolean;
  isAddition?: boolean;
};

export interface RatingsGroupChanges {
  name?: string;
  positions?: Record<number, string>; // position -> ratingId
  additions?: string[]; // ratingIds added
  deletions?: string[]; // ratingIds removed
  replacements?: Array<{
    oldRatingId: string;
    newRatingId: string;
    position: number;
  }>;
}

export interface RatingsPageChanges {
  name?: string;
  positions?: Record<number, string>; // position -> groupId
  additions?: string[]; // groupIds added
  deletions?: string[]; // groupIds removed
  replacements?: Array<{
    oldGroupId: string;
    newGroupId: string;
    position: number;
  }>;
}

export interface RatingsPageStore {
  // State
  pages: Map<string, RatingsPageWithGroups>;
  pendingPageChanges: Map<string, RatingsPageChanges>;
  pendingGroupChanges: Map<string, RatingsGroupChanges>;
  isLoading: boolean;
  error: Error | null;

  // Actions
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: Error | null) => void;
  setPages: (pages: RatingsPageWithGroups[]) => void;

  // Page actions
  addGroupToPage: (pageId: string, groupId: string) => void;
  updatePageGroupPositions: (
    pageId: string,
    updates: Record<number, string>
  ) => void;
  deleteGroupFromPage: (pageId: string, groupId: string) => void;
  updatePageName: (pageId: string, name: string) => void;
  revertPageChanges: (pageId: string) => void;

  // Group actions
  addRatingToGroup: (groupId: string, ratingId: string) => void;
  updateGroupRatingPositions: (
    groupId: string,
    updates: Record<number, string>
  ) => void;
  deleteRatingFromGroup: (groupId: string, ratingId: string) => void;
  updateGroupName: (groupId: string, name: string) => void;
  revertGroupChanges: (groupId: string) => void;

  // Selectors
  getPendingPageChanges: (pageId: string) => RatingsPageChanges | null;
  getPendingGroupChanges: (groupId: string) => RatingsGroupChanges | null;
  getEffectivePagePositions: (pageId: string) => RatingsPagePositionData[];
  getEffectiveGroupPositions: (groupId: string) => RatingsGroupPositionData[];
  arePagePositionsValid: (pageId: string) => boolean;
  areGroupPositionsValid: (groupId: string) => boolean;
}

export { type RatingsGroup, type RatingsPage, type DeviceWithFullDetails };
