import type {
  RatingCategory,
  RatingType,
  Rating,
} from "@/src/server/db/schema";
import { useDebounce } from "@/src/hooks/useDebounce";
import { useState, useMemo } from "react";
import fuzzysort from "fuzzysort";
import { type DeviceWithFullDetails } from "@/src/types/rating";

interface RatingWithDevices extends Rating {
  devices: DeviceWithFullDetails[];
  RatingCategory: RatingCategory[];
  RatingType: RatingType | null;
}

interface UseRatingFilterProps {
  ratings: RatingWithDevices[] | undefined;
  selectedRatingType: string | null;
}

interface UseRatingFilterResult {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredRatings: RatingWithDevices[];
  matchedDeviceIds: Set<string>;
}

export const useRatingFilter = ({
  ratings,
  selectedRatingType,
}: UseRatingFilterProps): UseRatingFilterResult => {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const [matchedDeviceIds, setMatchedDeviceIds] = useState<Set<string>>(
    new Set()
  );

  // Cache prepared search targets
  const preparedSearchTargets = useMemo(() => {
    if (!ratings) return [];

    return ratings.map((rating) => ({
      obj: rating,
      name: fuzzysort.prepare(String(rating.name || "")),
      deviceNames: rating.devices
        .map((d) => d.name)
        .filter((name): name is string => Boolean(name))
        .map((name) => fuzzysort.prepare(name)),
      deviceTypes: rating.devices
        .map((d) => d.type)
        .filter((type): type is string => Boolean(type))
        .map((type) => fuzzysort.prepare(type)),
      ratingTypeId: rating.ratingTypeId,
    }));
  }, [ratings]);

  const filteredRatings = useMemo(() => {
    if (!ratings) return [];

    let searchTargets = preparedSearchTargets;
    const newMatchedDeviceIds = new Set<string>();

    // Filter by rating type if selected
    if (selectedRatingType) {
      searchTargets = searchTargets.filter(
        (target) => target.ratingTypeId === selectedRatingType
      );
    }

    // Filter by search query using fuzzysort
    if (debouncedSearchQuery) {
      const results = searchTargets.filter((target) => {
        // Search in rating name with early return for performance
        const nameMatch = fuzzysort.single(debouncedSearchQuery, target.name);
        if (nameMatch && nameMatch.score > -1) return true;

        // If we have many devices, check if any device name matches
        if (target.deviceNames.length > 0) {
          for (let i = 0; i < target.deviceNames.length; i++) {
            const preparedName = target.deviceNames[i];
            if (!preparedName) continue;

            const match = fuzzysort.single(debouncedSearchQuery, preparedName);
            if (match && match.score > -1) {
              // Add matched device ID to the set
              const device = target.obj.devices[i];
              if (device) {
                newMatchedDeviceIds.add(device.id);
              }
              return true;
            }
          }
        }

        // Only check types if no name matches found
        if (target.deviceTypes.length > 0) {
          for (let i = 0; i < target.deviceTypes.length; i++) {
            const preparedType = target.deviceTypes[i];
            if (!preparedType) continue;

            const match = fuzzysort.single(debouncedSearchQuery, preparedType);
            if (match && match.score > -1) {
              // Add matched device ID to the set
              const device = target.obj.devices[i];
              if (device) {
                newMatchedDeviceIds.add(device.id);
              }
              return true;
            }
          }
        }

        return false;
      });

      setMatchedDeviceIds(newMatchedDeviceIds);
      return results.map((result) => result.obj);
    }

    setMatchedDeviceIds(new Set());
    return searchTargets.map((target) => target.obj);
  }, [
    preparedSearchTargets,
    selectedRatingType,
    debouncedSearchQuery,
    ratings,
  ]);

  return {
    searchQuery,
    setSearchQuery,
    filteredRatings,
    matchedDeviceIds,
  };
};
