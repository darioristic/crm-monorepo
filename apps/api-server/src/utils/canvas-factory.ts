export class NodeCanvasFactory {
  async create(width: number, height: number): Promise<{ canvas: any; context: any }> {
    const { createCanvas } = await import("canvas");
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }

  reset(canvasAndContext: { canvas: any; context: any }, width: number, height: number): void {
    if (canvasAndContext.canvas) {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    }
  }

  destroy(canvasAndContext: { canvas: any; context: any }): void {
    if (canvasAndContext.canvas) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
    }
  }
}
