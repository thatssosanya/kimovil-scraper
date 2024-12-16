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
    skus: Sku[];
    cpu: string | null;
    gpu: string | null;
    sdSlot: boolean | null;
  };
  camera: {
    rear: { cameras: SingleCameraData[]; features: string[] };
    front: { cameras: SingleCameraData[]; features: string[] };
  };
  connectivity: {
    nfc: boolean | null;
    bluetooth: string | null;
    sim: Sim[];
    usb: "USB-C" | "Lightning" | "MicroUSB" | null;
    headphoneJack: boolean | null;
  };
  battery: {
    capacity_mah: number | null;
    fastCharging: boolean | null;
  };
}
export { SIM_TYPES as simTypes };
