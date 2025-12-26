export type DeviceWithDetails = {
  id: string;
  name: string | null;
  imageUrl: string | null;
  description: string | null;
  slug: string | null;
  brand: string;
  releaseDate: Date | null;
  price: number | null;
  valueRating: number | null;
  link: {
    url: string | null;
    name: string | null;
    marketplace: {
      name: string | null;
      iconUrl: string | null;
    };
  } | null;
  configs: Array<{
    id: string;
    name: string | null;
    capacity: string | null;
    ram: string | null;
  }>;
};

export type BrandGroup = {
  brand: string;
  devices: DeviceWithDetails[];
  totalDevices: number;
};

export type DevicesProps = {
  brandGroups: BrandGroup[];
  totalDevices: number;
};