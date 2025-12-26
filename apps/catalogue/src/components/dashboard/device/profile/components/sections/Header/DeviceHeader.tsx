import { useState, useCallback } from "react";
import { Smartphone, Tablet, Laptop, Watch, ChevronDown, Copy, ExternalLink, Merge } from "lucide-react";
import Link from "next/link";
import { DuplicateCandidatesPopover } from "./DuplicateCandidatesPopover";
import type { Device } from "@/src/server/db/schema";
import { InfoCard } from "../../shared";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/src/components/ui/Popover";
import { InlineEditableInput } from "@/src/components/ui/InlineEditableInput";
import { EditableImage } from "@/src/components/ui/EditableImage";
import { api } from "@/src/utils/api";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";

type AvailabilityStatus = "selling" | "not_in_sale" | "not_yet_in_sale";

const AVAILABILITY_STATUS_CONFIG: Record<
  AvailabilityStatus,
  { label: string; color: string }
> = {
  selling: { label: "Продается", color: "text-emerald-600 dark:text-emerald-400" },
  not_in_sale: { label: "Нет в продаже", color: "text-gray-600 dark:text-gray-400" },
  not_yet_in_sale: { label: "Еще нет в продаже", color: "text-blue-600 dark:text-blue-400" },
};

const deviceIcons = {
  SMARTPHONE: Smartphone,
  TABLET: Tablet,
  LAPTOP: Laptop,
  SMARTWATCH: Watch,
} as const;

interface DeviceHeaderProps {
  device: Device;
  onSave?: (updates: Record<string, unknown>) => void;
  isLoading?: boolean;
}

