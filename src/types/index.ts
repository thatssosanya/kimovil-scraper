import { SIM_TYPES } from "../utils/consts";

export interface AutocompleteOption {
  name: string;
  slug: string;
}

export type SIM = (typeof SIM_TYPES)[number];

export interface CameraData {
  resolution_mp: number;
  aperture: string;
  features: string[];
}

export interface PhoneData {
  name: string;
  brand: string;
  aliases: string[];
  releaseDate: string | null;
  design: {
    dimensions_mm: {
      height: number;
      width: number;
      thickness: number;
    } | null;
    weight_g: number | null;
    materials: string[];
    ipRating: string | null;
    colors: string[];
  };
  display: {
    size_in: number | null;
    type: string | null;
    resolution: string | null;
    ppi: number | null;
    features: string[];
  };
  hardware: {
    cpu: string | null;
    gpu: string | null;
    ramOptions_gb: number[];
    storageOptions_gb: number[];
    sdSlot: boolean | null;
  };
  camera: {
    rear: CameraData[];
    front: CameraData[];
  };
  connectivity: {
    nfc: boolean | null;
    bluetooth: string | null;
    sim: SIM[];
    usb: "USB-C" | "Lightning" | "MicroUSB" | null;
    headphoneJack: boolean | null;
  };
  battery: {
    capacity_mah: number | null;
    fastCharging: boolean | null;
  };
}
export { SIM_TYPES as simTypes };
