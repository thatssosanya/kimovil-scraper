import React, { useState, useEffect } from "react";
import { type Characteristic, type Screen } from "../types";
import { cn } from "@/src/utils/cn";
import { CharacteristicsTable } from "./CharacteristicsTable";

type ScreenTabsProps = {
  screens: Screen[];
};

export const ScreenTabs: React.FC<ScreenTabsProps> = ({ screens }) => {
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);

  // Set the main screen as selected by default when data loads
  useEffect(() => {
    if (screens.length > 0) {
      const mainScreen = screens.find((screen) => screen?.isMain);
      if (mainScreen) {
        setSelectedScreenId(mainScreen.id);
      } else {
        setSelectedScreenId(screens[0]?.id || null);
      }
    }
  }, [screens]);

  // If no screens or still loading selected screen
  if (screens.length === 0 || !selectedScreenId) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Нет данных об экране</p>;
  }

  // Multiple screens with tabs
  return (
    <div className="">
      {screens.length > 1 && (
        <nav className="mb-2 flex max-w-max rounded-lg " aria-label="Экраны">
          {screens.map((screen, index) => (
            <button
              key={screen.id}
              type="button"
              onClick={() => setSelectedScreenId(screen.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 font-medium transition-colors",
                screen.id === selectedScreenId
                  ? " font-bold text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-white"
              )}
              aria-current={screen.id === selectedScreenId ? "page" : undefined}
            >
              {screen.isMain && (
                <span className="h-1.5 w-1.5 rounded-full font-bold" />
              )}
              <span>
                {screen.isMain
                  ? "Основной"
                  : screen.position
                  ? screen.position.charAt(0).toUpperCase() +
                    screen.position.slice(1)
                  : `Экран ${index + 1}`}
              </span>
            </button>
          ))}
        </nav>
      )}

      <div className="">
        {screens
          .filter((screen) => screen && screen.id === selectedScreenId)
          .map((screen) => ({
            data: normalizeScreen(screen),
            id: screen.id,
          }))
          .map((screen) => (
            <CharacteristicsTable
              key={screen.id}
              characteristics={screen.data
                .filter((characteristic) => characteristic !== null)
                .filter((characteristic) => characteristic.value !== "—")}
            />
          ))}
      </div>
    </div>
  );
};

const normalizeScreen = (screen: Screen): (Characteristic | null)[] => {
  return [
    {
      label: "Размер",
      value: screen.size_in ? `${screen.size_in?.toString()}"` : "—",
    },
    { label: "Разрешение экрана", value: screen.resolution || "—" },
    {
      label: "PPI",
      value: screen.ppi ? `${screen.ppi?.toString()} пикселей на дюйм` : "—",
    },
    {
      label: "Частота кадров",
      value: screen.refreshRate ? `${screen.refreshRate?.toString()} Гц` : "—",
    },
    { label: "Технология", value: screen.displayType || "—" },
    {
      label: "Яркость",
      value: screen.brightnessNits
        ? `${screen.brightnessNits?.toString()} нит`
        : "—",
    },
  ];
};
