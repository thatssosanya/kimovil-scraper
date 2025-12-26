import type { EditableField } from "../types";

export function getDeviceFieldsConfig(): EditableField[] {
  return [
    {
      key: "yandexId",
      label: "Yandex ID",
      type: "text",
      hint: "Внутренний идентификатор товара из Яндекс.Маркета",
    },
    {
      key: "imageUrl", 
      label: "Изображение",
      type: "image",
    },
  ];
}