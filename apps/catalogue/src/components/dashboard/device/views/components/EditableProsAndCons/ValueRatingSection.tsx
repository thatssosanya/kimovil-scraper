import React, { useState, useEffect } from "react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { SaveIcon, XIcon } from "lucide-react";
import * as Slider from "@radix-ui/react-slider";
import { cn } from "@/src/lib/utils";
import { useDeviceValueRating, type DeviceRating } from "./hooks";

type ValueRatingSectionProps = {
  deviceId: string;
  className?: string;
};

const RatingBadge: React.FC<{ rating: DeviceRating }> = ({ rating }) => {
  const position = rating.RatingPosition?.[0]?.position ?? 0;
  if (position === 0) return null;

  const ratingName = rating.RatingType?.displayName ?? rating.RatingType?.name;

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      <span className="text-zinc-500 dark:text-zinc-400">{ratingName}:</span>
      <span>№{position}</span>
    </div>
  );
};

export const ValueRatingSection: React.FC<ValueRatingSectionProps> = ({
  deviceId,
  className,
}) => {
  const {
    currentValue,
    pendingValue,
    setPendingValue,
    isSaving,
    confirm,
    deviceRatings,
  } = useDeviceValueRating(deviceId);

  const [isEditingInput, setIsEditingInput] = useState(false);
  useEffect(() => {
    if (!isSaving) {
      setPendingValue(currentValue);
    }
  }, [currentValue, isSaving, setPendingValue]);

  const showConfirm = pendingValue !== currentValue;

  const handleSliderChange = (value: number[]) => {
    setPendingValue(value[0] ?? 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    if (rawValue === "") {
      setPendingValue(0);
      return;
    }
    const cleanValue = rawValue.replace(/^0+(?!$)/, "");
    const numValue = parseInt(cleanValue, 10);

    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setPendingValue(numValue);
    }
  };

  const handleInputBlur = () => {
    if (!showConfirm) {
      setIsEditingInput(false);
    }
    if (pendingValue === 0 && String(pendingValue) !== String(currentValue)) {
      setPendingValue(currentValue);
    }
  };

  const handleConfirm = () => {
    confirm();
    setIsEditingInput(false);
  };

  const handleCancel = () => {
    setPendingValue(currentValue);
    setIsEditingInput(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const displayValue = showConfirm ? pendingValue : currentValue;

  return (
    <div
      className={cn(
        "space-y-3 border-b border-zinc-100 pb-4 dark:border-zinc-800",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Цена / качество
          </span>
          {isEditingInput ? (
            <Input
              type="number"
              min={0}
              max={100}
              value={pendingValue === 0 ? "" : String(pendingValue)} // Show empty string for 0
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className="h-7 w-14 appearance-none rounded border-zinc-300 text-center text-lg font-medium dark:border-zinc-700 dark:bg-zinc-800 dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              autoFocus
              disabled={isSaving}
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingInput(true)}
              disabled={isSaving}
              className="min-w-[2rem] rounded px-1 py-0.5 text-center text-lg font-medium text-zinc-900 hover:bg-zinc-100 dark:text-white dark:hover:bg-zinc-800"
            >
              {isSaving && !showConfirm ? (
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent dark:border-emerald-400 dark:border-t-transparent" />
              ) : (
                displayValue
              )}
            </button>
          )}
          {showConfirm && (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={handleConfirm}
                disabled={isSaving}
                className="h-7 border-emerald-200 bg-emerald-50 px-2 text-xs text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-800/50"
              >
                {isSaving ? (
                  <span className="inline-flex h-3 w-3 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent dark:border-emerald-400 dark:border-t-transparent" />
                ) : (
                  <>
                    <SaveIcon className="mr-1 h-3 w-3" /> Сохранить
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                disabled={isSaving}
                className="h-7 px-2 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <XIcon className="mr-1 h-3 w-3" /> Отмена
              </Button>
            </div>
          )}
        </div>

        {!!deviceRatings?.length && (
          <div className="flex flex-wrap gap-1.5">
            {deviceRatings.map((r) => (
              <RatingBadge key={r.id} rating={r} />
            ))}
          </div>
        )}
      </div>

      <div className="relative h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700"
          style={{ width: `${displayValue}%` }}
        />
        <Slider.Root
          className="absolute inset-0 flex touch-none select-none items-center"
          value={[displayValue]}
          onValueChange={handleSliderChange}
          max={100}
          step={1}
          aria-label="Value Rating"
          disabled={isSaving}
        >
          <Slider.Track className="relative h-full w-full grow overflow-hidden rounded-full">
            <Slider.Range className="absolute h-full" />{" "}
          </Slider.Track>
          <Slider.Thumb
            className={cn(
              "block h-3.5 w-3.5 rounded-full border-2 border-white bg-zinc-700 shadow-sm ring-offset-white transition-transform dark:border-zinc-900 dark:bg-zinc-300",
              "focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 dark:ring-offset-zinc-950 dark:focus:ring-zinc-500",
              "hover:scale-110",
              isSaving
                ? "cursor-not-allowed"
                : "cursor-grab active:cursor-grabbing"
            )}
          />
        </Slider.Root>
      </div>
    </div>
  );
};
