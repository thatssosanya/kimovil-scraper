import React, { useState } from "react";
import { TwoColumns } from "@/src/components/dashboard/layout";
import Layout from "@/src/components/dashboard/layout/Layout";
import { api } from "@/src/utils/api";
import { AddMarketplaceDialogue } from "@/src/components/dashboard/device/dialogs/AddMarketplaceDialogue";
import type { Marketplace } from "@/src/server/db/schema";
import { MarketplaceView } from "@/src/components/dashboard/device/MarketplaceView";
import { Store, Package } from "lucide-react";
import { motion } from "framer-motion";

const MarketplacesPage = () => {
  const [selectedMarketplace, setSelectedMarketplace] = useState<Marketplace>();
  const { data: marketplaceList, isLoading } = api.config.getAllMarketplaces.useQuery();

  return (
    <Layout>
      <TwoColumns>
        {/* Left sidebar - Marketplace List */}
        <div className="flex h-full flex-col bg-white dark:bg-gray-900">
          {/* Header */}
          <div className="border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                <Store className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Маркетплейсы
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {marketplaceList?.length || 0} маркетплейсов
                </p>
              </div>
            </div>
          </div>

          {/* Marketplace List */}
          <div className="scrollbar flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="flex items-center gap-3 text-gray-500">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                  <span>Загрузка...</span>
                </div>
              </div>
            ) : marketplaceList && marketplaceList.length > 0 ? (
              <div className="p-2">
                {marketplaceList.map((marketplace) => (
                  <motion.div
                    key={marketplace.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`group relative mb-2 cursor-pointer rounded-lg border p-3 transition-all ${
                      selectedMarketplace?.id === marketplace.id
                        ? "border-blue-500 bg-blue-50 shadow-md dark:border-blue-400 dark:bg-blue-900/20"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600"
                    }`}
                    onClick={() => setSelectedMarketplace(marketplace)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border-2 p-1 ${
                        selectedMarketplace?.id === marketplace.id
                          ? "border-blue-200 bg-white dark:border-blue-400 dark:bg-gray-700"
                          : "border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700"
                      }`}>
                        {marketplace.iconUrl ? (
                          <img
                            src={marketplace.iconUrl}
                            alt={marketplace.name || "Marketplace"}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Package className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <h3 className={`truncate text-sm font-semibold ${
                          selectedMarketplace?.id === marketplace.id
                            ? "text-blue-900 dark:text-blue-100"
                            : "text-gray-900 dark:text-white"
                        }`}>
                          {marketplace.name || "Без названия"}
                        </h3>
                        <p className={`truncate text-xs ${
                          selectedMarketplace?.id === marketplace.id
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-gray-500 dark:text-gray-400"
                        }`}>
                          ID: {marketplace.id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>

                    {/* Selection indicator */}
                    {selectedMarketplace?.id === marketplace.id && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400"></div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center">
                <div className="text-center text-gray-500">
                  <Package className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                  <p className="text-sm">Нет маркетплейсов</p>
                </div>
              </div>
            )}
          </div>

          {/* Add Marketplace Button */}
          <div className="border-t border-gray-200 p-4 dark:border-gray-700">
            <AddMarketplaceDialogue />
          </div>
        </div>

        {/* Right content - Marketplace Details */}
        <div className="bg-gray-50 dark:bg-gray-900">
          <MarketplaceView marketplaceId={selectedMarketplace?.id} />
        </div>
      </TwoColumns>
    </Layout>
  );
};

export default MarketplacesPage;
