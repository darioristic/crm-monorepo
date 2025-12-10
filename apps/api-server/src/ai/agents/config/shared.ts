import { openai } from "@ai-sdk/openai";
import type { CoreMessage, LanguageModel } from "ai";
import { redis } from "../../../cache/redis";
import { logger } from "../../../lib/logger";
import type { AppContext, ChatUserContext } from "../../types";

// Memory storage using Redis
const CHAT_HISTORY_PREFIX = "chat:history:";
const CHAT_MEMORY_PREFIX = "chat:memory:";
const MEMORY_TTL = 60 * 60 * 24 * 7; // 7 days

export interface AgentConfig {
  name: string;
  model: LanguageModel;
  temperature?: number;
  instructions: string | ((ctx: AppContext) => string);
  tools?: Record<string, unknown>;
  maxTurns?: number;
}

export interface Agent {
  name: string;
  config: AgentConfig;
  getSystemPrompt: (ctx: AppContext) => string;
}

export function formatContextForLLM(context: AppContext): string {
  return `<company_info>
<current_date>${context.currentDateTime}</current_date>
<timezone>${context.timezone}</timezone>
<company_name>${context.companyName}</company_name>
<base_currency>${context.baseCurrency}</base_currency>
<locale>${context.locale}</locale>
</company_info>

Important: Use the current date/time above for time-sensitive operations. User-specific information is maintained in your working memory.`;
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

export function createAgent(config: AgentConfig): Agent {
  return {
    name: config.name,
    config,
    getSystemPrompt: (ctx: AppContext) => {
      const instructions =
        typeof config.instructions === "function" ? config.instructions(ctx) : config.instructions;
      return instructions;
    },
  };
}

// Chat history management
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

export async function clearChatHistory(chatId: string): Promise<void> {
  try {
    const key = `${CHAT_HISTORY_PREFIX}${chatId}`;
    await redis.del(key);
  } catch (error) {
    logger.error({ error }, "Error clearing chat history");
  }
}

// Working memory management
export async function getWorkingMemory(userId: string): Promise<string | null> {
  try {
    const key = `${CHAT_MEMORY_PREFIX}${userId}`;
    return await redis.get(key);
  } catch (error) {
    logger.error({ error }, "Error getting working memory");
    return null;
  }
}

export async function saveWorkingMemory(userId: string, memory: string): Promise<void> {
  try {
    const key = `${CHAT_MEMORY_PREFIX}${userId}`;
    await redis.set(key, memory);
    await redis.expire(key, MEMORY_TTL);
  } catch (error) {
    logger.error({ error }, "Error saving working memory");
  }
}

// Default model configurations
export const models: Record<string, unknown> = {
  fast: openai("gpt-4o-mini"),
  smart: openai("gpt-4o"),
  embedding: openai.embedding("text-embedding-3-small"),
};
