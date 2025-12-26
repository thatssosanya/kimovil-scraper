import { type NextPage } from "next";
import { api } from "@/src/utils/api";
import DeviceTable from "@/src/components/dashboard/device/DeviceTable";
import Layout from "@/src/components/dashboard/layout/Layout";
import { useDeviceUrlState } from "@/src/components/dashboard/device/hooks/useDeviceUrlState";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useHeaderActions } from "@/src/hooks/useHeaderActions";
import { DataTableSearch } from "@/src/components/ui/data-table/components/Header/Search";
import QuickFilters from "@/src/components/dashboard/device/QuickFilters";
import { AddDeviceDialogue } from "@/src/components/dashboard/device/dialogs/AddDeviceDialogue";

const DevicesPage: NextPage = () => {
  const { search, activeFilters, deviceType, sort, order, updateUrlState } =
    useDeviceUrlState();
  const isNavigating = useRef(false);
  const [searchTerm, setSearchTerm] = useState(search || "");
  const utils = api.useUtils();

  const {
    data: devices,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = api.device.getAllDevices.useInfiniteQuery(
    {
      limit: 40,
      search: searchTerm || null,
      filters: activeFilters.length > 0 ? activeFilters : undefined,
      deviceType: deviceType && deviceType.trim() ? deviceType : undefined,
      sortBy: sort,
      sortOrder: order,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchOnWindowFocus: false,
    }
  );

  // Get total device count (unfiltered)
  const { data: totalCount } = api.device.getDeviceCount.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Get filtered device count
  const { data: filteredCount, isLoading: _isLoadingFilteredCount } =
    api.device.getFilteredDeviceCount.useQuery(
      {
        search: searchTerm || null,
        filters: activeFilters.length > 0 ? activeFilters : undefined,
        deviceType: deviceType && deviceType.trim() ? deviceType : undefined,
      },
      {
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60, // Cache for 1 minute
        // Keep previous data while refetching
      }
    );

  const { mutateAsync: deleteDevices, isPending: isDeleting } =
    api.device.deleteDevices.useMutation({
      onSuccess: () => {
        toast.success("Устройства успешно удалены");
        void utils.device.getAllDevices.invalidate();
      },
      onError: (error) => {
        toast.error("Ошибка при удалении устройств: " + error.message);
      },
    });

  // Memoize flattened device list
  const allDevices = useMemo(() => {
    return devices?.pages.flatMap((page) => page.items) ?? [];
  }, [devices?.pages]);

  // Memoize loading state
  const isLoadingState = useMemo(() => {
    return isLoading || isFetchingNextPage || isNavigating.current;
  }, [isLoading, isFetchingNextPage]);

  const handleLoadMore = useCallback(async () => {
    try {
      await fetchNextPage();
    } catch (error) {
      console.error("Error loading more devices:", error);
    }
  }, [fetchNextPage]);

  const handleDeviceSelect = useCallback((id?: string) => {
    if (id) {
      isNavigating.current = true;
      void window.open(`/dashboard/devices/${id}`, "_blank");
    }
  }, []);

  const handleSearch = useCallback(
    (searchTerm: string) => {
      setSearchTerm(searchTerm);
      updateUrlState({ search: searchTerm });
    },
    [updateUrlState]
  );

  const handleFilterChange = useCallback(
    (filters: string[]) => {
      updateUrlState({ activeFilters: filters });
    },
    [updateUrlState]
  );

  const handleDeviceTypeChange = useCallback(
    (value?: string) => {
      updateUrlState({ deviceType: value && value.trim() ? value : undefined });
    },
    [updateUrlState]
  );

  const handleSortChange = useCallback(
    (columnId: string, sortOrder: "asc" | "desc" | undefined) => {
      updateUrlState({
        sort: sortOrder ? columnId : undefined,
        order: sortOrder,
      });
    },
    [updateUrlState]
  );

  const handleDelete = useCallback(
    async (deviceIds: string[]) => {
      try {
        await deleteDevices({ ids: deviceIds });
      } catch (error) {
        console.error("Error deleting devices:", error);
      }
    },
    [deleteDevices]
  );

  // Set up header with search and filters
  useHeaderActions({
    title: "Устройства",
    leftActions: [
      <QuickFilters
        key="filters"
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        deviceType={deviceType}
        onDeviceTypeChange={handleDeviceTypeChange}
      />,
    ],
    rightActions: [
      <DataTableSearch
        key="search"
        value={searchTerm}
        onChange={handleSearch}
        placeholder="Поиск устройств..."
      />,
      <AddDeviceDialogue key="create" variant="ghost" size="icon" iconOnly className="h-8 w-8 text-black" />,
    ],
  });

  return (
    <Layout contentScrollable={false}>
      <DeviceTable
        deviceList={allDevices}
        totalCount={totalCount}
        filteredCount={filteredCount}
        handleDeviceSelect={handleDeviceSelect}
        isLoading={isLoadingState}
        isFetchingNextPage={isFetchingNextPage}
        hasMore={hasNextPage}
        onLoadMore={handleLoadMore}
        onSearch={handleSearch}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        onDelete={handleDelete}
        isDeleting={isDeleting}
        sortBy={sort}
        sortOrder={order}
        onSortChange={handleSortChange}
      />
    </Layout>
  );
};

export default DevicesPage;
