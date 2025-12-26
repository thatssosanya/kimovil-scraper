import React, { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { rubleCurrencyFormatter } from "@/src/utils/utils";
import { motion } from "framer-motion";
import {
  ChevronRight,
  ExternalLink,
  ArrowUpRight,
  ShoppingCart,
  Pencil,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/Tooltip";
import { cn } from "@/src/utils/cn";
import { SignedIn } from "@clerk/nextjs";
import {
  buildUniqueConfigSummaries,
  type ConfigLink,
  type ConfigSummary,
  type DeviceConfig,
} from "./configSummary";

type MinimalDevice = {
  id: string;
  name: string | null;
  imageUrl: string | null;
  description: string | null;
  slug?: string | null;
  hasCharacteristics?: boolean;
  links?: Array<{
    id: string;
    url: string | null;
    price: number | null;
    marketplace?: {
      id: string;
      name: string | null;
      iconUrl?: string | null;
    } | null;
  }>;
  configs?:
    | Array<{
        config: {
          id: string;
          name: string | null;
          capacity?: string | null;
          ram?: string | null;
          links?: ConfigLink[];
        };
      }>
    | Array<{
        id: string;
        name: string | null;
        capacity?: string | null;
        ram?: string | null;
        links?: ConfigLink[];
      }>;
  RatingPosition?: Array<{ position: number }>;
};

type PhoneCardProps = {
  device: MinimalDevice;
  index: number;
};

export const PhoneCard = React.memo(({ device, index }: PhoneCardProps) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Handle both direct device and nested device.device structure
  const actualDevice = device;
  const deviceSlug =
    actualDevice.slug || actualDevice.name?.toLowerCase().replace(/\s+/g, "-");
  const hasCharacteristics = actualDevice.hasCharacteristics ?? false;

  // Extract configs from Drizzle junction table format with proper typing
  const extractedConfigs = useMemo<DeviceConfig[]>(() => {
    if (!actualDevice.configs) return [];

    return actualDevice.configs.map((configWrapper) => {
      const config =
        "config" in configWrapper ? configWrapper.config : configWrapper;
      return {
        id: config.id,
        name: config.name,
        capacity: config.capacity,
        ram: config.ram,
        links: config.links || [],
      };
    });
  }, [actualDevice.configs]);

  const lowestPriceLink = React.useMemo(() => {
    const allLinks: { price: number; url: string }[] = [];

    actualDevice.links?.forEach((link) => {
      if (
        typeof link.price === "number" &&
        link.price > 0 &&
        typeof link.url === "string"
      ) {
        allLinks.push({ price: link.price, url: link.url });
      }
    });

    if (extractedConfigs.length > 0) {
      extractedConfigs.forEach((config) => {
        config.links?.forEach((link) => {
          if (
            typeof link.price === "number" &&
            link.price > 0 &&
            typeof link.url === "string"
          ) {
            allLinks.push({ price: link.price, url: link.url });
          }
        });
      });
    }

    return allLinks.length > 0
      ? allLinks.reduce((lowest, current) =>
          current.price < lowest.price ? current : lowest
        )
      : null;
  }, [actualDevice.links, extractedConfigs]);

  const { minPrice, maxPrice } = React.useMemo(() => {
    const devicePrices =
      actualDevice.links
        ?.map((link) => link.price)
        .filter(
          (price): price is number => typeof price === "number" && price > 0
        ) || [];

    const configPrices =
      extractedConfigs.flatMap(
        (config) =>
          config.links
            ?.map((link) => link.price)
            .filter(
              (price): price is number => typeof price === "number" && price > 0
            ) || []
      ) || [];

    const allPrices = [...devicePrices, ...configPrices];

    return {
      minPrice: allPrices.length > 0 ? Math.min(...allPrices) : 0,
      maxPrice: allPrices.length > 0 ? Math.max(...allPrices) : 0,
    };
  }, [actualDevice.links, extractedConfigs]);

  const configsWithLinks = React.useMemo(
    () =>
      extractedConfigs.filter((config): config is DeviceConfig =>
        Boolean(config.links?.length)
      ) || [],
    [extractedConfigs]
  );

  const uniqueConfigs = React.useMemo<ConfigSummary[]>(
    () => buildUniqueConfigSummaries(extractedConfigs),
    [extractedConfigs]
  );

  const hasVariants = configsWithLinks.length > 0;

  const description = useMemo(() => {
    let descWithAppendedDot = actualDevice.description;
    if (descWithAppendedDot && !descWithAppendedDot.endsWith(".")) {
      descWithAppendedDot += ".";
    }
    return descWithAppendedDot;
  }, [actualDevice.description]);

  return (
    <motion.div
      className={cn(
        "bg-card/50 hover:bg-card dark:bg-card/30 dark:hover:bg-card/50 select-none overflow-hidden rounded-lg transition-all duration-200",
        hasCharacteristics && "hover:bg-card/80 dark:hover:bg-card/60"
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      layout
    >
      <div className="flex items-start p-3">
        <div className="bg-muted/30 dark:bg-muted/10 relative mr-3 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md p-1 sm:h-16 sm:w-16">
          {actualDevice.imageUrl ? (
            <Image
              src={actualDevice.imageUrl}
              alt={actualDevice.name || "Device image"}
              width={64}
              height={64}
              className="h-auto max-h-full w-auto max-w-full object-contain"
            />
          ) : (
            <div className="text-muted-foreground flex h-full w-full items-center justify-center text-xs">
              No image
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              {hasCharacteristics ? (
                <Link
                  href={`/devices/${deviceSlug}`}
                  className="text-foreground hover:text-primary dark:hover:text-primary group inline-flex items-center gap-1 truncate text-base font-medium dark:text-zinc-100"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`View ${actualDevice.name} details`}
                >
                  <span className="group-hover:underline">
                    {actualDevice.name}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-70 transition-opacity group-hover:opacity-100" />
                </Link>
              ) : (
                <span
                  title={actualDevice?.name || ""}
                  className="text-foreground block max-w-[275px] truncate text-base font-medium dark:text-zinc-100"
                >
                  {actualDevice.name}
                </span>
              )}

              {uniqueConfigs.length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {uniqueConfigs.map((config) => (
                    <TooltipProvider key={config.key}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={config.link}
                            className="bg-muted/50 text-muted-foreground hover:bg-muted dark:bg-muted/20 dark:hover:bg-muted/30 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors dark:text-zinc-300"
                          >
                            {config.name}
                          </a>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>
                            {config.price
                              ? ` ${rubleCurrencyFormatter(config.price)}`
                              : config.name}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              )}
            </div>

            <div
              className="border-sepia-300/50 bg-sepia-300/15 dark:bg-sepia-300/25 min-w-10 flex h-10 flex-shrink-0 items-center justify-center rounded-full border text-lg font-bold text-black"
              aria-label={`Ranked #${index}`}
            >
              {index}
            </div>
          </div>

          <div className="text-muted-foreground mt-1 text-sm font-medium dark:text-zinc-300">
            {minPrice > 0 ? (
              minPrice === maxPrice ? (
                rubleCurrencyFormatter(minPrice)
              ) : (
                `${rubleCurrencyFormatter(minPrice)} - ${rubleCurrencyFormatter(
                  maxPrice
                )}`
              )
            ) : (
              <span className="text-muted-foreground/70 dark:text-zinc-400">
                Цена не указана
              </span>
            )}
          </div>

          {description && (
            <p className="text-muted-foreground mt-0.5 text-xs dark:text-zinc-400">
              {description}
            </p>
          )}

          <div className="mt-2 flex items-center gap-2">
            {lowestPriceLink && (
              <a
                href={lowestPriceLink.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center rounded-md bg-yellow-300/90 px-4 py-2 text-sm font-medium text-black  transition-all hover:bg-yellow-400/80 focus:outline-none focus:ring-2 focus:ring-yellow-300/30 dark:bg-yellow-400/80 dark:hover:bg-yellow-400/90"
                aria-label={`Buy ${actualDevice.name}`}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                <span>Купить</span>
              </a>
            )}

            <SignedIn>
              <Link
                href={`/dashboard/devices/${actualDevice.id}`}
                passHref
                legacyBehavior
              >
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="bg-card/80 text-muted-foreground hover:bg-accent hover:text-primary focus:ring-ring/30 inline-flex items-center justify-center rounded-md p-2 transition-all focus:outline-none focus:ring-2"
                  aria-label={`Edit ${actualDevice.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </a>
              </Link>
            </SignedIn>

            {hasVariants && false && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-primary hover:bg-primary/5 focus:ring-primary/30 dark:text-primary-foreground dark:hover:bg-primary/10 inline-flex items-center rounded-md border border-transparent px-2.5 py-1.5 text-xs font-medium hover:underline focus:outline-none focus:ring-2"
                aria-expanded={isExpanded}
                aria-controls={`variants-${deviceSlug}`}
              >
                <span>
                  {isExpanded ? "Скрыть варианты" : "Показать варианты"}
                </span>
                <ChevronRight
                  className={`ml-1 h-3 w-3 transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
              </button>
            )}
          </div>
        </div>
      </div>

      {false && hasVariants && (
        <div
          id={`variants-${deviceSlug}`}
          className="bg-accent/5 dark:bg-accent/10 px-3 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-1.5">
            {configsWithLinks.map((config, configIndex) => (
              <div
                key={config.id || `config-${configIndex}`}
                className="space-y-1"
              >
                <div className="text-foreground text-xs font-medium dark:text-zinc-200">
                  {config.name}
                </div>
                <div className="flex flex-wrap gap-1">
                  {config.links?.map((link, linkIndex) => (
                    <a
                      key={link.id || `link-${configIndex}-${linkIndex}`}
                      href={link.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Buy ${actualDevice.name} ${
                        config.name
                      } from ${link.marketplace?.name || "store"} for ${
                        typeof link.price === "number"
                          ? rubleCurrencyFormatter(link.price)
                          : "undefined price"
                      }`}
                      className="bg-card/80 hover:bg-card focus:ring-primary dark:bg-card/60 dark:hover:bg-card/80 flex items-center rounded px-2 py-1 text-xs transition-colors focus:outline-none focus:ring-1"
                    >
                      {link.marketplace?.iconUrl && (
                        <img
                          src={link.marketplace.iconUrl}
                          alt={link.marketplace.name || "Marketplace"}
                          className="mr-1 h-3 w-3"
                        />
                      )}
                      <span className="dark:text-zinc-200">
                        {typeof link.price === "number"
                          ? rubleCurrencyFormatter(link.price)
                          : "N/A"}
                      </span>
                      <ExternalLink className="text-muted-foreground ml-1 h-2.5 w-2.5 dark:text-zinc-400" />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
});

PhoneCard.displayName = "PhoneCard";
