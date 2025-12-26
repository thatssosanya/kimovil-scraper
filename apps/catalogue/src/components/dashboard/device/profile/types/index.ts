import type { Device, DeviceCharacteristics, Config, Link } from "@/src/server/db/schema";

export interface DeviceProfileData extends Device {
  characteristics: DeviceCharacteristics[];
  configs: Config[];
  links: Link[];
  ratingPositions: Array<{
    id: string;
    deviceId: string;
    position: number;
    rating?: {
      id: string;
      name?: string;
      description?: string;
    };
  }>;
}

export interface ProfileSection {
  id: string;
  title: string;
  isCollapsible?: boolean;
  isCollapsed?: boolean;
}

export interface EditableField {
  key: keyof Device | keyof DeviceCharacteristics;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "textarea" | "image";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  validation?: (value: unknown) => string | null;
  hint?: string;
}

export interface TableRowField extends EditableField {
  value: string | number | boolean | null;
  isEditing?: boolean;
  isDirty?: boolean;
}