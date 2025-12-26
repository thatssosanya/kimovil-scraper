import { useState, useEffect } from "react";
import { api } from "@/src/utils/api";
import { type RouterOutputs } from "@/src/utils/api";

export function useDeviceValueRating(deviceId: string) {
  const utils = api.useUtils();
  const { data: deviceData } = api.device.getDevice.useQuery(
    { deviceId },
    { refetchOnWindowFocus: false }
  );

  const [pendingValue, setPendingValue] = useState<number>(
    deviceData?.valueRating ?? 0
  );

  useEffect(() => {
    if (deviceData?.valueRating != null)
      setPendingValue(deviceData.valueRating);
  }, [deviceData?.valueRating]);

  const updateValueMutation = api.device.updateDeviceValueRating.useMutation({
    onMutate: async (newValue) => {
      await utils.device.getDevice.cancel({ deviceId });
      const previous = utils.device.getDevice.getData({ deviceId });
      utils.device.getDevice.setData({ deviceId }, (old) =>
        old ? { ...old, valueRating: newValue.value } : old
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous)
        utils.device.getDevice.setData({ deviceId }, ctx.previous);
    },
    onSuccess: (_data, variables) => {
      setPendingValue(variables.value);
      void utils.device.getDevice.invalidate({ deviceId });
    },
  });

  const confirm = () =>
    updateValueMutation.mutate({ deviceId, value: pendingValue });

  const deviceRatingsQuery = api.rating.getDeviceRatings.useQuery(
    { deviceId },
    { enabled: !!deviceId }
  );

  return {
    currentValue: deviceData?.valueRating ?? 0,
    pendingValue,
    setPendingValue,
    isSaving: updateValueMutation.isPending,
    confirm,
    deviceRatings: deviceRatingsQuery.data,
    isDeviceRatingsLoading: deviceRatingsQuery.isPending,
  } as const;
}

type DeviceRating = RouterOutputs["rating"]["getDeviceRatings"][number];
export type { DeviceRating };

export function useProsCons(deviceId: string) {
  const utils = api.useUtils();
  const { data, isPending } = api.device.getDeviceProsAndCons.useQuery(
    { deviceId },
    { refetchOnWindowFocus: false }
  );

  const invalidate = () =>
    utils.device.getDeviceProsAndCons.invalidate({ deviceId });

  const addMutation = api.device.addProsCons.useMutation({
    onSuccess: invalidate,
  });
  const updateMutation = api.device.updateProsCons.useMutation({
    onSuccess: invalidate,
  });
  const deleteMutation = api.device.deleteProsCons.useMutation({
    onSuccess: invalidate,
  });

  return {
    pros: data?.pros ?? [],
    cons: data?.cons ?? [],
    isPending,
    add: addMutation,
    update: updateMutation,
    remove: deleteMutation,
  } as const;
}
