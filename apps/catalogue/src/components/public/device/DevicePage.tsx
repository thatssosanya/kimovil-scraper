import { api } from "@/src/utils/api";
import { type DevicePageProps } from "./types";
import { generateDeviceSchema } from "./utils/schemaHelper";
import Head from "next/head";
import { ruDateFormatter } from "@/src/utils/utils";
import { ValueRating } from "@/src/components/dashboard/rating/components/ValueRating";
import { Preview } from "@/src/components/dashboard/device/components/preview/Preview";
import { RatingBadge } from "@/src/components/shared/RatingBadge";
import { DeviceImage } from "@/src/components/shared/DeviceImage";
import { PurchaseOptions } from "./components/PurchaseOptions";
import { ProsConsAdapter } from "@/src/components/dashboard/device/views/components/ProsConsAdapter";
import { CameraSpecifications } from "./components/specifications/CameraSpecifications";
import {
  BatterySpecifications,
  PhysicalSpecifications,
  ProcessorSpecifications,
  ScreenSpecifications,
} from "./components/specifications";
import { SecurityFeatures } from "./components/specifications/SecurityFeatures";
import { Benchmarks } from "./components/specifications/Benchmarks";
import { RelevantDevices } from "./components/RelevantDevices";
import { DevicePageSkeleton } from "./components/DevicePageSkeleton";
import { DevicePageError } from "./components/DevicePageError";
import { useRouter } from "next/router";

