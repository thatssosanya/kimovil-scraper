import { useState, useCallback, memo, useEffect, useRef } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/src/utils/api";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import dynamic from "next/dynamic";
import { Loader2Icon, PlusCircleIcon, AlertTriangle, ExternalLink, ImagePlus, X, Search } from "lucide-react";
import { useUppy } from "@/src/hooks/useUppy";
import { DeviceTypeSelector } from "@/src/components/dashboard/device/components/DeviceTypeSelector";
import { useDebounce } from "@/src/hooks/useDebounce";
import { cn } from "@/src/lib/utils";

// Dynamic import for heavy Uppy Dashboard component
const UppyDashboard = dynamic(
  () => import("@uppy/react").then((m) => m.Dashboard),
  { ssr: false, loading: () => <div className="h-[300px] flex items-center justify-center text-sm text-zinc-400">Загрузка...</div> }
);

export const addDeviceSchema = z.object({
  name: z.string().min(1, "Введите название устройства"),
  type: z.string().min(1, "Выберите тип устройства"),
  description: z.string().default(""),
  imageUrl: z.string().default(""),
});

type FormValues = z.infer<typeof addDeviceSchema>;

interface AddDeviceFormProps {
  onSuccess?: () => void;
  form?: UseFormReturn<FormValues>;
  hideDuplicateWarning?: boolean;
  hideFooter?: boolean;
}

// Hoisted static class strings
const inputClasses = cn(
  "h-10 px-3 text-sm rounded-lg w-full",
  "bg-white dark:bg-slate-800/50",
  "border border-zinc-200 dark:border-slate-700/50",
  "focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50",
  "placeholder:text-zinc-400 dark:placeholder:text-slate-500",
  "text-zinc-900 dark:text-slate-100"
);

const inputErrorClasses = cn(inputClasses, "border-rose-400/50 focus:ring-rose-500/20 focus:border-rose-400");
const labelClasses = "text-xs font-medium text-zinc-500 dark:text-slate-400";

// Memoized DuplicateWarning component
interface DuplicateWarningProps {
  matches: Array<{ id: string; name: string; type: string }>;
  matchType?: string;
  skipDuplicateCheck: boolean;
  onSkipChange: (checked: boolean) => void;
}

