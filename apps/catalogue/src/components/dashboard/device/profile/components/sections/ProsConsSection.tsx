import React, { useState, useEffect } from "react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { SaveIcon, XIcon, Edit2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import * as Slider from "@radix-ui/react-slider";
import { cn } from "@/src/lib/utils";
import { InfoCard } from "../shared";
import { api } from "@/src/utils/api";

interface ProsConsSectionProps {
  deviceId: string;
}


// ValueRating component integrated inline
const ValueRatingSection: React.FC<{ deviceId: string }> = ({ deviceId }) => {
  const utils = api.useUtils();
  const { data: deviceData } = api.device.getDevice.useQuery(
    { deviceId },
    { refetchOnWindowFocus: false }
  );

  const [pendingValue, setPendingValue] = useState<number>(
    deviceData?.valueRating ?? 0
  );
  const [isEditingInput, setIsEditingInput] = useState(false);

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


  useEffect(() => {
    if (!updateValueMutation.isPending) {
      setPendingValue(deviceData?.valueRating ?? 0);
    }
  }, [deviceData?.valueRating, updateValueMutation.isPending]);

  const showConfirm = pendingValue !== (deviceData?.valueRating ?? 0);

  const handleSliderChange = (value: number[]) => {
    setPendingValue(value[0] ?? 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    if (rawValue === "") {
      setPendingValue(0);
      return;
    }
    const cleanValue = rawValue.replace(/^0+(?!$)/, "");
    const numValue = parseInt(cleanValue, 10);

    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setPendingValue(numValue);
    }
  };

  const handleInputBlur = () => {
    if (!showConfirm) {
      setIsEditingInput(false);
    }
    if (pendingValue === 0 && String(pendingValue) !== String(deviceData?.valueRating ?? 0)) {
      setPendingValue(deviceData?.valueRating ?? 0);
    }
  };

  const handleConfirm = () => {
    updateValueMutation.mutate({ deviceId, value: pendingValue });
    setIsEditingInput(false);
  };

  const handleCancel = () => {
    setPendingValue(deviceData?.valueRating ?? 0);
    setIsEditingInput(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const displayValue = showConfirm ? pendingValue : (deviceData?.valueRating ?? 0);

  return (
    <div className="space-y-3 border-b border-gray-200 pb-4 dark:border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Цена / качество
          </span>
          {isEditingInput ? (
            <Input
              type="number"
              min={0}
              max={100}
              value={pendingValue === 0 ? "" : String(pendingValue)}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className="h-7 w-14 appearance-none rounded border-gray-300 text-center text-lg font-medium dark:border-gray-700 dark:bg-gray-800 dark:text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              autoFocus
              disabled={updateValueMutation.isPending}
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingInput(true)}
              disabled={updateValueMutation.isPending}
              className="min-w-[2rem] rounded px-1 py-0.5 text-center text-lg font-medium text-gray-900 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-800"
            >
              {updateValueMutation.isPending && !showConfirm ? (
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent dark:border-emerald-400 dark:border-t-transparent" />
              ) : (
                displayValue
              )}
            </button>
          )}
          {showConfirm && (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={handleConfirm}
                disabled={updateValueMutation.isPending}
                className="h-7 border-emerald-200 bg-emerald-50 px-2 text-xs text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-800/50"
              >
                {updateValueMutation.isPending ? (
                  <span className="inline-flex h-3 w-3 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent dark:border-emerald-400 dark:border-t-transparent" />
                ) : (
                  <>
                    <SaveIcon className="mr-1 h-3 w-3" /> Сохранить
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                disabled={updateValueMutation.isPending}
                className="h-7 px-2 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <XIcon className="mr-1 h-3 w-3" /> Отмена
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="relative h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700"
          style={{ width: `${displayValue}%` }}
        />
        <Slider.Root
          className="absolute inset-0 flex touch-none select-none items-center"
          value={[displayValue]}
          onValueChange={handleSliderChange}
          max={100}
          step={1}
          aria-label="Value Rating"
          disabled={updateValueMutation.isPending}
        >
          <Slider.Track className="relative h-full w-full grow overflow-hidden rounded-full">
            <Slider.Range className="absolute h-full" />
          </Slider.Track>
          <Slider.Thumb
            className={cn(
              "block h-3.5 w-3.5 rounded-full border-2 border-white bg-gray-700 shadow-sm ring-offset-white transition-transform dark:border-gray-900 dark:bg-gray-300",
              "focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:ring-offset-gray-950 dark:focus:ring-gray-500",
              "hover:scale-110",
              updateValueMutation.isPending
                ? "cursor-not-allowed"
                : "cursor-grab active:cursor-grabbing"
            )}
          />
        </Slider.Root>
      </div>
    </div>
  );
};

// ProsConsColumn component integrated inline
const ProsConsColumn: React.FC<{
  title: string;
  color: "emerald" | "rose";
  items: Array<{ id: string; text: string }>;
  deviceId: string;
  type: "pro" | "con";
}> = ({ title, color, items, deviceId, type }) => {
  const utils = api.useUtils();
  const [newItemText, setNewItemText] = useState("");
  const [editingItem, setEditingItem] = useState<{ id: string; text: string } | null>(null);
  const [editText, setEditText] = useState("");
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

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

  const handleAdd = () => {
    const trimmedText = newItemText.trim();
    if (!trimmedText) return;
    addMutation.mutate({ deviceId, type, text: trimmedText });
    setNewItemText("");
  };

  const startEditing = (item: { id: string; text: string }) => {
    setEditingItem(item);
    setEditText(item.text);
  };

  const saveEdit = () => {
    const trimmedText = editText.trim();
    if (!editingItem || !trimmedText) return;
    if (trimmedText !== editingItem.text) {
      updateMutation.mutate({ id: editingItem.id, text: trimmedText });
    }
    setEditingItem(null);
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditText("");
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id });
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!addMutation.isPending && newItemText.trim()) handleAdd();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setNewItemText("");
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  const isMutating =
    addMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  const colorClasses = {
    emerald: {
      title: "text-emerald-600 dark:text-emerald-400",
      input: "focus-visible:ring-emerald-500 dark:focus-visible:ring-emerald-400",
      button: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-800/30",
      dot: "bg-emerald-500 dark:bg-emerald-400",
      item: "bg-emerald-50 dark:bg-emerald-900/20",
      spinner: "border-emerald-600 dark:border-emerald-400",
    },
    rose: {
      title: "text-rose-600 dark:text-rose-400",
      input: "focus-visible:ring-rose-500 dark:focus-visible:ring-rose-400",
      button: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-800/30",
      dot: "bg-rose-500 dark:bg-rose-400",
      item: "bg-rose-50 dark:bg-rose-900/20",
      spinner: "border-rose-600 dark:border-rose-400",
    },
  };

  const classes = colorClasses[color];

  return (
    <div className="space-y-3">
      <h4 className={`text-sm font-medium ${classes.title}`}>{title}</h4>

      <div className="flex items-center space-x-2">
        <Input
          placeholder={`Добавить ${type === "pro" ? "плюс" : "минус"}`}
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={handleInputKeyDown}
          className={`h-9 border-gray-200 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white ${classes.input}`}
          disabled={addMutation.isPending}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleAdd}
          disabled={addMutation.isPending || !newItemText.trim()}
          className={`h-9 shrink-0 disabled:cursor-not-allowed disabled:opacity-70 ${classes.button}`}
        >
          {addMutation.isPending ? (
            <span className={`inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent ${classes.spinner}`} />
          ) : (
            <>
              <PlusIcon className="mr-1 h-3.5 w-3.5" />
              <span className="text-xs">Добавить</span>
            </>
          )}
        </Button>
      </div>

      <ul className="space-y-1.5" role="list">
        {items.map((item) => (
          <li
            key={item.id}
            className={`group relative flex min-h-[34px] items-start rounded-md p-1.5 pr-16 transition-colors duration-200 ${
              hoveredItemId === item.id ? classes.item : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
            }`}
            onMouseEnter={() => setHoveredItemId(item.id)}
            onMouseLeave={() => setHoveredItemId(null)}
          >
            {editingItem?.id === item.id ? (
              <div className="flex w-full flex-col space-y-2">
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className={`h-auto border-gray-300 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white ${classes.input}`}
                  autoFocus
                  disabled={updateMutation.isPending}
                />
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={saveEdit}
                    disabled={updateMutation.isPending}
                    className={`h-7 px-2 text-xs ${classes.button}`}
                  >
                    {updateMutation.isPending ? (
                      <span className={`inline-flex h-3 w-3 animate-spin rounded-full border-2 border-t-transparent ${classes.spinner}`} />
                    ) : (
                      <>
                        <SaveIcon className="mr-1 h-3 w-3" />
                        Сохранить
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cancelEdit}
                    disabled={updateMutation.isPending}
                    className="h-7 px-2 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                  >
                    <XIcon className="mr-1 h-3 w-3" />
                    Отмена
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <span
                  className={`mt-1 block h-2 w-2 flex-shrink-0 rounded-full ${classes.dot}`}
                  aria-hidden="true"
                />
                <span className="ml-2 flex-1 break-words pr-2 text-sm text-gray-700 dark:text-gray-300">
                  {item.text}
                </span>
                <div
                  className={cn(
                    "absolute right-1.5 top-1/2 flex -translate-y-1/2 space-x-1 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100",
                    hoveredItemId !== item.id && "opacity-0",
                    isMutating && "pointer-events-none opacity-50"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => startEditing(item)}
                    disabled={isMutating}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed dark:text-gray-500 dark:hover:bg-gray-800/40 dark:hover:text-gray-400"
                    aria-label="Редактировать"
                  >
                    <Edit2Icon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    disabled={
                      deleteMutation.isPending &&
                      deleteMutation.variables?.id === item.id
                    }
                    className={cn(
                      "rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed dark:text-gray-500 dark:hover:bg-gray-800/40 dark:hover:text-gray-400",
                      isMutating &&
                        !(
                          deleteMutation.isPending &&
                          deleteMutation.variables?.id === item.id
                        ) &&
                        "pointer-events-none"
                    )}
                    aria-label="Удалить"
                  >
                    {deleteMutation.isPending &&
                    deleteMutation.variables?.id === item.id ? (
                      <span className={`inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent ${classes.spinner}`} />
                    ) : (
                      <Trash2Icon className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </>
            )}
          </li>
        ))}

        {items.length === 0 && !addMutation.isPending && (
          <li className="py-1 text-left text-sm italic text-gray-400 dark:text-gray-500">
            Нет {type === "pro" ? "плюсов" : "минусов"}. Добавьте первый!
          </li>
        )}
      </ul>
    </div>
  );
};

export function ProsConsSection({ deviceId }: ProsConsSectionProps) {
  const { data: prosConsData, isLoading } = api.device.getDeviceProsAndCons.useQuery({
    deviceId,
  });

  if (isLoading) {
    return (
      <InfoCard title="Плюсы и минусы">
        <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
          Загрузка...
        </div>
      </InfoCard>
    );
  }

  const pros = prosConsData?.pros || [];
  const cons = prosConsData?.cons || [];

  return (
    <InfoCard title="Плюсы и минусы">
      <div className="space-y-6">
        <ValueRatingSection deviceId={deviceId} />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ProsConsColumn
            title="Плюсы"
            color="emerald"
            items={pros}
            deviceId={deviceId}
            type="pro"
          />

          <ProsConsColumn
            title="Минусы"
            color="rose"
            items={cons}
            deviceId={deviceId}
            type="con"
          />
        </div>
      </div>
    </InfoCard>
  );
}