import { Droplet } from "lucide-react";
import { cn } from "@/src/utils/cn";

interface IPRatingProps {
  rating: string;
  className?: string;
}

export const IPRating = ({ rating, className }: IPRatingProps) => {
  const dropletCount =
    rating[3] === "5" ? 1 : rating[3] === "7" ? 2 : rating[3] === "8" ? 3 : 0;

  if (dropletCount === 0) return null;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="text-[0.5rem] font-normal tracking-wider text-indigo-700">
        {rating}
      </div>
      <div className="flex gap-0">
        {Array.from({ length: dropletCount }).map((_, i) => (
          <Droplet
            key={i}
            className="h-1.5 w-1.5 fill-indigo-400 text-indigo-600"
            strokeWidth={2.5}
          />
        ))}
      </div>
    </div>
  );
};
