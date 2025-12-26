import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import Link from "next/link";

interface DevicePageErrorProps {
  error?: { message: string } | null;
  retry?: () => void;
}

export const DevicePageError = ({ error, retry }: DevicePageErrorProps) => {
  return (
    <div className="mt-14 flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
        <AlertTriangle className="h-10 w-10 text-red-500 dark:text-red-400" />
      </div>
      
      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Устройство не найдено
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          {error?.message || 
           "Запрашиваемое устройство не существует или было удалено. Попробуйте найти другое устройство в каталоге."}
        </p>
      </div>

      <div className="flex gap-3">
        {retry && (
          <Button
            onClick={retry}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Попробовать снова
          </Button>
        )}
        
        <Link href="/ratings">
          <Button className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Перейти к рейтингам
          </Button>
        </Link>
      </div>
    </div>
  );
};