import React from "react";
import { type DeviceViewProps } from "./types/index";
import { DeviceHeader } from "./components/DeviceHeader";
import { DeviceDescription } from "./components/DeviceDescription";
import { LinksSection } from "./components/LinksSection";
import { DeviceSpecifications } from "./components/DeviceSpecifications/DeviceSpecifications";
import { api } from "@/src/utils/api";
import { type DeviceSpecsFormValues } from "./types";
import ImportSpecs from "./components/ImportSpecs";
import { useScraperManager } from "@/src/components/dashboard/scraping/hooks/useScraper";
import { EditableProsAndCons } from "./components/EditableProsAndCons";

const DeviceView = ({ device }: DeviceViewProps) => {
  // Initialize scraping manager with the selected device
  useScraperManager(device || undefined);

  if (!device) return null;

  const { data: deviceIds, isPending: isDeviceIdsLoading } =
    api.device.getSmartphoneIdsWhereCharacteristicsExist.useQuery(undefined, {
      refetchInterval: 5000, // Refetch every 5 seconds
    });

  const {
    data: deviceCharacteristics,
    isLoading: isDataLoading,
    refetch,
  } = api.device.getDeviceCharacteristic.useQuery({
    deviceId: device.id,
  });

  const updateMutation = api.device.updateDeviceSpecsAndRelated.useMutation({
    onSuccess: () => void refetch(),
  });

  const deleteMutation = api.device.deleteDeviceCharacteristics.useMutation({
    onSuccess: () => void refetch(),
  });

  const updateStatusMutation = api.device.updateDeviceCharacteristicsStatus.useMutation({
    onSuccess: () => void refetch(),
  });

  const handleSpecsSubmit = async (data: DeviceSpecsFormValues) => {
    if (!deviceCharacteristics?.id) return;
    await updateMutation.mutateAsync({
      id: deviceCharacteristics.id,
      ...data,
    });
  };

  const handleSpecsDelete = async () => {
    if (!device.id) return;
    await deleteMutation.mutateAsync({
      deviceId: device.id,
    });
  };

  const handleStatusChange = async (status: string) => {
    if (!deviceCharacteristics?.id) return;
    await updateStatusMutation.mutateAsync({
      id: deviceCharacteristics.id,
      status: status as "DRAFT" | "PUBLISHED" | "PRIVATE" | "ARCHIVED",
    });
  };

  const isLoading =
    isDeviceIdsLoading ||
    (isDataLoading && (!deviceIds || deviceIds?.includes(device.id)));

  return (
    <div className="w-full flex-col space-y-6 pb-4">
      <DeviceHeader device={device} />
      <DeviceDescription device={device} />
      {isLoading ? (
        <DeviceSpecifications
          initialData={null}
          isLoading={true}
          onSubmit={handleSpecsSubmit}
          onDelete={handleSpecsDelete}
          isDeleting={deleteMutation.isPending}
        />
      ) : deviceCharacteristics ? (
        <DeviceSpecifications
          initialData={deviceCharacteristics}
          isLoading={false}
          onSubmit={handleSpecsSubmit}
          onDelete={handleSpecsDelete}
          isDeleting={deleteMutation.isPending}
          onStatusChange={handleStatusChange}
          isUpdatingStatus={updateStatusMutation.isPending}
        />
      ) : (
        <ImportSpecs device={device} />
      )}
      <EditableProsAndCons deviceId={device.id} />
      <LinksSection device={device} />
    </div>
  );
};

export default DeviceView;
