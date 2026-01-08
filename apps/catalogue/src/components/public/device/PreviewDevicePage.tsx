import { api } from "@/src/utils/api";
import Head from "next/head";
import {
  type PhoneData,
  type RawPhoneData,
} from "@repo/scraper-domain";
import { ruDateFormatter } from "@/src/utils/utils";
import { DeviceImage } from "@/src/components/shared/DeviceImage";
import { CameraSpecifications } from "./components/specifications/CameraSpecifications";
import {
  BatterySpecifications,
  PhysicalSpecifications,
  ProcessorSpecifications,
  ScreenSpecifications,
} from "./components/specifications";
import { SecurityFeatures } from "./components/specifications/SecurityFeatures";
import { Benchmarks } from "./components/specifications/Benchmarks";
import { DevicePageSkeleton } from "./components/DevicePageSkeleton";
import { DevicePageError } from "./components/DevicePageError";
import { Preview } from "@/src/components/dashboard/device/components/preview/Preview";
import { type DeviceData } from "./types";

type PreviewDevicePageProps = {
  slug: string;
};

function mapPhoneDataToDeviceData(
  phone: PhoneData,
  _rawPhone: RawPhoneData | undefined,
  imageUrl: string | null
): DeviceData {
  return {
    id: phone.slug,
    name: phone.name,
    brand: phone.brand,
    releaseDate: phone.releaseDate ? new Date(phone.releaseDate) : null,
    redirectSlug: null,
    height_mm: phone.height_mm,
    width_mm: phone.width_mm,
    thickness_mm: phone.thickness_mm,
    weight_g: phone.weight_g,
    ipRating: phone.ipRating,
    materials: phone.materials.join("|"),
    batteryCapacity_mah: phone.batteryCapacity_mah,
    batteryFastCharging: phone.batteryFastCharging,
    batteryWattage: phone.batteryWattage,
    fingerprintPosition: phone.fingerprintPosition,
    cpu: phone.cpu,
    cpuManufacturer: phone.cpuManufacturer,
    cpuCores: phone.cpuCores?.join("|") ?? null,
    cpuCoresArr: [...(phone.cpuCores ?? [])],
    gpu: phone.gpu,
    nfc: phone.nfc,
    bluetooth: phone.bluetooth,
    sim: phone.sim.join("|"),
    simCount: phone.simCount,
    usb: phone.usb,
    headphoneJack: phone.headphoneJack,
    displayFeaturesArr: [...phone.displayFeatures],
    screens: [
      {
        id: "main",
        position: "main",
        size_in: phone.size_in,
        displayType: phone.displayType,
        resolution: phone.resolution,
        aspectRatio: phone.aspectRatio,
        ppi: phone.ppi,
        displayFeatures: phone.displayFeatures.join("|"),
        refreshRate: null,
        brightnessNits: null,
        isMain: true,
      },
    ],
    benchmarks: phone.benchmarks.map((b, i) => ({
      id: `bench-${i}`,
      name: b.name,
      score: b.score,
    })),
    cameras: phone.cameras.map((c, i) => ({
      id: `cam-${i}`,
      type: c.type,
      resolution_mp: c.resolution_mp,
      aperture_fstop: c.aperture_fstop,
      sensor: c.sensor,
      features: c.features?.join("|") ?? null,
    })),
    device: {
      id: phone.slug,
      description: null,
      imageUrl: imageUrl,
      valueRating: null,
      links: [],
      ratingPositions: [],
    },
  } as DeviceData;
}

export const PreviewDevicePage = ({ slug }: PreviewDevicePageProps) => {
  const {
    data,
    status,
    error,
    refetch,
  } = api.scraperService.getDeviceData.useQuery(
    { slug, dataKind: "specs" },
    { refetchOnMount: false, refetchOnWindowFocus: false }
  );

  const { data: rawData } = api.scraperService.getDeviceRawData.useQuery(
    { slug, source: "kimovil", dataKind: "specs" },
    { refetchOnMount: false, refetchOnWindowFocus: false }
  );

  if (status === "pending") {
    return <DevicePageSkeleton />;
  }

  if (status === "error" || !data?.data) {
    return <DevicePageError error={error} retry={() => void refetch()} />;
  }

  const phone = data.data as PhoneData;
  const rawPhone = rawData?.data as RawPhoneData | undefined;
  const imageUrl = rawPhone?.images?.[0] ?? null;
  const deviceData = mapPhoneDataToDeviceData(phone, rawPhone, imageUrl);

  const deviceTitle = `${phone.brand} ${phone.name}`;
  const fullDescription = "Подробная информация о " + deviceTitle;

  const releaseDate = phone.releaseDate ? new Date(phone.releaseDate) : undefined;

  return (
    <>
      <Head>
        <title>{deviceTitle} | Предпросмотр</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="mt-14 flex flex-col gap-16 pb-8">
        {/* Preview banner */}
        <div className="rounded-lg bg-amber-100 p-3 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          ⚠️ Режим предпросмотра — данные из скрейпера (не опубликовано)
        </div>

        <div
          className="flex grid-cols-2 flex-col gap-6 md:grid md:gap-16"
          id="device-header"
        >
          <div className="grid-cols-4 flex-col gap-4 md:grid">
            <div className="col-span-4 flex h-[350px] items-center justify-center rounded-3xl bg-gray-100 dark:bg-gray-800 md:grid md:h-[550px] lg:h-[500px] lg:grid-cols-2">
              <div className="relative h-full w-full p-4 md:p-12">
                <DeviceImage
                  src={imageUrl}
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
              </div>
            </div>
            <div className="hidden w-full flex-wrap items-center justify-center gap-4 rounded-3xl lg:flex lg:h-[155px] xl:auto-cols-fr xl:grid-flow-col">
              {/* No purchase options for preview */}
              <div className="text-center text-gray-500">
                <p className="text-sm">Ссылки на покупку недоступны в предпросмотре</p>
              </div>
            </div>
          </div>
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
      </div>
    </>
  );
};
