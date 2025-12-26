import { InfoCard } from "../shared";
import type { DeviceCharacteristics } from "@/src/server/db/schema";

interface SpecificationsSectionProps {
  characteristics: DeviceCharacteristics | null;
  isLoading?: boolean;
}

export function SpecificationsSection({ 
  characteristics,
  isLoading
}: SpecificationsSectionProps) {
  if (isLoading) {
    return (
      <InfoCard>
        <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
          Загрузка спецификаций...
        </div>
      </InfoCard>
    );
  }

  if (!characteristics) {
    return (
      <InfoCard>
        <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
          Спецификации отсутствуют
        </div>
      </InfoCard>
    );
  }

  // Simple read-only view - this is now replaced by SpecificationsEditorSection
  return (
    <InfoCard>
      <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
        Используйте новый редактор спецификаций
      </div>
    </InfoCard>
  );
}
