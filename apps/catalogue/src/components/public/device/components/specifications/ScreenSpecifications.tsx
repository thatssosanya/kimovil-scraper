import React from "react";
import { type DeviceData } from "../../types";
import { ScreenTabs } from "../ScreenTabs";
import { SpecificationSection } from "../SpecificationSection";
import { Sun } from "lucide-react";

type ScreenSpecificationsProps = {
  deviceData: DeviceData;
};

export const ScreenSpecifications: React.FC<ScreenSpecificationsProps> = ({
  deviceData,
}) => {
  if (!deviceData) return null;

  const hasScreens = deviceData.screens && deviceData.screens.length > 0;

  return (
    <SpecificationSection
      title={
        deviceData.screens.length > 1
          ? `Экраны (${deviceData.screens.length})`
          : "Экран"
      }
      icon={Sun}
    >
      <div className="rounded-3xl">
        {hasScreens ? (
          <ScreenTabs screens={deviceData.screens} />
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-400">Нет данных об экране</div>
        )}
      </div>
    </SpecificationSection>
  );
};
