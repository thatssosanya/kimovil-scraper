import { type RouterOutputs } from "@/src/utils/api";

export type DeviceData = NonNullable<
  RouterOutputs["device"]["getDeviceCharacteristicBySlug"]
>;

export type Screen = {
  id: string;
  position?: string | null;
  size_in?: number | null;
  displayType?: string | null;
  resolution?: string | null;
  aspectRatio?: string | null;
  ppi?: number | null;
  displayFeatures?: string | null;
  refreshRate?: number | null;
  brightnessNits?: number | null;
  isMain: boolean;
};

export type ProsConsType = {
  pros: string[];
  cons: string[];
};

export type DevicePageProps = {
  slug: string;
};

/** @deprecated Use DevicePageProps instead */
export type DeviceProfileProps = DevicePageProps;

export type Characteristic = {
  label: string;
  value: string;
};
