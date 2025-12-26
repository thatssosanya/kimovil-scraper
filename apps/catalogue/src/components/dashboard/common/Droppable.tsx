import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/src/lib/utils";

interface DroppableProps {
  id: string;
  children: React.ReactNode;
}

export const Droppable = ({ id, children }: DroppableProps) => {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative w-full transition-colors duration-200",
        isOver && "bg-blue-50/50 ring-2 ring-inset ring-blue-900/20"
      )}
      style={{
        minHeight: "100px",
        height: "fit-content",
      }}
    >
      {children}
    </div>
  );
};
