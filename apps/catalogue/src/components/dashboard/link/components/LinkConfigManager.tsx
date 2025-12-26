import React from "react";
import type { Config, Sku } from "@/src/server/db/schema";
import { api } from "@/src/utils/api";
import { toast } from "sonner";
import { X, Check } from "lucide-react";
import { rubleCurrencyFormatter } from "@/src/utils/utils";
import { revalidateDevicePage } from "@/src/utils/revalidate";
import { type LinkWithRelations } from "./LinkCard";

type Props = {
  link: LinkWithRelations;
  configs: Config[];
  skus?: Sku[];
  onUpdate: () => void;
  onClose: () => void;
  deviceId: string;
};

type Connection = {
  configId: string | null;
  skuId: string | null;
};

export const LinkConfigManager = ({
  link,
  configs,
  skus,
  onUpdate,
  onClose,
  deviceId,
}: Props) => {
  const utils = api.useUtils();
  const [pendingConnections, setPendingConnections] = React.useState<
    Connection[]
  >(() => {
    return [
      {
        configId: link.config?.id ?? null,
        skuId: link.sku?.id ?? null,
      },
    ];
  });

  const updateLinkMutation = api.link.updateLink.useMutation({
    onSuccess: async () => {
      toast.success("Ссылка обновлена успешно");
      void utils.link.getDeviceLinks.invalidate();
      onUpdate();
      const characteristics = await utils.device.getDeviceCharacteristic.fetch({
        deviceId: deviceId,
      });
      if (characteristics?.slug) {
        await revalidateDevicePage(characteristics.slug);
        toast.success("Кэш страницы профиля обновлен");
      }
    },
    onError: (error) => toast.error(`Failed to update link: ${error.message}`),
  });

  const handleSave = async () => {
    try {
      for (const connection of pendingConnections) {
        await updateLinkMutation.mutateAsync({ id: link.id, ...connection });
      }
      onClose();
    } catch (error) {
      console.error("Failed to save connections:", error);
      toast.error("Failed to save connections");
    }
  };

  const formatConfig = (config: Config) => {
    const parts = [];
    if (config.name) parts.push(config.name);

    return parts.join(" • ");
  };

  const formatSku = (sku: Sku) => `${sku.ram_gb} ГБ ОЗУ • ${sku.storage_gb} ГБ`;

  const SelectionButton = ({
    isSelected,
    onClick,
    label,
  }: {
    isSelected: boolean;
    onClick: () => void;
    label: string;
  }) => (
    <button
      onClick={onClick}
      className={`group flex w-full items-center justify-between rounded border p-3 text-left transition-colors ${
        isSelected
          ? "border-green-500 bg-green-50 text-green-700"
          : "bg-white hover:border-green-500 hover:bg-green-50"
      }`}
    >
      <span className="text-sm font-medium">{label}</span>
      {isSelected && <Check className="h-5 w-5 text-green-500" />}
    </button>
  );

  return (
    <div className="flex flex-col gap-4 ">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Настройка привязки ссылки</h2>
        <button
          onClick={onClose}
          className="rounded-full p-1 hover:bg-zinc-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="rounded-lg border bg-blue-50 p-4">
        <div className="mb-2 text-sm font-medium text-blue-700">
          Настраиваемая ссылка:
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="text-sm font-medium">{link.name}</div>
            <div
              className="max-w-[400px] truncate text-xs text-zinc-600"
              title={link.url || ""}
            >
              {link.url}
            </div>
          </div>
          <div className="text-sm text-zinc-600">
            {link.price ? rubleCurrencyFormatter(link.price) : "Нет цены"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="mb-2 text-sm font-medium text-zinc-700">
            Конфигурация
          </h3>
          <div className="rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 p-4">
            <div className="space-y-2">
              {configs.map((config) => (
                <SelectionButton
                  key={config.id}
                  isSelected={pendingConnections[0]?.configId === config.id}
                  onClick={() =>
                    setPendingConnections([
                      {
                        configId: config.id,
                        skuId: pendingConnections[0]?.skuId ?? null,
                      },
                    ])
                  }
                  label={formatConfig(config)}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-zinc-700">
            SKU
          </h3>
          <div className="rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50 p-4">
            <div className="space-y-2">
              {skus?.map((sku) => (
                <SelectionButton
                  key={sku.id}
                  isSelected={pendingConnections[0]?.skuId === sku.id}
                  onClick={() =>
                    setPendingConnections([
                      {
                        configId: pendingConnections[0]?.configId ?? null,
                        skuId: sku.id,
                      },
                    ])
                  }
                  label={formatSku(sku)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-zinc-600">
          {(() => {
            const selectedConfig = configs.find(
              (c) => c.id === pendingConnections[0]?.configId
            );
            if (selectedConfig) {
              return (
                <span className="mr-2">
                  Конфигурация: {formatConfig(selectedConfig)}
                </span>
              );
            }
            return null;
          })()}
          {(() => {
            const selectedSku = skus?.find(
              (s) => s.id === pendingConnections[0]?.skuId
            );
            if (selectedSku) {
              return <span>SKU: {formatSku(selectedSku)}</span>;
            }
            return null;
          })()}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="rounded border px-4 py-2 hover:bg-zinc-50"
          >
            Отмена
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={updateLinkMutation.isPending}
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};
