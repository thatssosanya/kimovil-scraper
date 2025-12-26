import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import DeviceView from "@/src/components/dashboard/device/views";
import type { DeviceWithConfigs } from "@/src/components/dashboard/device/views/types";

interface DeviceViewDialogProps {
  device: DeviceWithConfigs;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DeviceViewDialog = ({
  device,
  open,
  onOpenChange,
}: DeviceViewDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-auto max-h-[calc(100vh-80px)] w-[calc(100vw-80px)] max-w-7xl overflow-auto">
        <DialogHeader>
          <DialogTitle>{device.name}</DialogTitle>
        </DialogHeader>
        <DeviceView device={device} />
      </DialogContent>
    </Dialog>
  );
};
