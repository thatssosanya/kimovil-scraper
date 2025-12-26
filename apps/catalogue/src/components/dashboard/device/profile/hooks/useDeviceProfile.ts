import { useState } from "react";
import { api } from "@/src/utils/api";
import type { DeviceProfileData } from "../types";

export function useDeviceProfile(deviceId: string) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);

  const deviceQuery = api.device.getDevice.useQuery(
    { deviceId },
    {
      enabled: !!deviceId,
    }
  );

  const characteristicsQuery = api.device.getDeviceCharacteristic.useQuery(
    { deviceId },
    {
      enabled: !!deviceId,
      refetchOnWindowFocus: false,
      staleTime: 120000, // 2 minutes
    }
  );

  const updateDeviceMutation = api.device.updateDevice.useMutation({
    onSuccess: () => {
      void deviceQuery.refetch();
      void characteristicsQuery.refetch();
      setIsEditing(false);
      setEditingSection(null);
    },
  });

  const device = deviceQuery.data as DeviceProfileData | undefined;

  return {
    device,
    characteristics: characteristicsQuery.data,
    isLoading: deviceQuery.isLoading,
    isLoadingCharacteristics: characteristicsQuery.isLoading,
    error: deviceQuery.error,
    characteristicsError: characteristicsQuery.error,
    isEditing,
    setIsEditing,
    editingSection,
    setEditingSection,
    updateDevice: updateDeviceMutation.mutate,
    isUpdating: updateDeviceMutation.isPending,
    refetch: deviceQuery.refetch,
    refetchCharacteristics: characteristicsQuery.refetch,
  };
}