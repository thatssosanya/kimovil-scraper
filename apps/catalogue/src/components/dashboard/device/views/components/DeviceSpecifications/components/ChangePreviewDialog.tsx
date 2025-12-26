import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import { type DeviceSpecsFormValues, type DirtyFields } from "../../../types";
import {
  ChevronDown,
  ChevronUp,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  XCircleIcon,
} from "lucide-react";

import { useState } from "react";
import {
  type RelatedChanges,
  type RelatedKey,
  getItemSummary,
} from "../utils/utils";

// Define a Screen type to match the form structure
interface Screen {
  id: string;
  position?: string;
  size_in?: number | null;
  displayType?: string;
  resolution?: string;
  aspectRatio?: string;
  ppi?: number | null;
  displayFeatures?: string;
  refreshRate?: number | null;
  brightnessNits?: number | null;
  isMain?: boolean;
}

type ChangePreviewDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  dirtyFields: DirtyFields;
  relatedChanges: RelatedChanges;
  currentValues: DeviceSpecsFormValues;
  initialValues?: DeviceSpecsFormValues;
  onReset: (field: keyof DeviceSpecsFormValues) => void;
};

type RelatedChange = RelatedChanges[RelatedKey];

type RelatedChangesSummaryProps<T extends RelatedKey> = {
  type: T;
  changes: RelatedChange;
  values: NonNullable<DeviceSpecsFormValues[T]>;
  initialValues: DeviceSpecsFormValues[T];
  label: string;
};

const fieldNames: Record<string, string> = {
  name: "Название",
  brand: "Бренд",
  aliases: "Альтернативные названия",
  releaseDate: "Дата выхода",
  height_mm: "Высота",
  width_mm: "Ширина",
  thickness_mm: "Толщина",
  weight_g: "Вес",
  materials: "Материалы",
  colors: "Цвета",
  ipRating: "IP",
  // Display fields are now in screens
  cpu: "CPU",
  cpuManufacturer: "Производитель CPU",
  cpuCores: "Ядра CPU",
  gpu: "GPU",
  sdSlot: "SD-карта",
  fingerprintPosition: "Сканер отпечатка",
  nfc: "NFC",
  headphoneJack: "3.5mm",
  sim: "SIM",
  simCount: "Количество SIM",
  batteryCapacity_mah: "Ёмкость батареи",
  batteryFastCharging: "Быстрая зарядка",
  batteryWattage: "Мощность зарядки",
  cameraFeatures: "Особенности камер",
  os: "Операционная система",
  osSkin: "Оболочка ОС",
};

// Screen-specific field labels
const screenFieldNames: Record<string, string> = {
  position: "Позиция",
  size_in: "Диагональ (дюймы)",
  displayType: "Тип дисплея",
  resolution: "Разрешение",
  aspectRatio: "Соотношение сторон",
  ppi: "PPI",
  refreshRate: "Частота обновления (Гц)",
  brightnessNits: "Яркость (нит)",
  displayFeatures: "Особенности дисплея",
  isMain: "Основной экран",
};

const relatedModelFieldNames: Record<string, string> = {
  name: "Название",
  score: "Результат",
  marketId: "Регион",
  ram_gb: "RAM",
  storage_gb: "ROM",
  type: "Тип",
  resolution_mp: "Разрешение",
  aperture_fstop: "Диафрагма",
  sensor: "Сенсор",
  features: "Особенности",
};
const formatFieldName = (field: string): string =>
  fieldNames[field] ||
  screenFieldNames[field] ||
  relatedModelFieldNames[field] ||
  field;

const formatValue = (_: unknown, value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (value === "") return "—";
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (value instanceof Date) return value.toLocaleDateString("ru-RU");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "[Complex Object]";
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value);
};

