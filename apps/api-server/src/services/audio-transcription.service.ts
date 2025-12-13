/**
 * Audio Transcription Service
 *
 * Transcribes audio files using OpenAI Whisper API.
 * Supports multiple audio formats: mp3, mp4, mpeg, mpga, m4a, wav, webm
 */

import OpenAI from "openai";
import { logger } from "../lib/logger";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Supported audio formats
export const SUPPORTED_AUDIO_FORMATS = [
  "audio/mpeg", // mp3
  "audio/mp4", // m4a
  "audio/mp3",
  "audio/mpga",
  "audio/m4a",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "video/mp4", // mp4 with audio
  "video/webm",
];

export const SUPPORTED_EXTENSIONS = [
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpga",
  ".m4a",
  ".wav",
  ".webm",
  ".ogg",
];

// Max file size (25MB - OpenAI limit)
export const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: TranscriptionSegment[];
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionOptions {
  /** Language code (ISO 639-1). Auto-detected if not provided */
  language?: string;
  /** Optional prompt to guide the model */
  prompt?: string;
  /** Response format: json, text, srt, verbose_json, vtt */
  responseFormat?: "json" | "text" | "srt" | "verbose_json" | "vtt";
  /** Temperature for sampling (0-1) */
  temperature?: number;
  /** Include word-level timestamps */
  timestampGranularities?: ("word" | "segment")[];
}

/**
 * Check if a mimetype is a supported audio format
 */
export function isSupportedAudioFormat(mimetype: string): boolean {
  return SUPPORTED_AUDIO_FORMATS.includes(mimetype.toLowerCase());
}

/**
 * Check if a file extension is a supported audio format
 */
export function isSupportedAudioExtension(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Validate audio file for transcription
 */
export function validateAudioFile(
  size: number,
  mimetype: string
): { valid: boolean; error?: string } {
  if (size > MAX_AUDIO_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${MAX_AUDIO_SIZE / (1024 * 1024)}MB`,
    };
  }

  if (!isSupportedAudioFormat(mimetype)) {
    return {
      valid: false,
      error: `Unsupported audio format: ${mimetype}. Supported: ${SUPPORTED_AUDIO_FORMATS.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Transcribe audio file using OpenAI Whisper
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  logger.info(
    { filename, size: audioBuffer.length, options },
    "[Transcription] Starting audio transcription"
  );

  try {
    // Create a File object from the buffer
    const file = new File([audioBuffer], filename, {
      type: "audio/mpeg",
    });

    const response = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: options.language,
      prompt: options.prompt,
      response_format: options.responseFormat || "verbose_json",
      temperature: options.temperature ?? 0,
      timestamp_granularities: options.timestampGranularities,
    });

    if (typeof response === "string") {
      return { text: response };
    }

    type OpenAITranscriptionJSON = {
      text: string;
      language?: string;
      duration?: number;
      segments?: Array<{ id: number; start: number; end: number; text: string }>;
    };
    const r = response as unknown as OpenAITranscriptionJSON;
    const result: TranscriptionResult = {
      text: r.text,
      language: r.language,
      duration: r.duration,
    };

    if (Array.isArray(r.segments)) {
      result.segments = r.segments.map((seg) => ({
        id: seg.id,
        start: seg.start,
        end: seg.end,
        text: seg.text,
      }));
    }

    logger.info(
      {
        filename,
        textLength: result.text.length,
        language: result.language,
        duration: result.duration,
        segmentCount: result.segments?.length,
      },
      "[Transcription] Audio transcription complete"
    );

    return result;
  } catch (error) {
    logger.error({ error, filename }, "[Transcription] Failed to transcribe audio");
    throw error;
  }
}

/**
 * Transcribe audio and return as SRT subtitles
 */
export async function transcribeToSRT(
  audioBuffer: Buffer,
  filename: string,
  options: Omit<TranscriptionOptions, "responseFormat"> = {}
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const file = new File([audioBuffer], filename, {
    type: "audio/mpeg",
  });

  const response = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: options.language,
    prompt: options.prompt,
    response_format: "srt",
    temperature: options.temperature ?? 0,
  });

  return response as unknown as string;
}

/**
 * Transcribe audio and return as VTT subtitles
 */
export async function transcribeToVTT(
  audioBuffer: Buffer,
  filename: string,
  options: Omit<TranscriptionOptions, "responseFormat"> = {}
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const file = new File([audioBuffer], filename, {
    type: "audio/mpeg",
  });

  const response = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: options.language,
    prompt: options.prompt,
    response_format: "vtt",
    temperature: options.temperature ?? 0,
  });

  return response as unknown as string;
}

/**
 * Detect language from audio sample
 */
export async function detectAudioLanguage(
  audioBuffer: Buffer,
  filename: string
): Promise<string | null> {
  try {
    const result = await transcribeAudio(audioBuffer, filename, {
      responseFormat: "verbose_json",
    });
    return result.language || null;
  } catch {
    return null;
  }
}

/**
 * Translate audio to English
 */
export async function translateAudioToEnglish(
  audioBuffer: Buffer,
  filename: string,
  options: Omit<TranscriptionOptions, "language"> = {}
): Promise<TranscriptionResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  logger.info({ filename }, "[Translation] Starting audio translation to English");

  const file = new File([audioBuffer], filename, {
    type: "audio/mpeg",
  });

  const response = await openai.audio.translations.create({
    file,
    model: "whisper-1",
    prompt: options.prompt,
    response_format: "verbose_json",
    temperature: options.temperature ?? 0,
  });

  const r = response as unknown as {
    text: string;
    duration?: number;
    segments?: Array<{ id: number; start: number; end: number; text: string }>;
  };
  const result: TranscriptionResult = {
    text: r.text,
    language: "en",
    duration: r.duration,
  };

  if (Array.isArray(r.segments)) {
    result.segments = r.segments.map((seg) => ({
      id: seg.id,
      start: seg.start,
      end: seg.end,
      text: seg.text,
    }));
  }

  logger.info(
    { filename, textLength: result.text.length },
    "[Translation] Audio translation complete"
  );

  return result;
}

export default {
  transcribeAudio,
  transcribeToSRT,
  transcribeToVTT,
  translateAudioToEnglish,
  detectAudioLanguage,
  validateAudioFile,
  isSupportedAudioFormat,
  isSupportedAudioExtension,
  SUPPORTED_AUDIO_FORMATS,
  SUPPORTED_EXTENSIONS,
  MAX_AUDIO_SIZE,
};
