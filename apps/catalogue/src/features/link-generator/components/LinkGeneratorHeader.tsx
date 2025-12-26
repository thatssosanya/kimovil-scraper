import { Link2 } from "lucide-react";

export function LinkGeneratorHeader() {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2">
        <Link2 className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Генератор ссылок</h1>
      </div>
      <p className="mt-2 max-w-2xl text-center text-muted-foreground">
        Анализируйте и создавайте партнерские ссылки для Яндекс.Маркета.
        Поддерживаются как обычные, так и сокращенные ссылки.
      </p>
    </div>
  );
}
