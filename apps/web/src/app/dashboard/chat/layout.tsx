import type { ReactNode } from "react";

export const metadata = {
  title: "AI Chat | CRM",
  description: "Chat with AI assistant about your business",
};

export default function ChatLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