export const DevicePage = (props: DevicePageProps) => {
  const { slug } = props;
  const router = useRouter();

  const {
    data: deviceData,
    status,
    error,
    refetch,
  } = api.device.getDeviceCharacteristicBySlug.useQuery(
    { slug },
    { refetchOnMount: false, refetchOnWindowFocus: false }
  );

  // Handle redirect for duplicate devices
  if (deviceData?.redirectSlug) {
    void router.replace(`/devices/${deviceData.redirectSlug}`);
    return <DevicePageSkeleton />;
  }

  const { data: deviceProsAndCons } = api.device.getDeviceProsAndCons.useQuery(
    { deviceId: deviceData?.device?.id ?? "" },
    {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      enabled: !!deviceData?.device?.id,
    }
  );

  // Loading state
  if (status === "pending") {
    return <DevicePageSkeleton />;
  }

  // Error state
  if (status === "error" || !deviceData) {
    return <DevicePageError error={error} retry={() => void refetch()} />;
  }

  const deviceTitle = `${deviceData.brand} ${deviceData.name}`;
  const fullDescription =
    deviceData.device?.description ?? "Подробная информация о " + deviceTitle;

  const schemaProsAndCons = {
    pros: deviceProsAndCons?.pros.map((pro) => pro.text) ?? [],
    cons: deviceProsAndCons?.cons.map((con) => con.text) ?? [],
  };

  const jsonLd = generateDeviceSchema(
    deviceData,
    deviceTitle,
    fullDescription,
    schemaProsAndCons
  );

  const releaseDate = deviceData?.releaseDate
    ? new Date(deviceData.releaseDate)
    : undefined;

  return (
    <>
      <Head>
        {jsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        )}
      </Head>
      <div className="mt-14 flex flex-col gap-16 pb-8">
        <div
          className="flex grid-cols-2 flex-col gap-6  md:grid md:gap-16"
          id="device-header"
        >
          <div className=" grid-cols-4 flex-col gap-4 md:grid">
            <div className="col-span-4 flex h-[350px] items-center justify-center rounded-3xl bg-gray-100 dark:bg-gray-800 md:grid md:h-[550px] lg:h-[500px] lg:grid-cols-2">
              <div className="relative h-full w-full p-4 md:p-12">
                <DeviceImage
                  src={deviceData.device?.imageUrl}
                  alt={`${deviceTitle} - фото устройства`}
                  width={400}
                  height={400}
                  className="mx-auto h-full max-h-[350px] rounded-lg object-contain"
                  priority
                />
              </div>
              <div className="hidden items-center justify-center px-12 lg:flex">
                <Preview deviceData={deviceData} />
              </div>
            </div>
            <div className="hidden h-[155px] w-full items-center justify-center rounded-3xl bg-gray-100 py-2 dark:bg-gray-800 lg:flex"></div>
            <div className="hidden h-[155px] w-full rounded-3xl bg-gray-100 dark:bg-gray-800 lg:flex"></div>
            <div className="hidden h-[155px] w-full rounded-3xl bg-gray-100 dark:bg-gray-800 lg:flex"></div>
            <div className="hidden h-[155px] w-full rounded-3xl bg-gray-100 dark:bg-gray-800 lg:flex"></div>
          </div>
          <div className="flex flex-col items-start justify-start gap-4">
            <div className="flex flex-col gap-4 md:h-auto lg:h-[500px]">
              <h1 className="text-5xl font-semibold leading-none text-gray-900 dark:text-white">
                {deviceTitle}
              </h1>
              {releaseDate && (
                <div className="flex items-center gap-2">
                  <div className="flex w-max flex-col items-center gap-1.5 rounded-full bg-green-100 px-4 py-2 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <time
                      dateTime={releaseDate.toISOString()}
                      className="text-sm font-medium"
                    >
                      {ruDateFormatter(releaseDate, { day: undefined })}
                    </time>
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    дата выхода в продажу
                  </span>
                </div>
              )}
              <p className="text-lg font-medium text-gray-600 dark:text-gray-300 lg:text-xl">
                {fullDescription}
              </p>
              <div className="mt-auto flex flex-col gap-4">
                {deviceData.device?.ratingPositions &&
                deviceData.device.ratingPositions.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {deviceData.device.ratingPositions.map((rating) => (
                      <RatingBadge
                        key={rating.rating.name}
                        position={rating.position}
                        categoryName={rating.rating.name}
                        size="large"
                        variant="profile"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-4xl font-bold text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                      —
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Устройство еще не добавлено в рейтинги
                      </span>
                    </div>
                  </div>
                )}
                <ValueRating value={deviceData.device?.valueRating ?? 0} />
              </div>
            </div>
            <div className="hidden w-full  flex-wrap  items-center  justify-center gap-4 rounded-3xl lg:flex lg:h-[155px] xl:auto-cols-fr xl:grid-flow-col">
              <PurchaseOptions deviceData={deviceData} />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4 lg:hidden">
          <h2 className="text-4xl font-semibold text-gray-900 dark:text-white">
            Купить {deviceTitle}
          </h2>
          <PurchaseOptions deviceData={deviceData} />
        </div>
        <div className="flex flex-col gap-4" id="device-features">
          <h2 className="text-4xl font-semibold text-gray-900 dark:text-white">
            Плюсы и минусы устройства
          </h2>
          {deviceData.device?.id && (
            <ProsConsAdapter deviceId={deviceData.device.id} />
          )}
        </div>
        <div id="device-characteristics">
          <h2 className="text-4xl font-semibold text-gray-900 dark:text-white">
            Основные характеристики
          </h2>
          <div className="mt-8 flex flex-col gap-12">
            <CameraSpecifications deviceData={deviceData} />
            <ScreenSpecifications deviceData={deviceData} />
            <ProcessorSpecifications deviceData={deviceData} />
            <PhysicalSpecifications deviceData={deviceData} />
            <SecurityFeatures deviceData={deviceData} />
            <BatterySpecifications deviceData={deviceData} />
            <Benchmarks deviceData={deviceData} />
          </div>
        </div>
        <div className="mt-16 flex flex-col gap-4" id="device-relevant-devices">
          <h2 className="text-4xl font-semibold text-gray-900 dark:text-white">
            Похожие устройства
          </h2>
          <RelevantDevices deviceId={deviceData.device?.id ?? ""} />
        </div>
      </div>
    </>
  );
};
