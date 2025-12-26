import React, { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { Link } from "@/src/server/db/schema";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/src/components/ui/Dialog";
import { Input } from "@/src/components/ui/Input";
import { ComboBox } from "@/src/components/ui/ComboBox";
import { Skeleton } from "@/src/components/ui/Skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/Select";
import { Label } from "@/src/components/ui/Label";
import { api } from "@/src/utils/api";
import { rubleCurrencyFormatter } from "@/src/utils/utils";
import DumbConfigSelector from "@/src/components/dashboard/device/components/DumbConfigSelector";
import { type DeviceWithConfigs } from "@/src/components/dashboard/device/views/types";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/Button";
import { SaveIcon } from "lucide-react";

const addLinkSchema = z.object({
  device: z.string().min(1, "Выберите устройство"),
  config: z.string().optional(),
  marketplace: z.string().min(1, "Выберите площадку"),
  price: z.number().min(0).max(200000, "Слишком дорого"),
  link: z.string().url("Неверная ссылка"),
  sku: z.string().optional(),
});

type FormValues = z.infer<typeof addLinkSchema>;

export type AddLinkDialogueProps = {
  deviceId?: string;
  configId?: string;
  skuId?: string;
  variant?: "default" | "ghost" | "card";
  size?: "default" | "sm";
  cardLabel?: string;
};

export const AddLinkDialogue = ({
  deviceId,
  configId,
  skuId,
  variant = "default",
  size = "default",
  cardLabel,
}: AddLinkDialogueProps) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const [selectedDevice, setSelectedDevice] =
    React.useState<DeviceWithConfigs>();
  const [deviceSearch, setDeviceSearch] = React.useState("");

  const utils = api.useUtils();

  const { data: devices, isPending: isLoadingDevices } =
    api.search.getDevicesForSelect.useQuery({
      search: deviceSearch,
      id: deviceId,
    });

  useEffect(() => {
    if (devices && deviceId) {
      const device = devices.find((d) => d.id === deviceId);
      if (device) {
        setSelectedDevice(device as DeviceWithConfigs);
      }
    }
  }, [devices, deviceId]);

  const { data: marketplaces } = api.config.getAllMarketplaces.useQuery();

  const { data: deviceCharacteristics } =
    api.device.getDeviceCharacteristic.useQuery(
      { deviceId: deviceId! },
      { enabled: !!deviceId }
    );

  const { mutateAsync: createLink } = api.link.createLink.useMutation({
    onSuccess: async () => {
      await utils.link.getAllLinks.refetch();
      if (deviceId) {
        // Invalidate device query since that's what provides the links data
        void utils.device.getDevice.invalidate({ deviceId });
      }
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(addLinkSchema),
    defaultValues: {
      device: deviceId,
      config: configId,
      sku: skuId,
      marketplace: "clgspgon90002sci9ctmyyrnr",
      price: 0,
      link: "",
    },
  });

  const submitForm = (data: FormValues) => {
    toast.promise(
      createLink({
        ...data,
        url: data.link,
        price: data.price,
      })
        .then((result) => {
          if (!result) {
            throw new Error("Failed to create link - no data returned");
          }
          setIsOpen(false);
          reset();
          return result;
        })
        .catch((error) => {
          console.error("Error creating link:", error);
          throw error;
        }),
      {
        loading: "Добавляем ссылку",
        success: (data: Link) => `${data?.name || ""} успешно добавлен`,
        error: "Ошибка при добавлении ссылки",
      }
    );
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSubmit(submitForm)(e);
  };

  const handleOpenChange = (open: boolean) => {
    // When Radix requests a state change, set to the same value (do NOT invert)
    if (!open) {
      if (isDirty) {
        const shouldClose = confirm(
          "У вас есть несохраненные изменения. Вы уверены, что хотите закрыть?"
        );
        if (!shouldClose) return;
      }
      reset();
    }
    setIsOpen(open);
  };

  const handleClose = () => {
    // Reuse unified handler so logic stays consistent
    handleOpenChange(false);
  };

  const handleDeviceSelect = (val: string) => {
    setValue("device", val, { shouldDirty: true });
    const device = devices?.find((dev) => dev.id === val);
    if (device) {
      setSelectedDevice(device as DeviceWithConfigs);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {variant === "card" ? (
            <div className="group flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-3 transition-all duration-200 hover:border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800/30 dark:hover:border-gray-500 dark:hover:bg-gray-700/50">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-gray-400 transition-colors group-hover:bg-gray-500 dark:bg-gray-500 dark:group-hover:bg-gray-400" />
                <span className="text-sm font-medium text-gray-500 transition-colors group-hover:text-gray-600 dark:text-gray-400 dark:group-hover:text-gray-300">
                  {cardLabel || "Добавить ссылку"}
                </span>
              </div>
              <Plus className="h-4 w-4 text-gray-400 transition-colors group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300" />
            </div>
          ) : (
            <Button
              variant={variant}
              size={size}
              className={cn("inline-flex items-center gap-1 rounded", {
                "bg-black px-4 py-2 text-white hover:bg-zinc-800":
                  variant === "default",
                "text-zinc-600 hover:text-zinc-900": variant === "ghost",
                "text-sm": size === "sm",
              })}
            >
              <Plus className={cn("h-4 w-4", { "h-3 w-3": size === "sm" })} />
              <span>Добавить</span>
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold tracking-tight">
              Добавить ссылку
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              {deviceId
                ? "Добавьте ссылку на маркетплейс для этого устройства"
                : "Заполните информацию о новой ссылке"}
            </DialogDescription>
            {deviceId && selectedDevice && (
              <div className="bg-muted/50 mt-2 flex items-center gap-3 rounded-lg border p-3">
                {selectedDevice.imageUrl && (
                  <img
                    src={selectedDevice.imageUrl}
                    alt=""
                    className="h-12 w-12 rounded-md object-contain"
                  />
                )}
                <div className="flex flex-col gap-1">
                  <div className="font-medium">{selectedDevice.name}</div>
                  {configId && (
                    <div className="text-muted-foreground text-sm">
                      Конфигурация:{" "}
                      {
                        selectedDevice.configs.find((c) => c.id === configId)
                          ?.name
                      }
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogHeader>

          <div className="mt-6">
            <form onSubmit={onSubmit} className="flex flex-col gap-6">
              {/* Device Selection - Only show when no deviceId */}
              {!deviceId && (
                <div className="space-y-2">
                  <Label htmlFor="device" className="text-sm font-medium">
                    Устройство
                    <span className="text-destructive">*</span>
                  </Label>
                  {isLoadingDevices ? (
                    <Skeleton className="h-10 w-[240px]" />
                  ) : (
                    <ComboBox
                      value={watch("device")}
                      disabled={!!deviceId}
                      onSearch={setDeviceSearch}
                      setValue={handleDeviceSelect}
                      values={devices?.map((e) => ({
                        label: e.name || "",
                        iconUrl: e.imageUrl || "",
                        value: {
                          id: e.id,
                          name: e.name || "",
                        },
                      }))}
                      placeholder="Поиск устройства..."
                    />
                  )}
                  {errors.device && (
                    <p className="text-destructive text-sm" role="alert">
                      {errors.device.message}
                    </p>
                  )}
                </div>
              )}

              {/* Config Selection - Only show when no configId */}
              {selectedDevice &&
                !configId &&
                selectedDevice.configs.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="config" className="text-sm font-medium">
                      Конфигурация
                    </Label>
                    <DumbConfigSelector
                      configs={selectedDevice.configs}
                      setSelectedConfigId={(id: string) => {
                        setValue("config", id, { shouldDirty: true });
                      }}
                      disabled={!!configId}
                      selectedConfigId={watch("config") || ""}
                    />
                    {errors.config && (
                      <p className="text-destructive text-sm" role="alert">
                        {errors.config.message}
                      </p>
                    )}
                  </div>
                )}

              {/* Marketplace Selection */}
              <div className="space-y-2">
                <Label htmlFor="marketplace" className="text-sm font-medium">
                  Площадка
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  onValueChange={(val) =>
                    setValue("marketplace", val, { shouldDirty: true })
                  }
                  value={watch("marketplace")}
                >
                  <SelectTrigger className="text-muted-foreground w-full">
                    <SelectValue placeholder="Выбрать" />
                  </SelectTrigger>
                  <SelectContent>
                    {marketplaces?.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        <div className="flex items-center gap-2">
                          <img
                            className="h-4 w-4 rounded object-cover"
                            src={e.iconUrl || ""}
                            alt=""
                          />
                          {e.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.marketplace && (
                  <p className="text-destructive text-sm" role="alert">
                    {errors.marketplace.message}
                  </p>
                )}
              </div>

              {/* Price Input */}
              <div className="space-y-2">
                <Label htmlFor="price" className="text-sm font-medium">
                  Цена
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="text"
                  className="w-full"
                  value={rubleCurrencyFormatter(watch("price")).slice(0, -2)}
                  onChange={(e) => {
                    const value =
                      parseInt(e.target.value.replace(/\D/gi, "")) || 0;
                    setValue("price", value, { shouldDirty: true });
                  }}
                  placeholder="12 990 ₽"
                />
                {errors.price && (
                  <p className="text-destructive text-sm" role="alert">
                    {errors.price.message}
                  </p>
                )}
              </div>

              {/* Link Input */}
              <div className="space-y-2">
                <Label htmlFor="link" className="text-sm font-medium">
                  Ссылка
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="url"
                  className="w-full"
                  aria-invalid={!!errors.link}
                  {...register("link")}
                  placeholder="https://"
                />
                {errors.link && (
                  <p className="text-destructive text-sm" role="alert">
                    {errors.link.message}
                  </p>
                )}
              </div>

              {/* SKU Selection */}
              {deviceCharacteristics?.skus &&
                deviceCharacteristics.skus.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="sku" className="text-sm font-medium">
                      Конфигурация SKU
                    </Label>
                    <Select
                      onValueChange={(val) =>
                        setValue("sku", val, { shouldDirty: true })
                      }
                      value={watch("sku")}
                    >
                      <SelectTrigger className="text-muted-foreground w-full">
                        <SelectValue placeholder="Выбрать" />
                      </SelectTrigger>
                      <SelectContent>
                        {deviceCharacteristics.skus.map((sku) => (
                          <SelectItem key={sku.id} value={sku.id}>
                            <div className="flex items-center gap-2">
                              {sku.ram_gb}GB + {sku.storage_gb}GB
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

              <div className="mt-6 flex items-center justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="min-w-[120px]"
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  className="min-w-[120px] gap-2 bg-green-600 text-white transition-all hover:bg-green-700 active:scale-95"
                >
                  <SaveIcon className="h-4 w-4" />
                  <span>Сохранить</span>
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

AddLinkDialogue.displayName = "AddLinkDialogue";
