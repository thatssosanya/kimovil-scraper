import React from 'react';
import { CopyIcon, CheckIcon } from './Icons';

interface CopyButtonProps {
  text: string;
  field: string;
  onCopy: (text: string, field: string) => void;
  isCopied: (field: string) => boolean;
  label?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ text, field, onCopy, isCopied, label }) => {
  const copied = isCopied(field);
  
  return (
    <button
      onClick={() => onCopy(text, field)}
      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition-all relative tooltip-container"
      aria-label={label || `Copy ${field}`}
      title={label || `Copy ${field}`}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span
        className={`absolute -top-9 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded py-1 px-2 opacity-0 transition-opacity duration-200 pointer-events-none ${
          copied ? "opacity-100" : ""
        }`}
      >
        Скопировано!
      </span>
    </button>
  );
};