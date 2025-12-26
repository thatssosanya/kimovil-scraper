import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import { Button } from "@/src/components/ui/Button";
import { Badge } from "@/src/components/ui/Badge";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { api } from "@/src/utils/api";
import { toast } from "sonner";

interface RatingCleanupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleanupComplete?: () => void;
}

export const RatingCleanupDialog = ({
  open,
  onOpenChange,
  onCleanupComplete,
}: RatingCleanupDialogProps) => {
  const [isConfirming, setIsConfirming] = useState(false);

  const utils = api.useUtils();

  const { data: orphanedData, isPending: isLoadingOrphaned } =
    api.rating.findOrphanedRatingData.useQuery(undefined, {
      enabled: open,
    });

  const cleanupMutation = api.rating.cleanupOrphanedRatingData.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Очищено ${result.cleanedCount} устаревших связей с рейтингами`
      );
      void utils.rating.hasOrphanedRatingData.invalidate();
      void utils.rating.findOrphanedRatingData.invalidate();
      onCleanupComplete?.();
      onOpenChange(false);
      setIsConfirming(false);
    },
    onError: (error) => {
      toast.error(`Ошибка при очистке: ${error.message}`);
      setIsConfirming(false);
    },
  });

  const handleCleanup = () => {
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }
    cleanupMutation.mutate();
  };

  const handleCancel = () => {
    setIsConfirming(false);
    onOpenChange(false);
  };

  if (isLoadingOrphaned) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Очистка устаревших рейтингов
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Поиск устаревших данных...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const hasOrphanedData = orphanedData && orphanedData.totalOrphanedItems > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Очистка устаревших рейтингов
          </DialogTitle>
          <DialogDescription>
            {hasOrphanedData
              ? "Найдены устройства, связанные с удалёнными рейтингами. Эти связи можно безопасно удалить."
              : "Устаревших связей с рейтингами не найдено."}
          </DialogDescription>
        </DialogHeader>

        {hasOrphanedData ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">
                Найдено {orphanedData.totalOrphanedItems} устаревших связей
              </span>
            </div>

            {orphanedData.orphanedConnections.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">
                  Устройства с устаревшими рейтингами:
                </h4>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                  {orphanedData.orphanedConnections.map((connection, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="truncate">
                        {connection.deviceName || "Без названия"}
                      </span>
                      <Badge variant="destructive" className="ml-2 text-xs">
                        {connection.ratingName}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {orphanedData.orphanedPositions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">
                  Устаревшие позиции в рейтингах:
                </h4>
                <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border p-2">
                  {orphanedData.orphanedPositions.map((position) => (
                    <div
                      key={position.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="truncate">
                        {position.device?.name || "Без названия"}
                      </span>
                      <Badge variant="outline" className="ml-2 text-xs">
                        Позиция {position.position}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isConfirming && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">
                    Подтвердите удаление
                  </span>
                </div>
                <p className="mt-1 text-xs text-red-700">
                  Это действие нельзя отменить. Все устаревшие связи будут
                  удалены безвозвратно.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Trash2 className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-muted-foreground text-sm">
              Все связи с рейтингами актуальны
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {isConfirming ? "Отмена" : "Закрыть"}
          </Button>
          {hasOrphanedData && (
            <Button
              variant={isConfirming ? "destructive" : "default"}
              onClick={handleCleanup}
              disabled={cleanupMutation.isPending}
            >
              {cleanupMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Очистка...
                </>
              ) : isConfirming ? (
                "Подтвердить удаление"
              ) : (
                "Очистить"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
