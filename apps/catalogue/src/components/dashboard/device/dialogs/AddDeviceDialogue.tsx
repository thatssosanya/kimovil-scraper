import React, { memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/Dialog";
import { Plus } from "lucide-react";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import "@uppy/image-editor/dist/style.min.css";
import AddDeviceForm from "../AddDeviceForm";
import { Button } from "@/src/components/ui/Button";
import { useForm } from "react-hook-form";
import { type z } from "zod";
import { addDeviceSchema } from "../AddDeviceForm";
import { PublicDeviceCard } from "@/src/components/dashboard/device/components/cards";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/src/lib/utils";

export type AddDeviceDialogueProps = {
  variant?: "default" | "ghost";
  size?: "default" | "sm" | "icon";
  iconOnly?: boolean;
  className?: string;
};

type FormValues = z.infer<typeof addDeviceSchema>;

export const AddDeviceDialogue = memo(
  ({ variant = "default", size = "default", iconOnly = false, className }: AddDeviceDialogueProps) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const form = useForm<FormValues>({
      resolver: zodResolver(addDeviceSchema),
      defaultValues: {
        name: "",
        type: "",
        description: "",
        yandexId: "",
        imageUrl: "",
        configs: [],
      },
    });

    // Reset form when dialog closes
    const handleOpenChange = (open: boolean) => {
      if (!open) {
        form.reset();
      }
      setIsOpen(open);
    };

    const formValues = form.watch();

    const previewDevice = {
      ...formValues,
      id: "preview",
      createdAt: new Date(),
      widgetId: null,
      valueRating: null,
      configs: [],
      links: [],
      ratingPositions: [],
      index: 0,
    };

    return (
      <>
        <Button
          onClick={() => setIsOpen(true)}
          variant={variant}
          size={size}
          className={cn(
            iconOnly
              ? "h-8 w-8 p-0 text-black hover:bg-zinc-100 dark:hover:bg-gray-800/60 cursor-pointer"
              : "h-8 bg-black text-white hover:bg-black/90",
            className
          )}
          aria-label="Добавить устройство"
          title="Добавить устройство"
        >
          <Plus className={cn("h-4 w-4", iconOnly ? "" : "mr-2")} />
          {!iconOnly && <>Добавить устройство</>}
        </Button>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogContent className="max-h-[90vh] max-w-6xl overflow-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold tracking-tight">
                Добавить устройство
              </DialogTitle>
              <p className="text-sm text-muted-foreground dark:text-gray-500">
                Заполните информацию о новом устройстве
              </p>
            </DialogHeader>
            <div className="mt-6 grid grid-cols-[3fr,2fr] gap-8">
              <AddDeviceForm form={form} onSuccess={() => setIsOpen(false)} />
              <div className="flex flex-col gap-4">
                <h2 className="text-base font-medium text-foreground dark:text-gray-200">
                  Предпросмотр карточки
                </h2>
                <div className="rounded-lg border border-input bg-background p-4 dark:border-gray-800 dark:bg-[hsl(0_0%_7%)]">
                  <PublicDeviceCard device={previewDevice} index={1} />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }
);

AddDeviceDialogue.displayName = "AddDeviceDialogue";
