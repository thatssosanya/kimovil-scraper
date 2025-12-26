import React from "react";
import { type DeviceWithConfigs } from "../types/index";

type DeviceDescriptionProps = {
  device: DeviceWithConfigs;
};

export const DeviceDescription = ({ device }: DeviceDescriptionProps) => {
  return (
    <div className="px-4 py-2">
      <div className="text-xl font-bold">Описание</div>
      <div className="prose text-sm">
        {device?.description || "Описание отсутствует"}
      </div>
    </div>
  );
};
