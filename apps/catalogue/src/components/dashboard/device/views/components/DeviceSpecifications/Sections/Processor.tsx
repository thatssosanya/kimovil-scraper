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

type ProcessorProps = {
  register: UseFormRegister<DeviceSpecsFormValues>;
  watch: UseFormWatch<DeviceSpecsFormValues>;
  setValue: UseFormSetValue<DeviceSpecsFormValues>;
  dirtyFields: DirtyFields;
  initialValues?: DeviceSpecsFormValues;
};

export const Processor = ({
  register,
  watch,
  setValue,
  dirtyFields,
  initialValues,
}: ProcessorProps) => {
  const cpuCores = watch("cpuCores") || "";

  return (
    <SpecSection title="Процессор">
      <SpecRow label="CPU" isDirty={!!dirtyFields.cpu}>
        <input
          {...register("cpu")}
          placeholder="—"
          className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0"
        />
      </SpecRow>
      <SpecRow label="Производитель" isDirty={!!dirtyFields.cpuManufacturer}>
        <input
          {...register("cpuManufacturer")}
          placeholder="—"
          className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0"
        />
      </SpecRow>
      <SpecRow label="Ядра" isDirty={!!dirtyFields.cpuCores}>
        <ArrayInput
          value={cpuCores}
          onChange={(value) => setValue("cpuCores", value, { shouldDirty: true })}
          isEditing={true}
          placeholder="Добавить..."
          isDirty={!!dirtyFields.cpuCores}
          initialValue={initialValues?.cpuCores}
          borderless
        />
      </SpecRow>
      <SpecRow label="GPU" isDirty={!!dirtyFields.gpu}>
        <input
          {...register("gpu")}
          placeholder="—"
          className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0"
        />
      </SpecRow>
    </SpecSection>
  );
};
