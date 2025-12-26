import React from "react";
import { type DeviceData } from "../../types";
import { SpecificationSection } from "../SpecificationSection";
import { Fingerprint } from "lucide-react";

type BenchmarksProps = {
  deviceData: DeviceData;
};

export const Benchmarks: React.FC<BenchmarksProps> = ({ deviceData }) => {
  if (!deviceData) return null;
  const fixedScore = (benchmark: { score: number }) =>
    Number(benchmark.score.toString().replace(".", ""));

  return (
    <>
      {/* Benchmarks Section */}
      <SpecificationSection title="Тесты производительности" icon={Fingerprint}>
        <div className="flex gap-4">
          {deviceData.benchmarks.map((benchmark) => (
            <div
              className="flex min-w-[250px] items-center gap-6 rounded-3xl bg-gray-100 dark:bg-gray-800 p-6"
              key={benchmark.id}
            >
              <h3 className="text-gray-900 dark:text-white">{benchmark.name}</h3>
              <div className="rounded-full bg-white dark:bg-gray-900 px-6 py-4 text-xl font-bold text-gray-900 dark:text-white">
                {Intl.NumberFormat("ru-RU", {
                  maximumFractionDigits: 0,
                }).format(fixedScore(benchmark))}
              </div>
            </div>
          ))}
        </div>
      </SpecificationSection>
    </>
  );
};
