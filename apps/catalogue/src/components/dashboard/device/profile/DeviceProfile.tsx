import { useDeviceProfile } from "./hooks";
import { TwoColumnLayout, LeftColumn, RightColumn } from "./components/layout";
import {
  DeviceHeader,
  DeviceInfoTabs,
  ProsConsSection,
} from "./components/sections";
import { LinksSidebar, RatingsSidebar } from "./components/sidebar";
import { LoadingStates } from "./components/shared";
import { useScraperManager } from "@/src/components/dashboard/scraping/hooks/useScraper";

interface DeviceProfileProps {
  deviceId: string;
}

export function DeviceProfile({ deviceId }: DeviceProfileProps) {
  const {
    device,
    characteristics,
    isLoading,
    isLoadingCharacteristics,
    error,
    updateDevice,
    isUpdating,
  } = useDeviceProfile(deviceId);

  // Set up job polling for this device
  useScraperManager(device);

  if (isLoading) {
    const { ProfileSkeleton } = LoadingStates();
    return <ProfileSkeleton />;
  }

  if (error || !device) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-200">
            Устройство не найдено
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Устройство, которое вы ищете, не существует или было удалено.
          </div>
        </div>
      </div>
    );
  }

  const handleDeviceUpdate = (updates: Record<string, unknown>) => {
    if (!device) return;

    updateDevice({
      id: deviceId,
      name: device.name || "",
      type: device.type || "",
      description: device.description || "",
      yandexId: device.yandexId || "",
      imageUrl: device.imageUrl || "",
      configs: device.configs?.map((c) => c.id) || [],
      ...updates,
    });
  };

  const leftColumnContent = (
    <LeftColumn>
      <DeviceHeader
        device={device}
        onSave={handleDeviceUpdate}
        isLoading={isUpdating}
      />

      <DeviceInfoTabs
        device={device}
        onSave={handleDeviceUpdate}
        isLoading={isUpdating}
        characteristics={characteristics || null}
        isLoadingCharacteristics={isLoadingCharacteristics}
      />

      <ProsConsSection deviceId={deviceId as string} />
    </LeftColumn>
  );

  const rightColumnContent = (
    <RightColumn>
      <LinksSidebar
        links={device.links || []}
        configs={device.configs || []}
        skus={characteristics?.skus || []}
        deviceId={deviceId as string}
      />

      <RatingsSidebar ratings={device.ratingPositions || []} />
    </RightColumn>
  );

  return (
    <TwoColumnLayout
      leftColumn={leftColumnContent}
      rightColumn={rightColumnContent}
      className="h-full bg-gray-50 dark:bg-[hsl(0_0%_7%)]"
    />
  );
}
