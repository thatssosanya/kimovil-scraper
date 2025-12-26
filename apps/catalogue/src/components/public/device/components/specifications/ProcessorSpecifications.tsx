import React from "react";
import { Cpu } from "lucide-react";
import { type Characteristic, type DeviceData } from "../../types";
import { SpecificationSection } from "../SpecificationSection";
import { CharacteristicsTable } from "../CharacteristicsTable";

type ProcessorSpecificationsProps = {
  deviceData: DeviceData;
};

const normalizedProcessorSpecifications = (
  deviceData: DeviceData
): Characteristic[] => {
  return [
    {
      label: "Процессор",
      value: deviceData?.cpu || "—",
    },
    {
      label: "Ядра",
      value:
        deviceData?.cpuCoresArr
          .map((coreType) => {
            const [count, frequency] = coreType.split("x");
            if (!frequency || !count) return "";
            return `${count} x ${(parseInt(frequency, 10) / 1000).toPrecision(
              1
            )} ГГц`;
          })
          .join(", ") || "—",
    },
    {
      label: "Графический процессор",
      value: deviceData?.gpu || "—",
    },
  ];
};

export const ProcessorSpecifications: React.FC<
  ProcessorSpecificationsProps
> = ({ deviceData }) => {
  const characteristics = normalizedProcessorSpecifications(deviceData);

  return (
    <SpecificationSection title="Процессор" icon={Cpu}>
      {characteristics.length > 0 && (
        <CharacteristicsTable characteristics={characteristics} />
      )}
    </SpecificationSection>
  );
};
