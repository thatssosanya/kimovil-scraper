import { useState } from "react";
import { useRouter } from "next/router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import { Button } from "@/src/components/ui/Button";
import { Copy, AlertTriangle, Loader2, ArrowRight, Link as LinkIcon, MessageSquare, Star, FileText } from "lucide-react";
import { api } from "@/src/utils/api";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";

interface MergeDuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateId: string;
  canonicalId: string;
  onMergeComplete?: () => void;
}

export const MergeDuplicateDialog = ({
  open,
  onOpenChange,
  duplicateId,
  canonicalId,
  onMergeComplete,
}: MergeDuplicateDialogProps) => {
  const [characteristicsAction, setCharacteristicsAction] = useState<
    "keep_canonical" | "use_duplicate" | "keep_both"
  >("keep_canonical");
  const [deleteAfterMerge, setDeleteAfterMerge] = useState(false);

  const router = useRouter();
  const utils = api.useUtils();

  const { data: preview, isPending: isLoadingPreview } =
    api.device.getMergePreview.useQuery(
      { canonicalId, duplicateId },
      { enabled: open }
    );

  const mergeMutation = api.device.mergeDuplicate.useMutation({
    onSuccess: (result) => {
      const parts = [];
      if (result.transferred.links > 0) parts.push(`${result.transferred.links} ссылок`);
      if (result.transferred.prosCons > 0) parts.push(`${result.transferred.prosCons} плюсов/минусов`);
      if (result.transferred.ratingPositions > 0) parts.push(`${result.transferred.ratingPositions} рейтингов`);
      if (result.transferred.characteristics > 0) parts.push(`профиль`);
      
      toast.success("Устройства объединены", {
        description: parts.length > 0 
          ? `Перенесено: ${parts.join(", ")}` 
          : "Данные успешно объединены",
      });
      
      void utils.device.getAllDevices.invalidate();
      void utils.device.getDuplicateStats.invalidate();
      onMergeComplete?.();
      onOpenChange(false);
      
      // Navigate to the canonical device profile
      void router.push(`/dashboard/devices/${canonicalId}`);
    },
    onError: (error) => {
      toast.error("Ошибка объединения", {
        description: error.message,
      });
    },
  });

  const handleMerge = () => {
    mergeMutation.mutate({
      canonicalId,
      duplicateId,
      characteristicsAction,
      deleteAfterMerge,
    });
  };

  if (isLoadingPreview) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Объединение устройств
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2 text-sm text-gray-500">Загрузка данных...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!preview) {
    return null;
  }

  const hasAnythingToTransfer =
    preview.toTransfer.links > 0 ||
    preview.toTransfer.prosCons > 0 ||
    preview.toTransfer.configs > 0 ||
    preview.toTransfer.ratingPositions > 0 ||
    preview.conflicts.duplicateCharacteristics;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Объединение устройств
          </DialogTitle>
          <DialogDescription>
            Все данные дубликата будут перенесены на оригинал
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Device names */}
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500 dark:text-gray-400">Дубликат</div>
              <div className="font-medium truncate">{preview.duplicate.name}</div>
            </div>
            <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500 dark:text-gray-400">Оригинал</div>
              <div className="font-medium truncate">{preview.canonical.name}</div>
            </div>
          </div>

          {/* Transfer summary */}
          {hasAnythingToTransfer && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Будет перенесено:</div>
              <div className="grid grid-cols-2 gap-2">
                {preview.toTransfer.links > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800/50">
                    <LinkIcon className="h-4 w-4 text-gray-500" />
                    <span>{preview.toTransfer.links} ссылок</span>
                  </div>
                )}
                {preview.toTransfer.prosCons > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800/50">
                    <MessageSquare className="h-4 w-4 text-gray-500" />
                    <span>{preview.toTransfer.prosCons} плюсов/минусов</span>
                  </div>
                )}
                {preview.toTransfer.ratingPositions > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800/50">
                    <Star className="h-4 w-4 text-gray-500" />
                    <span>{preview.toTransfer.ratingPositions} рейтингов</span>
                  </div>
                )}
                {preview.conflicts.duplicateCharacteristics && (
                  <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800/50">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span>Профиль</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rating conflicts warning */}
          {preview.conflicts.ratingConflicts > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Конфликт в {preview.conflicts.ratingConflicts} рейтингах
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Оба устройства присутствуют в одних рейтингах. Будет сохранена лучшая позиция.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Characteristics conflict */}
          {preview.conflicts.hasCharacteristicsConflict && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Оба устройства имеют профиль:</div>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="characteristicsAction"
                    value="keep_canonical"
                    checked={characteristicsAction === "keep_canonical"}
                    onChange={() => setCharacteristicsAction("keep_canonical")}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm">
                    Оставить профиль оригинала
                    {preview.conflicts.canonicalCharacteristics?.name && (
                      <span className="ml-1 text-gray-500">
                        ({preview.conflicts.canonicalCharacteristics.name})
                      </span>
                    )}
                  </span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="characteristicsAction"
                    value="use_duplicate"
                    checked={characteristicsAction === "use_duplicate"}
                    onChange={() => setCharacteristicsAction("use_duplicate")}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm">
                    Заменить на профиль дубликата
                    {preview.conflicts.duplicateCharacteristics?.name && (
                      <span className="ml-1 text-gray-500">
                        ({preview.conflicts.duplicateCharacteristics.name})
                      </span>
                    )}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Delete option */}
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={deleteAfterMerge}
              onChange={(e) => setDeleteAfterMerge(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-primary"
            />
            <span className="text-sm">
              Удалить дубликат после объединения
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mergeMutation.isPending}
          >
            Отмена
          </Button>
          <Button
            onClick={handleMerge}
            disabled={mergeMutation.isPending}
            className={cn(
              deleteAfterMerge && "bg-red-600 hover:bg-red-700"
            )}
          >
            {mergeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Объединение...
              </>
            ) : deleteAfterMerge ? (
              "Объединить и удалить"
            ) : (
              "Объединить"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
