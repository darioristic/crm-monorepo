/**
 * Chat API Route - Proxies to the backend AI chat service
 */

import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cookieStore = await cookies();

    // Build cookie header from all cookies
    const allCookies = cookieStore.getAll();
    const cookieHeader = allCookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // Extract message from AI SDK format
    const messages = body.messages || [];
    const lastMessage = messages[messages.length - 1];

    // Debug logging removed to satisfy lint rules

    // Handle different content formats (string, array of parts, or object)
    let message = "";
    type Part = string | { type?: string; text?: string };

    if (typeof lastMessage?.content === "string") {
      message = lastMessage.content;
    } else if (Array.isArray(lastMessage?.content)) {
      // AI SDK can send content as array of parts
      message = lastMessage.content
        .map((part: Part) => (typeof part === "string" ? part : part?.text || ""))
        .join("");
    } else if (lastMessage?.content?.text) {
      message = lastMessage.content.text;
    } else if (lastMessage?.text) {
      // Handle { text: "..." } format
      message = lastMessage.text;
    } else if (Array.isArray(lastMessage?.parts)) {
      // AI SDK v5 uses parts array
      message = lastMessage.parts
        .filter((part: Part) => typeof part !== "string" && part.type === "text")
        .map((part: Part) => (typeof part !== "string" ? part.text || "" : ""))
        .join("");
    }

    // Debug logging removed

    const chatId = body.id || crypto.randomUUID();

    // Validate message is not empty
    if (!message.trim()) {
      return Response.json(
        { error: "Message cannot be empty", debug: { body, lastMessage } },
        { status: 400 }
      );
    }

    // Forward to backend API with cookies
    const response = await fetch(`${API_URL}/api/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({
        message,
        chatId,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: { message: "Chat request failed" } }));
      const errorMessage = error?.error?.message || error?.message || "Chat request failed";
      return Response.json({ error: errorMessage }, { status: response.status });
    }

    // Stream the response back
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
