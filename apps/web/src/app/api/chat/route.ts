/**
 * Chat API Route - Proxies to the backend AI chat streaming service
 * Supports real-time streaming responses with tool calls
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

    // Fetch CSRF token from backend and include it in subsequent POSTs
    let csrfToken: string | null = null;
    try {
      const csrfResp = await fetch(`${API_URL}/api/v1/auth/csrf-token`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      });
      const csrfJson = await csrfResp.json().catch(() => ({}));
      csrfToken = (csrfJson?.data?.csrfToken as string | undefined) || null;
    } catch {
      csrfToken = null;
    }

    // Extract message from AI SDK format
    const messages = body.messages || [];
    const lastMessage = messages[messages.length - 1];

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
    } else if (body.message) {
      // Direct message format
      message = body.message;
    }

    const chatId = body.id || crypto.randomUUID();

    // Validate message is not empty
    if (!message.trim()) {
      return Response.json(
        { error: "Message cannot be empty", debug: { body, lastMessage } },
        { status: 400 }
      );
    }

    // Use the streaming endpoint
    const response = await fetch(`${API_URL}/api/v1/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({
        message,
        chatId,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "AI servis nije dostupan. Molim pokušajte kasnije.";
      try {
        const error = JSON.parse(errorText);
        errorMessage = error?.error?.message || error?.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      const encoder = new TextEncoder();
      const id = crypto.randomUUID();
      // Try non-streaming backend as a richer fallback
      try {
        const nonStream = await fetch(`${API_URL}/api/v1/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          body: JSON.stringify({
            message,
            chatId,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });

        if (nonStream.ok) {
          const json = await nonStream.json().catch(() => ({}));
          const content = (json?.data?.message?.content as string | undefined) || errorMessage;
          const msgId = (json?.data?.message?.id as string | undefined) || id;
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(`event: text-start\n`));
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "text-start", id: msgId })}\n\n`)
              );
              controller.enqueue(encoder.encode(`event: text-delta\n`));
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "text-delta", id: msgId, delta: content })}\n\n`
                )
              );
              controller.enqueue(encoder.encode(`event: text-end\n`));
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "text-end", id: msgId })}\n\n`)
              );
              controller.enqueue(encoder.encode(`event: done\n`));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
              controller.close();
            },
          });
          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
              "x-vercel-ai-ui-message-stream": "v1",
              "X-Chat-Id": chatId,
              "X-Agent": nonStream.headers.get("X-Agent") || "general",
            },
          });
        }
      } catch {
        // ignore and use simple error stream below
      }

      // Simple error stream fallback
      const simpleStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`event: text-start\n`));
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "text-start", id })}\n\n`)
          );
          controller.enqueue(encoder.encode(`event: text-delta\n`));
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "text-delta", id, delta: errorMessage })}\n\n`
            )
          );
          controller.enqueue(encoder.encode(`event: text-end\n`));
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "text-end", id })}\n\n`)
          );
          controller.enqueue(encoder.encode(`event: done\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        },
      });

      return new Response(simpleStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "x-vercel-ai-ui-message-stream": "v1",
          "X-Chat-Id": chatId,
          "X-Agent": "general",
        },
      });
    }

    // If backend returned no body, synthesize a minimal SSE so UI shows a message
    if (!response.body) {
      const encoder = new TextEncoder();
      const id = crypto.randomUUID();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`event: text-start\n`));
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "text-start", id })}\n\n`)
          );
          controller.enqueue(encoder.encode(`event: text-delta\n`));
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "text-delta", id, delta: "Nema odgovora od AI agenta." })}\n\n`
            )
          );
          controller.enqueue(encoder.encode(`event: text-end\n`));
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "text-end", id })}\n\n`)
          );
          controller.enqueue(encoder.encode(`event: done\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
          "x-vercel-ai-ui-message-stream": "v1",
          "X-Chat-Id": chatId,
          "X-Agent": "general",
          Connection: "keep-alive",
        },
      });
    }

    // Pass through the streaming response from the backend
    // AI SDK v5 uses toUIMessageStreamResponse() which sets specific headers for useChat parsing
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "text/event-stream",
        // SSE-friendly caching headers
        "Cache-Control": "no-cache, no-transform",
        // Disable proxy buffering to improve stream delivery
        "X-Accel-Buffering": "no",
        // Critical: This header tells @ai-sdk/react's useChat how to parse the stream
        "x-vercel-ai-ui-message-stream":
          response.headers.get("x-vercel-ai-ui-message-stream") || "v1",
        "X-Chat-Id": response.headers.get("X-Chat-Id") || chatId,
        "X-Agent": response.headers.get("X-Agent") || "general",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET endpoint for tools
export async function GET() {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const cookieHeader = allCookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const response = await fetch(`${API_URL}/api/v1/chat/tools`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });

    if (!response.ok) {
      return Response.json({ error: "Failed to fetch tools" }, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error("Tools API error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
