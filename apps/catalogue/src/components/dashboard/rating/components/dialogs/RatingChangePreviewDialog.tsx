import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import type { RatingType } from "@/src/server/db/schema";
import type { RatingWithDevices } from "@/src/types/rating";
import { cn } from "@/src/lib/utils";
import {
  RotateCcw,
  ArrowRightLeft,
  ArrowUp,
  ArrowDown,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import useRatingStore from "@/src/stores/ratingStore";
import { api } from "@/src/utils/api";

interface RatingWithType extends RatingWithDevices {
  RatingType: RatingType | null;
}

interface RatingChangePreviewDialogProps {
  open: boolean;
  onClose: () => void;
  ratings: RatingWithType[] | undefined;
}

const RatingDeviceList = ({
  rating,
  isOriginal = false,
}: {
  rating: RatingWithType;
  isOriginal?: boolean;
}) => {
  const store = useRatingStore();
  const effectivePositions = store.getEffectivePositions(rating.id);
  const changes = store.getPendingChangesForRating(rating.id);

  // Get IDs of devices that need to be fetched (devices that are in positions but not in devices array)
  const replacementDeviceIds = effectivePositions
    .map((p) => p.deviceId)
    .filter((id) => !rating.devices.find((d) => d.id === id));

  // Fetch replacement devices
  const { data: replacementDevices } = api.device.getDevicesById.useQuery(
    { deviceIds: replacementDeviceIds },
    { enabled: replacementDeviceIds.length > 0 && !isOriginal }
  );

  // Get all devices that have positions
  const devicesWithPositions = isOriginal
    ? // For original state, show original devices in their original positions
      rating.devices
        .filter((device) => {
          const pos = device.ratingPositions?.find(
            (p) => p.ratingId === rating.id
          );
          return pos !== undefined;
        })
        .map((device) => {
          const pos = device.ratingPositions?.find(
            (p) => p.ratingId === rating.id
          );
          const isReplaced = changes?.replacements?.some(
            (r) => r.oldDeviceId === device.id
          );
          return {
            device,
            position: {
              deviceId: device.id,
              position: pos?.position || 0,
              isOriginal: true,
              isDeleted: isReplaced || changes?.deletions?.includes(device.id),
            },
          };
        })
        .sort((a, b) => a.position.position - b.position.position)
    : // For current state, show all devices including replacements and additions
      effectivePositions.map((pos) => {
        const device =
          rating.devices.find((d) => d.id === pos.deviceId) ||
          replacementDevices?.find((d) => d.id === pos.deviceId);
        return {
          device: device || pos.replacedDevice,
          position: pos,
        };
      });

  return (
    <div className="space-y-3">
      {devicesWithPositions.map(({ device, position }) => {
        if (!device) return null;

        const originalPosition =
          device.ratingPositions?.find((pos) => pos.ratingId === rating.id)
            ?.position ?? 0;

        const isReplacement = !rating.devices.find((d) => d.id === device.id);
        const isAddition = changes?.additions?.includes(device.id) ?? false;
        const isDeleted =
          position.isDeleted || changes?.deletions?.includes(device.id);
        const positionDiff =
          !isReplacement && !isAddition && originalPosition && position.position
            ? position.position - originalPosition
            : null;

        return (
          <div
            key={device.id}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm transition-shadow",
              isOriginal && "bg-muted/50 text-muted-foreground",
              isReplacement && "ring-2 ring-green-500",
              isAddition && "ring-2 ring-blue-500",
              isDeleted && "opacity-50 ring-2 ring-red-500",
              !isReplacement &&
                !isAddition &&
                !position.isOriginal &&
                positionDiff !== 0 &&
                "ring-2 ring-amber-500",
              !isOriginal && "hover:shadow-md"
            )}
          >
            {/* Position indicator */}
            <div
              className={cn(
                "flex h-8 w-8 flex-none items-center justify-center rounded-lg border text-sm font-medium",
                isOriginal ? "bg-muted text-muted-foreground" : "bg-background"
              )}
            >
              {position.position || "—"}
            </div>

            {/* Device image */}
            {device.imageUrl && (
              <div
                className={cn(
                  "relative h-12 w-12 overflow-hidden rounded-lg border bg-white",
                  isOriginal && "opacity-75"
                )}
              >
                <img
                  src={device.imageUrl}
                  alt=""
                  className="h-full w-full object-contain p-1"
                />
              </div>
            )}

            {/* Device info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <div
                  className={cn(
                    "truncate font-medium",
                    isOriginal && "text-muted-foreground"
                  )}
                >
                  {device.name}
                </div>
              </div>

              {/* Change indicators */}
              {!isOriginal && (
                <div className="mt-1 flex items-center gap-2 text-xs">
                  {isReplacement && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700">
                      <ArrowRightLeft className="h-3 w-3" />
                      Замена устройства
                    </span>
                  )}
                  {isAddition && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                      <Plus className="h-3 w-3" />
                      Новое устройство
                    </span>
                  )}
                  {isDeleted && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700">
                      <Trash2 className="h-3 w-3" />
                      Удалено
                    </span>
                  )}
                  {!isReplacement &&
                    !isAddition &&
                    !position.isOriginal &&
                    positionDiff !== null &&
                    positionDiff !== 0 && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                          positionDiff < 0
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        )}
                      >
                        {positionDiff < 0 ? (
                          <>
                            <ArrowUp className="h-3 w-3" />
                            Поднялось на {Math.abs(positionDiff)}{" "}
                            {Math.abs(positionDiff) === 1
                              ? "позицию"
                              : "позиции"}
                          </>
                        ) : (
                          <>
                            <ArrowDown className="h-3 w-3" />
                            Опустилось на {Math.abs(positionDiff)}{" "}
                            {Math.abs(positionDiff) === 1
                              ? "позицию"
                              : "позиции"}
                          </>
                        )}
                      </span>
                    )}
                </div>
              )}
            </div>

            {/* Original position indicator for moved devices */}
            {!isOriginal &&
              !isReplacement &&
              !isAddition &&
              !position.isOriginal &&
              originalPosition > 0 && (
                <div className="bg-muted/50 text-muted-foreground flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                  <span>Было:</span>
                  <span className="font-medium">{originalPosition}</span>
                </div>
              )}
          </div>
        );
      })}
    </div>
  );
};

