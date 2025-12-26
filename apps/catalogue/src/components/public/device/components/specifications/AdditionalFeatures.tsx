import React from "react";
import { Sparkles } from "lucide-react";
import { type DeviceData } from "../../types";
import { SpecificationSection } from "../SpecificationSection";

type AdditionalFeaturesProps = {
  deviceData: DeviceData;
};

export const AdditionalFeatures: React.FC<AdditionalFeaturesProps> = ({
  deviceData,
}) => {
  const hasFeatures = deviceData?.nfc || deviceData?.headphoneJack;

  if (!hasFeatures) {
    return null;
  }

  return (
    <SpecificationSection title="Доп. фичи" icon={Sparkles}>
      <ul className="mt-1 space-y-1">
        {deviceData?.nfc && <li className="text-sm">NFC</li>}
        {deviceData?.headphoneJack && (
          <li className="text-sm">3.5mm аудио-разъем</li>
        )}
      </ul>
    </SpecificationSection>
  );
};
