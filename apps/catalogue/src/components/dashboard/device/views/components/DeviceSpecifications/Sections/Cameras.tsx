import { ArrayInput } from "@/src/components/ui/ArrayInput";
import { PlusIcon } from "lucide-react";
import React from "react";
import {
  useFieldArray,
  type UseFormRegister,
  type UseFormWatch,
  type UseFormSetValue,
  type Control,
} from "react-hook-form";
import {
  type DirtyFields,
  type DeviceSpecsFormValues,
} from "../../../types/index";
import { SpecSection } from "../components/SpecSection";
import { SpecRow } from "../components/SpecRow";
import { ArrayItemCard } from "../components/ArrayItemCard";

type CamerasProps = {
  register: UseFormRegister<DeviceSpecsFormValues>;
  watch: UseFormWatch<DeviceSpecsFormValues>;
  setValue: UseFormSetValue<DeviceSpecsFormValues>;
  control: Control<DeviceSpecsFormValues>;
  dirtyFields: DirtyFields;
  initialValues?: DeviceSpecsFormValues;
};

export const Cameras = ({
  register,
  watch,
  setValue,
  control,
  dirtyFields,
  initialValues,
}: CamerasProps) => {
  const {
    fields: cameraFields,
    append: appendCamera,
    remove: removeCamera,
  } = useFieldArray({
    control,
    name: "cameras",
  });

  const cameraDirtyFields = dirtyFields.cameras as
    | Record<number, Record<string, boolean>>
    | undefined;

  const cameraFeatures = watch("cameraFeatures") || "";
  const cameras = watch("cameras") || [];

  const handleAppendCamera = React.useCallback(() => {
    const newCamera = {
      id: Math.random().toString(),
      type: "",
      resolution_mp: null,
      aperture_fstop: null,
      sensor: null,
      features: "",
    };
    appendCamera(newCamera);
  }, [appendCamera]);

  return (
    <SpecSection
      title="Камеры"
      action={
        <button
          type="button"
          onClick={handleAppendCamera}
          className="flex items-center justify-center h-5 w-5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      }
    >
      <SpecRow label="Общие характеристики" isDirty={!!dirtyFields.cameraFeatures}>
        <ArrayInput
          value={cameraFeatures}
          onChange={(value) => setValue("cameraFeatures", value, { shouldDirty: true })}
          isEditing={true}
          placeholder="Добавить..."
          isDirty={!!dirtyFields.cameraFeatures}
          initialValue={initialValues?.cameraFeatures}
          borderless
        />
      </SpecRow>

      {cameraFields.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 px-3 py-2">
          Нет данных о камерах
        </p>
      )}

      {cameraFields.map((field, index) => {
        const cameraType = watch(`cameras.${index}.type`) || "";
        const resolution = watch(`cameras.${index}.resolution_mp`);
        const isDirty = cameraDirtyFields?.[index];

        const title = cameraType && resolution
          ? `${cameraType} ${resolution}MP`
          : `Камера ${index + 1}`;

        return (
          <ArrayItemCard
            key={field.id}
            title={title}

            onRemove={() => removeCamera(index)}
          >
            <input type="hidden" {...register(`cameras.${index}.id`)} />
            <SpecRow label="Тип" isDirty={isDirty?.type}>
              <input
                {...register(`cameras.${index}.type`)}
                placeholder="Основная, Широкоугольная..."
                className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0"
              />
            </SpecRow>
            <SpecRow label="Разрешение (MP)" isDirty={isDirty?.resolution_mp}>
              <input
                type="number"
                {...register(`cameras.${index}.resolution_mp`, { valueAsNumber: true })}
                placeholder="—"
                className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </SpecRow>
            <SpecRow label="Диафрагма" isDirty={isDirty?.aperture_fstop}>
              <input
                {...register(`cameras.${index}.aperture_fstop`)}
                placeholder="f/1.8..."
                className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0"
              />
            </SpecRow>
            <SpecRow label="Сенсор" isDirty={isDirty?.sensor}>
              <input
                {...register(`cameras.${index}.sensor`)}
                placeholder="—"
                className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0"
              />
            </SpecRow>
            <SpecRow label="Особенности" isDirty={isDirty?.features}>
              <ArrayInput
                value={cameras[index]?.features ?? ""}
                onChange={(value) =>
                  setValue(`cameras.${index}.features`, value, { shouldDirty: true })
                }
                isEditing={true}
                placeholder="OIS, автофокус..."
                isDirty={!!isDirty?.features}
                initialValue={initialValues?.cameras?.[index]?.features ?? ""}
                borderless
              />
            </SpecRow>
          </ArrayItemCard>
        );
      })}
    </SpecSection>
  );
};
