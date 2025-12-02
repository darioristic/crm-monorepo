import type { CoreMessage } from "ai";

export type UITools = Record<string, unknown>;

export type ChatMessageMetadata = {
  webSearch?: boolean;
  toolCall?: {
    toolName: string;
    toolParams: Record<string, unknown>;
  };
};

export type MessageDataParts = Record<string, unknown> & {
  toolChoice?: string;
  agentChoice?: string;
};

export type UIChatMessage = CoreMessage & {
  metadata?: ChatMessageMetadata;
  data?: MessageDataParts;
};

export interface ChatUserContext {
  userId: string;
  teamId: string;
  teamName?: string | null;
  fullName?: string | null;
  baseCurrency?: string | null;
  locale?: string | null;
  timezone?: string | null;
}

export interface AppContext {
  userId: string;
  fullName: string;
  companyName: string;
  baseCurrency: string;
  locale: string;
  currentDateTime: string;
  timezone: string;
  chatId: string;
  teamId?: string;
  [key: string]: unknown;
}

export interface ToolResponse {
  text: string;
  link?: {
    text: string;
    url: string;
  };
}

