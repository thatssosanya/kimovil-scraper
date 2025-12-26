import {
  Search,
  AlertCircle,
  ArrowUpDown,
  Clock,
  CalendarDays,
  Type,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/src/components/ui/Drawer";
import { Input } from "@/src/components/ui/Input";
import type { Device } from "@/src/server/db/schema";
import { api } from "@/src/utils/api";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/src/lib/utils";
import { rubleCurrencyFormatter } from "@/src/utils/utils";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/DropdownMenu";
import { Button } from "@/src/components/ui/Button";

interface DeviceLink {
  id: string;
  price: number;
  updatedAt: Date;
  marketplace: {
    id: string;
    name: string | null;
  } | null;
}

type SortOption = "recent" | "name" | "date" | "price" | "relevance";

interface RatingDeviceSelectDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceToReplace: (Device & { links: DeviceLink[] }) | null;
  ratingId: string;
  onReplace: (newDeviceId: string) => void;
}

const CompactPriceRangeChip = ({ links }: { links: DeviceLink[] }) => {
  const prices = links
    .map((link) => link.price)
    .filter(
      (price): price is number => typeof price === "number" && !isNaN(price)
    );

  if (prices.length === 0) {
    return <span className="text-muted-foreground text-xs">Нет цен</span>;
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const lastUpdate = new Date(
    Math.max(...links.map((link) => new Date(link.updatedAt).getTime()))
  );

  return (
    <div className="flex flex-col gap-1">
      <span className="text-foreground font-medium">
        {minPrice === maxPrice
          ? rubleCurrencyFormatter(minPrice)
          : `${rubleCurrencyFormatter(minPrice)} - ${rubleCurrencyFormatter(
              maxPrice
            )}`}
      </span>
      <span className="text-muted-foreground text-xs">
        обновлено{" "}
        {formatDistanceToNow(lastUpdate, { addSuffix: true, locale: ru })}
      </span>
    </div>
  );
};

export const RatingDeviceSelectDrawer = ({
  open,
  onOpenChange,
  deviceToReplace,
  ratingId,
  onReplace,
}: RatingDeviceSelectDrawerProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [sortBy, setSortBy] = useState<SortOption>("relevance");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when drawer opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Search for replacement devices
  const { data: searchResults, isPending: isSearching } =
    api.search.searchDevicesForReplacement.useQuery(
      {
        query: debouncedQuery,
        ratingId,
        excludeDeviceId: deviceToReplace?.id || "",
        priceRange: undefined,
        sortBy,
      },
      {
        enabled: open,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
      }
    );

  const { data: rating } = api.rating.getAllRatings.useQuery(undefined, {
    enabled: false,
  });

  const currentRating = rating?.find((r) => r.id === ratingId);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const sortOptions: { value: SortOption; label: string; icon: JSX.Element }[] =
    [
      {
        value: "relevance",
        label: "По релевантности",
        icon: <Search className="h-4 w-4" />,
      },
      {
        value: "recent",
        label: "Недавно добавленные",
        icon: <Clock className="h-4 w-4" />,
      },
      {
        value: "name",
        label: "По названию",
        icon: <Type className="h-4 w-4" />,
      },
      {
        value: "date",
        label: "По дате обновления",
        icon: <CalendarDays className="h-4 w-4" />,
      },
      {
        value: "price",
        label: "По цене",
        icon: <ArrowUpDown className="h-4 w-4" />,
      },
    ];

  const currentSortOption = sortOptions.find(
    (option) => option.value === sortBy
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex h-[60vh] flex-col">
        <DrawerHeader className="border-b px-6 py-4">
          <div className="mb-4 flex items-center justify-center gap-3">
            <DrawerTitle className="text-xl font-semibold">
              {deviceToReplace ? "Заменить устройство" : "Добавить устройство"}
            </DrawerTitle>
            {deviceToReplace && (
              <div className="bg-muted/50 flex items-center gap-2 rounded-full border border-zinc-200 py-1.5 pl-2 pr-3">
                <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border bg-white">
                  {deviceToReplace.imageUrl && (
                    <img
                      src={deviceToReplace.imageUrl}
                      alt=""
                      className="h-full w-full object-contain p-0.5"
                    />
                  )}
                </div>
                <span className="max-w-[200px] truncate text-sm">
                  {deviceToReplace.name}
                </span>
              </div>
            )}{" "}
            {currentRating && (
              <div className="text-muted-foreground text-center text-base">
                в рейтинге{" "}
                <span className="font-semibold text-black ">
                  {currentRating.name}
                </span>
              </div>
            )}
          </div>
          <DrawerDescription className="text-center">
            Выберите устройство для замены или добавления в рейтинг.
          </DrawerDescription>

          <div className="mt-6 space-y-3">
            <div className="relative">
              <Search className="text-muted-foreground absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2" />
              <Input
                ref={inputRef}
                placeholder="Поиск устройства..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-muted-foreground/20 placeholder:text-muted-foreground/40 hover:border-muted-foreground/30 focus:border-primary h-12 rounded-full pl-12 pr-4 text-lg shadow-sm transition-shadow focus:shadow-md"
                aria-label="Поиск устройства"
              />
            </div>
            <div className="flex items-center justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    {currentSortOption?.icon}
                    {currentSortOption?.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {sortOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setSortBy(option.value)}
                      className="gap-2"
                    >
                      {option.icon}
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {isSearching ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="bg-card flex gap-4 rounded-lg border p-3"
                >
                  <div className="bg-muted h-20 w-20 animate-pulse rounded-md" />
                  <div className="flex-1 space-y-2">
                    <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
                    <div className="bg-muted h-3 w-1/2 animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : !searchResults?.length ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="bg-muted/50 rounded-full p-3">
                <AlertCircle className="text-muted-foreground h-6 w-6" />
              </div>
              <div className="max-w-[280px] space-y-1">
                <h3 className="font-medium">Ничего не найдено</h3>
                <p className="text-muted-foreground text-sm">
                  Попробуйте изменить поисковый запрос
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {searchResults.map((device) => (
                <button
                  key={device.id}
                  onClick={() => onReplace(device.id)}
                  className={cn(
                    "bg-card group flex gap-4 rounded-lg border p-3 text-left transition-all",
                    "hover:border-primary hover:shadow-md",
                    "focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-2"
                  )}
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-white">
                    {device.imageUrl && (
                      <img
                        src={device.imageUrl || undefined}
                        alt={device.name || undefined}
                        className="h-full w-full object-contain p-2 transition-transform group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <h3 className="group-hover:text-primary truncate text-sm font-medium">
                      {device.name}
                    </h3>
                    <CompactPriceRangeChip links={device.links} />
                  </div>
                  <div className="flex items-center">
                    <span className="bg-primary/10 text-primary rounded-full px-3 py-1.5 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
                      Выбрать
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
