import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/src/server/api/root";

type RouterOutput = inferRouterOutputs<AppRouter>;

export type DeviceUpdateStats =
  RouterOutput["dashboardWidgets"]["getDeviceUpdateStats"];

export type RatingsPagesOverview =
  RouterOutput["dashboardWidgets"]["getRatingsPagesOverview"];

export type CharacteristicsCoverage =
  RouterOutput["dashboardWidgets"]["getCharacteristicsCoverage"];

export type AnalyticsPreview =
  RouterOutput["dashboardWidgets"]["getAnalyticsPreview"];

export interface WidgetProps {
  expanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
}

export interface ManagedWidgetProps {
  className?: string;
  expanded: boolean;
  onToggleExpand: () => void;
}
