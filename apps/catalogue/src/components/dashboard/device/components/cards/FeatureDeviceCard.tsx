import React from "react";
import Image from "next/image";
import Link from "next/link";
import { SignedIn } from "@clerk/nextjs";
import { Pencil } from "lucide-react";
import { api } from "@/src/utils/api";
import { rubleCurrencyFormatter } from "@/src/utils/utils";
import { ProsConsAdapter } from "../../views/components/ProsConsAdapter";

type DeviceType = {
  id: string;
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  price: number | null;
};

type FeatureDeviceCardProps = {
  device: DeviceType;
};

export const FeatureDeviceCard = ({ device }: FeatureDeviceCardProps) => {
  const { data: prosAndCons } = api.device.getDeviceProsAndCons.useQuery({
    deviceId: device.id,
  });

  const pros = prosAndCons?.pros;
  const cons = prosAndCons?.cons;
  const hasProsAndCons = pros && cons && pros.length > 0 && cons.length > 0;

  return (
    <div className="rounded-4xl xs:p-6 relative w-full bg-zinc-100 p-4 dark:bg-gray-800 sm:p-8 lg:p-12">
      <SignedIn>
        <Link
          href={`/dashboard/devices/${device.id}`}
          className="group/edit xs:left-4 xs:top-4 xs:h-8 xs:w-8 xs:p-2 absolute left-3 top-3 h-7 w-7 overflow-hidden rounded-full bg-white p-1.5 transition-all duration-300 hover:bg-gray-600 dark:bg-gray-900 dark:hover:bg-gray-600"
        >
          <Pencil className="h-full w-full text-gray-900 group-hover/edit:text-white dark:text-gray-100" />
        </Link>
      </SignedIn>

      <div className="xs:gap-6 flex flex-col gap-4 lg:grid lg:grid-cols-[0.47fr_0.72fr] lg:gap-8 xl:gap-12">
        {/* Image Container */}
        <div className="xs:max-w-[320px] relative mx-auto w-full max-w-[280px] sm:max-w-[380px] lg:mx-0 lg:max-w-none">
          <div className=" w-full overflow-hidden rounded-2xl p-2">
            <Image
              src={device.imageUrl || ""}
              alt={device.name || ""}
              width={400}
              height={400}
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        {/* Content Container */}
        <div className="xs:gap-3 flex h-full flex-col gap-2 py-2 sm:py-4 lg:justify-center lg:py-0">
          <h3 className="xs:text-2xl text-xl font-semibold leading-tight dark:text-white sm:text-3xl lg:text-4xl xl:text-5xl">
            {device.name}
          </h3>
          <p className="xs:text-base text-sm font-medium text-gray-500 dark:text-gray-400 sm:text-lg lg:text-xl">
            {device.description}
          </p>

          {device.price && (
            <div className="xs:gap-4 mt-4 flex flex-col gap-3 sm:mt-6 lg:mt-auto lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-1">
                <p className="xs:text-2xl text-xl font-medium text-gray-500 dark:text-gray-400 sm:text-3xl lg:text-4xl xl:text-5xl">
                  от{" "}
                  <span className="font-semibold text-black dark:text-white">
                    {rubleCurrencyFormatter(device.price)}
                  </span>
                </p>
              </div>
              <button className="xs:py-3 xs:text-base w-full rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-gray-700 dark:hover:bg-gray-600 sm:text-lg lg:w-auto lg:min-w-[180px] lg:py-4 lg:text-xl xl:min-w-[200px]">
                Купить
              </button>
            </div>
          )}
        </div>
      </div>

      {hasProsAndCons && (
        <div className="xs:mt-8 xs:gap-4 mt-6 flex flex-col gap-3 lg:mt-12">
          <div className="xs:gap-2 xs:text-xl flex flex-wrap items-center gap-1 text-lg font-semibold dark:text-white sm:text-2xl lg:text-3xl">
            <span className="text-[#40B32C]">Плюсы</span>
            <span>и</span>
            <span className="text-[#EB4967]">минусы</span>
          </div>
          <ProsConsAdapter deviceId={device.id} />
        </div>
      )}
    </div>
  );
};
