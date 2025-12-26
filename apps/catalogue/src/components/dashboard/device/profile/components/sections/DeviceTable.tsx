import { useCallback } from "react";
import { InfoCard, SpecificationRow } from "../shared";
import { getDeviceFieldsConfig } from "../../utils";
import type { Device } from "@/src/server/db/schema";
import type { DeviceProfileData } from "../../types";

interface DeviceTableProps {
  device: DeviceProfileData;
  onSave: (updates: Record<string, unknown>) => void;
  isLoading?: boolean;
}

export function DeviceTable({ device, onSave }: DeviceTableProps) {
  const fieldsConfig = getDeviceFieldsConfig();
  
  const fields = fieldsConfig.map(field => ({
    ...field,
    value: (device[field.key as keyof Device] ?? null) as string | number | boolean | null,
  }));

  const handleFieldSave = useCallback((fieldKey: string, value: unknown) => {
    onSave({ [fieldKey]: value });
  }, [onSave]);

  return (
    <InfoCard>
      <div className="space-y-1">
        {fields.map((field) => (
          <SpecificationRow
            key={field.key}
            field={field}
            onSave={(value) => handleFieldSave(field.key, value)}
            deviceId={device.id}
            links={device.links || []}
          />
        ))}
      </div>
    </InfoCard>
  );
}
