import type { InferSelectModel } from "drizzle-orm";
import type {
  device,
  rating as ratingTable,
  ratingPosition,
  link,
  config,
  marketplace,
} from "@/src/server/db/schema";

type Device = InferSelectModel<typeof device>;
type Rating = InferSelectModel<typeof ratingTable>;
type RatingPosition = InferSelectModel<typeof ratingPosition>;
type Link = InferSelectModel<typeof link>;
type Config = InferSelectModel<typeof config>;
type Marketplace = InferSelectModel<typeof marketplace>;

interface LinkWithMarketplace extends Link {
  marketplace: Pick<Marketplace, "id" | "name"> | null;
}

export interface DeviceWithFullDetails extends Device {
  ratingPositions: RatingPosition[];
  links: LinkWithMarketplace[];
  configs: Config[];
}

export interface DevicePosition {
  deviceId: string;
  position: number;
  isOriginal: boolean;
  isAddition?: boolean;
  isDeleted?: boolean;
  replacedDevice?: DeviceWithFullDetails;
  updatedAt?: Date;
}

export interface RatingWithDevices extends Rating {
  devices: DeviceWithFullDetails[];
}

export interface RatingChanges {
  positions?: Record<number, string>;
  replacements?: Array<{
    oldDeviceId: string;
    newDeviceId: string;
    position: number;
  }>;
  additions?: string[];
  deletions?: string[];
  name?: string;
}

export interface RatingState {
  ratings: Map<string, RatingWithDevices>;
  pendingChanges: Map<string, RatingChanges>;
  isLoading: boolean;
  error: Error | null;
}

export interface RatingActions {
  setRatings: (ratings: RatingWithDevices[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: Error | null) => void;
  updateDevicePositions: (
    ratingId: string,
    updates: Record<number, string>
  ) => void;
  replaceDevice: (
    ratingId: string,
    oldDeviceId: string,
    newDeviceId: string
  ) => void;
  addDevice: (ratingId: string, deviceId: string) => void;
  deleteDevice: (ratingId: string, deviceId: string) => void;
  updateRatingName: (ratingId: string, name: string) => void;
  revertChanges: (ratingId: string) => void;
  saveChanges: (ratingId: string) => Promise<void>;
}

export interface RatingSelectors {
  getPendingChangesForRating: (ratingId: string) => RatingChanges | null;
  getEffectivePositions: (ratingId: string) => DevicePosition[];
  arePositionsValid: (ratingId: string) => boolean;
}

export type RatingStore = RatingState & RatingActions & RatingSelectors;
