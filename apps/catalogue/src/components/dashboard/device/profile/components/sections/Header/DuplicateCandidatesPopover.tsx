import { useState, type ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/Popover";
import { Button } from "@/src/components/ui/Button";
import { Loader2, Check, ExternalLink } from "lucide-react";
import { api } from "@/src/utils/api";
import { toast } from "sonner";
import Link from "next/link";
import { MergeDuplicateDialog } from "@/src/components/dashboard/device/components/dialogs/MergeDuplicateDialog";
import { cn } from "@/src/lib/utils";
import {
  getAgeStyle,
  formatRelativeTime,
  type AgeCategory,
} from "@/src/utils/utils";

interface DuplicateCandidatesPopoverProps {
  deviceId: string;
  children: ReactNode;
}

type DeviceInfo = {
  id: string;
  name: string | null;
  type: string | null;
  imageUrl: string | null;
  createdAt: Date;
  hasProfile: boolean;
  latestPrice: number | null;
  priceUpdatedAt: Date | null;
  linksCount: number;
};

const dateColors: Record<AgeCategory, string> = {
  fresh: "text-emerald-600 dark:text-emerald-400",
  recent: "text-blue-600 dark:text-blue-400",
  aging: "text-yellow-600 dark:text-yellow-500",
  old: "text-orange-600 dark:text-orange-400",
  "very-old": "text-red-600 dark:text-red-400",
};

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

function DeviceRow({
  device,
  labelType,
  isSelected,
  onSelect,
  showLink,
}: {
  device: DeviceInfo;
  labelType: "current" | "candidate";
  isSelected: boolean;
  onSelect: () => void;
  showLink?: boolean;
}) {
  const priceDate = device.priceUpdatedAt ? new Date(device.priceUpdatedAt) : null;
  const ageStyle: AgeCategory = priceDate ? getAgeStyle(priceDate) : "very-old";

  return (
    <div
      onClick={onSelect}
      className={cn(
        "grid grid-cols-[16px_1fr_100px_80px_28px] items-center gap-4 px-4 py-2.5 cursor-pointer transition-colors",
        isSelected
          ? "bg-blue-50 dark:bg-blue-900/20"
          : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
      )}
    >
      {/* Profile status indicator */}
      <div className="flex items-center justify-center">
        {device.hasProfile ? (
          <div
            className="h-2 w-2 rounded-full bg-green-500 dark:bg-green-400"
            title="Профиль создан"
          />
        ) : (
          <div
            className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600"
            title="Нет профиля"
          />
        )}
      </div>

      {/* Device name */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base font-semibold dark:text-gray-100 truncate">
          {device.name}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium flex-shrink-0",
            labelType === "current"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          )}
        >
          {labelType === "current" ? "текущее" : "кандидат"}
        </span>
        {isSelected && (
          <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        )}
      </div>

      {/* Price */}
      <div>
        {device.latestPrice ? (
          <div className="inline-flex flex-col items-start gap-0.5">
            <span className="text-base font-semibold dark:text-gray-100">
              {device.latestPrice.toLocaleString()} ₽
            </span>
            {priceDate && (
              <span className={cn("text-xs", dateColors[ageStyle])}>
                {formatRelativeTime(priceDate)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs dark:text-gray-500">—</span>
        )}
      </div>

      {/* Created date */}
      <div>
        <span className="text-muted-foreground text-sm dark:text-gray-500">
          {formatDate(device.createdAt)}
        </span>
      </div>

      {/* Link */}
      <div>
        {showLink && (
          <Link
            href={`/dashboard/devices/${device.id}`}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "flex items-center justify-center rounded p-1 text-gray-400 transition-colors",
              "hover:bg-gray-200 hover:text-gray-600",
              "dark:hover:bg-gray-700 dark:hover:text-gray-300"
            )}
            title="Открыть"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

export function DuplicateCandidatesPopover({
  deviceId,
  children,
}: DuplicateCandidatesPopoverProps) {
  const [open, setOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedCanonicalId, setSelectedCanonicalId] = useState<string | null>(null);
  const [selectedDuplicateId, setSelectedDuplicateId] = useState<string | null>(null);
  // Track which device is selected to keep (per candidate pair)
  const [selectedToKeep, setSelectedToKeep] = useState<string | null>(null);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);

  const utils = api.useUtils();

  const { data, isPending } = api.device.getDuplicateCandidates.useQuery(
    { deviceId },
    { enabled: open }
  );

  const resolveAsUniqueMutation = api.device.resolveAsUnique.useMutation({
    onSuccess: () => {
      toast.success("Устройство отмечено как уникальное");
      void utils.device.getAllDevices.invalidate();
      void utils.device.getDuplicateStats.invalidate();
      void utils.device.getDevice.invalidate({ deviceId });
      setOpen(false);
    },
    onError: (error) => {
      toast.error("Ошибка", { description: error.message });
    },
  });

  const handleSelectDevice = (keepId: string, candidateId: string) => {
    setSelectedToKeep(keepId);
    setActiveCandidateId(candidateId);
  };

  const handleConfirmMerge = () => {
    if (!selectedToKeep || !activeCandidateId) return;
    
    if (selectedToKeep === deviceId) {
      // Keep current, merge candidate into it
      setSelectedCanonicalId(deviceId);
      setSelectedDuplicateId(activeCandidateId);
    } else {
      // Keep candidate, merge current into it
      setSelectedCanonicalId(activeCandidateId);
      setSelectedDuplicateId(deviceId);
    }
    setMergeDialogOpen(true);
    setOpen(false);
  };

  const handleResolveAsUnique = () => {
    resolveAsUniqueMutation.mutate({ deviceId });
  };

  const handleMergeComplete = () => {
    void utils.device.getAllDevices.invalidate();
    void utils.device.getDuplicateStats.invalidate();
    void utils.device.getDevice.invalidate({ deviceId });
    setSelectedToKeep(null);
    setActiveCandidateId(null);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSelectedToKeep(null);
      setActiveCandidateId(null);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent className="w-[620px] p-0" align="start">
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3">
            <div className="text-sm font-medium dark:text-gray-100">Возможные дубликаты</div>
            <div className="text-xs text-muted-foreground dark:text-gray-500">
              Кликните на устройство которое нужно оставить
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[16px_1fr_100px_80px_28px] items-center gap-4 px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
            <div />
            <div className="text-xs font-medium text-muted-foreground dark:text-gray-500">
              Название
            </div>
            <div className="text-xs font-medium text-muted-foreground dark:text-gray-500">
              Цена
            </div>
            <div className="text-xs font-medium text-muted-foreground dark:text-gray-500">
              Создано
            </div>
            <div />
          </div>

          {isPending ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : data?.current && data.candidates.length > 0 ? (
            <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {data.candidates.map((candidate) => (
                <div key={candidate.id}>
                  {/* Current device row */}
                  <DeviceRow
                    device={data.current}
                    labelType="current"
                    isSelected={selectedToKeep === deviceId && activeCandidateId === candidate.id}
                    onSelect={() => handleSelectDevice(deviceId, candidate.id)}
                  />
                  
                  {/* Candidate device row */}
                  <DeviceRow
                    device={candidate}
                    labelType="candidate"
                    isSelected={selectedToKeep === candidate.id && activeCandidateId === candidate.id}
                    onSelect={() => handleSelectDevice(candidate.id, candidate.id)}
                    showLink
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground dark:text-gray-500">
              Кандидатов не найдено
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-xs"
              onClick={handleResolveAsUnique}
              disabled={resolveAsUniqueMutation.isPending}
            >
              {resolveAsUniqueMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Не дубликат
            </Button>
            
            <Button
              size="sm"
              disabled={!selectedToKeep}
              onClick={handleConfirmMerge}
            >
              Объединить
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {selectedCanonicalId && selectedDuplicateId && (
        <MergeDuplicateDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          duplicateId={selectedDuplicateId}
          canonicalId={selectedCanonicalId}
          onMergeComplete={handleMergeComplete}
        />
      )}
    </>
  );
}
