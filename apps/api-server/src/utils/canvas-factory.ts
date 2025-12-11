type CanvasLike = {
  width: number;
  height: number;
  getContext: (id: string) => unknown;
  toBuffer: (type?: string) => Buffer;
};

export class NodeCanvasFactory {
  async create(width: number, height: number): Promise<{ canvas: CanvasLike; context: unknown }> {
    const { createCanvas } = await import("canvas");
    const canvas: CanvasLike = createCanvas(width, height) as CanvasLike;
    const context = canvas.getContext("2d");
    return { canvas, context };
  }

  reset(
    canvasAndContext: { canvas: CanvasLike; context: unknown },
    width: number,
    height: number
  ): void {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: { canvas: CanvasLike; context: unknown }): void {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}
