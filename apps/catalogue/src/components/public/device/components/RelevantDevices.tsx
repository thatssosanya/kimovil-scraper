import { api } from "@/src/utils/api";
import { DeviceCard } from "@/src/components/public/rating/DeviceCard";

interface RelevantDevicesProps {
  deviceId: string;
}

export function RelevantDevices({ deviceId }: RelevantDevicesProps) {
  const { data: relevantDevices, isPending } =
    api.search.getRelevantDevices.useQuery(
      { deviceId },
      {
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: Infinity,
      }
    );

  if (isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex animate-pulse items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="h-16 w-16 rounded-md bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
            <div className="h-5 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    );
  }

  if (!relevantDevices?.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        Похожих устройств не найдено
      </div>
    );
  }

  return (
    <div className="scrollbar flex max-w-full gap-2 overflow-x-auto pb-3">
      {relevantDevices.map((device) => (
        <DeviceCard key={device.id} device={device} />
      ))}
    </div>
  );
}
