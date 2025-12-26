import { db } from "@/src/server/db";
import { sql } from "drizzle-orm";

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

export const fetchDevicesData = async () => {
  const query = `
    SELECT 
      -- Device
      d.id as device_id,
      d.name as device_name,
      d.imageUrl as device_image_url,
      d.description as device_description,
      d.valueRating as device_value_rating,
      
      -- DeviceCharacteristics
      dc.slug as device_slug,
      dc.brand as device_brand,
      dc.releaseDate as device_release_date,
      
      -- Links/Prices (get cheapest price per device)
      l.price as device_price,
      l.url as device_link_url,
      l.name as device_link_name,
      m.name as marketplace_name,
      m.iconUrl as marketplace_icon,
      
      -- Config
      c.id as config_id,
      c.name as config_name,
      c.capacity as config_capacity,
      c.ram as config_ram
      
    FROM Device d
    LEFT JOIN DeviceCharacteristics dc ON d.id = dc.deviceId
    LEFT JOIN (
      SELECT 
        l1.deviceId,
        l1.price,
        l1.url,
        l1.name,
        l1.marketplaceId
      FROM Link l1
      INNER JOIN (
        SELECT deviceId, MIN(price) as min_price
        FROM Link 
        WHERE price > 0
        GROUP BY deviceId
      ) l2 ON l1.deviceId = l2.deviceId AND l1.price = l2.min_price
    ) l ON d.id = l.deviceId
    LEFT JOIN Marketplace m ON l.marketplaceId = m.id
    LEFT JOIN _ConfigToDevice cd ON d.id = cd.B
    LEFT JOIN Config c ON cd.A = c.id
    
    WHERE dc.status = 'PUBLISHED' AND dc.brand IS NOT NULL
    
    ORDER BY 
      dc.brand ASC,
      dc.releaseDate DESC,
      d.name ASC
  `;

  // Execute raw SQL using proper Drizzle syntax
  const rawResults = await db.all(
    sql.raw(query)
  ) as Array<{
      device_id: string;
      device_name: string | null;
      device_image_url: string | null;
      device_description: string | null;
      device_value_rating: number | null;
      device_slug: string | null;
      device_brand: string;
      device_release_date: Date | null;
      device_price: number | null;
      device_link_url: string | null;
      device_link_name: string | null;
      marketplace_name: string | null;
      marketplace_icon: string | null;
      config_id: string | null;
      config_name: string | null;
      config_capacity: string | null;
      config_ram: string | null;
    }>;


  return rawResults;
};

export const transformDevicesData = (rawResults: Awaited<ReturnType<typeof fetchDevicesData>>) => {
  // Transform raw results to nested structure
  const devicesMap = new Map<string, DeviceWithDetails>();

  rawResults.forEach((row) => {
    // Get or create device
    if (!devicesMap.has(row.device_id)) {
      devicesMap.set(row.device_id, {
        id: row.device_id,
        name: row.device_name,
        imageUrl: row.device_image_url,
        description: row.device_description,
        valueRating: row.device_value_rating,
        slug: row.device_slug,
        brand: row.device_brand,
        releaseDate: row.device_release_date,
        price: row.device_price,
        link: row.device_link_url
          ? {
              url: row.device_link_url,
              name: row.device_link_name,
              marketplace: {
                name: row.marketplace_name,
                iconUrl: row.marketplace_icon,
              },
            }
          : null,
        configs: [],
      });
    }

    const device = devicesMap.get(row.device_id)!;

    // Add config if present and not already added
    if (row.config_id && !device.configs.find((c) => c.id === row.config_id)) {
      device.configs.push({
        id: row.config_id,
        name: row.config_name,
        capacity: row.config_capacity,
        ram: row.config_ram,
      });
    }
  });

  // Group devices by brand and year
  const devices = Array.from(devicesMap.values());
  const brandMap = new Map<string, DeviceWithDetails[]>();

  devices.forEach((device) => {
    if (!brandMap.has(device.brand)) {
      brandMap.set(device.brand, []);
    }
    brandMap.get(device.brand)!.push(device);
  });

  // Create brand groups
  const brandGroups: BrandGroup[] = Array.from(brandMap.entries()).map(
    ([brand, devices]) => {
      // Sort devices by release date (newest first), then by name
      const sortedDevices = devices.sort((a, b) => {
        if (a.releaseDate && b.releaseDate) {
          const dateA = new Date(a.releaseDate);
          const dateB = new Date(b.releaseDate);
          if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
            const dateCompare = dateB.getTime() - dateA.getTime();
            if (dateCompare !== 0) return dateCompare;
          }
        }
        return (a.name || "").localeCompare(b.name || "");
      });

      return {
        brand,
        devices: sortedDevices,
        totalDevices: devices.length,
      };
    }
  );

  // Sort brands alphabetically
  brandGroups.sort((a, b) => a.brand.localeCompare(b.brand));

  return {
    brandGroups,
    totalDevices: devices.length,
  };
};