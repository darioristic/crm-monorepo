import { openai } from "@ai-sdk/openai";
import { Agent, type AgentConfig } from "@ai-sdk-tools/agents";
import { RedisProvider } from "@ai-sdk-tools/memory/redis";
import type { CoreMessage } from "ai";
import { redis } from "../../../cache/redis";
import { logger } from "../../../lib/logger";
import type { AppContext, ChatUserContext } from "../../types";

// Memory provider using existing Redis client
export const memoryProvider = new RedisProvider(redis);

export function formatContextForLLM(context: AppContext): string {
  return `<company_info>
<tenant_id>${context.teamId}</tenant_id>
<current_date>${context.currentDateTime}</current_date>
<timezone>${context.timezone}</timezone>
<company_name>${context.companyName}</company_name>
<base_currency>${context.baseCurrency}</base_currency>
<locale>${context.locale}</locale>
</company_info>

IMPORTANT: When calling tools that require a tenantId parameter, use the tenant_id value above: "${context.teamId}"`;
}

export const COMMON_AGENT_RULES = `<behavior_rules>
- Call tools immediately without explanatory text
- Use parallel tool calls when possible
- Provide specific numbers and actionable insights
- Explain your reasoning
- Lead with the most important information first
- When presenting repeated structured data (lists of items, multiple entries, time series), always use markdown tables
- Tables make data scannable and easier to compare - use them for any data with 2+ rows
- Be concise but thorough
- If you don't have enough information, ask for clarification
</behavior_rules>`;

export function buildAppContext(context: ChatUserContext, chatId: string): AppContext {
  const scopedUserId = `${context.userId}:${context.teamId}`;

  return {
    userId: scopedUserId,
    fullName: context.fullName ?? "",
    companyName: context.teamName ?? "",
    chatId,
    baseCurrency: context.baseCurrency ?? "EUR",
    locale: context.locale ?? "sr-RS",
    currentDateTime: new Date().toISOString(),
    timezone: context.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    teamId: context.teamId,
  };
}

// Create agent using @ai-sdk-tools/agents Agent class (identical to Midday)
export const createAgent = (config: AgentConfig<AppContext>) => {
  return new Agent({
    ...config,
    memory: {
      provider: memoryProvider,
      history: {
        enabled: true,
        limit: 10,
      },
      workingMemory: {
        enabled: false,
        scope: "user" as const,
      },
      chats: {
        enabled: true,
      },
    },
  });
};

// Chat history management (kept for backwards compatibility)
const CHAT_HISTORY_PREFIX = "chat:history:";
const MEMORY_TTL = 60 * 60 * 24 * 7; // 7 days

export async function getChatHistory(chatId: string, limit = 20): Promise<CoreMessage[]> {
  try {
    const key = `${CHAT_HISTORY_PREFIX}${chatId}`;
    const history = await redis.lrange(key, -limit, -1);
    return history.map((msg) => JSON.parse(msg) as CoreMessage);
  } catch (error) {
    logger.error({ error }, "Error getting chat history");
    return [];
  }
}

export async function saveChatMessage(chatId: string, message: CoreMessage): Promise<void> {
  try {
    const key = `${CHAT_HISTORY_PREFIX}${chatId}`;
    await redis.rpush(key, JSON.stringify(message));
    await redis.expire(key, MEMORY_TTL);
  } catch (error) {
    logger.error({ error }, "Error saving chat message");
  }
}

// Default model configurations
export const models: Record<string, ReturnType<typeof openai>> = {
  fast: openai("gpt-4o-mini"),
  smart: openai("gpt-4o"),
};
