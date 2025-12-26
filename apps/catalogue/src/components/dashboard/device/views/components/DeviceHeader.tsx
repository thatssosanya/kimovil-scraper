import React from "react";
import { type DeviceWithConfigs } from "../types/index";
type DeviceHeaderProps = {
  device: DeviceWithConfigs;
};

export const DeviceHeader = ({ device }: DeviceHeaderProps) => {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <img
        className="aspect-[2/3] w-16 rounded border border-gray-200 bg-white object-contain px-2 dark:border-gray-800 dark:bg-[hsl(0_0%_9%)]"
        src={device.imageUrl || ""}
        alt={device.name || ""}
      />
      <div className="min-w-0">
        <div className="truncate text-lg font-semibold leading-tight dark:text-gray-100">{device.name}</div>
        <div className="truncate text-xs text-gray-600 dark:text-gray-500">{device.type || "Без типа"}</div>
      </div>
    </div>
  );
};
