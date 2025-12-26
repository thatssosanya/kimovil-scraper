import { ArrayInput } from "@/src/components/ui/ArrayInput";
import { DatePicker } from "@/src/components/ui/DatePicker";
import {
  type UseFormRegister,
  type UseFormWatch,
  type UseFormSetValue,
} from "react-hook-form";
import {
  type DeviceSpecsFormValues,
  type DirtyFields,
} from "../../../types/index";
import { SpecRow } from "../components/SpecRow";

type BasicInfoProps = {
  register: UseFormRegister<DeviceSpecsFormValues>;
  watch: UseFormWatch<DeviceSpecsFormValues>;
  setValue: UseFormSetValue<DeviceSpecsFormValues>;
  dirtyFields: DirtyFields;
  initialValues?: DeviceSpecsFormValues;
};

export const BasicInfo = ({
  register,
  watch,
  setValue,
  dirtyFields,
  initialValues,
}: BasicInfoProps) => {
  const releaseDate = watch("releaseDate");
  const aliases = watch("aliases") || "";

  return (
    <div>
      <SpecRow label="Название" isDirty={!!dirtyFields.name}>
        <input
          {...register("name")}
          placeholder="—"
          className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0"
        />
      </SpecRow>
      <SpecRow label="Бренд" isDirty={!!dirtyFields.brand}>
        <input
          {...register("brand")}
          placeholder="—"
          className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0"
        />
      </SpecRow>
      <SpecRow label="Альт. названия" isDirty={!!dirtyFields.aliases}>
        <ArrayInput
          value={aliases}
          onChange={(value) => setValue("aliases", value, { shouldDirty: true })}
          isEditing={true}
          placeholder="Добавить..."
          isDirty={!!dirtyFields.aliases}
          initialValue={initialValues?.aliases}
          borderless
        />
      </SpecRow>
      <SpecRow label="Дата выхода" isDirty={!!dirtyFields.releaseDate}>
        <DatePicker
          date={releaseDate}
          onSelect={(date) => setValue("releaseDate", date ?? null, { shouldDirty: true })}
          borderless
        />
      </SpecRow>
    </div>
  );
};
