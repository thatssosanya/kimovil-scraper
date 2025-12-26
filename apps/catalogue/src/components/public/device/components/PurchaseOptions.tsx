import React from "react";
import NextLink from "next/link";
import { ShoppingCart } from "lucide-react";
import { rubleCurrencyFormatter } from "@/src/utils/utils";
import { type DeviceData } from "../types";

type PurchaseOptionsProps = {
  deviceData: DeviceData;
};

export const PurchaseOptions: React.FC<PurchaseOptionsProps> = ({
  deviceData,
}) => {
  const links = deviceData?.device?.links ?? [];

  // Filter links that have associated SKUs
  const skuLinks = links.filter((link) => link.sku && link.url);

  // Find the cheapest link among all links if no SKU links are present
  let cheapestLink = null;
  if (skuLinks.length === 0 && links.length > 0) {
    cheapestLink = links.reduce(
      (min, link) => (link.price < min.price ? link : min),
      links[0]!
    );
  }

  return (
    <>
      {/* Render SKU links if available */}
      {skuLinks.length > 0 &&
        skuLinks.map(({ price, sku, url }) =>
          sku && url ? (
            <NextLink
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="h-full w-full min-w-[130px] flex-1 rounded-3xl bg-gray-100 p-4 transition hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
              key={sku.id}
            >
              <div className="flex h-full flex-col justify-between gap-2">
                <p className=" text-sm font-semibold leading-[20px] text-gray-600 dark:text-gray-300 lg:text-xl">{`${sku.ram_gb}GB/${sku.storage_gb}GB`}</p>
                <div className="text-nowrap mt-auto self-start  rounded-full text-center text-base font-semibold text-gray-900 dark:text-white lg:bg-gray-900  lg:px-6 lg:py-3 lg:text-white lg:dark:bg-white  lg:dark:text-gray-900">
                  от {rubleCurrencyFormatter(price)}
                </div>
              </div>
            </NextLink>
          ) : null
        )}

      {/* Render the cheapest link if no SKU links are available */}
      {cheapestLink && cheapestLink.url && (
        <NextLink
          href={cheapestLink.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-[150px] items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-2 shadow-sm transition hover:border-gray-300 hover:bg-white hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 dark:hover:bg-gray-700 sm:w-[170px]"
        >
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-200">
              Купить
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              от {rubleCurrencyFormatter(cheapestLink.price)}
            </p>
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white transition group-hover:bg-blue-50 dark:bg-gray-700 dark:group-hover:bg-blue-900/30">
            <ShoppingCart
              className="h-3.5 w-3.5 text-gray-500 dark:text-gray-300"
              aria-hidden="true"
            />
          </div>
        </NextLink>
      )}
    </>
  );
};
