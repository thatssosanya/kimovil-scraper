import React from "react";
import { cn } from "@/src/lib/utils";

type Config = {
  id: string;
  name: string;
};

type DumbConfigSelectorProps = {
  configs: Config[];
  selectedConfigId: string;
  setSelectedConfigId: (configId: string) => void;
  disabled?: boolean;
};

const DumbConfigSelector = ({
  configs,
  selectedConfigId,
  setSelectedConfigId,
  disabled = false,
}: DumbConfigSelectorProps) => {
  return (
    <div className="flex items-center gap-2">
      <div className="scrollbar flex items-center gap-2 overflow-auto">
        {configs
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((config) => (
            <div
              className={cn(
                "shrink-0 cursor-pointer select-none rounded bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-800 transition",
                selectedConfigId === config.id
                  ? "bg-zinc-400"
                  : "hover:bg-zinc-300",
                disabled && "cursor-not-allowed opacity-50"
              )}
              key={config.id}
              onClick={() => {
                if (!disabled) {
                  setSelectedConfigId(config.id);
                }
              }}
            >
              {config.name}
            </div>
          ))}
      </div>
    </div>
  );
};

export default DumbConfigSelector;
