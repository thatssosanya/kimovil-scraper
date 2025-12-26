import React from "react";
import { ArrayInput } from "@/src/components/ui/ArrayInput";
import { PlusIcon } from "lucide-react";
import {
  useFieldArray,
  type UseFormRegister,
  type UseFormWatch,
  type UseFormSetValue,
  type Control,
} from "react-hook-form";
import {
  type DeviceSpecsFormValues,
  type DirtyFields,
} from "../../../types/index";
import { SpecSection } from "../components/SpecSection";
import { SpecRow } from "../components/SpecRow";
import { ArrayItemCard } from "../components/ArrayItemCard";

type SKUProps = {
  register: UseFormRegister<DeviceSpecsFormValues>;
  watch: UseFormWatch<DeviceSpecsFormValues>;
  setValue: UseFormSetValue<DeviceSpecsFormValues>;
  control: Control<DeviceSpecsFormValues>;
  dirtyFields: DirtyFields;
  initialValues?: DeviceSpecsFormValues;
};

export const SKU = ({
  register,
  watch,
  setValue,
  control,
  dirtyFields,
  initialValues,
}: SKUProps) => {
  const {
    fields: skuFields,
    append: appendSku,
    remove: removeSku,
  } = useFieldArray({
    control,
    name: "skus",
  });

  const skuDirtyFields = dirtyFields.skus as
    | Record<number, Record<string, boolean>>
    | undefined;

  const handleAppendSku = React.useCallback(() => {
    const newSku = {
      id: Math.random().toString(),
      marketId: "",
      ram_gb: 0,
      storage_gb: 0,
    };
    appendSku(newSku);
  }, [appendSku]);

  return (
    <SpecSection
      title="Конфигурации"
      action={
        <button
          type="button"
          onClick={handleAppendSku}
          className="flex items-center justify-center h-5 w-5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      }
    >
      {skuFields.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 px-3 py-2">
          Нет данных о конфигурациях
        </p>
      )}

      {skuFields.map((field, index) => {
        const marketId = watch(`skus.${index}.marketId`) || "";
        const ramGb = watch(`skus.${index}.ram_gb`);
        const storageGb = watch(`skus.${index}.storage_gb`);
        const isDirty = skuDirtyFields?.[index];

        const title = ramGb && storageGb
          ? `${ramGb}GB / ${storageGb}GB`
          : `Конфигурация ${index + 1}`;

        return (
          <ArrayItemCard
            key={field.id}
            title={title}

            onRemove={() => removeSku(index)}
          >
            <input type="hidden" {...register(`skus.${index}.id`)} />
            <SpecRow label="Регион" isDirty={isDirty?.marketId}>
              <ArrayInput
                value={marketId}
                onChange={(value) =>
                  setValue(`skus.${index}.marketId`, value, { shouldDirty: true })
                }
                isEditing={true}
                placeholder="RU, US, EU..."
                isDirty={!!isDirty?.marketId}
                initialValue={initialValues?.skus?.[index]?.marketId}
                borderless
              />
            </SpecRow>
            <SpecRow label="RAM (GB)" isDirty={isDirty?.ram_gb}>
              <input
                type="number"
                {...register(`skus.${index}.ram_gb`, { valueAsNumber: true })}
                placeholder="—"
                className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </SpecRow>
            <SpecRow label="ROM (GB)" isDirty={isDirty?.storage_gb}>
              <input
                type="number"
                {...register(`skus.${index}.storage_gb`, { valueAsNumber: true })}
                placeholder="—"
                className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </SpecRow>
          </ArrayItemCard>
        );
      })}
    </SpecSection>
  );
};
