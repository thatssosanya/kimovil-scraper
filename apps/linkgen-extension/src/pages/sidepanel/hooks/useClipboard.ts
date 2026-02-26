import { useState, useCallback } from 'react';

export function useClipboard(timeout = 2000) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copy = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => {
        setCopiedField(null);
      }, timeout);
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      return false;
    }
  }, [timeout]);

  const isCopied = useCallback((field: string) => {
    return copiedField === field;
  }, [copiedField]);

  return { copy, isCopied };
}