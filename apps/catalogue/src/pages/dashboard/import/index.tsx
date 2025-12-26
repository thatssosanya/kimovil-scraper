import { type NextPage } from "next";
import { api } from "@/src/utils/api";
import Layout from "@/src/components/dashboard/layout/Layout";
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { useHeaderActions } from "@/src/hooks/useHeaderActions";
import { DataTableSearch } from "@/src/components/ui/data-table/components/Header/Search";
import { ScraperDeviceTable } from "@/src/components/dashboard/import/ScraperDeviceTable";
import { FilterBar } from "@/src/components/dashboard/import/FilterBar";
import type { ScraperDevice } from "@/src/server/api/routers/scraper-service";

const PAGE_SIZE = 50;

const ImportPage: NextPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const [allDevices, setAllDevices] = useState<ScraperDevice[]>([]);
  const prevQueryKey = useRef("");
  const canLoadMoreRef = useRef(false);

  const isClientFilter = filter === "matched" || filter === "unmatched";
  const apiFilter = isClientFilter ? "all" : filter;
  const queryKey = `${searchTerm}|${apiFilter}`;

  const {
    data: devicesData,
    isLoading,
    error,
    isFetching,
  } = api.scraperService.getDevices.useQuery(
    {
      search: searchTerm || undefined,
      filter: apiFilter as "all" | "scraped" | "unscraped" | "corrupted" | "valid" | "has_raw" | "has_ai" | "needs_raw" | "needs_ai",
      limit: PAGE_SIZE,
      offset,
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  const { data: matchedData } = api.scraperService.getMatchedCount.useQuery(
    {},
    { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }
  );

  // Reset when query key changes
  useEffect(() => {
    if (queryKey !== prevQueryKey.current) {
      setOffset(0);
      setAllDevices([]);
      prevQueryKey.current = queryKey;
    }
  }, [queryKey]);

  // Append new devices when data arrives
  useEffect(() => {
    if (devicesData?.devices && queryKey === prevQueryKey.current) {
      if (offset === 0) {
        setAllDevices(devicesData.devices);
      } else {
        setAllDevices((prev) => {
          const existingSlugs = new Set(prev.map((d) => d.slug));
          const newDevices = devicesData.devices.filter((d) => !existingSlugs.has(d.slug));
          return [...prev, ...newDevices];
        });
      }
    }
  }, [devicesData, offset, queryKey]);

  const devices = useMemo(() => {
    if (filter === "matched") {
      return allDevices.filter((d) => d.inCatalogue);
    }
    if (filter === "unmatched") {
      return allDevices.filter((d) => !d.inCatalogue);
    }
    return allDevices;
  }, [allDevices, filter]);

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const handleFilterChange = useCallback((value: string) => {
    setFilter(value);
  }, []);

  const hasMore = devicesData ? allDevices.length < devicesData.filtered : false;
  canLoadMoreRef.current = hasMore && !isFetching;

  const handleLoadMore = useCallback(async () => {
    if (canLoadMoreRef.current) {
      setOffset((prev) => prev + PAGE_SIZE);
    }
  }, []);

  useHeaderActions({
    title: "Импорт устройств",
    leftActions: [
      <FilterBar
        key="filters"
        activeFilter={filter}
        onFilterChange={handleFilterChange}
        stats={devicesData?.stats}
        matchedCount={matchedData?.matched}
      />,
    ],
    rightActions: [
      <DataTableSearch
        key="search"
        value={searchTerm}
        onChange={handleSearch}
        placeholder="Поиск устройств..."
      />,
    ],
  });

  return (
    <Layout contentScrollable={false}>
      <ScraperDeviceTable
        devices={devices}
        totalCount={devicesData?.total}
        filteredCount={isClientFilter ? devices.length : devicesData?.filtered}
        isLoading={isLoading}
        isFetchingNextPage={isFetching && offset > 0}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        error={error?.message}
        stats={devicesData?.stats}
      />
    </Layout>
  );
};

export default ImportPage;
