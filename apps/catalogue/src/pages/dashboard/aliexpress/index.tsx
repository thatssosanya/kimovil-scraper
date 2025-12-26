import React, { useState, useMemo } from "react";
import Layout from "@/src/components/dashboard/layout/Layout";
import { DataTable } from "@/src/components/ui/data-table/DataTable";
// Using div-based card structure
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { RefreshCw, Package, TrendingUp, AlertCircle } from "lucide-react";
import { api } from "@/src/utils/api";
import { aliExpressTableColumns } from "@/src/features/aliexpress/components/AliExpressTableColumns";
import type {
  AliExpressTableItem,
  AliExpressSortField,
  SortOrder,
} from "@/src/types/aliexpress";

const AliExpressPage = () => {
  const [search, setSearch] = useState("");
  const [sortBy, _setSortBy] = useState<AliExpressSortField>("commissionRate");
  const [sortOrder, _setSortOrder] = useState<SortOrder>("desc");

  // Fetch AliExpress items with pagination and search
  const {
    data: itemsData,
    isLoading: isLoadingItems,
    refetch: refetchItems,
  } = api.aliexpress.getAllItems.useQuery({
    limit: 50,
    search: search || undefined,
    sortBy,
    sortOrder,
  });

  // Fetch statistics
  const {
    data: stats,
    isLoading: isLoadingStats,
    refetch: refetchStats,
  } = api.aliexpress.getStats.useQuery();

  const items = itemsData?.items || [];

  // Handle search with debouncing
  const handleSearch = (value: string) => {
    setSearch(value);
  };

  // Handle refresh
  const handleRefresh = () => {
    void refetchItems();
    void refetchStats();
  };

  // Statistics cards data
  const statsCards = useMemo(() => {
    if (!stats) return [];

    return [
      {
        title: "Всего товаров",
        value: stats.total,
        description: "Общее количество товаров AliExpress",
        icon: Package,
        color: "text-blue-600",
        bgColor: "bg-blue-50",
      },
      {
        title: "С комиссией",
        value: stats.withCommission,
        description: `${((stats.withCommission / stats.total) * 100).toFixed(
          1
        )}% от общего количества`,
        icon: TrendingUp,
        color: "text-green-600",
        bgColor: "bg-green-50",
      },
      {
        title: "С названиями",
        value: stats.withNames,
        description: `${((stats.withNames / stats.total) * 100).toFixed(
          1
        )}% товаров имеют названия`,
        icon: Package,
        color: "text-purple-600",
        bgColor: "bg-purple-50",
      },
      {
        title: "Требуют обновления",
        value: stats.withoutCommission,
        description: "Товары без данных о комиссии",
        icon: AlertCircle,
        color: "text-orange-600",
        bgColor: "bg-orange-50",
      },
    ];
  }, [stats]);

  return (
    <Layout>
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                AliExpress товары
              </h1>
              <p className="text-muted-foreground">
                Управление товарами AliExpress и данными о комиссии
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoadingItems || isLoadingStats}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${
                    isLoadingItems || isLoadingStats ? "animate-spin" : ""
                  }`}
                />
                Обновить
              </Button>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statsCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.title}
                  className="rounded-lg border bg-card p-6 shadow-sm"
                >
                  <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <h3 className="text-sm font-medium">{stat.title}</h3>
                    <div className={`rounded-md p-2 ${stat.bgColor}`}>
                      <Icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">
                      {isLoadingStats ? (
                        <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                      ) : (
                        stat.value.toLocaleString()
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {stat.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Data Table */}
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="p-6 pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Список товаров</h2>
                  <p className="text-sm text-muted-foreground">
                    Просмотр и управление товарами AliExpress с данными о
                    комиссии
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {items.length} товаров
                  </Badge>
                </div>
              </div>
            </div>
            <div className="p-6 pt-0">
              <DataTable<AliExpressTableItem>
                data={items}
                columns={aliExpressTableColumns}
                searchable={true}
                sortable={true}
                filterable={true}
                searchPlaceholder="Поиск по названию или URL..."
                isLoading={isLoadingItems}
                onSearch={handleSearch}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AliExpressPage;
