import React, { memo, useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/src/components/ui/Dialog";
import { Plus, Smartphone, AlertTriangle, ExternalLink } from "lucide-react";
import AddDeviceForm from "../AddDeviceForm";
import { Button } from "@/src/components/ui/Button";
import { useForm } from "react-hook-form";
import { type z } from "zod";
import { addDeviceSchema } from "../AddDeviceForm";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/src/lib/utils";
import { api } from "@/src/utils/api";
import { useDebounce } from "@/src/hooks/useDebounce";

export type AddDeviceDialogueProps = {
  variant?: "default" | "ghost";
  size?: "default" | "sm" | "icon";
  iconOnly?: boolean;
  className?: string;
};

type FormValues = z.infer<typeof addDeviceSchema>;

// Memoized Preview Card
const PreviewCard = memo(function PreviewCard({
  name,
  type,
  imageUrl
}: {
  name: string;
  type: string;
  imageUrl: string;
}) {
  const hasContent = name || type || imageUrl;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-slate-800/40">
      {/* Image */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name || "Preview"}
          className="h-14 w-auto object-contain shrink-0"
        />
      ) : (
        <div className="h-14 w-10 rounded-md bg-zinc-100 dark:bg-slate-700/50 flex items-center justify-center shrink-0">
          <Smartphone className="h-5 w-5 text-zinc-300 dark:text-slate-600" />
        </div>
      )}

      {/* Info */}
      <div className="min-w-0">
        <p className={cn(
          "text-sm font-medium truncate",
          hasContent
            ? "text-zinc-900 dark:text-slate-100"
            : "text-zinc-300 dark:text-slate-500"
        )}>
          {name || "Название устройства"}
        </p>
        {type && (
          <p className="text-xs text-zinc-500 dark:text-slate-400 truncate">
            {type}
          </p>
        )}
      </div>
    </div>
  );
});

// Memoized Duplicate Warning for sidebar - subtle inline hint
const SidebarDuplicateWarning = memo(function SidebarDuplicateWarning({
  matches,
  matchType,
  skipDuplicateCheck,
  onSkipChange,
}: {
  matches: Array<{ id: string; name: string; type: string }>;
  matchType?: string;
  skipDuplicateCheck: boolean;
  onSkipChange: (checked: boolean) => void;
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onSkipChange(e.target.checked),
    [onSkipChange]
  );

  return (
    <div className="text-xs text-zinc-500 dark:text-slate-400 space-y-2">
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="h-3 w-3 text-zinc-400 dark:text-slate-500" />
        <span>{matchType === "exact" ? "Уже есть:" : "Похожие:"}</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {matches.slice(0, 3).map((d) => (
          <a
            key={d.id}
            href={`/dashboard/devices/${d.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-zinc-100 dark:bg-slate-800 hover:bg-zinc-200 dark:hover:bg-slate-700 text-zinc-600 dark:text-slate-300"
          >
            {d.name}
            <ExternalLink className="h-2.5 w-2.5 opacity-50" />
          </a>
        ))}
        {matches.length > 3 && (
          <span className="text-[11px] text-zinc-400">+{matches.length - 3}</span>
        )}
      </div>

      <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
        <input
          type="checkbox"
          checked={skipDuplicateCheck}
          onChange={handleChange}
          className="h-3 w-3 rounded border-zinc-300 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0"
        />
        <span className="text-zinc-500 dark:text-slate-400">Создать всё равно</span>
      </label>
    </div>
  );
});

export const AddDeviceDialogue = memo(
  ({ variant = "default", size = "default", iconOnly = false, className }: AddDeviceDialogueProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false);

    const form = useForm<FormValues>({
      resolver: zodResolver(addDeviceSchema),
      defaultValues: {
        name: "",
        type: "",
        description: "",
        imageUrl: "",
      },
    });

    const handleOpenChange = useCallback((open: boolean) => {
      if (!open) {
        form.reset();
        setSkipDuplicateCheck(false);
      }
      setIsOpen(open);
    }, [form]);

    const formValues = form.watch();
    const debouncedName = useDebounce(formValues.name, 300);

    const { data: similarDevices } = api.device.findSimilarByName.useQuery(
      { name: debouncedName, type: formValues.type || undefined },
      { enabled: debouncedName.trim().length >= 3 }
    );

    const hasSimilarDevices = (similarDevices?.matches?.length ?? 0) > 0;

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
          <DialogContent className="max-h-[90vh] max-w-4xl flex flex-col overflow-hidden p-0 gap-0">
            {/* Header */}
            <DialogHeader className="shrink-0 px-6 py-4 border-b border-zinc-200 dark:border-slate-800">
              <DialogTitle>Новое устройство</DialogTitle>
              <DialogDescription>
                Заполните информацию для добавления в каталог
              </DialogDescription>
            </DialogHeader>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="flex flex-col lg:flex-row">
                {/* Form */}
                <div className="flex-1 min-w-0 p-6">
                  <AddDeviceForm
                    form={form}
                    onSuccess={() => setIsOpen(false)}
                    hideDuplicateWarning
                    hideFooter
                  />
                </div>

                {/* Sidebar */}
                <div className="w-full lg:w-72 shrink-0 p-6 pt-0 lg:pt-6 lg:pl-0 space-y-4">
                  <PreviewCard
                    name={formValues.name}
                    type={formValues.type}
                    imageUrl={formValues.imageUrl}
                  />

                  {hasSimilarDevices && similarDevices?.matches && (
                    <SidebarDuplicateWarning
                      matches={similarDevices.matches}
                      matchType={similarDevices.matchType}
                      skipDuplicateCheck={skipDuplicateCheck}
                      onSkipChange={setSkipDuplicateCheck}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 py-4 border-t border-zinc-200 dark:border-slate-800 bg-zinc-50/50 dark:bg-slate-800/30 flex items-center justify-between">
              <p className="text-xs text-zinc-400 dark:text-slate-500">
                <span className="text-rose-400">*</span> Обязательные поля
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  className="h-9 px-4"
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  form="add-device-form"
                  disabled={form.formState.isSubmitting || (hasSimilarDevices && !skipDuplicateCheck)}
                  className="h-9 px-5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {form.formState.isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Создание...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Создать
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }
);

AddDeviceDialogue.displayName = "AddDeviceDialogue";
