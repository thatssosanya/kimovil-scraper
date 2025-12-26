import NextLink from "next/link";
import { rubleCurrencyFormatter } from "@/src/utils/utils";
import type { Camera } from "@/src/server/db/schema";

interface RelevantPhoneCardProps {
  device: RelevantDevice;
}
interface RelevantDevice {
  relevanceScore: number;
  id: string;
  device: {
    id: string;
    valueRating: number | null;
    imageUrl: string | null;

    links: {
      price: number;
      sku: {
        ram_gb: number;
        storage_gb: number;
      } | null;
    }[];
  };
  releaseDate: Date | null;
  brand: string;
  name: string;
  slug: string;
  cpuManufacturer: string | null;
  cameras: Camera[];
}

// Value rating ranges with colors matching ValueRating component
const valueRanges = [
  {
    min: 90,
    color: {
      bg: "#059669",
      text: "text-emerald-700",
      border: "border-emerald-200",
    },
  },
  {
    min: 80,
    color: {
      bg: "#0284c7",
      text: "text-blue-700",
      border: "border-blue-200",
    },
  },
  {
    min: 70,
    color: {
      bg: "#4f46e5",
      text: "text-indigo-700",
      border: "border-indigo-200",
    },
  },
  {
    min: 60,
    color: {
      bg: "#7c3aed",
      text: "text-violet-700",
      border: "border-violet-200",
    },
  },
  {
    min: 40,
    color: {
      bg: "#dc2626",
      text: "text-red-700",
      border: "border-red-200",
    },
  },
  {
    min: 0,
    color: {
      bg: "#451a03",
      text: "text-amber-900",
      border: "border-amber-200",
    },
  },
];

function getValueRange(value: number) {
  for (const range of valueRanges) {
    if (value >= range.min) {
      return range;
    }
  }
  return valueRanges[valueRanges.length - 1];
}

export function RelevantPhoneCard({ device }: RelevantPhoneCardProps) {
  const lowestPrice = Math.min(
    ...(device.device?.links.map((l) => l.price || 0).filter(Boolean) || [0])
  );

  // Determine relevance category based on score
  const getRelevanceInfo = (score: number) => {
    const percentage = score * 100;
    if (percentage >= 75) {
      return {
        label: "Высокая",
        bgColor: "bg-emerald-100",
        textColor: "text-emerald-700",
        dots: 4,
      };
    } else if (percentage >= 50) {
      return {
        label: "Средняя",
        bgColor: "bg-blue-100",
        textColor: "text-blue-700",
        dots: 3,
      };
    } else if (percentage >= 25) {
      return {
        label: "Низкая",
        bgColor: "bg-amber-100",
        textColor: "text-amber-700",
        dots: 2,
      };
    } else {
      return {
        label: "Минимальная",
        bgColor: "bg-zinc-100",
        textColor: "text-zinc-700",
        dots: 1,
      };
    }
  };

  const relevanceInfo = getRelevanceInfo(device.relevanceScore);

  // Get value rating color and info
  const normalizedValue = Math.max(
    0,
    Math.min(100, device.device.valueRating || 0)
  );
  const valueInfo = getValueRange(normalizedValue);

  return (
    <NextLink
      href={`/devices/${device.slug}`}
      className="group relative flex max-w-full overflow-hidden rounded-lg border border-zinc-200 bg-white transition hover:border-zinc-300 hover:shadow-md"
    >
      <div
        className={`absolute bottom-0 left-0 top-0 w-1 ${relevanceInfo.textColor.replace(
          "text",
          "bg"
        )}`}
        aria-hidden="true"
      />

      <div className="relative flex h-20 w-16 max-w-full shrink-0 items-center justify-center overflow-hidden bg-zinc-50 p-1">
        <img
          src={device.device?.imageUrl || ""}
          alt={`${device.brand} ${device.name}`}
          className="h-full w-full object-contain transition group-hover:scale-105"
        />
      </div>

      <div className="flex max-w-full flex-1 flex-col justify-center p-3">
        <div className="flex items-center justify-between">
          <h3 className="max-w-[180px] truncate font-medium text-zinc-900">
            {device.brand} {device.name}
          </h3>

          {/* Enhanced value rating indicator */}
          {normalizedValue > 0 && valueInfo && (
            <div
              className="ml-2 flex items-center gap-1"
              title="Рейтинг цена/качество"
            >
              <div className="relative h-1.5 w-8 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${normalizedValue}%`,
                    backgroundColor: valueInfo.color.bg,
                  }}
                />
              </div>
              <span
                className="text-xs font-semibold"
                style={{ color: valueInfo.color.bg }}
              >
                {normalizedValue}
              </span>
            </div>
          )}
        </div>

        <div className="mt-0.5 flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            от {rubleCurrencyFormatter(lowestPrice)}
          </p>

          {/* Relevance dots */}
          <div className="ml-2 flex flex-shrink-0 space-x-0.5">
            <span className="sr-only">Схожесть: {relevanceInfo.label}</span>
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className={`h-1 w-1 rounded-full ${
                  i < relevanceInfo.dots
                    ? relevanceInfo.textColor.replace("text", "bg")
                    : "bg-zinc-200"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </NextLink>
  );
}
