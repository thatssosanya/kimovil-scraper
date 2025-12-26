import React, { useState } from "react";
import { Input } from "@/src/components/ui/Input";
import { Check, X, Pencil } from "lucide-react";

interface EditableRatingNameProps {
  name: string | null;
  pendingName?: string;
  onNameChange: (newName: string) => void;
}

export const EditableRatingName = ({
  name,
  pendingName,
  onNameChange,
}: EditableRatingNameProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(pendingName || name || "");

  const handleSubmit = () => {
    if (inputValue.trim() && inputValue !== name) {
      onNameChange(inputValue.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setInputValue(pendingName || name || "");
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="h-7 w-[200px] bg-white"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSubmit();
            } else if (e.key === "Escape") {
              handleCancel();
            }
          }}
          autoFocus
        />
        <button
          onClick={handleSubmit}
          className="rounded p-1 text-green-600 hover:bg-green-50"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={handleCancel}
          className="rounded p-1 text-red-600 hover:bg-red-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className="group -ml-1 flex items-center gap-2 rounded px-1 hover:bg-zinc-200"
    >
      <h3 className="font-medium">{pendingName || name}</h3>
      <Pencil className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-50" />
    </button>
  );
};
