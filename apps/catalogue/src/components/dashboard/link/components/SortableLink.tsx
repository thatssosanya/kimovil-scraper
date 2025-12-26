import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Props = {
  id: string;
  name: string;
  type: "config" | "sku";
};

export const SortableLink = ({ id, name, type }: Props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex cursor-move items-center gap-2 rounded border bg-white px-3 py-2 shadow-sm"
      {...attributes}
      {...listeners}
    >
      <div className="flex-1">
        <div className="text-sm font-medium">{name}</div>
        <div className="text-xs text-zinc-500">
          {type === "config" ? "Legacy Config" : "SKU"}
        </div>
      </div>
      <div className="text-zinc-400">⋮⋮</div>
    </div>
  );
};
