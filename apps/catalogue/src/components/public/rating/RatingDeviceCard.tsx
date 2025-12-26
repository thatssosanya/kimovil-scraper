import React, { memo } from "react";
import Link from "next/link";
import { SignedIn } from "@clerk/nextjs";
import { ArrowUpRight, Pencil, ShoppingBag } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { DeviceImage } from "@/src/components/shared/DeviceImage";
import { RankBadge } from "@/src/components/shared/RankBadge";
import { buildUniqueConfigSummaries } from "@/src/components/dashboard/device/components/cards/configSummary";
import { extractDigits } from "@/src/utils/utils";

function getValueRatingColor(value: number) {
  if (value >= 80) return "from-emerald-400 to-emerald-600";
  if (value >= 60) return "from-sky-400 to-sky-600";
  if (value >= 40) return "from-amber-400 to-amber-600";
  return "from-rose-400 to-rose-600";
}

type DeviceType = {
  id: string;
  name: string | null;
  description: string | null;
  imageUrl: string | null;
  price: number | null;
  ratingPosition: number | null;
  valueRating?: number | null;
  link: {
    url: string | null;
    name: string | null;
    marketplace: {
      name: string | null;
      iconUrl: string | null;
    } | null;
  } | null;
  configs?: Array<{
    id: string;
    name: string | null;
    capacity: string | null;
    ram: string | null;
  }>;
  characteristics: {
    slug: string | null;
  } | null;
  prosAndCons?: {
    pros: Array<{ id: string; text: string }>;
    cons: Array<{ id: string; text: string }>;
  };
};

type RatingDeviceCardProps = {
  device: DeviceType;
  position: number;
};

const RatingDeviceCardComponent = ({
  device,
  position,
}: RatingDeviceCardProps) => {
  const deviceUrl = device.characteristics?.slug
    ? `/devices/${device.characteristics.slug}`
    : `/devices/${device.id}`;

  const pros = device.prosAndCons?.pros || [];
  const cons = device.prosAndCons?.cons || [];
  const hasProsAndCons = pros.length > 0 || cons.length > 0;

  const uniqueConfigs = React.useMemo(() => {
    if (!device.configs?.length) return [];
    return buildUniqueConfigSummaries(
      device.configs.map((config, index) => ({
        id: config.id || `${device.id}-${index}-${config.name ?? "config"}`,
        name: config.name,
        capacity: config.capacity,
        ram: config.ram,
        links: [],
      }))
    );
  }, [device.configs, device.id]);

  const sortedConfigChips = React.useMemo(
    () =>
      uniqueConfigs.slice().sort((a, b) => {
        const aValue = a.sortValue ?? extractDigits(a.name);
        const bValue = b.sortValue ?? extractDigits(b.name);
        if (aValue !== bValue) return aValue - bValue;
        return a.name.localeCompare(b.name, "ru");
      }),
    [uniqueConfigs]
  );

  return (
    <article className="group relative overflow-hidden rounded-3xl bg-zinc-100 dark:bg-zinc-900">

      {/* Main card link */}
      <Link
        href={deviceUrl}
        className="absolute inset-0 z-0"
        aria-label={device.name ?? "Device"}
      />

      {/* Admin Edit Button */}
      <SignedIn>
        <Link
          href={`/dashboard/devices/${device.id}`}
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 opacity-0 shadow-lg transition-all duration-300 hover:bg-zinc-700 hover:scale-110 group-hover:opacity-100 dark:bg-white dark:hover:bg-zinc-200 md:right-6 md:top-6"
        >
          <Pencil className="h-4 w-4 pointer-events-none text-white dark:text-zinc-900" />
        </Link>
      </SignedIn>

      <div className="relative grid gap-0 lg:grid-cols-[240px_1fr] xl:grid-cols-[260px_1fr]">
        {/* Image Section */}
        <div className="relative flex items-center justify-center p-6 lg:p-8">
          {/* Position badge */}
          <div className="absolute left-4 top-4 z-10 lg:left-6 lg:top-6">
            <RankBadge rank={position} size="large" />
          </div>

          {/* Value rating badge */}
          {device.valueRating && (
            <div
              className={cn(
                "absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow-lg lg:right-6 lg:top-6",
                getValueRatingColor(device.valueRating)
              )}
              title={`Индекс цены/качества: ${device.valueRating}`}
            >
              {device.valueRating}
            </div>
          )}

          <div className="pointer-events-none relative aspect-square w-full max-w-[140px] transition-transform duration-500 group-hover:scale-[1.02] lg:max-w-[160px]">
            <DeviceImage
              src={device.imageUrl}
              alt={device.name ? `${device.name}` : "Изображение устройства"}
              width={160}
              height={160}
              className="h-full w-full object-contain drop-shadow-lg"
              priority={position <= 3}
            />
          </div>
        </div>

        {/* Content Section */}
        <div className="relative z-10 flex flex-col gap-4 p-6 pt-0 lg:p-8 lg:pt-8">
          {/* Header */}
          <header className="space-y-3">
            <Link
              href={deviceUrl}
              className="group/title relative z-10 inline-flex items-center gap-2"
            >
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white md:text-3xl lg:text-4xl">
                {device.name}
              </h2>
              <ArrowUpRight className="h-5 w-5 flex-shrink-0 text-zinc-400 transition-transform duration-200 group-hover/title:translate-x-0.5 group-hover/title:-translate-y-0.5 dark:text-zinc-500 md:h-6 md:w-6" />
            </Link>
            {device.description && (
              <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-400 lg:text-lg">
                {device.description}
              </p>
            )}
          </header>

          {/* Configurations */}
          {sortedConfigChips.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Конфигурации
              </h3>
              <div className="flex flex-wrap gap-2">
                {sortedConfigChips.map((config) => (
                  <span
                    key={config.key}
                    className="rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors duration-200 group-hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-300 dark:group-hover:bg-zinc-700"
                  >
                    {config.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Pros and Cons */}
          {hasProsAndCons && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                <span className="text-emerald-500">Плюсы</span>
                <span className="mx-1.5 text-zinc-300 dark:text-zinc-600">/</span>
                <span className="text-rose-500">минусы</span>
              </h3>
              <div className="space-y-2">
                {pros.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pros.map((pro) => (
                      <span
                        key={pro.id}
                        className="rounded-full bg-emerald-500/10 px-3.5 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                      >
                        {pro.text}
                      </span>
                    ))}
                  </div>
                )}
                {cons.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {cons.map((con) => (
                      <span
                        key={con.id}
                        className="rounded-full bg-rose-500/10 px-3.5 py-1.5 text-sm font-medium text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
                      >
                        {con.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Price and Actions */}
          {device.price && (
            <div className="mt-auto flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Цена от
                </p>
                <p className="text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-white md:text-3xl">
                  {device.price.toLocaleString("ru-RU")}{" "}
                  <span className="text-lg text-zinc-400">₽</span>
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {device.link?.url && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const url = device.link?.url;
                      if (url) window.open(url, "_blank", "noopener,noreferrer");
                    }}
                    className="relative z-10 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-zinc-900 px-6 font-medium text-white shadow-md transition-all duration-300 hover:bg-zinc-800 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    <span>Купить</span>
                  </button>
                )}
                <Link
                  href={deviceUrl}
                  className="relative z-10 flex h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-zinc-600 transition-all duration-300 hover:bg-zinc-50 hover:scale-[1.02] dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <span className="text-sm font-medium">Характеристики и цены</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

export const RatingDeviceCard = memo(RatingDeviceCardComponent);
