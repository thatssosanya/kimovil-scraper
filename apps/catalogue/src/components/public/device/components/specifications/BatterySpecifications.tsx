import React from "react";
import { BatteryCharging } from "lucide-react";
import { type Characteristic, type DeviceData } from "../../types";
import { SpecificationSection } from "../SpecificationSection";
import { CharacteristicsTable } from "../CharacteristicsTable";

type BatterySpecificationsProps = {
  deviceData: DeviceData;
};

const calculateBatteryChargeTime = (
  batteryCapacity: number, // mAh
  batteryWattage: number // W
) => {
  if (!batteryCapacity || !batteryWattage) {
    return null;
  }

  // Constants for realistic battery charging calculation
  const TYPICAL_VOLTAGE = 3.9; // V (typical Li-ion battery voltage)
  const CHARGING_EFFICIENCY = 0.8; // 80% efficiency (typical for modern chargers)
  const FAST_CHARGE_THRESHOLD = 0.8; // Fast charging up to 80%
  const SLOW_CHARGE_FACTOR = 0.2; // Slower charging for last 20%

  // Convert mAh to Wh (Watt-hours)
  const batteryCapacityWh = (batteryCapacity * TYPICAL_VOLTAGE) / 1000;

  // Account for charging efficiency
  const effectiveWattage = batteryWattage * CHARGING_EFFICIENCY;

  // Calculate time to 80% (fast charging phase)
  const timeToEightyPercent =
    (batteryCapacityWh * FAST_CHARGE_THRESHOLD) / effectiveWattage;

  // Calculate time for remaining 20% (slower charging phase)
  const remainingCapacityWh = batteryCapacityWh * (1 - FAST_CHARGE_THRESHOLD);
  const timeForRemaining =
    remainingCapacityWh / (effectiveWattage * SLOW_CHARGE_FACTOR);

  // Total charging time in hours
  const totalTimeHours = timeToEightyPercent + timeForRemaining;

  // Convert to minutes and format
  const totalTimeMinutes = Math.round(totalTimeHours * 60);

  if (totalTimeMinutes < 60) {
    return `${totalTimeMinutes} мин`;
  } else {
    const hours = Math.floor(totalTimeMinutes / 60);
    const minutes = totalTimeMinutes % 60;
    return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
  }
};

const normalizedBatterySpecifications = (
  deviceData: DeviceData
): Characteristic[] => {
  const chargeTime =
    deviceData?.batteryCapacity_mah && deviceData?.batteryWattage
      ? calculateBatteryChargeTime(
          deviceData.batteryCapacity_mah,
          deviceData.batteryWattage
        )
      : null;

  return [
    {
      label: "Ёмкость батареи",
      value: `${deviceData?.batteryCapacity_mah} мАч`,
    },
    {
      label: "Быстрая зарядка",
      value: deviceData?.batteryFastCharging ? "Да" : "Нет",
    },
    {
      label: "Мощность зарядки",
      value: deviceData?.batteryWattage
        ? `${deviceData.batteryWattage} Вт`
        : "—",
    },
    {
      label: "Зарядка до 80% (мин)",
      value: chargeTime ? `≈${chargeTime}` : "—",
    },
  ];
};

export const BatterySpecifications: React.FC<BatterySpecificationsProps> = ({
  deviceData,
}) => {
  const characteristics = normalizedBatterySpecifications(deviceData);

  return (
    <SpecificationSection title="Батарея" icon={BatteryCharging}>
      <CharacteristicsTable characteristics={characteristics} />
    </SpecificationSection>
  );
};
