import { DeviceSpecifications } from "@/src/components/dashboard/device/views/components/DeviceSpecifications/DeviceSpecifications";
import ImportSpecs from "@/src/components/dashboard/device/views/components/ImportSpecs";
import { api } from "@/src/utils/api";
import type {
  Device,
  DeviceCharacteristics,
  Screen,
  Camera,
  Sku,
  Benchmark,
} from "@/src/server/db/schema";
import type {
  ExtendedDeviceCharacteristics,
  DeviceSpecsFormValues,
} from "@/src/components/dashboard/device/views/types";
import type { PublishStatus } from "@/src/constants/publishStatus";

type CharacteristicsWithRelations = DeviceCharacteristics & {
  screens?: Screen[];
  cameras?: Camera[];
  skus?: Sku[];
  benchmarks?: Benchmark[];
};

interface SpecificationsEditorSectionProps {
  characteristics: CharacteristicsWithRelations | null;
  isLoading?: boolean;
  deviceId: string;
  device: Device;
}

export function SpecificationsEditorSection({
  characteristics,
  isLoading,
  deviceId,
  device,
}: SpecificationsEditorSectionProps) {
  const utils = api.useUtils();

  const updateMutation = api.device.updateDeviceSpecsAndRelated.useMutation({
    onSuccess: () => {
      void utils.device.getDeviceCharacteristic.invalidate();
    },
  });

  const deleteMutation = api.device.deleteDeviceCharacteristics.useMutation({
    onSuccess: () => {
      void utils.device.getDeviceCharacteristic.invalidate();
    },
  });

  const statusMutation =
    api.device.updateDeviceCharacteristicsStatus.useMutation({
      onSuccess: () => {
        void utils.device.getDeviceCharacteristic.invalidate();
      },
    });

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-8 dark:border-gray-800 dark:bg-[hsl(0_0%_9%)]">
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          Загрузка спецификаций...
        </div>
      </div>
    );
  }

  if (!characteristics) {
    return (
      <div className="rounded-lg border bg-white dark:border-gray-800 dark:bg-[hsl(0_0%_9%)]">
        <ImportSpecs device={device} />
      </div>
    );
  }

  // Convert our characteristics to the format expected by DeviceSpecifications
  const extendedCharacteristics: ExtendedDeviceCharacteristics = {
    ...characteristics,
    screens: characteristics.screens || [],
    cameras: characteristics.cameras || [],
    skus: characteristics.skus || [],
    benchmarks: characteristics.benchmarks || [],
  };

  const handleSubmit = async (data: DeviceSpecsFormValues) => {
    await updateMutation.mutateAsync({
      id: characteristics.id,
      ...data,
    });
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync({ deviceId });
  };

  const handleStatusChange = async (status: PublishStatus) => {
    await statusMutation.mutateAsync({ id: characteristics.id, status });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-[hsl(0_0%_9%)]">
      <DeviceSpecifications
        initialData={extendedCharacteristics}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        isDeleting={deleteMutation.isPending}
        onStatusChange={handleStatusChange}
        isUpdatingStatus={statusMutation.isPending}
      />
    </div>
  );
}
