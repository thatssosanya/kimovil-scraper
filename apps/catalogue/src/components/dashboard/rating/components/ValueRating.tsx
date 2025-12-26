import { cn } from "@/src/utils/cn";

interface ValueRatingProps {
  value?: number;
  description?: string;
  className?: string;
  deviceId?: string;
}

interface ValueRange {
  min: number;
  color: {
    bg: string;
    badgeBg: string;
    softGradient: string;
  };
  description: string;
}

const valueRanges = [
  {
    min: 90,
    color: {
      bg: "bg-green-100 dark:bg-green-900/30",
      // background: linear-gradient(140.04deg, #70DB5D 12.57%, #40B32C 83.96%);
      badgeBg: "bg-gradient-to-br from-[#70DB5D] to-[#40B32C]",
      softGradient: "from-emerald-50 to-teal-50",
    },
    description: "Бомба! Оптимальный вариант",
  },
  {
    min: 80,
    color: {
      bg: "bg-blue-100 dark:bg-blue-900/30",
      // background: linear-gradient(140.04deg, #5D96DB 12.57%, #2C67B3 83.96%);
      badgeBg: "bg-gradient-to-br from-[#5D96DB] to-[#2C67B3]",
      softGradient: "from-sky-50 to-cyan-50",
    },
    description: "Отличная покупка",
  },
  {
    min: 70,
    color: {
      bg: "bg-blue-100 dark:bg-blue-900/30",
      // background: linear-gradient(140.04deg, #5D96DB 12.57%, #2C67B3 83.96%);
      badgeBg: "bg-gradient-to-br from-[#5D96DB] to-[#2C67B3]",
      softGradient: "from-indigo-50 to-blue-50",
    },
    description: "Неплохой выбор",
  },
  {
    min: 60,
    color: {
      bg: "bg-blue-100 dark:bg-blue-900/30",
      // background: linear-gradient(140.04deg, #5D96DB 12.57%, #2C67B3 83.96%);
      badgeBg: "bg-gradient-to-br from-[#5D96DB] to-[#2C67B3]",
      softGradient: "from-violet-50 to-indigo-50",
    },
    description: "Можно поискать получше",
  },
  {
    min: 40,
    color: {
      bg: "bg-orange-100 dark:bg-orange-900/30",
      // background: linear-gradient(140.04deg, #DB5D5D 12.57%, #B32C2C 83.96%);
      badgeBg: "bg-gradient-to-br from-[#DB5D5D] to-[#B32C2C]",
      softGradient: "from-rose-50 to-red-50",
    },
    description: "Не советуем",
  },
  {
    min: 0,
    color: {
      bg: "bg-red-100 dark:bg-red-900/30",
      // background: linear-gradient(140.04deg, #DB5D5D 12.57%, #B32C2C 83.96%);
      badgeBg: "bg-gradient-to-br from-[#DB5D5D] to-[#B32C2C]",
      softGradient: "from-amber-50 to-yellow-100",
    },
    description: "Полный провал",
  },
] as const satisfies readonly [ValueRange, ...ValueRange[]];

function getValueRange(value: number): ValueRange {
  for (const range of valueRanges) {
    if (value >= range.min) {
      return range;
    }
  }
  return valueRanges[0];
}

export const ValueRating = ({
  value = 0,
  description,
  className,
}: ValueRatingProps) => {
  const normalizedValue = Math.max(0, Math.min(100, value));
  const { color, description: defaultDescription } =
    getValueRange(normalizedValue);

  return (
    <section
      className={cn(
        "flex h-32 items-center justify-between gap-6 overflow-hidden rounded-3xl p-6 transition-colors",
        color.bg,
        className
      )}
      aria-labelledby="value-heading"
    >
      <div
        className={cn(
          "flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-full text-lg font-bold text-white shadow-lg transition-transform duration-200 ease-out hover:scale-110",
          color.badgeBg
        )}
        style={{
          fontSize: "30px",
        }}
        aria-label={`Оценка: ${normalizedValue} из 100`}
      >
        {normalizedValue}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="text-2xl font-semibold text-gray-900 dark:text-white">
          {description || defaultDescription}
        </div>
        <div className="flex items-center justify-between">
          <h2 id="value-heading" className="text-xl font-medium text-gray-600 dark:text-gray-300">
            Индекс цены / качества
          </h2>
        </div>
      </div>
    </section>
  );
};
