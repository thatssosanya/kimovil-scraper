import { ArrayInput } from "@/src/components/ui/ArrayInput";
import {
  type UseFormRegister,
  type UseFormWatch,
  type UseFormSetValue,
} from "react-hook-form";
import {
  type DeviceSpecsFormValues,
  type DirtyFields,
} from "../../../types/index";
import { SpecSection } from "../components/SpecSection";
import { SpecRow } from "../components/SpecRow";

type DimensionsProps = {
  register: UseFormRegister<DeviceSpecsFormValues>;
  watch: UseFormWatch<DeviceSpecsFormValues>;
  setValue: UseFormSetValue<DeviceSpecsFormValues>;
  dirtyFields: DirtyFields;
  initialValues?: DeviceSpecsFormValues;
};

export const Dimensions = ({
  register,
  watch,
  setValue,
  dirtyFields,
  initialValues,
}: DimensionsProps) => {
  const materials = watch("materials") || "";
  const colors = watch("colors") || "";

  return (
    <SpecSection title="Размеры">
      <SpecRow label="Высота (мм)" isDirty={!!dirtyFields.height_mm}>
        <input
          type="number"
          step="0.1"
          {...register("height_mm")}
          placeholder="—"
          className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </SpecRow>
      <SpecRow label="Ширина (мм)" isDirty={!!dirtyFields.width_mm}>
        <input
          type="number"
          step="0.1"
          {...register("width_mm")}
          placeholder="—"
          className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </SpecRow>
      <SpecRow label="Толщина (мм)" isDirty={!!dirtyFields.thickness_mm}>
        <input
          type="number"
          step="0.1"
          {...register("thickness_mm")}
          placeholder="—"
          className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </SpecRow>
      <SpecRow label="Вес (г)" isDirty={!!dirtyFields.weight_g}>
        <input
          type="number"
          {...register("weight_g")}
          placeholder="—"
          className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </SpecRow>
      <SpecRow label="Материалы" isDirty={!!dirtyFields.materials}>
        <ArrayInput
          value={materials}
          onChange={(value) => setValue("materials", value, { shouldDirty: true })}
          isEditing={true}
          placeholder="Добавить..."
          isDirty={!!dirtyFields.materials}
          initialValue={initialValues?.materials}
          borderless
        />
      </SpecRow>
      <SpecRow label="Цвета" isDirty={!!dirtyFields.colors}>
        <ArrayInput
          value={colors}
          onChange={(value) => setValue("colors", value, { shouldDirty: true })}
          isEditing={true}
          placeholder="Добавить..."
          isDirty={!!dirtyFields.colors}
          initialValue={initialValues?.colors}
          borderless
        />
      </SpecRow>
      <SpecRow label="IP" isDirty={!!dirtyFields.ipRating}>
        <input
          {...register("ipRating")}
          placeholder="—"
          className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0"
        />
      </SpecRow>
    </SpecSection>
  );
};
