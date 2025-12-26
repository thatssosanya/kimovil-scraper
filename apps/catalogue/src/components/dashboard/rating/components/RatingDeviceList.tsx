import { type DeviceWithFullDetails } from "@/src/types/rating";
import { DeviceCard } from "@/src/components/dashboard/device/components/cards/AdminDeviceCard";
import { DeviceViewDialog } from "@/src/components/dashboard/device/DeviceViewDialog";
import { AddDeviceCard } from "@/src/components/dashboard/device/components/cards/AddDeviceCard";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
} from "@dnd-kit/core";
import { useState, useMemo } from "react";
import useRatingStore from "@/src/stores/ratingStore";
import { RatingDeviceInvalidPositionsAlert } from "@/src/components/dashboard/rating/components/RatingDeviceInvalidPositionsAlert";
import { Skeleton } from "@/src/components/ui/Skeleton";
import { api } from "@/src/utils/api";

import { type Config } from "@/src/server/db/schema";

export type { DeviceWithFullDetails };

interface RatingDeviceListProps {
  devices: DeviceWithFullDetails[];
  ratingId: string;
  onReplaceDevice: (device: DeviceWithFullDetails) => void;
  onAddDevice: () => void;
  matchedDeviceIds?: Set<string>;
}

export const RatingDeviceList = ({
  devices,
  ratingId,
  onReplaceDevice,
  onAddDevice,
  matchedDeviceIds,
}: RatingDeviceListProps) => {
  const [selectedDevice, setSelectedDevice] =
    useState<DeviceWithFullDetails | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const store = useRatingStore();
  const effectivePositions = store.getEffectivePositions(ratingId);
  const arePositionsValid = store.arePositionsValid(ratingId);

  const { isFetching: isRatingLoading } = api.rating.getAllRatings.useQuery(
    undefined,
    {
      enabled: false,
    }
  );

  // Get IDs of devices that need to be fetched (devices that are in positions but not in devices array)
  const replacementDeviceIds = effectivePositions
    .map((p) => p.deviceId)
    .filter((id) => !devices.find((d) => d.id === id));

  // Fetch replacement devices
  const { data: replacementDevices } = api.device.getDevicesById.useQuery(
    { deviceIds: replacementDeviceIds },
    {
      enabled: replacementDeviceIds.length > 0,
    }
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
        delay: 0,
        tolerance: 0,
      },
    })
  );

  // Get all available devices (original + replacements)
  const allDevices = useMemo(() => {
    const allDevicesMap = new Map<string, DeviceWithFullDetails>();

    // Add original devices
    devices.forEach((device) => allDevicesMap.set(device.id, device));

    // Add replacement devices if available
    replacementDevices?.forEach((device) => {
      const deviceWithFullDetails: DeviceWithFullDetails = {
        ...device,
        configs:
          device.configs
            ?.map((c) => ("config" in c ? (c.config as Config) : c))
            .filter(Boolean) || ([] as Config[]),
        links: device.links || [],
        ratingPositions: device.ratingPositions || [],
      };
      allDevicesMap.set(device.id, deviceWithFullDetails);
    });

    return Array.from(allDevicesMap.values());
  }, [devices, replacementDevices]);

  if (isRatingLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-card flex items-center gap-3 rounded-lg border p-3"
          >
            <div className="flex h-full items-center self-stretch px-1">
              <Skeleton className="h-5 w-5" />
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <div className="flex gap-1">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Function to get device by ID, checking both original devices and replacement devices
  const getDeviceById = (
    deviceId: string
  ): DeviceWithFullDetails | undefined => {
    const device = devices.find((d) => d.id === deviceId);
    if (device) {
      return device;
    }

    const replacementDevice = replacementDevices?.find(
      (d) => d.id === deviceId
    );

    if (replacementDevice) {
      return {
        ...replacementDevice,
        configs:
          replacementDevice.configs
            ?.map((c) => ("config" in c ? (c.config as Config) : c))
            .filter(Boolean) || ([] as Config[]),
        links: replacementDevice.links || [],
        ratingPositions: replacementDevice.ratingPositions || [],
      };
    }

    return undefined;
  };

  // Function to get original device at position
  const getOriginalDeviceAtPosition = (position: number) => {
    return devices.find(
      (d) =>
        d.ratingPositions.find((pos) => pos.ratingId === ratingId)?.position ===
        position
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    setIsDragging(true);
    setActiveId(event.active.id.toString());
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (event.over) {
      setOverId(event.over.id.toString());
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setIsDragging(false);
    setActiveId(null);
    setOverId(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const movedDeviceId = active.id.toString();
    const targetDeviceId = over.id.toString();

    // Get current positions
    const positions = new Map(
      effectivePositions.map((p) => [p.deviceId, p.position])
    );

    // Find current positions of involved devices
    const sourcePosition = positions.get(movedDeviceId) ?? positions.size + 1;
    const targetPosition = positions.get(targetDeviceId) ?? positions.size + 1;

    // Create array of all positions for easier manipulation
    const positionArray = Array.from(positions.entries());

    // Add devices with no position to the end of the array
    devices.forEach((device) => {
      if (!positions.has(device.id)) {
        positionArray.push([device.id, positionArray.length + 1]);
      }
    });

    // Sort by position
    positionArray.sort((a, b) => a[1] - b[1]);

    // Remove moved device from array
    const withoutMoved = positionArray.filter(([id]) => id !== movedDeviceId);

    // When dragging down, we want to insert after the target position
    // When dragging up, we want to insert before the target position
    const isMovingDown = sourcePosition < targetPosition;

    if (isMovingDown) {
      // Find the index after the target position
      const insertAt = withoutMoved.findIndex(
        ([, pos]) => pos > targetPosition
      );
      if (insertAt === -1) {
        // If no position is greater (dragging to the end), append to the end
        withoutMoved.push([movedDeviceId, targetPosition]);
      } else {
        withoutMoved.splice(insertAt, 0, [movedDeviceId, targetPosition]);
      }
    } else {
      // Find the exact target position for upward movement
      const insertAt = withoutMoved.findIndex(
        ([, pos]) => pos === targetPosition
      );
      withoutMoved.splice(insertAt, 0, [movedDeviceId, targetPosition]);
    }

    // Reassign sequential positions
    const updates: Record<number, string> = {};
    withoutMoved.forEach(([id], index) => {
      updates[index + 1] = id;
    });

    if (Object.keys(updates).length > 0) {
      store.updateDevicePositions(ratingId, updates);
    }
  };

  const handleDeleteDevice = (deviceId: string) => {
    store.deleteDevice(ratingId, deviceId);
  };

  const handleReplaceDevice = (device: DeviceWithFullDetails) => {
    onReplaceDevice(device);
  };

  const handleAddDevice = () => {
    onAddDevice();
  };

  const handleFixPositions = () => {
    // Get all current positions
    const currentPositions = effectivePositions.map((p) => ({
      deviceId: p.deviceId,
      position: p.position,
    }));

    // Sort by current position
    currentPositions.sort((a, b) => a.position - b.position);

    // Create updates object with sequential positions
    const updates: Record<number, string> = {};
    currentPositions.forEach((pos, index) => {
      updates[index + 1] = pos.deviceId;
    });

    // Update positions in store
    store.updateDevicePositions(ratingId, updates);
  };

  return (
    <>
      {!arePositionsValid ? (
        <RatingDeviceInvalidPositionsAlert
          devices={allDevices}
          getEffectivePositions={() =>
            new Map(effectivePositions.map((p) => [p.deviceId, p.position]))
          }
          fixedPositionsPreview={
            new Map(
              effectivePositions
                .sort((a, b) => a.position - b.position)
                .map((p, index) => [p.deviceId, index + 1])
            )
          }
          onFixPositions={handleFixPositions}
          isFixingPositions={store.isLoading}
        />
      ) : (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-2 rounded-lg bg-zinc-50/50 p-2 dark:bg-zinc-900/50">
              <SortableContext
                items={effectivePositions.map((p) => p.deviceId)}
                strategy={verticalListSortingStrategy}
              >
                {effectivePositions.map((position) => {
                  const device = getDeviceById(position.deviceId);
                  if (!device) return null;

                  const originalPosition =
                    device.ratingPositions?.find?.(
                      (pos) => pos.ratingId === ratingId
                    )?.position ?? 0;

                  const isReplacement = !devices.find(
                    (d) => d.id === device.id
                  );
                  const originalDeviceAtPosition = getOriginalDeviceAtPosition(
                    position.position
                  );
                  const hasPositionChanged =
                    originalDeviceAtPosition?.id !== device.id;

                  const deviceForCard = {
                    ...device,
                    RatingPosition: device.ratingPositions,
                  };

                  return (
                    <DeviceCard
                      key={device.id}
                      device={deviceForCard}
                      position={position.position}
                      originalPosition={originalPosition}
                      potentialPosition={
                        activeId === device.id && overId
                          ? effectivePositions.find(
                              (p) => p.deviceId === overId
                            )?.position ?? position.position
                          : position.position
                      }
                      isPending={hasPositionChanged || isReplacement}
                      isPendingReplacement={isReplacement}
                      replacedWith={position.replacedDevice}
                      isDragging={isDragging}
                      onViewDetails={() => setSelectedDevice(device)}
                      onReplace={() => handleReplaceDevice(device)}
                      onDelete={() => handleDeleteDevice(device.id)}
                      isMatched={matchedDeviceIds?.has(device.id)}
                    />
                  );
                })}

                {/* Add Device Card */}
                {effectivePositions.length < 5 && (
                  <AddDeviceCard
                    position={effectivePositions.length + 1}
                    onClick={handleAddDevice}
                  />
                )}
              </SortableContext>
            </div>
          </DndContext>
        </>
      )}

      {selectedDevice && (
        <DeviceViewDialog
          device={{
            ...selectedDevice,
            links: selectedDevice.links.map((link) => ({
              ...link,
              marketplace: link.marketplace
                ? {
                    ...link.marketplace,
                    iconUrl: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    baseUrl: null,
                  }
                : null,
              config: null,
              sku: null,
            })),
            hasCharacteristics: true,
          }}
          open={!!selectedDevice}
          onOpenChange={(open) => !open && setSelectedDevice(null)}
        />
      )}
    </>
  );
};
