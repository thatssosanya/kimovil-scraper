import { TrendingUp } from "lucide-react";

// Using the actual RatingPosition type from your API
interface RatingPosition {
  id: string;
  deviceId: string;
  position: number;
  rating?: {
    id: string;
    name?: string;
    description?: string;
  };
}

interface RatingsSidebarProps {
  ratings?: RatingPosition[];
}

export function RatingsSidebar({ ratings = [] }: RatingsSidebarProps) {
  const getPositionColor = (position: number) => {
    if (position <= 3) return "text-green-600 dark:text-green-400";
    if (position <= 10) return "text-blue-600 dark:text-blue-400";
    if (position <= 20) return "text-yellow-600 dark:text-yellow-400";
    if (position <= 50) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="mt-8">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-4">
        Позиции в рейтингах
      </h3>
      {ratings.length === 0 ? (
        <div className="text-center py-6">
          <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50 text-gray-400 dark:text-gray-400" />
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Пока не участвует в рейтингах
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {ratings.map((ratingPos) => (
            <div
              key={ratingPos.id}
              className="flex items-center justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-200 leading-relaxed">
                  {ratingPos.rating?.name || "Рейтинг"}
                </div>
              </div>
              <div className="flex items-center shrink-0 ml-3">
                <span 
                  className={`text-sm font-semibold ${getPositionColor(
                    ratingPos.position
                  )}`}
                >
                  #{ratingPos.position}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}