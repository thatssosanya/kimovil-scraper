import {
  type ChangeEvent,
  useState,
  useEffect,
  useCallback,
  memo,
} from "react";
import { Search } from "lucide-react";
import { Input } from "../../../Input";
import { useDebounce } from "@/src/hooks/useDebounce";

interface DataTableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const DataTableSearch = memo(function DataTableSearch({
  value,
  onChange,
  placeholder = "Поиск...",
}: DataTableSearchProps) {
  const [searchValue, setSearchValue] = useState(value);
  const debouncedValue = useDebounce(searchValue, 300);

  useEffect(() => {
    onChange(debouncedValue);
  }, [debouncedValue, onChange]);

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchValue(event.target.value);
  }, []);

  return (
    <div className="relative max-w-md flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-gray-400" />
      <Input
        placeholder={placeholder}
        value={searchValue ?? ""}
        onChange={handleChange}
        className="h-8 pl-9 shadow-none dark:shadow-none dark:bg-[hsl(0_0%_7%)] dark:text-gray-200 dark:border-gray-800 dark:placeholder:text-gray-500"
      />
    </div>
  );
});
