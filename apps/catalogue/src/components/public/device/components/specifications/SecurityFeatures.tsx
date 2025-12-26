import React from "react";
import { type Characteristic, type DeviceData } from "../../types";
import { CharacteristicsTable } from "../CharacteristicsTable";
import { SpecificationSection } from "../SpecificationSection";
import { Fingerprint } from "lucide-react";

type SecurityFeaturesProps = {
  deviceData: DeviceData;
};

const fingerprintPositionMap = {
  screen: "В экране",
  side: "Сбоку",
  back: "Сзади",
};

const normalizeSecuritySpecifications = (
  deviceData: DeviceData
): Characteristic[] => {
  return [
    {
      label: "Сканер отпечатков",
      value:
        fingerprintPositionMap[
          deviceData?.fingerprintPosition as keyof typeof fingerprintPositionMap
        ] || "—",
    },
    {
      label: "USB-порт",
      value: deviceData?.usb || "—",
    },
  ];
};

export const SecurityFeatures: React.FC<SecurityFeaturesProps> = ({
  deviceData,
}) => {
  if (!deviceData) return null;

  const characteristics = normalizeSecuritySpecifications(deviceData);

  return (
    <>
      {/* Preview Section */}
      <SpecificationSection title="Безопасность и порты" icon={Fingerprint}>
        {characteristics.length > 0 && (
          <CharacteristicsTable characteristics={characteristics} />
        )}
      </SpecificationSection>
    </>
  );
};
