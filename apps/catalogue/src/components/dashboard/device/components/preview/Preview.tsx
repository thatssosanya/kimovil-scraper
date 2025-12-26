import { type RouterOutputs } from "@/src/utils/api";
import { IPRating } from "./IPRating";

interface PreviewProps {
  deviceData: NonNullable<
    RouterOutputs["device"]["getDeviceCharacteristicBySlug"]
  >;
}

export const Preview = ({ deviceData }: PreviewProps) => {
  if (!deviceData.height_mm || !deviceData.width_mm) return null;

  // Get the main screen (if exists)
  const mainScreen = deviceData.screens?.find((screen) => screen?.isMain);

  return (
    <div
      className="relative w-24 shrink-0 sm:block"
      style={{
        aspectRatio: `${deviceData.width_mm} / ${deviceData.height_mm}`,
      }}
      title={`Размеры корпуса: ${deviceData.width_mm}мм × ${
        deviceData.height_mm
      }мм × ${
        deviceData.thickness_mm ? `${deviceData.thickness_mm}мм` : "неизвестно"
      }`}
    >
      <div className="absolute inset-0 rounded-[1rem] border-[1px] border-gray-300 dark:border-gray-600">
        <div className="absolute inset-[1px] flex flex-col items-center rounded-[0.9rem] border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="mt-1.5 h-[0.4rem] w-8 rounded-full bg-gray-300 dark:bg-gray-600" />

          <div className="flex h-full w-full flex-col items-center justify-between px-2 pt-4">
            <div className="mt-2 text-center">
              {mainScreen?.size_in && (
                <div className="text-[0.5rem] font-medium text-gray-500 dark:text-gray-400">
                  {mainScreen.size_in}&quot;
                </div>
              )}
            </div>
            <div className="flex w-full flex-col items-center gap-2 pb-4">
              {/* IP Rating */}
              {deviceData.ipRating && (
                <div className="rounded-md bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 px-1 py-0.5 shadow-sm ring-1 ring-indigo-100 dark:ring-indigo-800">
                  <IPRating rating={deviceData.ipRating} />
                </div>
              )}
            </div>
          </div>

          {/* Dimensions */}
          <div className="absolute -right-5 top-1/2 -translate-y-1/2 text-right">
            <div className="rounded-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-1 py-0.5 text-[0.5rem] font-medium text-gray-600 dark:text-gray-300">
              {deviceData.height_mm}
              <span className="text-[0.4rem] text-gray-500 dark:text-gray-400">мм</span>
            </div>
          </div>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-center">
            <div className="rounded-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-1 py-0.5 text-[0.5rem] font-medium text-gray-600 dark:text-gray-300">
              {deviceData.width_mm}
              <span className="text-[0.4rem] text-gray-500 dark:text-gray-400">мм</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
