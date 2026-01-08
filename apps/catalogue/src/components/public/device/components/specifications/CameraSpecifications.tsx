import React from "react";
import { Camera, Flower2, Moon } from "lucide-react";
import { type DeviceData } from "../../types";
import { SpecificationSection } from "../SpecificationSection";

type CameraSpecificationsProps = {
  deviceData: DeviceData;
};

export const CameraSpecifications: React.FC<CameraSpecificationsProps> = ({
  deviceData,
}) => {
  const cameras = deviceData?.cameras || [];

  return (
    <SpecificationSection title={`Камеры (${cameras.length})`} icon={Camera}>
      <div className="flex auto-cols-fr grid-flow-col flex-col gap-2 md:grid">
        {cameras.map((camera) => (
          <div
            className="flex flex-col items-start gap-4 rounded-3xl bg-gray-100 dark:bg-gray-800 p-6"
            key={camera.id}
          >
            <div className="flex flex-col items-start gap-1">
              <div className="text-xl font-medium capitalize leading-none text-gray-600 dark:text-gray-400">
                {camera.type || "—"}
              </div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {camera.sensor || "—"}
              </div>
            </div>
            <div className="mt-auto flex items-center gap-1">
              <div className="rounded-full bg-white dark:bg-gray-900 px-4 py-2 text-xs font-semibold text-gray-900 dark:text-white">
                {camera.resolution_mp}МП
              </div>
              {camera.aperture_fstop &&
                !isNaN(parseFloat(camera.aperture_fstop)) && (
                  <div className="rounded-full bg-white dark:bg-gray-900 px-4 py-2 text-xs font-semibold text-gray-900 dark:text-white">
                    f/{camera.aperture_fstop}
                  </div>
                )}
              {camera.features?.includes("monochrome") && (
                <div
                  className="rounded-full bg-white px-4 py-2 text-xs font-semibold "
                  title="Монохромный сенсор"
                >
                  <Moon
                    className="h-3.5 w-3.5 text-gray-600 dark:text-gray-300"
                    aria-hidden="true"
                  />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Ч/Б</span>
                </div>
              )}
              {camera.features?.includes("macro") && (
                <div className="items-cente flex gap-1 rounded-full bg-white dark:bg-gray-900 px-4 py-2 text-xs font-semibold text-gray-900 dark:text-white">
                  <span className="text-xxs">макро</span>
                  <Flower2
                    className="h-3.5 w-3.5 text-gray-600 dark:text-gray-300"
                    aria-hidden="true"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </SpecificationSection>
  );
};
