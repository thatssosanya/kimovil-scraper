import { Button } from "@/src/components/ui/Button";
import { RatingStatusToggle } from "@/src/components/dashboard/rating/components/RatingStatusToggle";
import { type PublishStatus } from "@/src/constants/publishStatus";
import { SaveIcon, Trash2Icon, AlertTriangleIcon } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  BasicInfo,
  Cameras,
  Dimensions,
  Display,
  HardwareFeatures,
  Processor,
  SKU,
  SoftwareAndBenchmarks,
} from "./Sections";
import {
  type DeviceSpecsFormValues,
  type ExtendedDeviceCharacteristics,
} from "../../types/index";
import { convertInitialData } from "./utils/utils";
import { ChangePreviewDialog } from "./components/ChangePreviewDialog";
import { getRelatedChanges } from "./utils/utils";
import { SpecSection } from "./components/SpecSection";
import { SpecRow, SpecRowToggle } from "./components/SpecRow";
import { Toggle } from "./components/Toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";

type DeviceSpecificationsProps = {
  initialData?: ExtendedDeviceCharacteristics | null;
  isLoading?: boolean;
  onSubmit: (data: DeviceSpecsFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  isDeleting?: boolean;
  onStatusChange?: (status: PublishStatus) => Promise<void>;
  isUpdatingStatus?: boolean;
};

export const DeviceSpecifications = ({
  initialData,
  isLoading,
  onSubmit,
  onDelete,
  isDeleting = false,
  onStatusChange,
  isUpdatingStatus = false,
}: DeviceSpecificationsProps) => {
  const [isChangePreviewOpen, setIsChangePreviewOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const initialFormValues = useMemo<DeviceSpecsFormValues | undefined>(
    () => convertInitialData(initialData),
    [initialData]
  );

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    control,
    formState: { dirtyFields, isDirty },
    reset,
  } = useForm<DeviceSpecsFormValues>({
    defaultValues: initialFormValues || {},
  });

  useEffect(() => {
    if (!isDirty) {
      reset(initialFormValues);
    }
  }, [initialFormValues, isDirty, reset]);

  const handleFormSubmit = async (data: DeviceSpecsFormValues) => {
    await onSubmit(data);
    reset(data);
  };

  const handleDelete = async () => {
    if (onDelete) {
      await onDelete();
      setIsDeleteDialogOpen(false);
    }
  };

  const currentValues = watch();
  const arrayChanges = getRelatedChanges(currentValues, initialFormValues);

  const dirtyFieldsCount = useMemo(() => {
    const simpleFieldsCount = Object.entries(dirtyFields).filter(
      ([key, value]) =>
        !["cameras", "skus", "benchmarks", "screens"].includes(key) &&
        value === true
    ).length;

    const relatedFields = Object.values(arrayChanges).reduce(
      (acc, { added, removed, modified }) => {
        const filteredModified = modified.reduce((count, item) => {
          if (item.fields) {
            const userVisibleFields = item.fields.filter(
              (field) => !["createdAt", "updatedAt"].includes(field)
            );
            return count + (userVisibleFields.length > 0 ? 1 : 0);
          }
          return count + 1;
        }, 0);

        return acc + added.length + removed.length + filteredModified;
      },
      0
    );

    return simpleFieldsCount + relatedFields;
  }, [dirtyFields, arrayChanges]);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          Загрузка спецификаций...
        </div>
      </div>
    );
  }

  return (
    <div className="pb-3">
      {/* Sticky Header Bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white dark:bg-[hsl(0_0%_9%)] py-3 px-4 border-b border-zinc-200 dark:border-zinc-800 rounded-t-lg">
        <div className="flex items-center gap-4">
          {initialData && onStatusChange && (
            <RatingStatusToggle
              currentStatus={initialData.status as PublishStatus}
              onStatusChange={(status) => void onStatusChange(status)}
              isLoading={isUpdatingStatus}
            />
          )}
          {dirtyFieldsCount > 0 && (
            <button
              onClick={() => setIsChangePreviewOpen(true)}
              className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors underline underline-offset-2"
            >
              {dirtyFieldsCount} {dirtyFieldsCount === 1 ? "изменение" : dirtyFieldsCount < 5 ? "изменения" : "изменений"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
              className="text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              {isDeleting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
              ) : (
                <Trash2Icon className="h-4 w-4" />
              )}
            </Button>
          )}
          {dirtyFieldsCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleSubmit(handleFormSubmit)()}
              className="border-zinc-300 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:border-zinc-200"
            >
              <SaveIcon className="mr-1.5 h-4 w-4" />
              Сохранить
            </Button>
          )}
        </div>
      </div>

      <ChangePreviewDialog
        isOpen={isChangePreviewOpen}
        onClose={() => setIsChangePreviewOpen(false)}
        dirtyFields={dirtyFields}
        relatedChanges={arrayChanges}
        currentValues={currentValues}
        initialValues={initialFormValues}
        onReset={(field) =>
          setValue(field, initialFormValues?.[field], {
            shouldDirty: false,
          })
        }
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md rounded-lg shadow-lg">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-red-100 p-3">
              <AlertTriangleIcon className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <DialogHeader className="mb-4 text-center">
            <DialogTitle className="text-xl font-semibold text-zinc-900">
              Удалить характеристики устройства?
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-zinc-600">
              Это действие нельзя отменить. Все характеристики устройства будут
              удалены. Вы сможете импортировать их заново позже.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
              className="border-zinc-300 hover:bg-zinc-100"
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : null}
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form Content */}
      <form onSubmit={(e) => void handleSubmit(handleFormSubmit)(e)} className="px-4 pt-4">
        <BasicInfo
          register={register}
          watch={watch}
          setValue={setValue}
          dirtyFields={dirtyFields}
          initialValues={initialFormValues}
        />

        <SKU
          register={register}
          watch={watch}
          setValue={setValue}
          control={control}
          dirtyFields={dirtyFields}
          initialValues={initialFormValues}
        />

        <Dimensions
          register={register}
          watch={watch}
          setValue={setValue}
          dirtyFields={dirtyFields}
          initialValues={initialFormValues}
        />

        <Display
          register={register}
          watch={watch}
          setValue={setValue}
          control={control}
          dirtyFields={dirtyFields}
          initialValues={initialFormValues}
        />

        <Processor
          register={register}
          watch={watch}
          setValue={setValue}
          dirtyFields={dirtyFields}
          initialValues={initialFormValues}
        />

        <HardwareFeatures
          register={register}
          watch={watch}
          setValue={setValue}
          dirtyFields={dirtyFields}
          initialValues={initialFormValues}
        />

        {/* Battery Section */}
        <SpecSection title="Батарея">
          <SpecRow label="Ёмкость (mAh)" isDirty={!!dirtyFields.batteryCapacity_mah}>
            <input
              type="number"
              {...register("batteryCapacity_mah", { valueAsNumber: true })}
              placeholder="—"
              className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </SpecRow>
          <SpecRowToggle label="Быстрая зарядка" isDirty={!!dirtyFields.batteryFastCharging}>
            <Toggle
              checked={watch("batteryFastCharging") ?? false}
              onCheckedChange={(checked) => setValue("batteryFastCharging", checked, { shouldDirty: true })}
            />
          </SpecRowToggle>
          <SpecRow label="Мощность (W)" isDirty={!!dirtyFields.batteryWattage}>
            <input
              type="number"
              step="0.1"
              {...register("batteryWattage", { valueAsNumber: true })}
              placeholder="—"
              className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </SpecRow>
        </SpecSection>

        <Cameras
          register={register}
          watch={watch}
          setValue={setValue}
          control={control}
          dirtyFields={dirtyFields}
          initialValues={initialFormValues}
        />

        <SoftwareAndBenchmarks
          register={register}
          watch={watch}
          setValue={setValue}
          control={control}
          dirtyFields={dirtyFields}
          initialValues={initialFormValues}
        />
      </form>
    </div>
  );
};
