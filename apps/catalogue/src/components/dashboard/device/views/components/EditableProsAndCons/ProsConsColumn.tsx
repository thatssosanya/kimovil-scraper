import React, { useState } from "react";
import { Button } from "@/src/components/ui/Button";
import { Input } from "@/src/components/ui/Input";
import { Edit2Icon, PlusIcon, SaveIcon, Trash2Icon, XIcon } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { type UseMutationResult } from "@tanstack/react-query";
import { cva, type VariantProps } from "class-variance-authority";

type Item = { id: string; text: string };

type ProsConsAddMutation = UseMutationResult<
  unknown,
  unknown,
  { deviceId: string; type: "pro" | "con"; text: string }
>;
type ProsConsUpdateMutation = UseMutationResult<
  unknown,
  unknown,
  { id: string; text: string }
>;
type ProsConsDeleteMutation = UseMutationResult<
  unknown,
  unknown,
  { id: string }
>;

const titleStyles = cva("text-base font-medium", {
  variants: {
    color: {
      emerald: "text-emerald-600 dark:text-emerald-400",
      rose: "text-rose-600 dark:text-rose-400",
    },
  },
});

const inputStyles = cva(
  "h-9 border-zinc-200 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-white",
  {
    variants: {
      color: {
        emerald:
          "focus-visible:ring-emerald-500 dark:focus-visible:ring-emerald-400",
        rose: "focus-visible:ring-rose-500 dark:focus-visible:ring-rose-400",
      },
    },
  }
);

const editInputStyles = cva(
  "h-auto border-zinc-300 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-700 dark:text-white",
  {
    variants: {
      color: {
        emerald:
          "focus-visible:ring-emerald-500 dark:focus-visible:ring-emerald-400",
        rose: "focus-visible:ring-rose-500 dark:focus-visible:ring-rose-400",
      },
    },
  }
);

const addButtonStyles = cva(
  "h-9 shrink-0 disabled:cursor-not-allowed disabled:opacity-70",
  {
    variants: {
      color: {
        emerald: [
          "border-emerald-200 dark:border-emerald-700/60",
          "bg-emerald-50 dark:bg-emerald-900/30",
          "text-emerald-700 dark:text-emerald-300",
          "hover:bg-emerald-100 dark:hover:bg-emerald-800/30",
          "hover:text-emerald-800 dark:hover:text-emerald-200",
          "focus-visible:ring-emerald-500 dark:focus-visible:ring-emerald-400",
        ],
        rose: [
          "border-rose-200 dark:border-rose-700/60",
          "bg-rose-50 dark:bg-rose-900/30",
          "text-rose-700 dark:text-rose-300",
          "hover:bg-rose-100 dark:hover:bg-rose-800/30",
          "hover:text-rose-800 dark:hover:text-rose-200",
          "focus-visible:ring-rose-500 dark:focus-visible:ring-rose-400",
        ],
      },
    },
  }
);

const saveButtonStyles = cva("h-7 px-2 text-xs", {
  variants: {
    color: {
      emerald: [
        "border-emerald-200 dark:border-emerald-700/60",
        "bg-emerald-50 dark:bg-emerald-900/30",
        "text-emerald-700 dark:text-emerald-300",
        "hover:bg-emerald-100 dark:hover:bg-emerald-800/30",
        "hover:text-emerald-800 dark:hover:text-emerald-200",
      ],
      rose: [
        "border-rose-200 dark:border-rose-700/60",
        "bg-rose-50 dark:bg-rose-900/30",
        "text-rose-700 dark:text-rose-300",
        "hover:bg-rose-100 dark:hover:bg-rose-800/30",
        "hover:text-rose-800 dark:hover:text-rose-200",
      ],
    },
  },
});

