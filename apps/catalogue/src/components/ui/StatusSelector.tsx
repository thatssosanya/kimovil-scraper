import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/Select";
import { Badge } from "@/src/components/ui/Badge";
import {
  PUBLISH_STATUS,
  PUBLISH_STATUS_LABELS,
  PUBLISH_STATUS_DESCRIPTIONS,
  type PublishStatus,
} from "@/src/constants/publishStatus";
import { cn } from "@/src/lib/utils";

interface StatusSelectorProps {
  value: PublishStatus;
  onValueChange: (value: PublishStatus) => void;
  className?: string;
  disabled?: boolean;
}

const getStatusColor = (status: PublishStatus) => {
  switch (status) {
    case PUBLISH_STATUS.PUBLISHED:
      return "bg-green-100 text-green-800 hover:bg-green-200";
    case PUBLISH_STATUS.DRAFT:
      return "bg-gray-100 text-gray-800 hover:bg-gray-200";
    case PUBLISH_STATUS.PRIVATE:
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200";
    case PUBLISH_STATUS.ARCHIVED:
      return "bg-red-100 text-red-800 hover:bg-red-200";
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-200";
  }
};

export const StatusSelector = ({
  value,
  onValueChange,
  className,
  disabled = false,
}: StatusSelectorProps) => {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={cn("h-10 w-[180px] border-none  ", className)}>
        <SelectValue>
          <Badge
            variant="secondary"
            className={cn("mr-2 text-xs", getStatusColor(value))}
          >
            {PUBLISH_STATUS_LABELS[value]}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.values(PUBLISH_STATUS).map((status) => (
          <SelectItem key={status} value={status}>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className={cn("text-xs", getStatusColor(status))}
                >
                  {PUBLISH_STATUS_LABELS[status]}
                </Badge>
              </div>
              <span className="mt-1 text-xs text-muted-foreground">
                {PUBLISH_STATUS_DESCRIPTIONS[status]}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

interface StatusBadgeProps {
  status: PublishStatus;
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  return (
    <Badge
      variant="secondary"
      className={cn("text-xs", getStatusColor(status), className)}
    >
      {PUBLISH_STATUS_LABELS[status]}
    </Badge>
  );
};
