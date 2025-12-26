import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/src/components/ui/Alert";
import { Button } from "@/src/components/ui/Button";
import { type DeviceWithFullDetails } from "@/src/types/rating";
import { useState } from "react";

interface RatingDeviceInvalidPositionsAlertProps {
  devices: DeviceWithFullDetails[];
  getEffectivePositions: () => Map<string, number>;
  fixedPositionsPreview: Map<string, number>;
  onFixPositions: () => void;
  isFixingPositions: boolean;
}

export const RatingDeviceInvalidPositionsAlert = ({
  devices,
  getEffectivePositions,
  fixedPositionsPreview,
  onFixPositions,
  isFixingPositions,
}: RatingDeviceInvalidPositionsAlertProps) => {
  const [showDebug, setShowDebug] = useState(false);

  // Get all devices that have positions, including those with positions > 5
  const devicesWithPositions = devices.filter((device) =>
    getEffectivePositions().has(device.id)
  );

  // Sort devices by their current position for consistent display
  const sortedDevices = devicesWithPositions.sort((a, b) => {
    const posA = getEffectivePositions().get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const posB = getEffectivePositions().get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return posA - posB;
  });

  // Prepare debug data
  const debugData = {
    devices: sortedDevices.map((device) => ({
      id: device.id,
      name: device.name,
      ratingPositions: device.ratingPositions,
      currentEffectivePosition: getEffectivePositions().get(device.id),
      fixedPosition: fixedPositionsPreview.get(device.id),
    })),
    effectivePositions: Array.from(getEffectivePositions().entries()).map(
      ([id, pos]) => ({
        deviceId: id,
        position: pos,
        deviceName: devices.find((d) => d.id === id)?.name,
      })
    ),
    fixedPositions: Array.from(fixedPositionsPreview.entries()).map(
      ([id, pos]) => ({
        deviceId: id,
        position: pos,
        deviceName: devices.find((d) => d.id === id)?.name,
      })
    ),
  };

  return (
    <div className="rounded-lg border bg-card">
      <Alert variant="destructive" className="flex flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="flex-1">
            <AlertTitle className="mb-1 text-sm font-medium">
              Нарушена последовательность позиций
            </AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              Для корректной работы рейтинга позиции должны идти по порядку (1,
              2, 3...)
            </AlertDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDebug(!showDebug)}
              className="gap-1"
            >
              {showDebug ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              Debug
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onFixPositions}
              disabled={isFixingPositions}
              className="gap-2 whitespace-nowrap"
            >
              {isFixingPositions ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Исправление...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3" />
                  Исправить
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="rounded-md bg-background/50 p-3">
          <div className="flex flex-col gap-2">
            {sortedDevices.map((device) => {
              const currentPos = getEffectivePositions().get(device.id) ?? 0;
              const newPos = fixedPositionsPreview.get(device.id);
              return (
                <div
                  key={device.id}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    {currentPos || "—"}
                  </span>
                  <span className="truncate">{device.name}</span>
                  {currentPos !== newPos && (
                    <span className="text-xs text-muted-foreground">
                      → {newPos}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {showDebug && (
          <div className="space-y-4 rounded-md bg-zinc-950 p-4 font-mono text-xs text-zinc-50">
            <div>
              <div className="mb-2 text-zinc-400">Devices and Positions:</div>
              <pre className="overflow-auto">
                {JSON.stringify(debugData.devices, null, 2)}
              </pre>
            </div>
            <div>
              <div className="mb-2 text-zinc-400">Effective Positions:</div>
              <pre className="overflow-auto">
                {JSON.stringify(debugData.effectivePositions, null, 2)}
              </pre>
            </div>
            <div>
              <div className="mb-2 text-zinc-400">Fixed Positions Preview:</div>
              <pre className="overflow-auto">
                {JSON.stringify(debugData.fixedPositions, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Alert>
    </div>
  );
};
