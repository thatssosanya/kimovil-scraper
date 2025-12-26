import Image from "next/image";
import Link from "next/link";
import { Smartphone } from "lucide-react";
import { InfoCard } from "../shared";
import type { Device } from "@/src/server/db/schema";

interface RelatedDevicesProps {
  devices?: Pick<Device, "id" | "name" | "imageUrl" | "type">[];
}

export function RelatedDevices({ devices = [] }: RelatedDevicesProps) {
  return (
    <InfoCard title="Related Devices">
      {devices.length === 0 ? (
        <div className="text-center py-6">
          <Smartphone className="h-8 w-8 mx-auto mb-2 opacity-50 dark:text-gray-400" />
          <div className="text-sm dark:text-gray-400">
            No related devices found
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {devices.map((device) => (
            <Link
              key={device.id}
              href={`/dashboard/devices/${device.id}`}
              className="block rounded-lg border p-3 dark:border-gray-800 dark:bg-[hsl(0_0%_7%)] dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded dark:bg-gray-800">
                  {device.imageUrl ? (
                    <Image
                      src={device.imageUrl}
                      alt={device.name || "Device"}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Smartphone className="h-5 w-5 dark:text-gray-500" />
                    </div>
                  )}
                </div>
                
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium dark:text-gray-200 truncate">
                    {device.name || "Untitled Device"}
                  </div>
                  <div className="text-xs dark:text-gray-400">
                    {device.type?.toLowerCase() || "device"}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </InfoCard>
  );
}