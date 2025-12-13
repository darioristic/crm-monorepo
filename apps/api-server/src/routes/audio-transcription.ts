/**
 * Audio Transcription Routes
 * API endpoints for transcribing audio files
 */

import { errorResponse, successResponse } from "@crm/utils";
import { logger } from "../lib/logger";
import { verifyAndGetUser } from "../middleware/auth";
import * as audioService from "../services/audio-transcription.service";
import { documentsService } from "../services/documents.service";
import * as fileStorage from "../services/file-storage.service";
import type { Route } from "./helpers";
import { applyCompanyIdFromHeader, getCompanyIdForFilter, json, parseBody } from "./helpers";

export const audioTranscriptionRoutes: Route[] = [
  // POST /api/v1/audio/transcribe - Transcribe uploaded audio file
  {
    method: "POST",
    pattern: /^\/api\/v1\/audio\/transcribe$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File)) {
          return json(errorResponse("VALIDATION_ERROR", "Audio file required"), 400);
        }

        // Validate file
        const validation = audioService.validateAudioFile(file.size, file.type);
        if (!validation.valid) {
          return json(errorResponse("VALIDATION_ERROR", validation.error!), 400);
        }

        // Get options from form data
        const language = formData.get("language")?.toString();
        const prompt = formData.get("prompt")?.toString();
        const format = formData.get("format")?.toString() as
          | "json"
          | "text"
          | "srt"
          | "vtt"
          | undefined;

        // Convert to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        let result: audioService.TranscriptionResult;
        if (format === "srt") {
          const srt = await audioService.transcribeToSRT(buffer, file.name, { language, prompt });
          return json(successResponse({ format: "srt", content: srt }));
        } else if (format === "vtt") {
          const vtt = await audioService.transcribeToVTT(buffer, file.name, { language, prompt });
          return json(successResponse({ format: "vtt", content: vtt }));
        } else {
          result = await audioService.transcribeAudio(buffer, file.name, {
            language,
            prompt,
            responseFormat: "verbose_json",
          });
        }

        return json(successResponse(result));
      } catch (error) {
        logger.error({ error }, "Audio transcription failed");
        return json(errorResponse("INTERNAL_ERROR", "Failed to transcribe audio"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/audio/transcribe-base64 - Transcribe base64 encoded audio
  {
    method: "POST",
    pattern: /^\/api\/v1\/audio\/transcribe-base64$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const body = await parseBody<{
          contentBase64: string;
          filename: string;
          mimetype: string;
          language?: string;
          prompt?: string;
          format?: "json" | "srt" | "vtt";
        }>(request);

        if (!body?.contentBase64 || !body?.filename || !body?.mimetype) {
          return json(
            errorResponse("VALIDATION_ERROR", "contentBase64, filename, and mimetype required"),
            400
          );
        }

        const buffer = Buffer.from(body.contentBase64, "base64");

        // Validate
        const validation = audioService.validateAudioFile(buffer.length, body.mimetype);
        if (!validation.valid) {
          return json(errorResponse("VALIDATION_ERROR", validation.error!), 400);
        }

        let result: audioService.TranscriptionResult;
        if (body.format === "srt") {
          const srt = await audioService.transcribeToSRT(buffer, body.filename, {
            language: body.language,
            prompt: body.prompt,
          });
          return json(successResponse({ format: "srt", content: srt }));
        } else if (body.format === "vtt") {
          const vtt = await audioService.transcribeToVTT(buffer, body.filename, {
            language: body.language,
            prompt: body.prompt,
          });
          return json(successResponse({ format: "vtt", content: vtt }));
        } else {
          result = await audioService.transcribeAudio(buffer, body.filename, {
            language: body.language,
            prompt: body.prompt,
            responseFormat: "verbose_json",
          });
        }

        return json(successResponse(result));
      } catch (error) {
        logger.error({ error }, "Audio transcription failed");
        return json(errorResponse("INTERNAL_ERROR", "Failed to transcribe audio"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/audio/translate - Translate audio to English
  {
    method: "POST",
    pattern: /^\/api\/v1\/audio\/translate$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      try {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File)) {
          return json(errorResponse("VALIDATION_ERROR", "Audio file required"), 400);
        }

        const validation = audioService.validateAudioFile(file.size, file.type);
        if (!validation.valid) {
          return json(errorResponse("VALIDATION_ERROR", validation.error!), 400);
        }

        const prompt = formData.get("prompt")?.toString();
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const result = await audioService.translateAudioToEnglish(buffer, file.name, { prompt });

        return json(successResponse(result));
      } catch (error) {
        logger.error({ error }, "Audio translation failed");
        return json(errorResponse("INTERNAL_ERROR", "Failed to translate audio"), 500);
      }
    },
    params: [],
  },

  // POST /api/v1/documents/:id/transcribe - Transcribe audio document from vault
  {
    method: "POST",
    pattern: /^\/api\/v1\/documents\/([^/]+)\/transcribe$/,
    handler: async (request, _url, params) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      const effectiveUrl = applyCompanyIdFromHeader(request, new URL(request.url));
      const { companyId, error } = await getCompanyIdForFilter(effectiveUrl, auth, false);
      if (error) return error;
      if (!companyId) {
        return json(errorResponse("VALIDATION_ERROR", "Company ID required"), 400);
      }

      try {
        // Get document
        const docResult = await documentsService.getDocumentById(params.id, companyId);
        if (!docResult.success || !docResult.data) {
          return json(errorResponse("NOT_FOUND", "Document not found"), 404);
        }

        const doc = docResult.data;
        const pathTokens = doc.pathTokens;

        if (!pathTokens || pathTokens.length === 0) {
          return json(errorResponse("NOT_FOUND", "File not found"), 404);
        }

        const mimetype = (doc.metadata?.mimetype as string) || "audio/mpeg";

        // Validate it's an audio file
        if (!audioService.isSupportedAudioFormat(mimetype)) {
          return json(errorResponse("VALIDATION_ERROR", `Not an audio file: ${mimetype}`), 400);
        }

        // Read file
        const buffer = await fileStorage.readFileAsBuffer(pathTokens);
        if (!buffer) {
          return json(errorResponse("NOT_FOUND", "File content not found"), 404);
        }

        // Get options
        let options: { language?: string; prompt?: string } = {};
        try {
          options = (await parseBody<typeof options>(request)) || {};
        } catch {
          // Ignore
        }

        // Transcribe
        const result = await audioService.transcribeAudio(buffer, doc.name || "audio.mp3", {
          language: options.language,
          prompt: options.prompt,
          responseFormat: "verbose_json",
        });

        // Update document summary with transcription text
        await documentsService.updateDocument(params.id, companyId, {
          summary: result.text,
        });

        return json(
          successResponse({
            documentId: params.id,
            transcription: result,
          })
        );
      } catch (error) {
        logger.error({ error, documentId: params.id }, "Document transcription failed");
        return json(errorResponse("INTERNAL_ERROR", "Failed to transcribe document"), 500);
      }
    },
    params: ["id"],
  },

  // GET /api/v1/audio/formats - Get supported audio formats
  {
    method: "GET",
    pattern: /^\/api\/v1\/audio\/formats$/,
    handler: async (request) => {
      const auth = await verifyAndGetUser(request);
      if (!auth) {
        return json(errorResponse("UNAUTHORIZED", "Authentication required"), 401);
      }

      return json(
        successResponse({
          mimetypes: audioService.SUPPORTED_AUDIO_FORMATS,
          extensions: audioService.SUPPORTED_EXTENSIONS,
          maxSizeBytes: audioService.MAX_AUDIO_SIZE,
          maxSizeMB: audioService.MAX_AUDIO_SIZE / (1024 * 1024),
        })
      );
    },
    params: [],
  },
];

export default audioTranscriptionRoutes;
