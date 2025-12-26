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
import { SpecRow, SpecRowToggle } from "../components/SpecRow";
import { Toggle } from "../components/Toggle";

type HardwareFeaturesProps = {
  register: UseFormRegister<DeviceSpecsFormValues>;
  watch: UseFormWatch<DeviceSpecsFormValues>;
  setValue: UseFormSetValue<DeviceSpecsFormValues>;
  dirtyFields: DirtyFields;
  initialValues?: DeviceSpecsFormValues;
};

export const HardwareFeatures = ({
  register,
  watch,
  setValue,
  dirtyFields,
  initialValues,
}: HardwareFeaturesProps) => {
  const sim = watch("sim") || "";

  return (
    <SpecSection title="Особенности">
      <SpecRowToggle label="SD-карта" isDirty={!!dirtyFields.sdSlot}>
        <Toggle
          checked={watch("sdSlot") ?? false}
          onCheckedChange={(checked) => setValue("sdSlot", checked, { shouldDirty: true })}
        />
      </SpecRowToggle>
      <SpecRow label="Сканер отпечатка" isDirty={!!dirtyFields.fingerprintPosition}>
        <input
          {...register("fingerprintPosition")}
          placeholder="screen | side | back"
          className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0"
        />
      </SpecRow>
      <SpecRowToggle label="NFC" isDirty={!!dirtyFields.nfc}>
        <Toggle
          checked={watch("nfc") ?? false}
          onCheckedChange={(checked) => setValue("nfc", checked, { shouldDirty: true })}
        />
      </SpecRowToggle>
      <SpecRowToggle label="3.5mm" isDirty={!!dirtyFields.headphoneJack}>
        <Toggle
          checked={watch("headphoneJack") ?? false}
          onCheckedChange={(checked) => setValue("headphoneJack", checked, { shouldDirty: true })}
        />
      </SpecRowToggle>
      <SpecRow label="SIM" isDirty={!!dirtyFields.sim}>
        <ArrayInput
          value={sim}
          onChange={(value) => setValue("sim", value, { shouldDirty: true })}
          isEditing={true}
          placeholder="nano, micro..."
          isDirty={!!dirtyFields.sim}
          initialValue={initialValues?.sim}
          borderless
        />
      </SpecRow>
      <SpecRow label="Количество SIM" isDirty={!!dirtyFields.simCount}>
        <input
          type="number"
          min="0"
          {...register("simCount")}
          placeholder="—"
          className="w-full bg-transparent border-none outline-none text-sm text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-0 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </SpecRow>
    </SpecSection>
  );
};
