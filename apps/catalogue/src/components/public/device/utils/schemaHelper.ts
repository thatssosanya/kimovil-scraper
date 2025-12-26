import { type DeviceData, type ProsConsType } from "../types";

export const generateDeviceSchema = (
  deviceCharacteristics: DeviceData,
  deviceTitle: string,
  fullDescription: string,
  prosAndCons: ProsConsType
) => {
  if (!deviceCharacteristics) return null;

  // Define the schema type with optional review property
  type ProductSchema = {
    "@context": string;
    "@type": string;
    name: string;
    description: string;
    image: string;
    brand: {
      "@type": string;
      name: string;
    };
    releaseDate: string | null;
    offers: {
      "@type": string;
      priceCurrency: string;
      offerCount: number;
      lowPrice: number;
      highPrice: number;
    };
    additionalProperty: Array<{
      "@type": string;
      name: string;
      value: string | undefined;
    }>;
    aggregateRating: {
      "@type": string;
      ratingValue: string;
      bestRating: string;
      worstRating: string;
      ratingCount: string;
      reviewCount: string;
    };
    review?: {
      "@type": string;
      reviewRating: {
        "@type": string;
        ratingValue: string;
        bestRating: string;
        worstRating: string;
      };
      author: {
        "@type": string;
        name: string;
      };
      reviewBody: string;
    };
  };

  // Create the schema object
  const schema: ProductSchema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: deviceTitle,
    description: fullDescription,
    image: deviceCharacteristics.device?.imageUrl || "",
    brand: {
      "@type": "Brand",
      name: deviceCharacteristics.brand,
    },
    releaseDate: deviceCharacteristics.releaseDate?.toISOString() ?? null, // Convert Date to string for schema
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "RUB",
      offerCount: deviceCharacteristics.device?.links?.length ?? 0,
      lowPrice: deviceCharacteristics.device?.links?.length
        ? Math.min(
            ...deviceCharacteristics.device.links.map((l) => l.price || 0)
          )
        : 0,
      highPrice: deviceCharacteristics.device?.links?.length
        ? Math.max(
            ...deviceCharacteristics.device.links.map((l) => l.price || 0)
          )
        : 0,
    },
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Экран",
        value: deviceCharacteristics?.screens?.length
          ? deviceCharacteristics.screens
              .filter(
                (
                  screen
                ): screen is NonNullable<
                  (typeof deviceCharacteristics.screens)[number]
                > => Boolean(screen?.isMain)
              )
              .map((screen) => {
                const parts: string[] = [];
                if (typeof screen.size_in === "number")
                  parts.push(`${screen.size_in}"`);
                if (typeof screen.displayType === "string")
                  parts.push(screen.displayType);
                return parts.join(" ");
              })
              .filter(Boolean)
              .join(", ") || undefined
          : undefined,
      },
      {
        "@type": "PropertyValue",
        name: "Процессор",
        value:
          deviceCharacteristics.cpuManufacturer && deviceCharacteristics.cpu
            ? `${deviceCharacteristics.cpuManufacturer} ${deviceCharacteristics.cpu}`
            : undefined,
      },
      {
        "@type": "PropertyValue",
        name: "Батарея",
        value: deviceCharacteristics.batteryCapacity_mah
          ? `${deviceCharacteristics.batteryCapacity_mah.toString()} мАч`
          : undefined,
      },
    ].filter((prop) => prop.value !== undefined) as Array<{
      "@type": string;
      name: string;
      value: string;
    }>,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "78",
      bestRating: "100",
      worstRating: "0",
      ratingCount: "1",
      reviewCount: "1",
    },
  };

  // Only add review if there are pros or cons
  if (prosAndCons.pros.length > 0 || prosAndCons.cons.length > 0) {
    schema.review = {
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: "78",
        bestRating: "100",
        worstRating: "0",
      },
      author: {
        "@type": "Organization",
        name: "Click or Die",
      },
      reviewBody:
        (prosAndCons.pros.length > 0
          ? "Pros: " + prosAndCons.pros.join(", ")
          : "") +
        (prosAndCons.cons.length > 0
          ? (prosAndCons.pros.length > 0 ? ". " : "") +
            "Cons: " +
            prosAndCons.cons.join(", ")
          : ""),
    };
  }

  return schema;
};
