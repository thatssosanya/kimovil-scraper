import React, { useState } from "react";
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
import { Loader2Icon, PlusCircleIcon, AlertTriangleIcon } from "lucide-react";
import ConfigSelector from "@/src/components/dashboard/device/components/ConfigSelector";
import { useUppy } from "@/src/hooks/useUppy";
import { DeviceTypeSelector } from "@/src/components/dashboard/device/components/DeviceTypeSelector";
import { useDebounce } from "@/src/hooks/useDebounce";

export const addDeviceSchema = z.object({
  name: z.string().min(1, "Введите название устройства"),
  type: z.string().min(1, "Выберите тип устройства"),
  description: z.string().default(""),
  yandexId: z.string().default(""),
  imageUrl: z.string().default(""),
  configs: z.array(z.string()).default([]),
});

type FormValues = z.infer<typeof addDeviceSchema>;

interface AddDeviceFormProps {
  onSuccess?: () => void;
  form?: UseFormReturn<FormValues>;
}

const AddDeviceForm = ({ onSuccess, form }: AddDeviceFormProps) => {
  const utils = api.useUtils();
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false);

  const defaultForm = useForm<FormValues>({
    resolver: zodResolver(addDeviceSchema),
    defaultValues: {
      name: "",
      type: "",
      description: "",
      yandexId: "",
      imageUrl: "",
      configs: [],
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = form || defaultForm;

  const name = watch("name");
  const type = watch("type");
  const debouncedName = useDebounce(name, 300);

  const { data: similarDevices } = api.device.findSimilarByName.useQuery(
    { name: debouncedName, type: type || undefined },
    { enabled: debouncedName.trim().length >= 3 }
  );

  const uppy = useUppy({
    onUploadSuccess: (url) => setValue("imageUrl", url),
  });

  const { mutateAsync: createDevice } = api.device.createDevice.useMutation({
    onSuccess: async () => {
      await utils.device.getAllDevices.invalidate();
      reset();
      setSkipDuplicateCheck(false);
      uppy.cancelAll();
      uppy.getFiles().forEach((file) => {
        uppy.removeFile(file.id);
      });
      onSuccess?.();
      toast.success("Устройство успешно добавлено");
    },
  });

  const submitHandler = async (data: FormValues) => {
    try {
      await createDevice({ ...data, skipDuplicateCheck });
    } catch (error: unknown) {
      const trpcError = error as { data?: { cause?: { code?: string; candidates?: Array<{ id: string; name: string; type: string }> } } };
      const cause = trpcError?.data?.cause;
      if (cause?.code === "DEVICE_DUPLICATE" && cause?.candidates) {
        toast.error("Похоже, такое устройство уже существует", {
          description: cause.candidates.map((c) => `${c.name} (${c.type})`).join(", "),
        });
        return;
      }
      console.error("Error creating device:", error);
      toast.error("Ошибка при создании устройства");
    }
  };

  const onSubmit = handleSubmit(submitHandler);

  const configs = watch("configs");

  const hasSimilarDevices = (similarDevices?.matches?.length ?? 0) > 0;

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
          <p className="text-destructive text-sm" id="name-error" role="alert">
            {errors.name.message}
          </p>
        )}

        {hasSimilarDevices && (
          <div className="mt-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-yellow-800">
              <AlertTriangleIcon className="h-4 w-4" />
              <span>Возможные дубликаты:</span>
              {similarDevices?.matchType === "exact" && (
                <span className="rounded bg-yellow-200 px-1.5 py-0.5 text-xs">
                  Точное совпадение
                </span>
              )}
            </div>
            <ul className="mt-2 space-y-1">
              {similarDevices?.matches?.map((d) => (
                <li key={d.id} className="flex items-center justify-between">
                  <span className="text-yellow-900">
                    {d.name} ({d.type})
                  </span>
                  <a
                    href={`/dashboard/devices/${d.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Открыть
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-yellow-700">
              Если это то же устройство, лучше использовать уже созданную
              карточку.
            </p>
            <label className="mt-2 flex items-center gap-2 text-xs text-yellow-800">
              <input
                type="checkbox"
                checked={skipDuplicateCheck}
                onChange={(e) => setSkipDuplicateCheck(e.target.checked)}
                className="rounded border-yellow-400"
              />
              Создать несмотря на возможный дубликат
            </label>
          </div>
        )}
      </div>
      <a
        href={`https://www.google.com/search?tbm=isch&q=filetype:webp\ ${form?.getValues(
          "name"
        )}&tbs=ic:trans`}
        target="_blank"
        className="-mb-2 -mt-4 inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-search"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        Искать картинку для {form?.getValues("name")}
      </a>

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
          <p className="text-destructive text-sm" id="type-error" role="alert">
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
            className="text-destructive text-sm"
            id="description-error"
            role="alert"
          >
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="configs" className="text-sm font-medium">
          Конфигурации
        </Label>
        <ConfigSelector
          deviceConfigs={configs}
          setValue={(value) => setValue("configs", value)}
        />
        {errors.configs && (
          <p
            className="text-destructive text-sm"
            id="configs-error"
            role="alert"
          >
            {errors.configs.message}
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
            className="text-destructive text-sm"
            id="yandexId-error"
            role="alert"
          >
            {errors.yandexId.message}
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
            className="text-destructive text-sm"
            id="imageUrl-error"
            role="alert"
          >
            {errors.imageUrl.message}
          </p>
        )}
      </div>

      <Dashboard
        width={"100%"}
        height={500}
        singleFileFullScreen
        uppy={uppy}
        autoOpen="imageEditor"
        proudlyDisplayPoweredByUppy={false}
      />

      <div className="mt-6 flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSuccess?.()}
          className="min-w-[100px] border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-700"
        >
          Отмена
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || (hasSimilarDevices && !skipDuplicateCheck)}
          className="min-w-[100px] gap-1.5 border border-emerald-200 bg-emerald-50 text-emerald-600 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-700 active:scale-95"
        >
          {isSubmitting ? (
            <>
              <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
              <span>Добавление...</span>
            </>
          ) : (
            <>
              <PlusCircleIcon className="h-3.5 w-3.5" />
              <span>Добавить</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default AddDeviceForm;
