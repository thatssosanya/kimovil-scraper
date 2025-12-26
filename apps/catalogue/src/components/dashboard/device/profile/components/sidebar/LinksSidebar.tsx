import {
  ExternalLink,
  Edit3,
  Check,
  X,
  ChevronDown,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { rubleCurrencyFormatter, formatRelativeTime } from "@/src/utils/utils";
import { revalidateDevicePage } from "@/src/utils/revalidate";
import { toast } from "sonner";
import { AddLinkDialogue } from "@/src/components/dashboard/link/components/dialogs/AddLinkDialogue";
import { api } from "@/src/utils/api";
import { useState, useRef, useEffect } from "react";
import type { Link, Config, Sku } from "@/src/server/db/schema";

interface LinkWithConfig extends Link {
  config?: Config | null;
  sku?: { id: string; name: string } | null;
  marketplace?: { id: string; name: string } | null;
}

interface ConfigGroup {
  config: Config | null;
  links: LinkWithConfig[];
}

interface LinksSidebarProps {
  links: LinkWithConfig[];
  configs: Config[];
  skus: Sku[];
  deviceId: string;
}

export function LinksSidebar({
  links,
  configs,
  skus,
  deviceId,
}: LinksSidebarProps) {
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newSkuId, setNewSkuId] = useState<string | null>(null);

  const utils = api.useUtils();

  // Delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-reset delete confirmation after 3 seconds
  useEffect(() => {
    if (deleteConfirmId) {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = setTimeout(
        () => setDeleteConfirmId(null),
        3000
      );
    }
    return () => {
      if (deleteTimeoutRef.current) clearTimeout(deleteTimeoutRef.current);
    };
  }, [deleteConfirmId]);

  // Delete mutation with revalidation
  const { mutateAsync: deleteLink } = api.link.deleteLink.useMutation({
    onSuccess: async () => {
      void utils.device.getDevice.invalidate({ deviceId });

      try {
        const characteristics =
          await utils.device.getDeviceCharacteristic.fetch({
            deviceId: deviceId,
          });
        if (characteristics?.slug) {
          await revalidateDevicePage(characteristics.slug);
          toast.success("Ссылка удалена и кэш обновлен");
        }
      } catch (error) {
        console.error("Failed to revalidate device page:", error);
        toast.success("Ссылка удалена");
      }
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Не удалось удалить ссылку";
      toast.error(message);
    },
  });

  const { mutate: updateLink } = api.link.updateLink.useMutation({
    onSuccess: async () => {
      setEditingLinkId(null);
      setNewPrice("");
      setNewUrl("");
      setNewSkuId(null);

      // Invalidate the device query to refetch (this includes links)
      void utils.device.getDevice.invalidate({ deviceId });

      // Get device characteristics to revalidate the page
      try {
        const characteristics =
          await utils.device.getDeviceCharacteristic.fetch({
            deviceId: deviceId,
          });
        if (characteristics?.slug) {
          await revalidateDevicePage(characteristics.slug);
          toast.success("Кэш страницы профиля обновлен");
        }
      } catch (error) {
        console.error("Failed to revalidate device page:", error);
      }
    },
  });

  const handleStartEdit = (link: LinkWithConfig) => {
    setEditingLinkId(link.id);
    setNewPrice(link.price.toString());
    setNewUrl(link.url || "");
    setNewSkuId(link.skuId || null);
  };

  const handleSaveEdit = (link: LinkWithConfig) => {
    const priceNumber = parseInt(newPrice);
    if (isNaN(priceNumber)) return;

    updateLink({
      id: link.id,
      configId: link.configId,
      skuId: newSkuId,
      price: priceNumber,
      url: newUrl || undefined,
    });
  };

  const handleCancelEdit = () => {
    setEditingLinkId(null);
    setNewPrice("");
    setNewUrl("");
    setNewSkuId(null);
  };

  const handleDeleteClick = async (link: LinkWithConfig) => {
    if (deletingId) return; // Prevent parallel deletes

    if (deleteConfirmId === link.id) {
      // Second click - perform deletion
      try {
        setDeletingId(link.id);
        await deleteLink({ id: link.id });
      } finally {
        setDeletingId(null);
        setDeleteConfirmId(null);
      }
    } else {
      // First click - show confirmation
      setDeleteConfirmId(link.id);
    }
  };

  const getAgeStyle = (date: Date) => {
    const days = (new Date().getTime() - date.getTime()) / (1000 * 3600 * 24);
    if (days >= 60) return "very-old";
    if (days >= 40) return "old";
    if (days >= 20) return "aging";
    return "fresh";
  };

  const getAgeColor = (ageStyle: string) => {
    switch (ageStyle) {
      case "very-old":
        return "text-red-600 dark:text-red-400";
      case "old":
        return "text-orange-600 dark:text-orange-400";
      case "aging":
        return "text-yellow-600 dark:text-yellow-400";
      case "fresh":
        return "text-green-600 dark:text-green-400";
      default:
        return "text-gray-500 dark:text-gray-400";
    }
  };

  const getAgeDotColor = (ageStyle: string) => {
    switch (ageStyle) {
      case "very-old":
        return "bg-red-600 dark:bg-red-400";
      case "old":
        return "bg-orange-600 dark:bg-orange-400";
      case "aging":
        return "bg-yellow-600 dark:bg-yellow-400";
      case "fresh":
        return "bg-green-600 dark:bg-green-400";
      default:
        return "bg-gray-500 dark:bg-gray-400";
    }
  };

  // Group links by config
  const groupedLinks: ConfigGroup[] = [
    ...configs.map((config) => ({
      config,
      links: links.filter((link) => link.configId === config.id),
    })),
    {
      config: null,
      links: links.filter((link) => !link.configId),
    },
  ];

  // Also include configs that have no links
  const configsWithoutLinks = configs.filter(
    (config) =>
      !groupedLinks.some(
        (group) => group.config?.id === config.id && group.links.length > 0
      )
  );

  return (
    <div className="pb-8">
      {links.length === 0 && configs.length === 0 ? (
        <div className="py-8 text-center">
          <div className="mb-3 text-sm text-gray-500 dark:text-gray-400">
            Ссылки для покупки ещё не добавлены
          </div>
          <div className="mt-4">
            <AddLinkDialogue deviceId={deviceId} variant="default" size="sm" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedLinks.map((group, groupIndex) => {
            if (group.links.length === 0) return null;

            return (
              <div key={groupIndex}>
                {group.config && (
                  <div className="mb-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {group.config.name}
                    </h4>
                  </div>
                )}

                <div className="space-y-3">
                  {group.links.map((link) => {
                    const ageStyle = getAgeStyle(link.updatedAt);
                    const ageColor = getAgeColor(ageStyle);
                    const ageDotColor = getAgeDotColor(ageStyle);
                    const isEditing = editingLinkId === link.id;

                    if (isEditing) {
                      return (
                        <div key={link.id} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-2 w-2 rounded-full ${ageDotColor}`}
                            />
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
                              {link.marketplace?.name || "Неизвестно"}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <input
                              type="number"
                              value={newPrice}
                              onChange={(e) => setNewPrice(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSaveEdit(link);
                                }
                              }}
                              placeholder="Цена"
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                            />
                            <input
                              type="url"
                              value={newUrl}
                              onChange={(e) => setNewUrl(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleSaveEdit(link);
                                }
                              }}
                              placeholder="URL"
                              className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                            />
                            {skus && skus.length > 0 && (
                              <div className="relative">
                                <select
                                  value={newSkuId || ""}
                                  onChange={(e) =>
                                    setNewSkuId(e.target.value || null)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleSaveEdit(link);
                                    }
                                  }}
                                  className="w-full appearance-none rounded border border-gray-300 px-2 py-1 pr-8 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                                >
                                  <option value="">Выберите SKU...</option>
                                  {skus.map((sku: Sku) => (
                                    <option key={sku.id} value={sku.id}>
                                      {sku.ram_gb} ГБ ОЗУ • {sku.storage_gb} ГБ
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                              </div>
                            )}
                          </div>

                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSaveEdit(link)}
                              className="h-6 w-6 p-0 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={link.id}
                        className="flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <div
                              className={`h-2 w-2 rounded-full ${ageDotColor}`}
                            />
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
                              {link.marketplace?.name || "Неизвестно"}
                            </span>
                          </div>

                          {link.price && (
                            <div className="mb-1">
                              <span className="text-base font-semibold text-green-600 dark:text-green-400">
                                {rubleCurrencyFormatter(link.price)}
                              </span>
                            </div>
                          )}

                          <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                            <span className={ageColor}>
                              {formatRelativeTime(link.updatedAt)}
                            </span>
                          </div>

                          {link.config && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {link.config.name}
                            </div>
                          )}
                        </div>

                        <div className="flex shrink-0 items-start gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEdit(link)}
                            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                            title="Редактировать ссылку"
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              link.url && window.open(link.url, "_blank")
                            }
                            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                            title="Открыть ссылку"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteClick(link)}
                            disabled={deletingId === link.id}
                            className={`h-6 w-6 p-0 ${
                              deleteConfirmId === link.id
                                ? "text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                            }`}
                            title={
                              deleteConfirmId === link.id
                                ? "Точно удалить?"
                                : "Удалить ссылку"
                            }
                          >
                            {deletingId === link.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {configsWithoutLinks.map((config) => (
            <div key={`empty-${config.id}`}>
              <div className="mb-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {config.name}
                </h4>
              </div>

              <AddLinkDialogue
                deviceId={deviceId}
                configId={config.id}
                variant="card"
                cardLabel="Нет ссылок"
              />
            </div>
          ))}

          {/* Add button for devices with configs but we also want to add links without configs */}
          {configs.length > 0 && (
            <div>
              <div className="mb-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Без конфигурации
                </h4>
              </div>

              <AddLinkDialogue
                deviceId={deviceId}
                variant="card"
                cardLabel="Добавить ссылку"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
