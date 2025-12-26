import React from "react";
import { type RouterOutputs } from "@/src/utils/api";
import { PhoneCard } from "@/src/components/dashboard/device/components/cards/PublicDeviceCard";
import { motion } from "framer-motion";

interface RatingPosition {
  ratingId: string;
  position: number;
}

interface DeviceWithRatingPositions {
  id: string;
  name: string | null;
  imageUrl: string | null;
  type: string | null;
  description: string | null;
  yandexId: string | null;
  slug?: string | null;
  ratingPositions?: RatingPosition[];
}

type RatingsGridProps = {
  ratings: {
    value: string;
    label: string;
    rating: RouterOutputs["rating"]["getAllRatings"][0];
  }[];
  selectedRating: string;
};

export const RatingsGrid: React.FC<RatingsGridProps> = ({
  ratings,
  selectedRating,
}) => {
  const sortedRatings = React.useMemo(() => {
    const sorted = [...ratings].sort((a, b) => {
      const aNum = parseInt(a.label.replace(/[^\d]/g, "")) || 0;
      const bNum = parseInt(b.label.replace(/[^\d]/g, "")) || 0;
      return aNum - bNum;
    });

    const selectedRatingObject = ratings.find(
      (rating) => rating.value === selectedRating
    );

    if (selectedRatingObject) {
      return [
        selectedRatingObject,
        ...sorted.filter((rating) => rating.value !== selectedRating),
      ];
    }

    return sorted;
  }, [ratings, selectedRating]);

  // Pre-sort devices for each rating to avoid re-sorting during animations
  const sortedDevices = React.useMemo(() => {
    return sortedRatings.map(({ rating }) => {
      const devices = [...(rating.devices || [])].map((device) => {
        return {
          ...device,
          slug: null,
        };
      }) as DeviceWithRatingPositions[];
      return {
        ratingId: rating.id,
        devices: devices.sort((a, b) => {
          const positionA =
            a.ratingPositions?.find((pos) => pos.ratingId === rating.id)
              ?.position || 0;
          const positionB =
            b.ratingPositions?.find((pos) => pos.ratingId === rating.id)
              ?.position || 0;
          return positionA - positionB;
        }),
      };
    });
  }, [sortedRatings]);

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {sortedRatings.map(({ rating }, ratingIndex) => {
          const sortedDevicesList =
            sortedDevices.find((sd) => sd.ratingId === rating.id)?.devices ||
            [];

          return (
            <motion.div
              key={rating.id}
              id={rating.id}
              className="border-border bg-card dark:border-border/30 dark:bg-card/90 overflow-hidden rounded-lg border shadow-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.2,
                delay: ratingIndex * 0.02,
              }}
              layout="position"
            >
              <div className="bg-zinc-800 px-3 py-2.5 text-center">
                <h3 className="font-medium text-white">{rating.name}</h3>
              </div>

              <div className="divide-border dark:divide-border/30 divide-y p-2">
                {sortedDevicesList.length > 0 ? (
                  sortedDevicesList.map((device) => {
                    const position =
                      device.ratingPositions?.find(
                        (pos) => pos.ratingId === rating.id
                      )?.position || 0;
                    return (
                      <div
                        key={device.id}
                        className="py-2.5 first:pt-1 last:pb-1"
                      >
                        <PhoneCard device={device} index={position} />
                      </div>
                    );
                  })
                ) : (
                  <div className="text-muted-foreground flex h-16 items-center justify-center p-2 text-xs">
                    Нет устройств в этой категории
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
