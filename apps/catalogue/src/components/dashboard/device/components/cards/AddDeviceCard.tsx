import { Plus } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/Button";

interface AddDeviceCardProps {
  position: number;
  onClick: () => void;
  className?: string;
}

export const AddDeviceCard = ({
  position,
  onClick,
  className,
}: AddDeviceCardProps) => {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={cn(
        "group relative flex h-[88px] w-full items-center gap-3 rounded-lg border bg-white p-3 shadow-sm transition-all hover:bg-muted/5 hover:shadow-md",
        className
      )}
    >
      {/* Position indicator */}
      <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border bg-background text-sm font-medium">
        {position}
      </div>

      {/* Add icon */}
      <div className="relative flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-lg border bg-white/50">
        <Plus className="h-6 w-6 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1 text-left">
        <div className="font-medium text-muted-foreground transition-colors group-hover:text-primary">
          Добавить устройство
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Нажмите, чтобы добавить новое устройство в рейтинг
        </div>
      </div>
    </Button>
  );
};