const spinnerStyles = cva(
  "inline-flex animate-spin rounded-full border-2 border-t-transparent",
  {
    variants: {
      size: {
        sm: "h-3 w-3",
        md: "h-3.5 w-3.5",
      },
      color: {
        emerald: "border-emerald-600 dark:border-emerald-400",
        rose: "border-rose-600 dark:border-rose-400",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

const listItemStyles = cva(
  "group relative flex min-h-[34px] items-start rounded-md p-1.5 pr-16 transition-colors duration-200",
  {
    variants: {
      color: {
        emerald: "bg-emerald-50 dark:bg-emerald-900/20",
        rose: "bg-rose-50 dark:bg-rose-900/20",
      },
      state: {
        active: "",
        inactive: "hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
      },
    },
  }
);

const listItemDotStyles = cva("mt-1 block h-2 w-2 flex-shrink-0 rounded-full", {
  variants: {
    color: {
      emerald: "bg-emerald-500 dark:bg-emerald-400",
      rose: "bg-rose-500 dark:bg-rose-400",
    },
  },
});

const iconButtonStyles = cva(
  "rounded p-1 text-zinc-400 dark:text-zinc-500 disabled:cursor-not-allowed",
  {
    variants: {
      color: {
        emerald: [
          "hover:bg-emerald-100 dark:hover:bg-emerald-800/40",
          "hover:text-emerald-600 dark:hover:text-emerald-400",
        ],
        rose: [
          "hover:bg-rose-100 dark:hover:bg-rose-800/40",
          "hover:text-rose-600 dark:hover:text-rose-400",
        ],
      },
    },
  }
);

const baseStyles = {
  cancelButton:
    "h-7 px-2 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700",
  emptyState: "py-1 text-left text-sm italic text-zinc-400 dark:text-zinc-500",
  actionButtonGroup:
    "absolute right-1.5 top-1/2 flex -translate-y-1/2 space-x-1 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100",
};

type ColumnColor = VariantProps<typeof titleStyles>["color"];

interface ProsConsColumnProps {
  title: string;
  color: NonNullable<ColumnColor>;
  items: Item[];
  addMutation: ProsConsAddMutation;
  updateMutation: ProsConsUpdateMutation;
  deleteMutation: ProsConsDeleteMutation;
  deviceId: string;
  type: "pro" | "con";
  className?: string;
}

export const ProsConsColumn: React.FC<ProsConsColumnProps> = ({
  title,
  color,
  items,
  addMutation,
  updateMutation,
  deleteMutation,
  deviceId,
  type,
  className,
}) => {
  const [newItemText, setNewItemText] = useState("");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editText, setEditText] = useState("");
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  const handleAdd = () => {
    const trimmedText = newItemText.trim();
    if (!trimmedText) return;
    addMutation.mutate({ deviceId, type, text: trimmedText });
    setNewItemText("");
  };

  const startEditing = (item: Item) => {
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

  return (
    <div className={cn("space-y-3", className)}>
      <h2 className={cn(titleStyles({ color }))}>{title}</h2>

      <div className="flex items-center space-x-2">
        <Input
          placeholder={`Добавить ${type === "pro" ? "плюс" : "минус"}`}
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          onKeyDown={handleInputKeyDown}
          className={cn(inputStyles({ color }))}
          disabled={addMutation.isPending}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleAdd}
          disabled={addMutation.isPending || !newItemText.trim()}
          className={cn(addButtonStyles({ color }))}
        >
          {addMutation.isPending ? (
            <span className={cn(spinnerStyles({ color, size: "md" }))} />
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
            className={cn(
              listItemStyles({
                color,
                state: hoveredItemId === item.id ? "active" : "inactive",
              })
            )}
            onMouseEnter={() => setHoveredItemId(item.id)}
            onMouseLeave={() => setHoveredItemId(null)}
          >
            {editingItem?.id === item.id ? (
              <div className="flex w-full flex-col space-y-2">
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className={cn(editInputStyles({ color }))}
                  autoFocus
                  disabled={updateMutation.isPending}
                />
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={saveEdit}
                    disabled={updateMutation.isPending}
                    className={cn(saveButtonStyles({ color }))}
                  >
                    {updateMutation.isPending ? (
                      <span
                        className={cn(spinnerStyles({ color, size: "sm" }))}
                      />
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
                    className={baseStyles.cancelButton}
                  >
                    <XIcon className="mr-1 h-3 w-3" />
                    Отмена
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <span
                  className={cn(listItemDotStyles({ color }))}
                  aria-hidden="true"
                />
                <span className="ml-2 flex-1 break-words pr-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {item.text}
                </span>
                <div
                  className={cn(
                    baseStyles.actionButtonGroup,
                    hoveredItemId !== item.id && "opacity-0",
                    isMutating && "pointer-events-none opacity-50"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => startEditing(item)}
                    disabled={isMutating}
                    className={cn(iconButtonStyles({ color }))}
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
                      iconButtonStyles({ color }),
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
                      <span
                        className={cn(spinnerStyles({ color, size: "md" }))}
                      />
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
          <li className={baseStyles.emptyState}>
            Нет {type === "pro" ? "плюсов" : "минусов"}. Добавьте первый!
          </li>
        )}
      </ul>
    </div>
  );
};
