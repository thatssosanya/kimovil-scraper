import { useState } from "react";
import { api } from "@/src/utils/api";
import { toast } from "sonner";
import { type DragEndEvent } from "@dnd-kit/core";

export const useLinkConfigs = (deviceId: string) => {
  const [pendingLinks, setPendingLinks] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);

  const { data: deviceLinks, refetch } = api.link.getDeviceLinks.useQuery({
    id: deviceId,
  });

  const updateLinkMutation = api.link.updateLink.useMutation({
    onSuccess: () => void refetch(),
  });

  const handleDragStart = () => setIsDragging(true);

  const handleDragEnd = (event: DragEndEvent) => {
    setIsDragging(false);
    const { active, over } = event;

    if (!over) return;

    const linkId = active.id as string;
    const configId = over.id as string;
    const link = deviceLinks?.find((l) => l.id === linkId);

    if (
      (configId === "no-config" && !link?.config) ||
      link?.config?.id === configId
    ) {
      setPendingLinks((prev) => {
        const next = { ...prev };
        delete next[linkId];
        return next;
      });
      return;
    }

    setPendingLinks((prev) => ({
      ...prev,
      [linkId]: configId === "no-config" ? "" : configId,
    }));
  };

  const handleSaveChanges = async () => {
    try {
      await Promise.all(
        Object.entries(pendingLinks).map(([linkId, configId]) =>
          updateLinkMutation.mutateAsync({
            id: linkId,
            configId: configId || null,
            skuId: deviceLinks?.find((l) => l.id === linkId)?.sku?.id ?? null,
          })
        )
      );
      setPendingLinks({});
      toast.success("Изменения сохранены");
    } catch {
      toast.error("Ошибка при сохранении изменений");
    }
  };

  const handleResetChanges = () => setPendingLinks({});

  const getFilteredLinks = (configId: string | null) => {
    return deviceLinks?.filter((el) =>
      pendingLinks[el.id]
        ? configId
          ? pendingLinks[el.id] === configId
          : !pendingLinks[el.id]
        : configId
        ? el.config?.id === configId
        : !el.config
    );
  };

  return {
    deviceLinks,
    pendingLinks,
    isDragging,
    handleDragStart,
    handleDragEnd,
    handleSaveChanges,
    handleResetChanges,
    getFilteredLinks,
    refetch,
  };
};
