import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { ExternalLink, Copy, Calendar, Percent } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type { AliExpressTableItem } from "@/src/types/aliexpress";

export const aliExpressTableColumns: ColumnDef<AliExpressTableItem>[] = [
  {
    accessorKey: "name",
    header: "Название товара",
    cell: ({ row }) => {
      const name = row.getValue("name");
      const url = row.original.url;

      return (
        <div className="flex flex-col gap-1">
          <div className="text-sm font-medium">
            {(name as string) || "Без названия"}
          </div>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex max-w-[300px] items-center gap-1 truncate text-xs text-muted-foreground hover:text-primary"
              title={url}
            >
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
              {url}
            </a>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => void navigator.clipboard.writeText(url)}
              title="Копировать ссылку"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "commissionRate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 font-semibold hover:bg-transparent"
        >
          <Percent className="mr-2 h-4 w-4" />
          Комиссия
        </Button>
      );
    },
    cell: ({ row }) => {
      const commissionRate = row.getValue("commissionRate");

      if (!commissionRate) {
        return (
          <Badge variant="secondary" className="text-xs">
            Не определена
          </Badge>
        );
      }

      const rate = parseFloat(commissionRate as string);
      const variant =
        rate >= 5 ? "default" : rate >= 3 ? "secondary" : "outline";

      return (
        <Badge variant={variant} className="text-xs font-medium">
          {rate.toFixed(2)}%
        </Badge>
      );
    },
    sortingFn: (rowA, rowB) => {
      const a = rowA.getValue("commissionRate");
      const b = rowB.getValue("commissionRate");

      // Handle null values - put them at the end
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;

      return parseFloat(a as string) - parseFloat(b as string);
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 font-semibold hover:bg-transparent"
        >
          <Calendar className="mr-2 h-4 w-4" />
          Добавлено
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = row.getValue("createdAt");
      return (
        <div className="text-sm text-muted-foreground">
          {format(date as Date, "dd MMM yyyy", { locale: ru })}
        </div>
      );
    },
  },
  {
    accessorKey: "updatedAt",
    header: "Обновлено",
    cell: ({ row }) => {
      const date = row.getValue("updatedAt");
      return (
        <div className="text-sm text-muted-foreground">
          {format(date as Date, "dd MMM yyyy", { locale: ru })}
        </div>
      );
    },
  },
];
