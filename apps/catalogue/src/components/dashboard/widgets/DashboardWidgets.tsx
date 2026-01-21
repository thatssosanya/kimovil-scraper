import { useState } from "react";
import { DeviceStatsWidget } from "./widgets/DeviceStatsWidget";
import { RatingsOverviewWidget } from "./widgets/RatingsOverviewWidget";
import { CharacteristicsWidget } from "./widgets/CharacteristicsWidget";
import { AnalyticsPreviewWidget } from "./widgets/AnalyticsPreviewWidget";
import { cn } from "@/src/lib/utils";

type WidgetId = "device-stats" | "ratings-overview" | "characteristics" | "analytics-preview" | null;

export default function DashboardWidgets() {
  const [expandedWidget, setExpandedWidget] = useState<WidgetId>(null);

  const handleToggleWidget = (widgetId: WidgetId) => {
    setExpandedWidget(expandedWidget === widgetId ? null : widgetId);
  };

  const isExpanded = expandedWidget !== null;

  return (
    <div className={cn(
      "grid gap-3 p-4",
      isExpanded
        ? "grid-cols-1"
        : "grid-cols-1 md:grid-cols-2 auto-rows-min"
    )}>
      {(expandedWidget === null || expandedWidget === "device-stats") && (
        <DeviceStatsWidget
          expanded={expandedWidget === "device-stats"}
          onToggleExpand={() => handleToggleWidget("device-stats")}
        />
      )}
      {(expandedWidget === null || expandedWidget === "ratings-overview") && (
        <RatingsOverviewWidget
          expanded={expandedWidget === "ratings-overview"}
          onToggleExpand={() => handleToggleWidget("ratings-overview")}
        />
      )}
      {(expandedWidget === null || expandedWidget === "characteristics") && (
        <CharacteristicsWidget
          expanded={expandedWidget === "characteristics"}
          onToggleExpand={() => handleToggleWidget("characteristics")}
        />
      )}
      {(expandedWidget === null || expandedWidget === "analytics-preview") && (
        <AnalyticsPreviewWidget
          expanded={expandedWidget === "analytics-preview"}
          onToggleExpand={() => handleToggleWidget("analytics-preview")}
        />
      )}
    </div>
  );
}
