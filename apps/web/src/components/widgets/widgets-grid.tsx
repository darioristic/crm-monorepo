"use client";

import { AccountBalancesWidget } from "./account-balances";
import { CashFlowWidget } from "./cash-flow";
import { CustomerLifetimeValueWidget } from "./customer-lifetime-value";
import { GrowthRateWidget } from "./growth-rate";
import { ProfitAnalysisWidget } from "./profit-analysis";
import { RevenueForecastWidget } from "./revenue-forecast";
import { RevenueSummaryWidget } from "./revenue-summary";
import { RunwayWidget } from "./runway";
import { type WidgetType, usePrimaryWidgets } from "./widget-provider";

const WIDGET_COMPONENTS: Record<WidgetType, React.ComponentType> = {
  runway: RunwayWidget,
  "cash-flow": CashFlowWidget,
  "account-balances": AccountBalancesWidget,
  "profit-analysis": ProfitAnalysisWidget,
  "revenue-forecast": RevenueForecastWidget,
  "revenue-summary": RevenueSummaryWidget,
  "growth-rate": GrowthRateWidget,
  "customer-lifetime-value": CustomerLifetimeValueWidget,
};

export function WidgetsGrid() {
  const primaryWidgets = usePrimaryWidgets();

  return (
    <div>
      {/* Mobile: Horizontal scrollable row with snap */}
      <div className="lg:hidden overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4">
        <div className="flex gap-4">
          {primaryWidgets.map((widgetType) => {
            const WidgetComponent = WIDGET_COMPONENTS[widgetType];
            return (
              <div
                key={widgetType}
                className="flex-shrink-0 w-[calc(100vw-2rem)] snap-center first:ml-4 last:mr-4"
              >
                <WidgetComponent />
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop: Grid layout */}
      <div className="hidden lg:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 gap-y-6">
        {primaryWidgets.map((widgetType) => {
          const WidgetComponent = WIDGET_COMPONENTS[widgetType];
          return <WidgetComponent key={widgetType} />;
        })}
      </div>
    </div>
  );
}