const DuplicateWarning = memo(function DuplicateWarning({
  matches,
  matchType,
  skipDuplicateCheck,
  onSkipChange,
}: DuplicateWarningProps) {
  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onSkipChange(e.target.checked),
    [onSkipChange]
  );

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-950/30 p-3">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
          {matchType === "exact" ? "Точное совпадение" : "Возможные дубликаты"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {matches.map((d) => (
          <a
            key={d.id}
            href={`/dashboard/devices/${d.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-white/60 dark:bg-slate-800/50 border border-amber-200 dark:border-amber-700/50 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30"
          >
            {d.name}
            <span className="text-amber-500/70">({d.type})</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        ))}
      </div>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={skipDuplicateCheck}
          onChange={handleCheckboxChange}
          className="h-3.5 w-3.5 rounded border-amber-300 dark:border-amber-600 text-amber-500 focus:ring-amber-500/30"
        />
        <span className="text-xs text-amber-700 dark:text-amber-300">
          Создать несмотря на дубликат
        </span>
      </label>
    </div>
  );
});

// Image Upload Modal component
const ImageUploadModal = memo(function ImageUploadModal({
  isOpen,
  onClose,
  uppy,
}: {
  isOpen: boolean;
  onClose: () => void;
  uppy: ReturnType<typeof useUppy>;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="px-4 py-3 border-b border-zinc-200 dark:border-slate-800">
          <DialogTitle className="text-base">Загрузить изображение</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <UppyDashboard
            width="100%"
            height={550}
            singleFileFullScreen
            uppy={uppy}
            autoOpen="imageEditor"
            proudlyDisplayPoweredByUppy={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
});

// Auto-growing textarea hook
function useAutoGrow(value: string, maxRows: number = 7) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reset height to auto to get the correct scrollHeight
    el.style.height = "auto";

    // Calculate line height and max height
    const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 20;
    const maxHeight = lineHeight * maxRows;

    // Set new height
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${newHeight}px`;
  }, [value, maxRows]);

  return ref;
}

const AddDeviceForm = ({ onSuccess, form, hideDuplicateWarning = false, hideFooter = false }: AddDeviceFormProps) => {
  const utils = api.useUtils();
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  const defaultForm = useForm<FormValues>({
    resolver: zodResolver(addDeviceSchema),
    defaultValues: {
      name: "",
      type: "",
      description: "",
      imageUrl: "",
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
  const imageUrl = watch("imageUrl");
  const description = watch("description");
  const debouncedName = useDebounce(name, 300);

  const descriptionRef = useAutoGrow(description, 7);

  const { data: similarDevices } = api.device.findSimilarByName.useQuery(
    { name: debouncedName, type: type || undefined },
    { enabled: !hideDuplicateWarning && debouncedName.trim().length >= 3 }
  );

  // Stable callback for image upload
  const handleImageUpload = useCallback(
    (url: string) => {
      setValue("imageUrl", url);
      setImageModalOpen(false);
    },
    [setValue]
  );

  const uppy = useUppy({
    onUploadSuccess: handleImageUpload,
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

  // Stable submit handler
  const submitHandler = useCallback(
    async (data: FormValues) => {
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
    },
    [createDevice, skipDuplicateCheck]
  );

  const onSubmit = handleSubmit(submitHandler);

  // Stable callbacks
  const handleTypeChange = useCallback(
    (value: string) => setValue("type", value),
    [setValue]
  );

  const handleCancel = useCallback(() => onSuccess?.(), [onSuccess]);

  const handleRemoveImage = useCallback(() => {
    setValue("imageUrl", "");
    uppy.cancelAll();
    uppy.getFiles().forEach((file) => {
      uppy.removeFile(file.id);
    });
  }, [setValue, uppy]);

  const hasSimilarDevices = (similarDevices?.matches?.length ?? 0) > 0;

  return (
    <div className="flex flex-col h-full">
      {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
      <form onSubmit={onSubmit} id="add-device-form" className="flex flex-col gap-4">
        {/* Name */}
        <div className="space-y-1.5">
          <label htmlFor="name" className={labelClasses}>
            Название <span className="text-rose-400">*</span>
          </label>
          <input
            id="name"
            {...register("name")}
            placeholder="iPhone 15 Pro Max"
            className={errors.name ? inputErrorClasses : inputClasses}
          />
          {errors.name && (
            <p className="text-xs text-rose-500">{errors.name.message}</p>
          )}
        </div>

        {/* Type */}
        <div className="space-y-1.5">
          <label className={labelClasses}>
            Тип устройства <span className="text-rose-400">*</span>
          </label>
          <DeviceTypeSelector
            value={type}
            onChange={handleTypeChange}
            error={!!errors.type}
          />
          {errors.type && (
            <p className="text-xs text-rose-500">{errors.type.message}</p>
          )}
        </div>

        {/* Image Upload */}
        <div className="space-y-1.5">
          <label className={labelClasses}>Изображение</label>
          {imageUrl ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-slate-700/50 bg-zinc-50/50 dark:bg-slate-800/30">
              <img
                src={imageUrl}
                alt="Preview"
                className="h-12 w-12 object-contain rounded"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-600 dark:text-slate-300 truncate">
                  Изображение загружено
                </p>
                <button
                  type="button"
                  onClick={() => setImageModalOpen(true)}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Заменить
                </button>
              </div>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-slate-700"
              >
                <X className="h-4 w-4 text-zinc-400" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setImageModalOpen(true)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
                  "border border-dashed border-zinc-300 dark:border-slate-600",
                  "text-zinc-500 dark:text-slate-400",
                  "hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
                )}
              >
                <ImagePlus className="h-4 w-4" />
                Загрузить
              </button>
              {name && (
                <a
                  href={`https://www.google.com/search?tbm=isch&q=filetype:webp\ ${name}&tbs=ic:trans`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-zinc-400 dark:text-slate-500 hover:text-zinc-600 dark:hover:text-slate-300"
                >
                  <Search className="h-3 w-3" />
                  Google
                </a>
              )}
            </div>
          )}
        </div>

        {/* Duplicate Warning - inline in form */}
        {!hideDuplicateWarning && hasSimilarDevices && similarDevices?.matches && (
          <DuplicateWarning
            matches={similarDevices.matches}
            matchType={similarDevices.matchType}
            skipDuplicateCheck={skipDuplicateCheck}
            onSkipChange={setSkipDuplicateCheck}
          />
        )}

        {/* Description */}
        <div className="space-y-1.5">
          <label htmlFor="description" className={labelClasses}>
            Описание
          </label>
          <textarea
            id="description"
            {...register("description")}
            ref={(e) => {
              register("description").ref(e);
              // @ts-expect-error - combining refs
              descriptionRef.current = e;
            }}
            placeholder="Краткое описание устройства..."
            rows={2}
            className={cn(
              inputClasses,
              "h-auto py-2.5 resize-none overflow-hidden min-h-[80px]"
            )}
          />
        </div>
      </form>

      {/* Image Upload Modal */}
      <ImageUploadModal
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        uppy={uppy}
      />

      {/* Footer - only shown when not hidden */}
      {!hideFooter && (
        <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-slate-800/50 flex items-center justify-between">
          <span className="text-xs text-zinc-400 dark:text-slate-500">
            <span className="text-rose-400">*</span> Обязательные поля
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              className="h-9 px-4"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              form="add-device-form"
              disabled={isSubmitting || (!hideDuplicateWarning && hasSimilarDevices && !skipDuplicateCheck)}
              className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                  Добавление...
                </>
              ) : (
                <>
                  <PlusCircleIcon className="h-4 w-4 mr-2" />
                  Создать
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddDeviceForm;
