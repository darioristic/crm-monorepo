"use client";

import { WidgetProvider, WidgetsGrid, WidgetsHeader } from "@/components/widgets";
import { ChatInputSimple } from "@/components/widgets/chat-input-simple";

export default function DashboardPage() {
  return (
    <WidgetProvider>
      <div className="flex flex-col min-h-[calc(100vh-var(--header-height)-2rem)]">
        {/* Header with greeting */}
        <WidgetsHeader userName="Dario" />

        {/* Widgets Grid */}
        <div className="flex-1">
          <WidgetsGrid />
        </div>

        {/* Chat Input at bottom */}
        <div className="mt-8 pb-6">
          <ChatInputSimple />
        </div>
      </div>
    </WidgetProvider>
  );
}
