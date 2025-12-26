import { api } from "@/src/utils/api";
import React, { useState, useMemo } from "react";
import { Search, ExternalLink, Package, Filter, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type MarketplaceViewProps = {
  marketplaceId?: string;
};

export const MarketplaceView = (props: MarketplaceViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [urlFilter, setUrlFilter] = useState("");
  const [priceSort, setPriceSort] = useState<"asc" | "desc" | "none">("none");
  const [onlyInRatings, setOnlyInRatings] = useState(false);
  const [onlyPublished, setOnlyPublished] = useState(false);
  
  const { data, isFetching } = api.link.getMarketplaceLinks.useQuery(
    { 
      id: props.marketplaceId || "",
      onlyInRatings,
      onlyPublished,
    },
    {
      enabled: !!props.marketplaceId,
    }
  );

  const filteredAndSortedData = useMemo(() => {
    if (!data) return [];
    
    let filtered = data.filter((link) => {
      const matchesSearch = !searchQuery || 
        link.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        link.device?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesUrl = !urlFilter || 
        link.url?.toLowerCase().includes(urlFilter.toLowerCase());
      
      return matchesSearch && matchesUrl;
    });

    if (priceSort !== "none") {
      filtered = filtered.sort((a, b) => {
        const priceA = a.price || 0;
        const priceB = b.price || 0;
        return priceSort === "asc" ? priceA - priceB : priceB - priceA;
      });
    }

    return filtered;
  }, [data, searchQuery, urlFilter, priceSort]);

  if (isFetching) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
          <span>Загрузка ссылок...</span>
        </div>
      </div>
    );
  }

  if (!props.marketplaceId) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center text-gray-500">
          <Package className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-lg font-medium">Выберите маркетплейс</p>
          <p className="text-sm">Выберите маркетплейс из списка слева для просмотра ссылок</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center text-gray-500">
          <Package className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-lg font-medium">Нет ссылок</p>
          <p className="text-sm">В этом маркетплейсе пока нет ссылок</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header with filters */}
      <div className="border-b border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Ссылки маркетплейса
            </h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {filteredAndSortedData.length} из {data.length} ссылок
            </div>
          </div>
          
          {/* Search and Filter Row */}
          <div className="flex flex-col gap-3">
            {/* Top row - Text filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск по названию или устройству..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* URL Filter */}
              <div className="relative flex-1">
                <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Фильтр по URL..."
                  value={urlFilter}
                  onChange={(e) => setUrlFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400"
                />
                {urlFilter && (
                  <button
                    onClick={() => setUrlFilter("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Price Sort */}
              <select
                value={priceSort}
                onChange={(e) => setPriceSort(e.target.value as "asc" | "desc" | "none")}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400"
              >
                <option value="none">Без сортировки</option>
                <option value="asc">Цена ↑</option>
                <option value="desc">Цена ↓</option>
              </select>
            </div>
            
            {/* Bottom row - Checkboxes */}
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={onlyInRatings}
                  onChange={(e) => setOnlyInRatings(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <span>Только в рейтингах</span>
              </label>
              
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={onlyPublished}
                  onChange={(e) => setOnlyPublished(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                />
                <span>Только опубликованные</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Links Grid */}
      <div className="flex-1 overflow-auto p-4">
        <AnimatePresence>
          {filteredAndSortedData.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex h-64 items-center justify-center"
            >
              <div className="text-center text-gray-500">
                <Search className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <p className="text-lg font-medium">Ничего не найдено</p>
                <p className="text-sm">Попробуйте изменить параметры поиска</p>
              </div>
            </motion.div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
              {filteredAndSortedData.map((link) => (
                <motion.div
                  key={link.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
                >
                  {/* Device Image */}
                  <div className="mb-3 flex items-start gap-3">
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700">
                      {link.device?.imageUrl ? (
                        <img
                          src={link.device.imageUrl}
                          alt={link.device.name || "Device"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {link.name || "Без названия"}
                      </h3>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {link.device?.name || "Устройство не указано"}
                      </p>
                      {link.config?.name && (
                        <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                          {link.config.name}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* URL Display */}
                  {link.url && (
                    <div className="mb-3">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{link.url}</span>
                      </div>
                    </div>
                  )}

                  {/* Price and Action */}
                  <div className="flex items-center justify-between">
                    {link.price && (
                      <div className="text-sm font-bold text-gray-900 dark:text-white">
                        {link.price.toLocaleString("ru-RU")} ₽
                      </div>
                    )}
                    
                    {link.url && (
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                      >
                        Открыть
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
