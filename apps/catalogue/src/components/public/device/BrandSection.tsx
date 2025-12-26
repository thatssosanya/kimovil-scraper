import { DeviceCard } from "@/src/components/public/rating/DeviceCard";
import type { BrandGroup } from "@/src/types/devices";

interface BrandSectionProps {
  brandGroup: BrandGroup;
}

export const BrandSection = ({ brandGroup }: BrandSectionProps) => {
  return (
    <section className="mb-16">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold text-gray-900 dark:text-white lg:text-4xl">
          {brandGroup.brand}
        </h2>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
          {brandGroup.totalDevices}{" "}
          {brandGroup.totalDevices === 1
            ? "устройство"
            : brandGroup.totalDevices < 5
            ? "устройства"
            : "устройств"}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {brandGroup.devices
          .map((device) => ({ ...device, ratingPosition: null }))
          .map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              className="w-full md:w-full"
            />
          ))}
      </div>
    </section>
  );
};
