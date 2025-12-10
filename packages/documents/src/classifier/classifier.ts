import { mistral } from "@ai-sdk/mistral";
import { generateObject } from "ai";
import { documentClassifierPrompt, imageClassifierPrompt } from "../prompt";
import { documentClassifierSchema, imageClassifierSchema } from "../schema";
import type {
  ClassificationResult,
  DocumentClassifierImageRequest,
  DocumentClassifierRequest,
} from "../types";

export class DocumentClassifier {
  private model = mistral("mistral-small-latest");

  async #processDocument({ content }: DocumentClassifierRequest): Promise<ClassificationResult> {
    const result = await generateObject({
      model: this.model,
      schema: documentClassifierSchema,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: documentClassifierPrompt,
        },
        {
          role: "user",
          content,
        },
      ],
    });

    return result.object;
  }

  async #processImage(request: DocumentClassifierImageRequest): Promise<ClassificationResult> {
    const result = await generateObject({
      model: this.model,
      schema: imageClassifierSchema,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: imageClassifierPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "image",
              image: request.content,
            },
          ],
        },
      ],
    });

    return result.object;
  }

  public async classifyDocument(request: DocumentClassifierRequest): Promise<ClassificationResult> {
    return this.#processDocument(request);
  }

  public async classifyImage(
    request: DocumentClassifierImageRequest
  ): Promise<ClassificationResult> {
    return this.#processImage(request);
  }

  public async classify(content: string, isImage = false): Promise<ClassificationResult> {
    if (isImage) {
      return this.classifyImage({ content });
    }
    return this.classifyDocument({ content });
  }
}

// Singleton instance
export const documentClassifier = new DocumentClassifier();
