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
  type DeviceSpecsFormValues,
  type DirtyFields,
} from "../../../types/index";
import { SpecSection } from "../components/SpecSection";
import { SpecRow } from "../components/SpecRow";
import { ArrayItemCard } from "../components/ArrayItemCard";

type SoftwareAndBenchmarksProps = {
  register: UseFormRegister<DeviceSpecsFormValues>;
  watch: UseFormWatch<DeviceSpecsFormValues>;
  setValue: UseFormSetValue<DeviceSpecsFormValues>;
  control: Control<DeviceSpecsFormValues>;
  dirtyFields: DirtyFields;
  initialValues?: DeviceSpecsFormValues;
};

export const SoftwareAndBenchmarks = ({
  register,
  watch,
  setValue: _setValue,
  control,
  dirtyFields,
  initialValues: _initialValues,
}: SoftwareAndBenchmarksProps) => {
  const {
    fields: benchmarkFields,
    append: appendBenchmark,
    remove: removeBenchmark,
  } = useFieldArray({
    control,
    name: "benchmarks",
  });

  const benchmarkDirtyFields = dirtyFields.benchmarks as
    | Record<number, Record<string, boolean>>
    | undefined;

  const handleAppendBenchmark = React.useCallback(() => {
    const newBenchmark = {
      id: Math.random().toString(),
      name: "",
      score: 0,
    };
    appendBenchmark(newBenchmark);
  }, [appendBenchmark]);

  return (
    <>
      <SpecSection title="Программное обеспечение">
        <SpecRow label="ОС" isDirty={!!dirtyFields.os}>
          <input
            {...register("os")}
            placeholder="—"
            className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0"
          />
        </SpecRow>
        <SpecRow label="Оболочка" isDirty={!!dirtyFields.osSkin}>
          <input
            {...register("osSkin")}
            placeholder="—"
            className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0"
          />
        </SpecRow>
      </SpecSection>

      <SpecSection
        title="Бенчмарки"
        action={
          <button
            type="button"
            onClick={handleAppendBenchmark}
            className="flex items-center justify-center h-5 w-5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
        }
      >
        {benchmarkFields.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 px-3 py-2">
            Нет данных о бенчмарках
          </p>
        )}

        {benchmarkFields.map((field, index) => {
          const benchmarkName = watch(`benchmarks.${index}.name`) || "";
          const isDirty = benchmarkDirtyFields?.[index];

          const title = benchmarkName || `Бенчмарк ${index + 1}`;

          return (
            <ArrayItemCard
              key={field.id}
              title={title}

              onRemove={() => removeBenchmark(index)}
            >
              <input type="hidden" {...register(`benchmarks.${index}.id`)} />
              <SpecRow label="Название" isDirty={isDirty?.name}>
                <input
                  {...register(`benchmarks.${index}.name`)}
                  placeholder="AnTuTu, Geekbench..."
                  className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0"
                />
              </SpecRow>
              <SpecRow label="Результат" isDirty={isDirty?.score}>
                <input
                  type="number"
                  {...register(`benchmarks.${index}.score`, { valueAsNumber: true })}
                  placeholder="—"
                  className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </SpecRow>
            </ArrayItemCard>
          );
        })}
      </SpecSection>
    </>
  );
};
