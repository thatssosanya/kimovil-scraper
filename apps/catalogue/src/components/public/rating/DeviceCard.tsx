import { SignedIn } from "@clerk/nextjs";
import { Pencil, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { RatingBadge } from "@/src/components/shared/RatingBadge";
import { DeviceImage } from "@/src/components/shared/DeviceImage";
import { cn } from "@/src/lib/utils";
import { useRouter } from "next/router";
import { capitalize } from "./RatingGroup";
import { buildUniqueConfigSummaries } from "@/src/components/dashboard/device/components/cards/configSummary";
import { extractDigits } from "@/src/utils/utils";
import { useMemo } from "react";

interface DeviceCardProps {
  style?: "normal" | "compact";
  device: {
    id: string;
    imageUrl?: string | null;
    name?: string | null;
    configs?: Array<{
      name?: string | null;
      capacity?: string | null;
    }>;
    link?: {
      url: string | null;
      name?: string | null;
      marketplace?: {
        name: string | null;
        iconUrl: string | null;
      };
    } | null;
    description?: string | null;
    ratingPosition?: number | null;
    price?: number | null;
    slug?: string | null;
    valueRating?: number | null;
  };
  className?: string;
}

// Helper function to get value rating color based on the same logic as ValueRating component
function getValueRatingColor(value: number) {
  if (value >= 90) return "bg-gradient-to-br from-[#70DB5D] to-[#40B32C]";
  if (value >= 80) return "bg-gradient-to-br from-[#5D96DB] to-[#2C67B3]";
  if (value >= 70) return "bg-gradient-to-br from-[#5D96DB] to-[#2C67B3]";
  if (value >= 60) return "bg-gradient-to-br from-[#5D96DB] to-[#2C67B3]";
  if (value >= 40) return "bg-gradient-to-br from-[#DB5D5D] to-[#B32C2C]";
  return "bg-gradient-to-br from-[#DB5D5D] to-[#B32C2C]";
}

export const DeviceCard = ({
  device,
  style = "normal",
  className,
}: DeviceCardProps) => {
  const deviceUrl = device.slug
    ? `/devices/${device.slug}`
    : device?.link?.url || "#";

  const isFirst = device.ratingPosition === 1;

  const router = useRouter();
  const deviceLink = device.link?.url;

  const descriptionValue = device?.description?.trim() || "";

  const description = capitalize(descriptionValue);

  const isCompact = style === "compact";
  const uniqueConfigs = useMemo(() => {
    if (!device.configs?.length) {
      return [];
    }

    return buildUniqueConfigSummaries(
      device.configs.map((config, index) => ({
        id: `${device.id}-${index}-${config.name ?? "config"}`,
        name: config.name ?? null,
        capacity: config.capacity ?? null,
        links: [],
        ram: null,
      }))
    );
  }, [device.configs, device.id]);

  const sortedConfigChips = useMemo(
    () =>
      uniqueConfigs
        .slice()
        .sort((a, b) => {
          const aValue = a.sortValue ?? extractDigits(a.name);
          const bValue = b.sortValue ?? extractDigits(b.name);

          if (aValue !== bValue) {
            return aValue - bValue;
          }

          return a.name.localeCompare(b.name, "ru");
        }),
    [uniqueConfigs]
  );

  if (isCompact) {
    return (
      <a
        href={deviceUrl}
        key={device.id}
        className={cn(
          "group relative flex w-[175px] flex-shrink-0 flex-col items-center gap-1 rounded-[24px] bg-gray-100 p-4 pb-6 transition-all duration-300 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 ",
          isFirst && "col-span-2",
          className
        )}
      >
        {device.ratingPosition && (
          <RatingBadge
            position={device.ratingPosition}
            variant="card"
            size="small"
            className="absolute right-2 top-2 scale-75"
          />
        )}
        <div className={cn("relative h-[120px] w-full py-4 ")}>
          <DeviceImage
            src={device.imageUrl}
            alt={
              device.name
                ? `${device.name} - фото устройства`
                : "Изображение устройства"
            }
            width={150}
            height={120}
            className="h-full w-full rounded object-contain"
          />
        </div>
        <div className="flex w-full items-center justify-start">
          <h5
            className={cn(
              "  self-start text-left text-base font-semibold text-gray-900 dark:text-white"
            )}
          >
            {device.name}
          </h5>
          {device.valueRating && (
            <div
              className={cn(
                "ml-2 flex h-6 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                getValueRatingColor(device.valueRating)
              )}
              title={`Индекс цены/качества: ${device.valueRating}`}
            >
              {device.valueRating}
            </div>
          )}
        </div>
        <div className="">
          {device.description && (
            <p className="text-wrap  line-clamp-3 break-keep text-sm font-medium text-gray-600 dark:text-gray-300">
              {description}
              {description.slice(-1) === "." ? "" : "."}
            </p>
          )}
        </div>

        {device.price && (
          <div className="mt-2 flex w-full items-center justify-between">
            <div
              className={cn(
                "xs:text-base text-xs font-semibold text-gray-900 dark:text-white",
                isFirst && "text-xl"
              )}
            >
              <span className="text-gray-500 dark:text-gray-400">от</span>{" "}
              {device.price.toLocaleString("ru-RU")} ₽
            </div>
            {deviceLink && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  router.push(deviceLink).catch((err) => {
                    console.error(err);
                  });
                }}
                className={cn(
                  "group/buy flex  h-11 w-11 cursor-pointer items-center justify-center gap-4 rounded-full bg-gray-900 text-white transition-all hover:bg-amber-400 dark:bg-white dark:text-gray-900  dark:hover:bg-gray-200",
                  isFirst && " hover:w-32"
                )}
              >
                <span
                  className={cn(
                    "hidden w-0 text-sm transition-all group-hover/buy:w-fit group-hover/buy:opacity-100 ",
                    isFirst && "group-hover/buy:block"
                  )}
                >
                  Купить
                </span>
                <ShoppingCart className="h-4  w-4 justify-self-end" />
              </button>
            )}
          </div>
        )}
      </a>
    );
  }

  return (
    <div
      key={device.id}
      className={cn(
        "group relative flex max-w-[220px] flex-shrink-0 flex-col items-center gap-1 rounded-[24px] bg-gray-100 p-6 pb-6 transition-all duration-300 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 md:w-[260px] md:max-w-none",
        isFirst && "col-span-2",
        className
      )}
    >
      {/* Card link covering entire card */}
      <Link
        href={deviceUrl}
        className="absolute inset-0 z-0 rounded-[24px]"
        aria-label={device.name ?? "Device"}
      />
      <SignedIn>
        <Link
          href={`/dashboard/devices/${device.id}`}
          className="group/edit absolute left-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white transition-all duration-300 hover:bg-gray-600 dark:bg-gray-900 dark:hover:bg-gray-600"
        >
          <Pencil className="pointer-events-none h-4 w-4 text-gray-900 group-hover/edit:text-white dark:text-gray-100" />
        </Link>
      </SignedIn>
      {device.ratingPosition && (
        <RatingBadge
          position={device.ratingPosition}
          variant="card"
          className="absolute right-4 top-4 z-10"
        />
      )}
      <div
        className={cn(
          "pointer-events-none relative z-10 h-[150px] w-full py-4 md:h-[220px] md:py-6",
          isFirst && "h-[220px] py-6",
          !isFirst && "px-8"
        )}
      >
        <DeviceImage
          src={device.imageUrl}
          alt={
            device.name
              ? `${device.name} - фото устройства`
              : "Изображение устройства"
          }
          width={220}
          height={isFirst ? 220 : 150}
          className="h-full w-full rounded object-contain"
        />
      </div>
      <div className="pointer-events-none relative z-10 flex w-full items-center justify-start">
        <h5
          className={cn(
            "  self-start text-left text-base font-semibold text-gray-900 dark:text-white md:text-xl",
            isFirst && "text-2xl"
          )}
        >
          {device.name}
        </h5>
        {device.valueRating && (
          <div
            className={cn(
              "ml-2 flex h-6 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
              getValueRatingColor(device.valueRating)
            )}
            title={`Индекс цены/качества: ${device.valueRating}`}
          >
            {device.valueRating}
          </div>
        )}
      </div>

      {sortedConfigChips.length > 0 && (
        <div className="pointer-events-none relative z-10 hidden w-full flex-shrink-0 grid-cols-[3fr_3fr_3fr_0.5fr] justify-stretch gap-2 md:mt-3 md:grid">
          {sortedConfigChips.slice(0, 3).map((config) => (
            <div
              className="-my-2 flex-1 rounded-full bg-white p-2 text-center text-xs font-semibold text-gray-600 transition-all duration-300 group-hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:group-hover:bg-gray-800"
              key={config.key}
            >
              {config.name}
            </div>
          ))}
          {sortedConfigChips.length > 3 && (
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              ...
            </div>
          )}
        </div>
      )}
      <div className="pointer-events-none relative z-10 md:mt-2">
        {device.description && (
          <p className="text-wrap  line-clamp-5 break-keep text-sm font-medium text-gray-600 dark:text-gray-300">
            {description}
            {description.slice(-1) === "." ? "" : "."}
          </p>
        )}
      </div>

      {device.price && (
        <div className="relative z-10 mt-auto flex w-full items-center justify-between">
          <div
            className={cn(
              "xs:text-base text-xs font-semibold text-gray-900 dark:text-white",
              isFirst && "text-xl"
            )}
          >
            <span className="text-gray-500 dark:text-gray-400">от</span>{" "}
            {device.price.toLocaleString("ru-RU")} ₽
          </div>
          {deviceLink && (
            <button
              onClick={(e) => {
                e.preventDefault();
                router.push(deviceLink).catch((err) => {
                  console.error(err);
                });
              }}
              className={cn(
                "group/buy flex  h-11 w-11 cursor-pointer items-center justify-center gap-4 rounded-full bg-gray-900 text-white transition-all hover:bg-amber-400 dark:bg-white dark:text-gray-900  dark:hover:bg-gray-200",
                isFirst && " hover:w-32"
              )}
            >
              <span
                className={cn(
                  "hidden w-0 text-sm transition-all group-hover/buy:w-fit group-hover/buy:opacity-100 ",
                  isFirst && "group-hover/buy:block"
                )}
              >
                Купить
              </span>
              <ShoppingCart className="h-4  w-4 justify-self-end" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
