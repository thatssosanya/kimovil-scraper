import { SIM_TYPES } from "../utils/consts";

export interface AutocompleteOption {
  name: string;
  slug: string;
}

export type Sim = (typeof SIM_TYPES)[number];

export type DirtySku = { ram: number; rom: number };
export type DirtyMarket = { mkid: string; devices: DirtySku[] };
export type Sku = { marketId: string; ram_gb: number; storage_gb: number };

export interface SingleCameraData {
  resolution_mp: number;
  aperture_fstop: string;
  sensor: string | null;
  front: boolean;
}

// fields representing string[] are cast to |-delimited strings
// due to sqlite limitations. see main repo's prisma schema
export interface PhoneData {
  // essentials
  slug: string;
  name: string;
  brand: string;
  aliases: string; // |-delimited
  releaseDate: Date | null;
  raw: string;

  // design
  height_mm: number | null;
  width_mm: number | null;
  thickness_mm: number | null;
  weight_g: number | null;
  materials: string; // |-delimited
  ipRating: string | null;
  colors: string; // |-delimited

  // display
  size_in: number | null;
  displayType: string | null;
  resolution: string | null;
  ppi: number | null;
  displayFeatures: string; // |-delimited

  // hardware
  cpu: string | null;
  gpu: string | null;
  sdSlot: boolean | null;
  skus: Sku[];

  // connectivity
  nfc: boolean | null;
  bluetooth: string | null;
  sim: string; // |-delimited
  usb: "USB-C" | "Lightning" | "MicroUSB" | null;
  headphoneJack: boolean | null;

  // battery
  batteryCapacity_mah: number | null;
  batteryFastCharging: boolean | null;

  // cameras
  cameras: SingleCameraData[];
  rearCameraFeatures: string; // |-delimited
  frontCameraFeatures: string; // |-delimited
}

export { SIM_TYPES as simTypes };
