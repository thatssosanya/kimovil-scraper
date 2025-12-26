import type { Device, RatingPosition, Link } from "@/src/server/db/schema";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/src/lib/utils";
import { GripVertical, ArrowRightLeft, Info, Trash2 } from "lucide-react";
import { rubleCurrencyFormatter } from "@/src/utils/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/src/components/ui/Button";

interface DeviceCardProps {
  device: Device & {
    RatingPosition: RatingPosition[];
    links: Link[];
  };
  position: number;
  potentialPosition: number;
  originalPosition: number;
  isPending: boolean;
  isPendingReplacement?: boolean;
  replacedWith?: Device | null;
  isDragging: boolean;
  onViewDetails: () => void;
  onReplace: () => void;
  onDelete: () => void;
  className?: string;
  isMatched?: boolean;
}

export const DeviceCard = ({
  device,
  position,
  potentialPosition,
  originalPosition,
  isPending,
  isPendingReplacement,
  replacedWith,
  isDragging: isListDragging,
  onViewDetails,
  onReplace,
  onDelete,
  className,
  isMatched,
}: DeviceCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: device.id });

  const style = {
    transform: CSS.Transform.toString(
      transform && {
        ...transform,
        scaleX: 1,
        scaleY: 1,
      }
    ),
    transition,
  };

  // Calculate price range
  const prices = (device.links || [])
    .map((link) => link.price)
    .filter(
      (price): price is number => typeof price === "number" && !isNaN(price)
    );
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;

  const priceDisplay = !minPrice
    ? "Нет цен"
    : minPrice === maxPrice
    ? rubleCurrencyFormatter(minPrice)
    : `${rubleCurrencyFormatter(minPrice)} - ${rubleCurrencyFormatter(
        maxPrice!
      )}`;

  const hasPositionChanged = position !== originalPosition;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm",
        {
          "opacity-50": isDragging && !isListDragging,
          "border-primary": isListDragging,
        },
        isPendingReplacement && "ring-4 ring-green-500/40",
        isPending && !isPendingReplacement && "ring-4 ring-yellow-500/40",
        isMatched && "bg-yellow-50/80",
        className
      )}
      {...attributes}
    >
      <AnimatePresence mode="popLayout">
        {isDragging && (
          <motion.div
            key="position-indicator"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="absolute -right-2 -top-2 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-semibold text-white shadow-lg"
          >
            {potentialPosition}
          </motion.div>
        )}
        {isPendingReplacement && replacedWith && !isDragging && (
          <motion.div
            key="replacement-indicator"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute -right-2 -top-2 flex items-center gap-1 rounded-full bg-green-500 px-2 py-1 text-xs font-medium text-white shadow-lg"
          >
            <ArrowRightLeft className="h-3 w-3" />
            <span className="max-w-[100px] truncate">{replacedWith.name}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        {...listeners}
        className={cn(
          "flex cursor-grab items-center self-stretch overflow-hidden rounded-l-lg px-1 text-zinc-400 hover:text-zinc-600",
          isDragging && "cursor-grabbing"
        )}
      >
        <GripVertical className="h-5 w-5" />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        {device.imageUrl && (
          <img
            src={device.imageUrl}
            alt=""
            className="h-12 w-12 flex-shrink-0 rounded-lg border object-contain p-1"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs text-zinc-500">
            {!isDragging && (
              <motion.div
                key={position}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1"
              >
                {hasPositionChanged && originalPosition > 0 ? (
                  <>
                    <span>№ {position}</span>
                    <span
                      className={cn(
                        "text-xs",
                        position < originalPosition
                          ? "text-green-600"
                          : "text-red-600"
                      )}
                    >
                      ({position < originalPosition ? "↑" : "↓"}
                      {Math.abs(originalPosition - position)})
                    </span>
                  </>
                ) : (
                  <span>№ {position}</span>
                )}
              </motion.div>
            )}
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <div
              onClick={onViewDetails}
              className="truncate text-base font-medium"
            >
              {device.name}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div
              className={cn(
                "text-[0.75rem] font-medium",
                !minPrice ? "text-zinc-400" : "text-zinc-600"
              )}
            >
              {priceDisplay}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
          >
            <Info className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onReplace();
            }}
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
