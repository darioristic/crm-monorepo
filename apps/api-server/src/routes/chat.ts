/**
 * AI Chat Routes - Streaming chat endpoint
 */

import { openai } from "@ai-sdk/openai";
import { streamText, generateText, type CoreMessage } from "ai";
import { z } from "zod";
import { errorResponse } from "@crm/utils";
import { logger } from "../lib/logger";
import { verifyAndGetUser } from "../middleware/auth";
import type { Route } from "./helpers";
import { json } from "./helpers";

// Import AI components
import { mainAgent, routeToAgent, AVAILABLE_AGENTS } from "../ai/agents";
import {
  buildAppContext,
  getChatHistory,
  saveChatMessage,
} from "../ai/agents/config/shared";
import type { ChatUserContext, AppContext } from "../ai/types";

// Import tools
import { getInvoicesTool, getOverdueInvoicesTool } from "../ai/tools/get-invoices";
import { getCustomersTool, getCustomerByIdTool, getIndustriesSummaryTool } from "../ai/tools/get-customers";
import { getProductsTool, getProductCategoriesSummaryTool } from "../ai/tools/get-products";
import { getQuotesTool, getQuoteConversionRateTool } from "../ai/tools/get-quotes";

// Chat request schema
const chatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  chatId: z.string().optional(),
  timezone: z.string().optional(),
});

// All available tools
const tools = {
  getInvoices: getInvoicesTool,
  getOverdueInvoices: getOverdueInvoicesTool,
  getCustomers: getCustomersTool,
  getCustomerById: getCustomerByIdTool,
  getIndustriesSummary: getIndustriesSummaryTool,
  getProducts: getProductsTool,
  getProductCategories: getProductCategoriesSummaryTool,
  getQuotes: getQuotesTool,
  getQuoteConversion: getQuoteConversionRateTool,
};

// Route user message to appropriate agent
async function routeMessage(
  message: string,
  context: AppContext
): Promise<string> {
  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      temperature: 0.1,
      system: mainAgent.getSystemPrompt(context),
      prompt: message,
    });

    // Extract agent name from response
    const agentName = text.toLowerCase().trim();
    if (agentName in AVAILABLE_AGENTS) {
      return agentName;
    }
    return "general";
  } catch (error) {
    logger.error({ error }, "Error routing message");
    return "general";
  }
}

// Get tools for specific agent
function getAgentTools(agentName: string) {
  switch (agentName) {
    case "invoices":
      return {
        getInvoices: tools.getInvoices,
        getOverdueInvoices: tools.getOverdueInvoices,
      };
    case "customers":
      return {
        getCustomers: tools.getCustomers,
        getCustomerById: tools.getCustomerById,
        getIndustriesSummary: tools.getIndustriesSummary,
      };
    case "sales":
      return {
        getQuotes: tools.getQuotes,
        getQuoteConversion: tools.getQuoteConversion,
        getInvoices: tools.getInvoices,
        getCustomers: tools.getCustomers,
      };
    default:
      return tools; // General agent gets all tools
  }
}

// Chat routes
export const chatRoutes: Route[] = [
  // POST /api/v1/chat - Main chat endpoint with streaming
  {
    method: "POST",
    pattern: /^\/api\/v1\/chat$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(
          errorResponse("UNAUTHORIZED", "Authentication required"),
          401
        );
      }

      try {
        const body = await request.json();
        const validationResult = chatRequestSchema.safeParse(body);

        if (!validationResult.success) {
          return json(
            errorResponse("VALIDATION_ERROR", validationResult.error.message),
            400
          );
        }

        const { message, chatId = crypto.randomUUID(), timezone } = validationResult.data;

        // Build user context
        const userContext: ChatUserContext = {
          userId: auth.userId,
          teamId: auth.companyId || auth.userId,
          teamName: null,
          fullName: null,
          baseCurrency: "EUR",
          locale: "sr-RS",
          timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        };

        const appContext = buildAppContext(userContext, chatId);

        // Get chat history
        const history = await getChatHistory(chatId, 10);

        // Route to appropriate agent
        const agentName = await routeMessage(message, appContext);
        const selectedAgent = routeToAgent(agentName);
        const agentTools = getAgentTools(agentName);

        logger.info({ agentName, chatId }, "Routed to agent");

        // Save user message to history
        await saveChatMessage(chatId, {
          role: "user",
          content: message,
        });

        // Build messages array
        const messages: CoreMessage[] = [
          ...history,
          { role: "user", content: message },
        ];

        // Stream response
        const result = streamText({
          model: openai("gpt-4o-mini"),
          system: selectedAgent.getSystemPrompt(appContext),
          messages,
          tools: agentTools as any,
          onFinish: async ({ text }) => {
            // Save assistant response to history
            await saveChatMessage(chatId, {
              role: "assistant",
              content: text,
            });
          },
        });

        // Return streaming response
        return result.toTextStreamResponse();
      } catch (error) {
        logger.error({ error }, "Error in chat endpoint");
        return json(
          errorResponse("INTERNAL_ERROR", "Chat processing failed"),
          500
        );
      }
    },
    params: [],
  },

  // GET /api/v1/chat/history/:chatId - Get chat history
  {
    method: "GET",
    pattern: /^\/api\/v1\/chat\/history\/([^/]+)$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(
          errorResponse("UNAUTHORIZED", "Authentication required"),
          401
        );
      }

      try {
        const chatId = params.chatId;
        const history = await getChatHistory(chatId, 50);

        return json({
          success: true,
          data: {
            chatId,
            messages: history,
          },
        });
      } catch (error) {
        logger.error({ error }, "Error getting chat history");
        return json(
          errorResponse("INTERNAL_ERROR", "Failed to get chat history"),
          500
        );
      }
    },
    params: ["chatId"],
  },

  // GET /api/v1/chat/agents - List available agents
  {
    method: "GET",
    pattern: /^\/api\/v1\/chat\/agents$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(
          errorResponse("UNAUTHORIZED", "Authentication required"),
          401
        );
      }

      const agents = Object.keys(AVAILABLE_AGENTS).map((name) => ({
        name,
        description: getAgentDescription(name),
      }));

      return json({
        success: true,
        data: agents,
      });
    },
    params: [],
  },
];

function getAgentDescription(name: string): string {
  const descriptions: Record<string, string> = {
    general: "General questions, help, and navigation",
    invoices: "Invoice management, payments, and billing",
    customers: "Customer relationships and contact management",
    sales: "Sales pipeline, quotes, and revenue",
  };
  return descriptions[name] || "Specialized assistant";
}

export default chatRoutes;
