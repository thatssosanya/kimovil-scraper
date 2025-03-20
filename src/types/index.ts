import { SIM_TYPES } from "../utils/consts.js";

export interface AutocompleteOption {
  name: string;
  slug: string;
}

export type Sim = (typeof SIM_TYPES)[number];

export type DirtySku = { ram: number; rom: number };
export type DirtyMarket = { mkid: string; devices: DirtySku[] };
export type Sku = {
  marketId: string; // |-delimited
  ram_gb: number;
  storage_gb: number;
};

export interface SingleCameraData {
  resolution_mp: number;
  aperture_fstop: string;
  sensor: string | null;
  type: string;
  features: string;
}

export interface Benchmark {
  name: string;
  score: number;
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
  aspectRatio: string | null;
  ppi: number | null;
  displayFeatures: string; // |-delimited

  // hardware
  cpu: string | null;
  cpuManufacturer: string | null;
  cpuCores: string | null; // |-delimited
  gpu: string | null;
  sdSlot: boolean | null;
  skus: Sku[];
  fingerprintPosition: string | null;
  benchmarks: Benchmark[];

  // connectivity
  nfc: boolean | null;
  bluetooth: string | null;
  sim: string; // |-delimited
  simCount: number;
  usb: "USB-A" | "USB-C" | "Lightning" | null;
  headphoneJack: boolean | null;

  // battery
  batteryCapacity_mah: number | null;
  batteryFastCharging: boolean | null;
  batteryWattage: number | null;

  // cameras
  cameras: SingleCameraData[];
  cameraFeatures: string; // |-delimited

  // software
  os: string | null;
  osSkin: string | null;
}

export { SIM_TYPES as simTypes };