function RelatedChangesSummary<T extends RelatedKey>({
  type,
  changes,
  values,
  initialValues,
  label,
}: RelatedChangesSummaryProps<T>) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChanges =
    changes.added.length > 0 ||
    changes.removed.length > 0 ||
    changes.modified.length > 0;

  if (!hasChanges) return null;

  const getItemSummaryForType = (id: string) => {
    const item = [...values, ...(initialValues || [])]?.find(
      (item) => item.id === id
    );
    if (!item) return "Unknown";

    return getItemSummary(item, type);
  };

  return (
    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {label}
          </span>
          <div className="flex items-center gap-2 text-xs">
            {changes.added.length > 0 && (
              <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-green-700 dark:text-green-300">
                +{changes.added.length}
              </span>
            )}
            {changes.removed.length > 0 && (
              <span className="rounded-full bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-zinc-500 dark:text-zinc-400">
                -{changes.removed.length}
              </span>
            )}
            {changes.modified.length > 0 && (
              <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                ~{changes.modified.length}
              </span>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2 pl-1">
          {changes.added.map((id) => (
            <div
              key={`added-${id}`}
              className="flex items-center gap-2 text-sm text-zinc-900 dark:text-zinc-100"
            >
              <PlusIcon className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              {getItemSummaryForType(id)}
            </div>
          ))}
          {changes.removed.map((id) => (
            <div
              key={`removed-${id}`}
              className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 line-through"
            >
              <MinusIcon className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
              {getItemSummaryForType(id)}
            </div>
          ))}
          {changes.modified.map(({ id, fields }) => (
            <div
              key={`modified-${id}`}
              className="flex items-center gap-2 text-sm text-zinc-900 dark:text-zinc-100"
            >
              <PencilIcon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>
                {getItemSummaryForType(id)}
                <span className="ml-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  ({fields.map((field) => formatFieldName(field)).join(", ")})
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Component to display screen changes
type ScreenChangesSummaryProps = {
  currentValues: DeviceSpecsFormValues;
  initialValues?: DeviceSpecsFormValues;
  dirtyFields: DirtyFields;
};

function ScreenChangesSummary({
  currentValues,
  initialValues,
  dirtyFields,
}: ScreenChangesSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract screens from values
  const currentScreens = (currentValues?.screens || []) as Screen[];
  const initialScreens = (initialValues?.screens || []) as Screen[];

  // Extract dirty fields for screens
  const screensDirty = dirtyFields.screens as
    | Record<number, Record<string, boolean>>
    | undefined;

  // Filter out system fields and check if there are real user-visible changes
  const hasScreenChanges =
    screensDirty &&
    Object.entries(screensDirty).some(([_, fields]) => {
      // Get field names that are dirty but exclude system fields
      const userVisibleChanges = Object.keys(fields).filter(
        (field) => !["createdAt", "updatedAt"].includes(field)
      );
      return userVisibleChanges.length > 0;
    });

  // Determine if screens have been added or removed
  const hasAddedScreens = currentScreens.length > initialScreens.length;
  const hasRemovedScreens = currentScreens.length < initialScreens.length;

  // Skip rendering if no changes
  if (!hasScreenChanges && !hasAddedScreens && !hasRemovedScreens) return null;

  // Create a summary of screen changes
  const getScreenSummary = (screen: Screen): string => {
    const position = screen.position || "Экран";
    const size = screen.size_in ? `${screen.size_in}"` : "";
    const type = screen.displayType || "";
    const resolution = screen.resolution || "";

    // Combine details that exist
    const details = [size, type, resolution].filter(Boolean).join(", ");

    return details ? `${position} (${details})` : position;
  };

  return (
    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Экраны
          </span>
          <div className="flex items-center gap-2 text-xs">
            {hasAddedScreens && (
              <span className="rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-green-700 dark:text-green-300">
                +{currentScreens.length - initialScreens.length}
              </span>
            )}
            {hasRemovedScreens && (
              <span className="rounded-full bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-zinc-500 dark:text-zinc-400">
                -{initialScreens.length - currentScreens.length}
              </span>
            )}
            {!hasAddedScreens && !hasRemovedScreens && hasScreenChanges && (
              <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                изменено
              </span>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2 pl-1">
          {/* Added screens */}
          {hasAddedScreens &&
            currentScreens.slice(initialScreens.length).map((screen, idx) => (
              <div
                key={`added-screen-${idx}`}
                className="flex items-center gap-2 text-sm text-zinc-900 dark:text-zinc-100"
              >
                <PlusIcon className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                {getScreenSummary(screen)}
              </div>
            ))}

          {/* Removed screens */}
          {hasRemovedScreens &&
            initialScreens.slice(currentScreens.length).map((screen, idx) => (
              <div
                key={`removed-screen-${idx}`}
                className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 line-through"
              >
                <MinusIcon className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                {getScreenSummary(screen)}
              </div>
            ))}

          {/* Modified screens */}
          {screensDirty &&
            Object.entries(screensDirty).map(([indexStr, dirtyFieldsObj]) => {
              const index = parseInt(indexStr, 10);
              const screen = currentScreens[index];
              const initialScreen = initialScreens[index];

              if (!screen || !dirtyFieldsObj) return null;

              const modifiedFields = Object.keys(dirtyFieldsObj).filter(
                (field) => !["createdAt", "updatedAt"].includes(field)
              );

              if (modifiedFields.length === 0) return null;

              return (
                <div key={`modified-screen-${index}`} className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-zinc-900 dark:text-zinc-100">
                    <PencilIcon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    <span>{getScreenSummary(screen)}</span>
                  </div>
                  <div className="ml-5 space-y-1">
                    {modifiedFields.map((field) => {
                      let initialValue: unknown;
                      let currentValue: unknown;

                      if (initialScreen && field in initialScreen) {
                        initialValue = initialScreen[field as keyof Screen];
                      }
                      if (field in screen) {
                        currentValue = screen[field as keyof Screen];
                      }

                      return (
                        <div
                          key={`field-${field}`}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className="text-zinc-500 dark:text-zinc-400 w-28 shrink-0">
                            {formatFieldName(field)}
                          </span>
                          <span className="text-zinc-400 dark:text-zinc-500 line-through">
                            {formatValue(field, initialValue)}
                          </span>
                          <span className="text-zinc-400 dark:text-zinc-500">
                            →
                          </span>
                          <span className="text-zinc-900 dark:text-zinc-100">
                            {formatValue(field, currentValue)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

export const ChangePreviewDialog = ({
  isOpen,
  onClose,
  dirtyFields,
  relatedChanges,
  currentValues,
  initialValues,
  onReset,
}: ChangePreviewDialogProps) => {
  const pipeDelimitedFields = [
    "aliases",
    "materials",
    "colors",
    "displayFeatures",
    "cpuCores",
    "sim",
    "cameraFeatures",
  ];

  const simpleChanges = Object.entries(dirtyFields)
    .filter(
      ([key, value]) =>
        ![
          "cameras",
          "skus",
          "benchmarks",
          "screens",
          ...pipeDelimitedFields,
        ].includes(key) && value === true
    )
    .map(([key]) => key);

  const arrayChanges = pipeDelimitedFields.reduce((acc, field) => {
    if (dirtyFields[field]) {
      const initialArray = (initialValues?.[field] as string)?.split("|") || [];
      const currentArray = (currentValues?.[field] as string)?.split("|") || [];

      const added = currentArray.filter((item) => !initialArray.includes(item));
      const removed = initialArray.filter(
        (item) => !currentArray.includes(item)
      );

      if (added.length > 0 || removed.length > 0) {
        acc.push({
          key: field,
          label: formatFieldName(field),
          added: added.filter(Boolean),
          removed: removed.filter(Boolean),
        });
      }
    }
    return acc;
  }, [] as { key: string; label: string; added: string[]; removed: string[] }[]);

  const relatedSummaryItems = [
    { key: "cameras", label: "Камеры" },
    { key: "skus", label: "Конфигурации" },
    { key: "benchmarks", label: "Бенчмарки" },
  ] as { key: RelatedKey; label: string }[];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-auto">
        <DialogHeader className="pb-4 border-b border-zinc-200 dark:border-zinc-700">
          <DialogTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Несохранённые изменения
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-4">
          {/* Screen changes */}
          <ScreenChangesSummary
            currentValues={currentValues}
            initialValues={initialValues}
            dirtyFields={dirtyFields}
          />

          {/* Related model changes */}
          {relatedSummaryItems.map(({ key, label }) => (
            <RelatedChangesSummary
              key={key}
              type={key}
              changes={relatedChanges[key]}
              values={currentValues?.[key] || []}
              initialValues={initialValues?.[key]}
              label={label}
            />
          ))}

          {/* Array field changes */}
          {arrayChanges.map(({ key, label, added, removed }) => (
            <div key={key} className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3">
              <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">{label}</div>
              <div className="flex flex-wrap gap-2">
                {removed.map((item) => (
                  <span
                    key={`removed-${key}-${item}`}
                    className="inline-flex items-center gap-1 rounded bg-zinc-200 dark:bg-zinc-700 px-2 py-1 text-sm text-zinc-500 dark:text-zinc-400 line-through"
                  >
                    {item}
                  </span>
                ))}
                {added.map((item) => (
                  <span
                    key={`added-${key}-${item}`}
                    className="inline-flex items-center gap-1 rounded bg-zinc-200 dark:bg-zinc-700 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-100 font-medium"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {/* Simple field changes */}
          {simpleChanges.map((field) => (
            <div
              key={field}
              className="group flex items-center justify-between gap-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3"
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400 w-32 shrink-0">
                  {formatFieldName(field)}
                </div>
                <div className="flex items-center gap-2 text-sm min-w-0">
                  {initialValues?.[field] && (
                    <>
                      <span className="text-zinc-400 dark:text-zinc-500 line-through truncate">
                        {formatValue(field, initialValues?.[field])}
                      </span>
                      <span className="text-zinc-400 dark:text-zinc-500">→</span>
                    </>
                  )}
                  <span className="text-zinc-900 dark:text-zinc-100 font-medium truncate">
                    {formatValue(field, currentValues[field])}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onReset(field)}
                className="opacity-0 transition-opacity group-hover:opacity-100 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                title="Отменить изменение"
              >
                <XCircleIcon className="h-4 w-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
              </button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
