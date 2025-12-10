import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { NodeCanvasFactory } from "./canvas-factory";

/**
 * Converts the first page of a PDF to a PNG image buffer.
 * Used for generating thumbnail previews in the Vault.
 */
export async function getPdfImage(data: ArrayBuffer): Promise<Buffer | null> {
  const canvasFactory = new NodeCanvasFactory();

  const loadingTask = getDocument({
    data,
    cMapPacked: true,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  try {
    const pdfDocument = await loadingTask.promise;

    // Use page 1 for the thumbnail
    const page = await pdfDocument.getPage(1);

    // Scale 2.0 for good quality thumbnail
    const viewport = page.getViewport({ scale: 2.0 });

    const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);

    const renderContext = {
      canvasContext: canvasAndContext.context,
      viewport,
      canvasFactory,
    };

    // @ts-expect-error - pdfjs types don't match exactly
    const renderTask = page.render(renderContext);
    await renderTask.promise;

    // Return image as PNG buffer
    const canvas = canvasAndContext.canvas;
    return canvas.toBuffer("image/png");
  } catch (error) {
    console.error("PDF to image conversion failed:", error);
    return null;
  }
}
