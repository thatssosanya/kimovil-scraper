import { cn } from "@/src/utils/cn";
import { type Characteristic } from "../types";

export const CharacteristicsTable = (props: {
  characteristics: Characteristic[];
}) => {
  if (props.characteristics.length === 0) {
    return null;
  }

  return (
    <table
      className="w-full"
      role="table"
      aria-label="Характеристики устройства"
    >
      <tbody>
        {props.characteristics.map((characteristic, index) => (
          <tr
            key={characteristic.label}
            className={cn(
              "flex flex-col gap-1 px-6 py-4 md:flex-row md:items-center",
              index % 2 === 0 ? "bg-gray-100 dark:bg-gray-800" : "bg-white dark:bg-gray-900"
            )}
          >
            <td className="min-w-64 text-base font-medium text-gray-600 dark:text-gray-400 md:text-xl">
              {characteristic.label}
            </td>
            <td className="text-xl font-semibold text-gray-900 dark:text-white">
              {characteristic.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
