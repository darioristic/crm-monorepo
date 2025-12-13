/**
 * Audio Transcription API Route
 * Proxies to the backend transcription service
 */

import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { audio, mimeType } = body;

    if (!audio) {
      return Response.json({ success: false, error: "Audio data is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const cookieHeader = allCookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // Convert base64 back to buffer
    const binaryString = atob(audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create form data for the backend
    const formData = new FormData();
    const blob = new Blob([bytes], { type: mimeType || "audio/webm" });
    formData.append("file", blob, "recording.webm");

    const response = await fetch(`${API_URL}/api/v1/audio/transcribe`, {
      method: "POST",
      headers: {
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend transcription error:", errorText);
      return Response.json(
        { success: false, error: "Transcription failed" },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.success && data.data?.text) {
      return Response.json({ success: true, text: data.data.text });
    }

    return Response.json({ success: false, error: "No transcription returned" }, { status: 500 });
  } catch (error) {
    console.error("Transcription API error:", error);
    return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