export function DeviceHeader({ device, onSave, isLoading }: DeviceHeaderProps) {
  const [typePopoverOpen, setTypePopoverOpen] = useState(false);
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const { data: deviceTypes = [] } = api.device.getDeviceTypes.useQuery();
  const utils = api.useUtils();

  const updateAvailabilityStatus = api.device.updateDeviceAvailabilityStatus.useMutation({
    onSuccess: (_data, variables) => {
      const statusLabel = AVAILABILITY_STATUS_CONFIG[variables.status].label;
      toast.success("Статус обновлен", {
        description: `Статус устройства изменен на "${statusLabel}"`,
      });
      void utils.device.getDevice.invalidate({ deviceId: device.id });
    },
    onError: (error) => {
      toast.error("Ошибка", {
        description: error.message || "Не удалось обновить статус устройства",
      });
    },
  });

  const Icon = device.type
    ? deviceIcons[device.type as keyof typeof deviceIcons] || Smartphone
    : Smartphone;

  const handleNameSave = useCallback((value: string) => {
    if (onSave && value.trim()) {
      onSave({ name: value.trim() });
    }
  }, [onSave]);

  const handleDescriptionSave = useCallback((value: string) => {
    if (onSave) {
      onSave({ description: value.trim() || null });
    }
  }, [onSave]);

  const handleImageSave = useCallback((url: string) => {
    if (onSave) {
      onSave({ imageUrl: url });
    }
  }, [onSave]);

  // Handle type selection (immediate save)
  const handleTypeSelect = useCallback(
    (newType: string) => {
      if (onSave) {
        onSave({ type: newType });
      }
      setTypePopoverOpen(false);
    },
    [onSave]
  );

  // Handle availability status selection
  const handleStatusSelect = useCallback(
    (newStatus: AvailabilityStatus) => {
      updateAvailabilityStatus.mutate({
        deviceId: device.id,
        status: newStatus,
      });
      setStatusPopoverOpen(false);
    },
    [device.id, updateAvailabilityStatus]
  );

  const currentStatus = device.availabilityStatus as AvailabilityStatus;
  const statusConfig = AVAILABILITY_STATUS_CONFIG[currentStatus] || AVAILABILITY_STATUS_CONFIG.selling;

  return (
    <InfoCard>
      <div className="flex items-start gap-4">
        <EditableImage
          imageUrl={device.imageUrl}
          placeholderIcon={Icon}
          onSave={handleImageSave}
          disabled={isLoading}
          alt={device.name || "Device"}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              {/* Inline Editable Name */}
              <div className="group">
                <InlineEditableInput
                  type="input"
                  value={device.name || ""}
                  onSave={handleNameSave}
                  placeholder="Untitled Device"
                  disabled={isLoading}
                  uniqueKey={`name-${device.id}`}
                  className="text-xl font-semibold"
                />
              </div>

              <div className="mt-2 flex items-center gap-2">
                {/* Device Type Badge */}
                <Popover
                  open={typePopoverOpen}
                  onOpenChange={setTypePopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <button
                      disabled={isLoading}
                      className={cn(
                        "group inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                        "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300",
                        "hover:bg-gray-200 hover:shadow-sm dark:hover:bg-gray-800",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                      <span>{device.type || "Тип"}</span>
                      <ChevronDown className="h-3 w-3 opacity-40 group-hover:opacity-60 transition-opacity" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1.5" align="start">
                    <div className="space-y-0.5">
                      {deviceTypes.map((type) => (
                        <button
                          key={type}
                          onClick={() => handleTypeSelect(type)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleTypeSelect(type);
                            }
                            if (e.key === "Escape") {
                              setTypePopoverOpen(false);
                            }
                          }}
                          className={cn(
                            "w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                            "focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                            device.type === type
                              ? "bg-blue-500/10 text-blue-700 font-medium dark:bg-blue-500/20 dark:text-blue-400"
                              : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/60"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Status Badge */}
                <Popover
                  open={statusPopoverOpen}
                  onOpenChange={setStatusPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <button
                      disabled={isLoading || updateAvailabilityStatus.isPending}
                      className={cn(
                        "group inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                        currentStatus === "selling" && "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 hover:bg-emerald-500/20 dark:hover:bg-emerald-500/30",
                        currentStatus === "not_in_sale" && "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800",
                        currentStatus === "not_yet_in_sale" && "bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 hover:bg-blue-500/20 dark:hover:bg-blue-500/30",
                        "hover:shadow-sm",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        "focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      )}
                    >
                      {updateAvailabilityStatus.isPending ? (
                        <>
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" />
                          <span>Обновление...</span>
                        </>
                      ) : (
                        <>
                          <span>{statusConfig.label}</span>
                          <ChevronDown className="h-3 w-3 opacity-40 group-hover:opacity-60 transition-opacity" />
                        </>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-1.5" align="start">
                    <div className="space-y-0.5">
                      {(Object.keys(AVAILABILITY_STATUS_CONFIG) as AvailabilityStatus[]).map((status) => {
                        const config = AVAILABILITY_STATUS_CONFIG[status];
                        const isSelected = currentStatus === status;
                        return (
                          <button
                            key={status}
                            onClick={() => handleStatusSelect(status)}
                            disabled={updateAvailabilityStatus.isPending}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleStatusSelect(status);
                              }
                              if (e.key === "Escape") {
                                setStatusPopoverOpen(false);
                              }
                            }}
                            className={cn(
                              "w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                              "focus:outline-none focus:ring-2 focus:ring-blue-500/20",
                              "disabled:opacity-50 disabled:cursor-not-allowed",
                              isSelected
                                ? "bg-blue-500/10 text-blue-700 font-medium dark:bg-blue-500/20 dark:text-blue-400"
                                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/60"
                            )}
                          >
                            {config.label}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Duplicate Status Badge with candidates popover */}
                {device.duplicateStatus === "potential" && (
                  <DuplicateCandidatesPopover deviceId={device.id}>
                    <button
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                        "bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
                        "hover:bg-amber-500/20 dark:hover:bg-amber-500/30"
                      )}
                    >
                      <Copy className="h-3 w-3" />
                      Потенциальный дубликат
                      <Merge className="h-3 w-3" />
                    </button>
                  </DuplicateCandidatesPopover>
                )}

                {device.duplicateStatus === "duplicate" && device.duplicateOfId && (
                  <Link
                    href={`/dashboard/devices/${device.duplicateOfId}`}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                      "bg-red-500/10 text-red-700 dark:bg-red-500/20 dark:text-red-400",
                      "hover:bg-red-500/20 dark:hover:bg-red-500/30"
                    )}
                  >
                    <Copy className="h-3 w-3" />
                    Дубликат
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Inline Editable Description */}
          <div className="group mt-3">
            <InlineEditableInput
              type="textarea"
              value={device.description || ""}
              onSave={handleDescriptionSave}
              placeholder="Добавьте описание устройства..."
              disabled={isLoading}
              uniqueKey={`description-${device.id}`}
              rows={2}
              className="text-sm dark:text-gray-300"
            />
          </div>
        </div>
      </div>
    </InfoCard>
  );
}
