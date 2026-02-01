import { HandLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";

export const drawLandmarks = (canvasContext: CanvasRenderingContext2D, landmarks: any[]) => {
  if (!canvasContext || !landmarks) return;

  const drawingUtils = new DrawingUtils(canvasContext);

  canvasContext.clearRect(0, 0, canvasContext.canvas.width, canvasContext.canvas.height);

  for (const landmark of landmarks) {
    drawingUtils.drawConnectors(landmark, HandLandmarker.HAND_CONNECTIONS, {
      color: "#00FF00",
      lineWidth: 5
    });
    drawingUtils.drawLandmarks(landmark, {
      color: "#FF0000",
      lineWidth: 2,
      radius: 3
    });
  }
};
