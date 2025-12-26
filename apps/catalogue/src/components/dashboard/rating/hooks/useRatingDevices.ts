import { useState } from "react";
import { type DeviceWithFullDetails } from "@/src/types/rating";
import useRatingStore from "@/src/stores/ratingStore";

interface DeviceReplacement {
  device: DeviceWithFullDetails | null;
  ratingId: string;
}

export const useRatingDevices = () => {
  const [deviceToReplace, setDeviceToReplace] =
    useState<DeviceReplacement | null>(null);
  const store = useRatingStore();

  const handleReplaceDevice = (newDeviceId: string) => {
    if (!deviceToReplace) return;

    const { device, ratingId } = deviceToReplace;
    if (device) {
      // Replace existing device
      store.replaceDevice(ratingId, device.id, newDeviceId);
    } else {
      // Add new device
      store.addDevice(ratingId, newDeviceId);
    }
    setDeviceToReplace(null);
  };

  const handleAddDevice = (ratingId: string) => {
    setDeviceToReplace({ ratingId, device: null });
  };

  return {
    deviceToReplace,
    setDeviceToReplace,
    handleReplaceDevice,
    handleAddDevice,
  };
};
