import * as React from "react";
import {
  DatePicker as AriaDatePicker,
  DateInput,
  DateSegment,
  Dialog,
  Group,
  Button as AriaButton,
  Calendar,
  CalendarGrid,
  CalendarCell,
  Heading,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarGridBody,
  Popover,
  type DateValue,
} from "react-aria-components";
import { CalendarDate } from "@internationalized/date";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/src/utils/cn";

interface DatePickerProps {
  date?: Date | null;
  onSelect?: (date: Date | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  borderless?: boolean;
}

export function DatePicker({
  date,
  onSelect,
  disabled = false,
  className,
  "aria-label": ariaLabel = "Select date",
  "aria-labelledby": ariaLabelledBy,
  borderless = false,
}: DatePickerProps) {
  // Convert Date to CalendarDate for react-aria
  const value = React.useMemo(() => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() returns 0-based month
    const day = date.getDate();
    return new CalendarDate(year, month, day);
  }, [date]);

  const handleChange = React.useCallback(
    (value: DateValue | null) => {
      if (!value) {
        onSelect?.(undefined);
        return;
      }
      // Convert back to Date
      const jsDate = new Date(value.year, value.month - 1, value.day);
      onSelect?.(jsDate);
    },
    [onSelect]
  );

  return (
    <AriaDatePicker
      value={value as DateValue | null}
      onChange={handleChange}
      isDisabled={disabled}
      className={cn("group flex flex-col gap-1", className)}
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      <Group className={cn(
        "flex transition-colors",
        !borderless && "rounded-md border border-zinc-300 bg-white focus-within:ring-1 focus-within:ring-ring dark:border-gray-800 dark:bg-gray-800"
      )}>
        <DateInput className={cn(
          "flex w-full text-sm ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200",
          !borderless && "h-10 rounded-md bg-white px-3 py-2 dark:bg-gray-800",
          borderless && "bg-transparent"
        )}>
          {(segment) => (
            <DateSegment
              segment={segment}
              className={cn(
                "rounded px-0.5 py-0.5 text-sm tabular-nums text-gray-900 outline-none",
                "placeholder:text-gray-500 dark:placeholder:text-gray-400",
                "focus:bg-blue-100 focus:text-blue-900 dark:focus:bg-blue-900/30 dark:focus:text-blue-200",
                "invalid:text-red-600 dark:invalid:text-red-400",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "dark:text-gray-200"
              )}
            />
          )}
        </DateInput>
        <AriaButton
          className={cn(
            "flex items-center justify-center px-2 text-sm transition-colors",
            "hover:text-gray-900 dark:hover:text-gray-200",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-50",
            "text-gray-400 dark:text-gray-500",
            !borderless && "rounded-r-md border-l border-zinc-300 bg-white py-2 px-3 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
          )}
        >
          <CalendarIcon className="h-4 w-4" />
        </AriaButton>
      </Group>
      <Popover
        className={cn(
          "z-50 w-auto rounded-md border border-gray-200 bg-white p-0 text-gray-900 shadow-md",
          "data-[entering]:animate-in data-[exiting]:animate-out",
          "data-[entering]:fade-in-0 data-[exiting]:fade-out-0",
          "data-[entering]:zoom-in-95 data-[exiting]:zoom-out-95",
          "data-[placement=bottom]:slide-in-from-top-2",
          "data-[placement=top]:slide-in-from-bottom-2",
          "dark:border-gray-800 dark:bg-gray-800 dark:text-gray-200"
        )}
        placement="bottom start"
      >
        <Dialog className="p-3 dark:text-gray-200">
          <Calendar>
            <header className="flex items-center justify-between pb-2">
              <AriaButton
                slot="previous"
                className={cn(
                  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
                  "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-gray-200",
                  "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "dark:text-gray-300"
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </AriaButton>
              <Heading className="text-sm font-medium dark:text-gray-200" />
              <AriaButton
                slot="next"
                className={cn(
                  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
                  "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-gray-200",
                  "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "dark:text-gray-300"
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </AriaButton>
            </header>
            <CalendarGrid className="border-collapse">
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell className="w-9 rounded-md text-[0.8rem] font-normal text-gray-500 dark:text-gray-400">
                    {day}
                  </CalendarHeaderCell>
                )}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => (
                  <CalendarCell
                    date={date}
                    className={cn(
                      "relative inline-flex h-9 w-9 items-center justify-center rounded-md p-0 text-sm font-normal transition-colors",
                      "hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-gray-200",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      "selected:bg-blue-600 selected:text-white selected:hover:bg-blue-700 dark:selected:bg-blue-500 dark:selected:hover:bg-blue-600",
                      "today:bg-gray-200 today:text-gray-900 dark:today:bg-gray-600 dark:today:text-gray-200",
                      "outside-month:text-gray-400 outside-month:opacity-50 dark:outside-month:text-gray-500",
                      "unavailable:text-gray-400 unavailable:opacity-50 dark:unavailable:text-gray-500",
                      "dark:text-gray-200"
                    )}
                  />
                )}
              </CalendarGridBody>
            </CalendarGrid>
          </Calendar>
        </Dialog>
      </Popover>
    </AriaDatePicker>
  );
}