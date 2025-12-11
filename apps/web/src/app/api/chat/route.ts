/**
 * Chat API Route - Proxies to the backend AI chat service
 */

import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("[Chat API] Body keys:", Object.keys(body));
    console.log("[Chat API] Body:", JSON.stringify(body).slice(0, 500));

    const cookieStore = await cookies();

    // Build cookie header from all cookies
    const allCookies = cookieStore.getAll();
    const cookieHeader = allCookies.map((c) => `${c.name}=${c.value}`).join("; ");
    console.log("[Chat API] Cookies count:", allCookies.length);
    console.log("[Chat API] Cookie names:", allCookies.map(c => c.name).join(", "));

    // Extract message from AI SDK format
    const messages = body.messages || [];
    const lastMessage = messages[messages.length - 1];
    console.log("[Chat API] Messages count:", messages.length);
    console.log("[Chat API] Last message:", JSON.stringify(lastMessage)?.slice(0, 200));

    // Handle different content formats (string, array of parts, or object)
    let message = "";
    type Part = string | { type?: string; text?: string };

    if (typeof lastMessage?.content === "string") {
      message = lastMessage.content;
      console.log("[Chat API] Extracted from content string");
    } else if (Array.isArray(lastMessage?.content)) {
      // AI SDK can send content as array of parts
      message = lastMessage.content
        .map((part: Part) => (typeof part === "string" ? part : part?.text || ""))
        .join("");
      console.log("[Chat API] Extracted from content array");
    } else if (lastMessage?.content?.text) {
      message = lastMessage.content.text;
      console.log("[Chat API] Extracted from content.text");
    } else if (lastMessage?.text) {
      // Handle { text: "..." } format
      message = lastMessage.text;
      console.log("[Chat API] Extracted from text");
    } else if (Array.isArray(lastMessage?.parts)) {
      // AI SDK v5 uses parts array
      message = lastMessage.parts
        .filter((part: Part) => typeof part !== "string" && part.type === "text")
        .map((part: Part) => (typeof part !== "string" ? part.text || "" : ""))
        .join("");
      console.log("[Chat API] Extracted from parts array");
    } else if (body.message) {
      // Direct message format
      message = body.message;
      console.log("[Chat API] Extracted from direct body.message");
    }

    console.log("[Chat API] Final message:", message?.slice(0, 100));

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
    console.log("[Chat API] Calling backend:", `${API_URL}/api/v1/chat`);
    console.log("[Chat API] Request payload:", { message, chatId });

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

    console.log("[Chat API] Backend response status:", response.status);
    console.log("[Chat API] Backend response headers:", Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log("[Chat API] Backend error response:", errorText);
      try {
        const error = JSON.parse(errorText);
        const errorMessage = error?.error?.message || error?.message || "Chat request failed";
        return Response.json({ error: errorMessage }, { status: response.status });
      } catch {
        return Response.json({ error: errorText || "Chat request failed" }, { status: response.status });
      }
    }

    // Parse JSON response from backend and convert to AI SDK data stream format
    const data = await response.json();
    console.log("[Chat API] Backend JSON response:", JSON.stringify(data).slice(0, 500));

    if (!data.success || !data.data?.message) {
      return Response.json({ error: "Invalid response from backend" }, { status: 500 });
    }

    const assistantMessage = data.data.message;
    const responseText = assistantMessage.content;

    // Convert to AI SDK data stream format
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send text as a single chunk in AI SDK format
        const textChunk = `0:${JSON.stringify(responseText)}\n`;
        controller.enqueue(encoder.encode(textChunk));
        // Send done signal
        controller.enqueue(encoder.encode(`d:{"finishReason":"stop"}\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Vercel-AI-Data-Stream": "v1",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