export const RatingChangePreviewDialog = ({
  open,
  onClose,
  ratings,
}: RatingChangePreviewDialogProps) => {
  const store = useRatingStore();
  if (!ratings) return null;

  const changedRatings = ratings.filter(
    (rating) => store.getPendingChangesForRating(rating.id) !== null
  );

  const totalChanges = changedRatings.reduce((acc, rating) => {
    const changes = store.getPendingChangesForRating(rating.id);
    if (!changes) return acc;
    return (
      acc +
      (changes.positions ? Object.keys(changes.positions).length : 0) +
      (changes.replacements?.length || 0) +
      (changes.deletions?.length || 0)
    );
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl overflow-auto p-0">
        <DialogHeader className="bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 border-b p-6 pb-4 backdrop-blur">
          <DialogTitle className="flex items-center gap-3 text-xl">
            Предпросмотр изменений
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-700">
                {totalChanges} {totalChanges === 1 ? "изменение" : "изменений"}
              </span>
            </div>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Проверьте или отмените изменения, которые будут применены к
            рейтингу.
          </DialogDescription>
        </DialogHeader>

        <div className="no-scrollbar max-h-[calc(100vh-12rem)] overflow-y-auto">
          <div className="divide-border divide-y">
            {changedRatings.map((rating) => {
              const changes = store.getPendingChangesForRating(rating.id);
              if (!changes) return null;

              const changesCount =
                (changes.positions
                  ? Object.keys(changes.positions).length
                  : 0) +
                (changes.replacements?.length || 0) +
                (changes.deletions?.length || 0);

              return (
                <div key={rating.id} className="space-y-6 p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-medium">
                        {changes.name || rating.name}
                      </h3>
                      {rating.RatingType && (
                        <p className="text-muted-foreground mt-1 text-sm">
                          {rating.RatingType.displayName ||
                            rating.RatingType.name}
                        </p>
                      )}
                    </div>
                    {changesCount > 0 && (
                      <Button
                        onClick={() => store.revertChanges(rating.id)}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Отменить изменения
                        <span className="bg-muted rounded-full px-1.5 py-0.5 text-xs font-medium">
                          {changesCount}
                        </span>
                      </Button>
                    )}
                  </div>

                  {changesCount > 0 && (
                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                      <div>
                        <div className="text-muted-foreground mb-4 flex items-center gap-2 text-sm font-medium">
                          <Clock className="h-4 w-4" />
                          Текущее состояние
                        </div>
                        <RatingDeviceList rating={rating} isOriginal />
                      </div>
                      <div>
                        <div className="text-muted-foreground mb-4 flex items-center gap-2 text-sm font-medium">
                          <ArrowRightLeft className="h-4 w-4" />
                          После изменений
                        </div>
                        <RatingDeviceList rating={rating} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
