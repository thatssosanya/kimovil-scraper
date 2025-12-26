import { useState, useCallback } from "react";
import type { TableRowField, EditableField } from "../types";

export function useEditableFields(initialFields: (EditableField & { value: unknown })[]) {
  const [fields, setFields] = useState<TableRowField[]>(() =>
    initialFields.map(field => ({
      ...field,
      value: field.value as string | number | boolean | null,
      isEditing: false,
      isDirty: false,
    }))
  );

  const updateFieldValue = useCallback((key: string, value: unknown) => {
    setFields(prev => prev.map(field => 
      field.key === key
        ? { ...field, value: value as string | number | boolean | null, isDirty: true }
        : field
    ));
  }, []);

  const setFieldEditing = useCallback((key: string, isEditing: boolean) => {
    setFields(prev => prev.map(field => 
      field.key === key
        ? { ...field, isEditing }
        : field
    ));
  }, []);

  const resetField = useCallback((key: string) => {
    setFields(prev => prev.map(field => 
      field.key === key
        ? { ...field, isDirty: false, isEditing: false }
        : field
    ));
  }, []);

  const getDirtyFields = useCallback(() => {
    return fields.filter(field => field.isDirty);
  }, [fields]);

  return {
    fields,
    updateFieldValue,
    setFieldEditing,
    resetField,
    getDirtyFields,
  };
}