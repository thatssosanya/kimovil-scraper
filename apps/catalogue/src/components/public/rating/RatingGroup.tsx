import { useEffect, useRef, useState } from "react";
import { cn } from "@/src/lib/utils";
import { type RatingPageProps } from "@/src/pages/ratings/[slug]";
import { DeviceCard } from "./DeviceCard";
import { FeatureDeviceCard } from "@/src/components/dashboard/device/components/cards";
import { useRouter } from "next/router";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

// Simple module-level storage to preserve group selections
const groupSelections: Record<string, string> = {};

type RatingGroupProps = RatingPageProps["pageData"]["groups"][number] & {
  pageName: string;
};

export const capitalize = (str: string) => {
  return str[0]?.toLocaleUpperCase() + str?.slice(1);
};

export const RatingGroup = ({
  group,
}: RatingGroupProps) => {
  const router = useRouter();
  const groupRef = useRef<HTMLDivElement>(null);
  const [hasScrolledOnMount, setHasScrolledOnMount] = useState(false);

  // Get selected rating from URL, stored selection, or default to first rating
  const urlSelectedRating = router.query.selectedRating as string;
  const urlRatingBelongsToGroup =
    urlSelectedRating &&
    group.ratings.some((rating) => rating.rating.id === urlSelectedRating);

  const selectedRatingId = urlRatingBelongsToGroup
    ? group.ratings.find((rating) => rating.rating.id === urlSelectedRating)
        ?.id || null
    : groupSelections[group.id] || group.ratings[0]?.id || null;

  const selectedRating = group.ratings.find(
    (rating) => rating.id === selectedRatingId
  );

  const handleRatingSelect = (ratingId: string) => {
    // Store selection for this group
    groupSelections[group.id] = ratingId;

    // Update URL with selectedRating parameter using Next.js router
    const selectedRatingData = group.ratings.find((r) => r.id === ratingId);
    if (selectedRatingData) {
      const query = { ...router.query };
      query.selectedRating = selectedRatingData.rating.id;

      void router.replace({ query }, undefined, { shallow: true });
    }
  };

  // Only scroll once on mount if there's a selectedRating for this group
  useEffect(() => {
    if (router.isReady && !hasScrolledOnMount) {
      const currentUrlSelectedRating = router.query.selectedRating as string;
      const currentUrlRatingBelongsToGroup =
        currentUrlSelectedRating &&
        group.ratings.some(
          (rating) => rating.rating.id === currentUrlSelectedRating
        );

      if (currentUrlRatingBelongsToGroup) {
        setHasScrolledOnMount(true);
        setTimeout(() => {
          if (groupRef.current) {
            groupRef.current.scrollIntoView({
              behavior: "smooth",
              block: "start",
              inline: "nearest",
            });
          }
        }, 100);
      }
    }
  }, [router.isReady, hasScrolledOnMount, group.ratings]); // eslint-disable-line react-hooks/exhaustive-deps

  // Store current selection to preserve it across group changes
  useEffect(() => {
    if (selectedRatingId) {
      groupSelections[group.id] = selectedRatingId;
    }
  }, [selectedRatingId, group.id]);

  const devicesSortedByPositions = selectedRating?.rating.devices.sort(
    (a, b) => (a.ratingPosition || 0) - (b.ratingPosition || 0)
  );
  const featuredDevice = devicesSortedByPositions?.[0];

  return (
    <div ref={groupRef} className="flex w-full flex-col rounded-lg">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-col items-start gap-2">
          <Link
            href={`/rating/${
              selectedRating?.rating.slug || selectedRating?.rating.id
            }`}
            className="text-primary flex gap-2 md:hidden"
          >
            <span>Рейтинг</span>
            <ArrowRight className="h-6 w-6 opacity-80" />
          </Link>
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white lg:text-4xl">
            {selectedRating?.rating.name}
          </h3>
        </div>
        {selectedRating && (
          <Link
            href={`/rating/${
              selectedRating.rating.slug || selectedRating.rating.id
            }`}
            className="hidden items-center gap-2 rounded-full bg-[#27272a] px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-[#1f1f23] dark:bg-[#27272a] dark:hover:bg-[#1f1f23] md:flex"
          >
            <span>Рейтинг</span>
            <ArrowRight className="h-6 w-6" />
          </Link>
        )}
      </div>

      {/* Rating tabs */}
      <div className="mb-4 flex max-w-full flex-row flex-wrap gap-2 overflow-hidden ">
        {group.ratings.map((rating) => (
          <button
            key={rating.id}
            onClick={() => handleRatingSelect(rating.id)}
            className={cn(
              "flex-shrink-0 cursor-pointer rounded-full px-6 py-4 text-sm font-semibold transition-colors",
              selectedRatingId === rating.id
                ? "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            )}
          >
            {capitalize(
              rating?.rating?.RatingsGroupPosition[0]?.shortName ??
                rating?.rating?.name ??
                ""
            )}
          </button>
        ))}
      </div>

      {/* Selected rating devices */}
      {selectedRating && group.displayType === "regular" && (
        <div className=" gap-2 md:flex">
          <div className="scrollbar -mb-2 grid grid-cols-2 gap-2 overflow-x-auto pb-2 md:flex">
            {devicesSortedByPositions?.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                className="max-w-none"
              />
            ))}
          </div>
        </div>
      )}
      {selectedRating && group.displayType === "feature" && (
        <div className="flex flex-col gap-4">
          {featuredDevice && <FeatureDeviceCard device={featuredDevice} />}
          <div className="text-3xl font-semibold">Альтернативы</div>
          <div className="scrollbar  -mb-2 grid gap-2 overflow-x-auto pb-2 lg:grid-cols-4">
            {devicesSortedByPositions
              ?.slice(1)
              .map((device) => ({ ...device, ratingPosition: null }))
              .map((device) => (
                <DeviceCard
                  key={device.id}
                  className="w-full md:w-full"
                  device={device}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
