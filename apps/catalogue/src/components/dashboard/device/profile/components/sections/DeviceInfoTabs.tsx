import { useState } from "react";
import { DeviceTable } from "./DeviceTable";
import { SpecificationsEditorSection } from "./SpecificationsEditorSection";
import type { DeviceCharacteristics, Screen, Camera, Sku, Benchmark } from "@/src/server/db/schema";
import type { DeviceProfileData } from "../../types";

type CharacteristicsWithRelations = DeviceCharacteristics & {
  screens?: Screen[];
  cameras?: Camera[];
  skus?: Sku[];
  benchmarks?: Benchmark[];
};

interface DeviceInfoTabsProps {
  device: DeviceProfileData;
  onSave: (updates: Record<string, unknown>) => void;
  isLoading?: boolean;
  characteristics: CharacteristicsWithRelations | null;
  isLoadingCharacteristics?: boolean;
}

export function DeviceInfoTabs({ 
  device, 
  onSave, 
  isLoading,
  characteristics,
  isLoadingCharacteristics
}: DeviceInfoTabsProps) {
  const [activeTab, setActiveTab] = useState("basic");

  return (
    <div className="w-full">
      {/* Minimal Tab Navigation */}
      <div className="flex items-center gap-6 mb-3">
        <button
          onClick={() => setActiveTab("basic")}
          className={`text-sm font-medium transition-colors ${
            activeTab === "basic" 
              ? "text-gray-900 dark:text-gray-200" 
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Основное
        </button>
        <button
          onClick={() => setActiveTab("specs")}
          className={`text-sm font-medium transition-colors ${
            activeTab === "specs" 
              ? "text-gray-900 dark:text-gray-200" 
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          Спецификации
        </button>
      </div>
      
      {/* Tab Content */}
      {activeTab === "basic" && (
        <DeviceTable
          device={device}
          onSave={onSave}
          isLoading={isLoading}
        />
      )}
      
      {activeTab === "specs" && (
        <SpecificationsEditorSection
          characteristics={characteristics}
          isLoading={isLoadingCharacteristics}
          deviceId={device.id}
          device={device}
        />
      )}
    </div>
  );
}