import React, { memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import { Edit } from "lucide-react";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import "@uppy/image-editor/dist/style.min.css";
import EditDeviceForm from "../EditDeviceForm";
import { Button } from "@/src/components/ui/Button";
import { type DeviceWithConfigs } from "@/src/components/dashboard/device/views/types";
import { useForm } from "react-hook-form";
import { type z } from "zod";
import { editDeviceSchema } from "../EditDeviceForm";
import { PublicDeviceCard } from "@/src/components/dashboard/device/components/cards";
import { zodResolver } from "@hookform/resolvers/zod";

interface EditDeviceDialogueProps {
  device: DeviceWithConfigs;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
  iconOnly?: boolean;
  className?: string;
}

type FormValues = z.infer<typeof editDeviceSchema>;

export const EditDeviceDialogue = memo(
  ({ device, variant = "outline", size = "sm", iconOnly = false, className }: EditDeviceDialogueProps) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const form = useForm<FormValues>({
      resolver: zodResolver(editDeviceSchema),
      defaultValues: {
        name: device.name || "",
        type: device.type || "",
        description: device.description || "",
        yandexId: device.yandexId || "",
        imageUrl: device.imageUrl || "",
        configs: device.configs.map((config) => config.id) || [],
      },
    });
    const formValues = form.watch();

    const previewDevice: DeviceWithConfigs = {
      ...device,
      name: formValues.name,
      imageUrl: formValues.imageUrl,
      description: formValues.description,
      configs: device.configs,
      links: device.links || [],
      ratingPositions: device.ratingPositions || []
    };

    return (
      <>
        <Button
          onClick={() => setIsOpen(true)}
          variant={variant}
          size={size}
          className={className}
          aria-label="Редактировать устройство"
          title="Редактировать устройство"
        >
          <Edit className={iconOnly ? "h-4 w-4" : "h-4 w-4 mr-2"} />
          {!iconOnly && <span>Редактировать</span>}
        </Button>

        {isOpen && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="mx-auto max-h-[calc(100vh-80px)] w-[calc(100vw-80px)] max-w-6xl overflow-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-semibold tracking-tight">
                  Редактировать устройство
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Измените информацию об устройстве
                </p>
              </DialogHeader>

              <div className="mt-6 grid grid-cols-[3fr,2fr] gap-8">
                <EditDeviceForm
                  device={device}
                  form={form}
                  onSuccess={() => setIsOpen(false)}
                />
                <div className="flex flex-col gap-4">
                  <h2 className="text-base font-medium text-foreground">
                    Предпросмотр карточки
                  </h2>
                  <div className="rounded-lg border border-input bg-background p-4">
                    <PublicDeviceCard device={previewDevice} index={1} />
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }
);

EditDeviceDialogue.displayName = "EditDeviceDialogue";
