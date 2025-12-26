import React from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/src/components/ui/Input";
import { Label } from "@/src/components/ui/Label";
import { api } from "@/src/utils/api";
import { toast } from "sonner";
import { Textarea } from "@/src/components/ui/Textarea";
import { Button } from "@/src/components/ui/Button";
import { Dashboard } from "@uppy/react";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { type DeviceWithConfigs } from "@/src/components/dashboard/device/views/types";
import ConfigSelector from "@/src/components/dashboard/device/components/ConfigSelector";
import { useUppy } from "@/src/hooks/useUppy";
import { DeviceTypeSelector } from "@/src/components/dashboard/device/components/DeviceTypeSelector";

export const editDeviceSchema = z.object({
  name: z.string().min(1, "Введите название устройства"),
  type: z.string().min(1, "Выберите тип устройства"),
  description: z.string().default(""),
  yandexId: z.string().default(""),
  imageUrl: z.string().default(""),
  configs: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof editDeviceSchema>;

interface EditDeviceFormProps {
  device: DeviceWithConfigs;
  onSuccess?: () => void;
  form?: UseFormReturn<FormValues>;
}

const EditDeviceForm = ({ device, onSuccess, form }: EditDeviceFormProps) => {
  const utils = api.useUtils();

  const defaultForm = useForm<FormValues>({
    resolver: zodResolver(editDeviceSchema),
    defaultValues: {
      name: device.name || "",
      type: device.type || "",
      description: device.description || "",
      yandexId: device.yandexId || "",
      imageUrl: device.imageUrl || "",
      configs: device.configs.map((config) => config.id) || [],
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = form || defaultForm;

  const uppy = useUppy({
    onUploadSuccess: (url) => setValue("imageUrl", url),
  });

  const { mutateAsync: editDevice } = api.device.updateDevice.useMutation({
    onSuccess: async () => {
      await utils.device.getAllDevices.invalidate();
      await utils.device.getDevice.invalidate();
      await utils.rating.getAllRatings.invalidate();
      uppy.cancelAll();
      uppy.getFiles().forEach((file) => {
        uppy.removeFile(file.id);
      });
      onSuccess?.();
      toast.success("Устройство успешно обновлено");
    },
  });

  const submitHandler = async (data: FormValues) => {
    try {
      await editDevice({ ...data, id: device.id });
    } catch (error) {
      console.error("Error updating device:", error);
      toast.error("Ошибка при обновлении устройства");
    }
  };

  const onSubmit = handleSubmit(submitHandler);

  const configs = watch("configs");

  return (
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium">
          Название
          <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="Например: iPhone 15 Pro"
          aria-describedby={errors.name ? "name-error" : undefined}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="text-sm text-destructive" id="name-error" role="alert">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="type" className="text-sm font-medium">
          Тип устройства
          <span className="text-destructive">*</span>
        </Label>
        <DeviceTypeSelector
          value={watch("type")}
          onChange={(value) => setValue("type", value)}
          placeholder="Выберите тип устройства"
          error={!!errors.type}
        />
        {errors.type && (
          <p className="text-sm text-destructive" id="type-error" role="alert">
            {errors.type.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-medium">
          Описание
        </Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Описание устройства"
          className="h-24 min-h-[96px] resize-none"
          aria-describedby={
            errors.description ? "description-error" : undefined
          }
        />
        {errors.description && (
          <p
            className="text-sm text-destructive"
            id="description-error"
            role="alert"
          >
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="yandexId" className="text-sm font-medium">
          ID Яндекс.Маркет
        </Label>
        <Input
          id="yandexId"
          {...register("yandexId")}
          placeholder="ID устройства в Яндекс.Маркет"
          aria-describedby={errors.yandexId ? "yandexId-error" : undefined}
        />
        {errors.yandexId && (
          <p
            className="text-sm text-destructive"
            id="yandexId-error"
            role="alert"
          >
            {errors.yandexId.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="configs" className="text-sm font-medium">
          Конфигурации
        </Label>
        <ConfigSelector
          deviceConfigs={configs}
          deviceId={device.id}
          setValue={(value) => setValue("configs", value)}
        />
        {errors.configs && (
          <p
            className="text-sm text-destructive"
            id="configs-error"
            role="alert"
          >
            {errors.configs.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="imageUrl" className="text-sm font-medium">
          Изображение
        </Label>
        <Input
          id="imageUrl"
          {...register("imageUrl")}
          placeholder="https://example.com/image.jpg"
          disabled
          aria-describedby={errors.imageUrl ? "imageUrl-error" : undefined}
        />
        {errors.imageUrl && (
          <p
            className="text-sm text-destructive"
            id="imageUrl-error"
            role="alert"
          >
            {errors.imageUrl.message}
          </p>
        )}
      </div>

      <Dashboard
        width={"100%"}
        height={300}
        singleFileFullScreen
        uppy={uppy}
        autoOpen="imageEditor"
        proudlyDisplayPoweredByUppy={false}
      />

      <div className="mt-6 flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => onSuccess?.()}
          className="min-w-[120px]"
        >
          Отмена
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="min-w-[120px] gap-2 bg-green-600 text-white transition-all hover:bg-green-700 active:scale-95"
        >
          {isSubmitting ? (
            <>
              <Loader2Icon className="h-4 w-4 animate-spin" />
              <span>Сохранение...</span>
            </>
          ) : (
            <>
              <SaveIcon className="h-4 w-4" />
              <span>Сохранить</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default EditDeviceForm;
