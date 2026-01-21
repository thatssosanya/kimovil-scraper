import { api } from "@/src/utils/api";
import { Plus, Check, Loader2, X } from "lucide-react";
import React, { useState } from "react";
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
  const [inputShowing, setInputShowing] = useState(false);

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

  const sortedConfigs = configs?.sort(
    (a, b) =>
      +(a.capacity || extractDigits(a.name)) -
      +(b.capacity || extractDigits(b.name))
  );

  return (
    <div className={cn(
      "flex flex-wrap gap-1.5 p-2 rounded-lg",
      "bg-zinc-50 dark:bg-slate-800/30",
      "border border-zinc-200 dark:border-slate-700/50"
    )}>
      {isPending ? (
        <div className="flex items-center gap-1.5 py-1 px-2 text-xs text-zinc-400 dark:text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Загрузка...
        </div>
      ) : sortedConfigs?.length === 0 ? (
        <div className="py-1 px-2 text-xs text-zinc-400 dark:text-slate-500">
          Нет конфигураций
        </div>
      ) : (
        sortedConfigs?.map((config) => {
          const isSelected = deviceConfigs?.includes(config.id) ?? false;
          return (
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              key={config.id}
              onClick={() => {
                if (isSelected) {
                  setValue((deviceConfigs || []).filter((c) => c !== config.id));
                } else {
                  setValue([...(deviceConfigs || []), config.id]);
                }
              }}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer",
                "transition-colors",
                isSelected
                  ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-500/30"
                  : "bg-white dark:bg-slate-800/50 text-zinc-600 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-700/50 border border-zinc-200 dark:border-slate-700/50"
              )}
            >
              {isSelected && <Check className="h-3 w-3" />}
              {config.name}
            </button>
          );
        })
      )}

      {/* Inline Add Button / Form */}
      {!inputShowing ? (
        <button
          type="button"
          onClick={() => setInputShowing(true)}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer",
            "border border-dashed border-zinc-300 dark:border-slate-600",
            "text-zinc-400 dark:text-slate-500",
            "hover:border-cyan-400 hover:text-cyan-500 dark:hover:border-cyan-500 dark:hover:text-cyan-400"
          )}
        >
          <Plus className="h-3 w-3" />
          Добавить
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={configName}
            onChange={(e) => setConfigName(e.target.value)}
            placeholder="256GB"
            disabled={isCreating}
            className={cn(
              "h-7 w-24 px-2 text-xs rounded-md",
              "bg-white dark:bg-slate-800/50",
              "border border-cyan-300 dark:border-cyan-600/50",
              "focus:outline-none focus:ring-1 focus:ring-cyan-500/30",
              "placeholder:text-zinc-400 dark:placeholder:text-slate-500",
              "text-zinc-900 dark:text-slate-100"
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" && configName) {
                e.preventDefault();
                createConfig({
                  name: configName,
                  deviceId: deviceId || undefined,
                });
              }
              if (e.key === "Escape") {
                setInputShowing(false);
                setConfigName("");
              }
            }}
            autoFocus
          />
          {isCreating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-500" />
          ) : (
            <>
              {configName && (
                <button
                  type="button"
                  onClick={() => {
                    createConfig({
                      name: configName,
                      deviceId: deviceId || undefined,
                    });
                  }}
                  className="h-6 w-6 flex items-center justify-center rounded bg-cyan-500 text-white hover:bg-cyan-600"
                >
                  <Check className="h-3 w-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setInputShowing(false);
                  setConfigName("");
                }}
                className="h-6 w-6 flex items-center justify-center rounded bg-zinc-200 dark:bg-slate-700 text-zinc-500 dark:text-slate-400 hover:bg-zinc-300 dark:hover:bg-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ConfigSelector;
