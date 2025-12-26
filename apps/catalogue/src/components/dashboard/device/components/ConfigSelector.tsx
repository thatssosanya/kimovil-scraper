import { api } from "@/src/utils/api";
import { PlusCircleIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";
import { Input } from "@/src/components/ui/Input";
import { SaveIcon, XIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { type TRPCError } from "@trpc/server";
import { extractDigits } from "@/src/utils/utils";
import { cn } from "@/src/lib/utils";

type ConfigSelectorProps = {
  deviceId?: string;
  deviceConfigs?: string[];
  setValue: (value: string[]) => void;
};

const ConfigSelector = ({
  deviceId,
  setValue,
  deviceConfigs = [],
}: ConfigSelectorProps) => {
  const { data: configs, isPending } = api.config.getAllConfigs.useQuery();
  const utils = api.useUtils();
  const [configName, setConfigName] = useState<string>("");
  const { mutate: createConfig, isPending: isCreating } =
    api.config.createConfig.useMutation({
      onSuccess: async () => {
        await utils.config.getAllConfigs.refetch();
        setInputShowing(false);
        setConfigName("");
      },
      onError: ({ message }) => {
        const [error] = !!message ? (JSON.parse(message) as TRPCError[]) : [];
        if (error?.code) {
          toast.error(error.message);
        }
      },
    });
  const [inputShowing, setInputShowing] = useState(false);

  return (
    <div className="border-input bg-background flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        {isPending && (
          <Loader2Icon className="text-muted-foreground h-4 w-4 animate-spin" />
        )}
        {!inputShowing && (
          <button
            onClick={() => setInputShowing(true)}
            className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-2 text-sm transition"
            type="button"
          >
            <PlusCircleIcon className="h-4 w-4" />
            <span>Добавить</span>
          </button>
        )}
      </div>

      {isPending ? (
        <div className="flex h-20 items-center justify-center">
          <Loader2Icon className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : configs?.length === 0 ? (
        <div className="text-muted-foreground flex h-20 items-center justify-center text-sm">
          Нет доступных конфигураций
        </div>
      ) : (
        <div
          className="scrollbar flex flex-wrap items-start gap-2 overflow-auto"
          role="listbox"
          aria-label="Список конфигураций"
        >
          {configs
            ?.sort(
              (a, b) =>
                +(a.capacity || extractDigits(a.name)) -
                +(b.capacity || extractDigits(b.name))
            )
            .map((config) => {
              const isSelected = deviceConfigs?.includes(config.id) ?? false;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  key={config.id}
                  onClick={() => {
                    if (isSelected) {
                      setValue(
                        (deviceConfigs || []).filter((c) => c !== config.id)
                      );
                    } else {
                      setValue([...(deviceConfigs || []), config.id]);
                    }
                  }}
                  className={cn(
                    "ring-offset-background focus-visible:ring-ring inline-flex h-8 shrink-0 select-none items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                    isSelected
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border-input bg-background hover:bg-accent hover:text-accent-foreground border"
                  )}
                >
                  {config.name}
                </button>
              );
            })}
        </div>
      )}

      {inputShowing && (
        <div className="bg-muted/50 flex items-center gap-2 rounded-md border p-2">
          <Input
            onChange={(e) => setConfigName(e.target.value)}
            value={configName}
            placeholder="Название конфигурации"
            className="h-8 text-sm"
            disabled={isCreating}
          />
          <div className="flex shrink-0 items-center gap-2">
            {configName && !isCreating && (
              <button
                onClick={() => {
                  createConfig({
                    name: configName,
                    deviceId: deviceId || undefined,
                  });
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
                type="button"
              >
                <SaveIcon className="h-4 w-4" />
              </button>
            )}
            {isCreating ? (
              <Loader2Icon className="text-muted-foreground h-4 w-4 animate-spin" />
            ) : (
              <button
                onClick={() => {
                  setInputShowing(false);
                  setConfigName("");
                }}
                className="bg-background text-foreground hover:bg-accent hover:text-accent-foreground inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors"
                type="button"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigSelector;
