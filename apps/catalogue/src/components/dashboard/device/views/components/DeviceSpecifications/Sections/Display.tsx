import { ArrayInput } from "@/src/components/ui/ArrayInput";
import { PlusIcon } from "lucide-react";
import {
  type UseFormRegister,
  type UseFormWatch,
  type UseFormSetValue,
  useFieldArray,
  type Control,
} from "react-hook-form";
import {
  type DeviceSpecsFormValues,
  type DirtyFields,
} from "../../../types/index";
import { SpecSection } from "../components/SpecSection";
import { SpecRow, SpecRowToggle } from "../components/SpecRow";
import { ArrayItemCard } from "../components/ArrayItemCard";
import { Toggle } from "../components/Toggle";
import React from "react";

type DisplayProps = {
  register: UseFormRegister<DeviceSpecsFormValues>;
  watch: UseFormWatch<DeviceSpecsFormValues>;
  setValue: UseFormSetValue<DeviceSpecsFormValues>;
  control: Control<DeviceSpecsFormValues>;
  dirtyFields: DirtyFields;
  initialValues?: DeviceSpecsFormValues;
};

const getDefaultScreen = (isFirst = false) => ({
  id: "",
  position: "",
  size_in: null,
  displayType: "",
  resolution: "",
  aspectRatio: "",
  ppi: null,
  displayFeatures: "",
  refreshRate: null,
  brightnessNits: null,
  isMain: isFirst,
});

export const Display = ({
  register,
  watch,
  setValue,
  control,
  dirtyFields,
  initialValues,
}: DisplayProps) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "screens",
  });

  const [isInitialized, setIsInitialized] = React.useState(false);

  React.useEffect(() => {
    if (!isInitialized) {
      if (initialValues?.screens?.length) {
        initialValues.screens.forEach((screen) => append(screen));
      } else if (fields.length === 0) {
        append(getDefaultScreen(true));
      }
      setIsInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, initialValues?.screens, append]);

  const handleAddScreen = () => {
    append(getDefaultScreen(fields.length === 0));
  };

  const screensDirty = dirtyFields.screens as
    | Record<number, Record<string, boolean>>
    | undefined;

  return (
    <SpecSection
      title="Экраны"
      action={
        <button
          type="button"
          onClick={handleAddScreen}
          className="flex items-center justify-center h-5 w-5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      }
    >
      {fields.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 px-3 py-2">
          Нет данных об экране
        </p>
      )}

      {fields.map((field, index) => {
        const screenPrefix = `screens.${index}` as const;
        const displayFeatures = watch(`${screenPrefix}.displayFeatures`) as string | undefined;
        const isScreenDirty = screensDirty?.[index];
        const position = watch(`${screenPrefix}.position`) as string | undefined;
        const isMain = watch(`${screenPrefix}.isMain`) as boolean;

        const title = position || `Экран ${index + 1}`;

        return (
          <ArrayItemCard
            key={field.id}
            title={title}

            onRemove={fields.length > 1 ? () => remove(index) : undefined}
          >
            <SpecRow label="Позиция" isDirty={isScreenDirty?.position}>
              <input
                {...register(`${screenPrefix}.position`)}
                placeholder="основной, внешний..."
                className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0"
              />
            </SpecRow>
            <SpecRowToggle label="Основной экран" isDirty={isScreenDirty?.isMain}>
              <Toggle
                checked={isMain ?? false}
                onCheckedChange={(checked) => {
                  if (checked) {
                    fields.forEach((_, otherIndex) => {
                      if (otherIndex !== index) {
                        setValue(`screens.${otherIndex}.isMain`, false);
                      }
                    });
                  }
                  setValue(`${screenPrefix}.isMain`, checked, { shouldDirty: true });
                }}
              />
            </SpecRowToggle>
            <SpecRow label="Диагональ (″)" isDirty={isScreenDirty?.size_in}>
              <input
                type="number"
                step="0.1"
                {...register(`${screenPrefix}.size_in`, { valueAsNumber: true })}
                placeholder="—"
                className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </SpecRow>
            <SpecRow label="Тип дисплея" isDirty={isScreenDirty?.displayType}>
              <input
                {...register(`${screenPrefix}.displayType`)}
                placeholder="AMOLED, IPS..."
                className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0"
              />
            </SpecRow>
            <SpecRow label="Разрешение" isDirty={isScreenDirty?.resolution}>
              <input
                {...register(`${screenPrefix}.resolution`)}
                placeholder="1080x2400..."
                className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0"
              />
            </SpecRow>
            <SpecRow label="Соотношение" isDirty={isScreenDirty?.aspectRatio}>
              <input
                {...register(`${screenPrefix}.aspectRatio`)}
                placeholder="16:9, 20:9..."
                className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0"
              />
            </SpecRow>
            <SpecRow label="PPI" isDirty={isScreenDirty?.ppi}>
              <input
                type="number"
                {...register(`${screenPrefix}.ppi`, { valueAsNumber: true })}
                placeholder="—"
                className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </SpecRow>
            <SpecRow label="Частота (Гц)" isDirty={isScreenDirty?.refreshRate}>
              <input
                type="number"
                {...register(`${screenPrefix}.refreshRate`, { valueAsNumber: true })}
                placeholder="60, 90, 120..."
                className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </SpecRow>
            <SpecRow label="Яркость (нит)" isDirty={isScreenDirty?.brightnessNits}>
              <input
                type="number"
                {...register(`${screenPrefix}.brightnessNits`, { valueAsNumber: true })}
                placeholder="—"
                className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </SpecRow>
            <SpecRow label="Особенности" isDirty={isScreenDirty?.displayFeatures}>
              <ArrayInput
                value={displayFeatures ?? ""}
                onChange={(value: string) =>
                  setValue(`${screenPrefix}.displayFeatures`, value, { shouldDirty: true })
                }
                isEditing={true}
                placeholder="HDR10+, Always On..."
                isDirty={!!isScreenDirty?.displayFeatures}
                initialValue={initialValues?.screens?.[index]?.displayFeatures ?? undefined}
                borderless
              />
            </SpecRow>
          </ArrayItemCard>
        );
      })}
    </SpecSection>
  );
};
