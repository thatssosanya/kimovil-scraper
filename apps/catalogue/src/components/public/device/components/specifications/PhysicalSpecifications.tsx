import React from "react";
import { type Characteristic, type DeviceData } from "../../types";
import { CharacteristicsTable } from "../CharacteristicsTable";
import { SpecificationSection } from "../SpecificationSection";
import { Ruler, TabletSmartphone } from "lucide-react";

type PhysicalSpecificationsProps = {
  deviceData: DeviceData;
};

const normalizePhysicalSpecifications = (
  deviceData: DeviceData
): Characteristic[] => {
  const dimensions = [
    deviceData?.width_mm != null && `Ширина: ${deviceData.width_mm} мм`,
    deviceData?.height_mm != null && `Высота: ${deviceData.height_mm} мм`,
    deviceData?.thickness_mm != null && `Толщина: ${deviceData.thickness_mm} мм`,
  ].filter(Boolean);

  return [
    {
      label: "Вес",
      value: deviceData?.weight_g != null ? `${deviceData.weight_g} г` : "—",
    },
    {
      label: "Размеры",
      value: dimensions.length > 0 ? dimensions.join(", ") : "—",
    },
  ];
};

const normalizedMaterialSpecifications = (
  deviceData: DeviceData
): Characteristic[] => {
  return [
    {
      label: "Материал корпуса",
      value: deviceData?.materials.split("|").join(", ") || "—",
    },
    {
      label: "Защита от пыли и воды",
      value: deviceData?.ipRating
        ? `Сертификация ${deviceData?.ipRating}`
        : "отсутствует",
    },
  ];
};

export const PhysicalSpecifications: React.FC<PhysicalSpecificationsProps> = ({
  deviceData,
}) => {
  if (!deviceData) return null;

  const characteristics = normalizePhysicalSpecifications(deviceData);
  const materialCharacteristics = normalizedMaterialSpecifications(deviceData);
  return (
    <>
      {/* Preview Section */}
      <SpecificationSection title="Размеры и вес" icon={Ruler}>
        {characteristics.length > 0 && (
          <CharacteristicsTable characteristics={characteristics} />
        )}
      </SpecificationSection>
      <div className="">
        <SpecificationSection title="Материалы" icon={TabletSmartphone}>
          {materialCharacteristics.length > 0 && (
            <CharacteristicsTable characteristics={materialCharacteristics} />
          )}
        </SpecificationSection>
      </div>
    </>
  );
};
