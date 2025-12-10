import { type Canvas, type CanvasRenderingContext2D, createCanvas } from "canvas";

/**
 * Factory for creating canvas elements in a Node.js/Bun environment.
 * This is required by pdfjs-dist when running outside a browser.
 */
export class NodeCanvasFactory {
  /**
   * Creates a canvas element and its 2D rendering context.
   */
  create(width: number, height: number): { canvas: Canvas; context: CanvasRenderingContext2D } {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return {
      canvas,
      context,
    };
  }

  /**
   * Resets the canvas and context for reuse.
   */
  reset(
    canvasAndContext: { canvas: Canvas; context: CanvasRenderingContext2D },
    width: number,
    height: number
  ): void {
    if (canvasAndContext.canvas) {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    }
  }

  /**
   * Destroys the canvas resources.
   */
  destroy(canvasAndContext: { canvas: Canvas; context: CanvasRenderingContext2D }): void {
    if (canvasAndContext.canvas) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
    }
  }
}
