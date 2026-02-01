import { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { drawLandmarks } from './utils/drawUtils';
import { calculateDistance } from './utils/geometryUtils';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fabricCanvasRef = useRef<HTMLCanvasElement>(null); // Bottom layer: Persistent Drawing
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null); // Top layer: Hand Tracking Overlay
  const fabricInstanceRef = useRef<fabric.Canvas | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);

  // 1. Initialize Video Stream
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(err => console.error("Error accessing webcam:", err));
    }
  }, []);

  // 2. Initialize Fabric Canvas (Drawing Layer)
  useEffect(() => {
    if (fabricCanvasRef.current) {
      const canvas = new fabric.Canvas(fabricCanvasRef.current, {
        width: window.innerWidth,
        height: window.innerHeight,
        isDrawingMode: true // Initially true, we'll control brush programmatically
      });

      // Customize brush
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.width = 5;
      canvas.freeDrawingBrush.color = "white";

      // Initially disable user mouse interaction for drawing if we want only hand control,
      // but for now let's keep it mixed or controlled by state. 
      // Actually, for "pinch to draw", we want to simulate drawing events.
      // Fabric's isDrawingMode listens to mouse events. We might need to manually trigger them 
      // or just toggle isDrawingMode based on pinch state if we map hand pos to mouse pos.
      // A simpler approach for v1: Use Fabric's programmatic drawing if possible, 
      // OR mostly just map the "Pinch" to "Mouse Down" logic.

      // Let's rely on standard isDrawingMode but we might need custom logic to inject points 
      // if we want the HAND to draw, not the mouse.
      // Fabric 6/7 structure might differ slightly.

      fabricInstanceRef.current = canvas;

      return () => {
        canvas.dispose();
      };
    }
  }, []);

  // 3. Hand Tracking & Gesture Loop
  useEffect(() => {
    let landmarker: any = null;
    let animationFrameId: number;
    // We need to keep track of previous pinch state to trigger "down" vs "up" vs "move"
    let wasPinching = false;

    // Helper to simulate Fabric events or draw manually
    // Since Fabric's free drawing brush is tied to mouse events usually, 
    // we might have to manually construct paths or override the brush mechanism.
    // For MVP, let's try mapping the index finger position to line segments.

    // HOWEVER, `isDrawingMode` in Fabric handles `mousedown`, `mousemove`, `mouseup`.
    // We can simulate these events on the canvas element!

    const triggerEvent = (eventName: string, x: number, y: number) => {
      if (!fabricCanvasRef.current) return;

      const event = new MouseEvent(eventName, {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      });
      // We target the upper-canvas which fabric creates, but our ref points to the lower one usually wrapper.
      // Fabric creates a wrapper .canvas-container and puts .upper-canvas (interactive) on top.
      // We need to dispatch to the top-most canvas element that Fabric listens to.
      const upperCanvas = document.querySelector('.upper-canvas');
      if (upperCanvas) {
        upperCanvas.dispatchEvent(event);
      }
    };

    const predictWebcam = () => {
      if (landmarker && videoRef.current && videoRef.current.currentTime > 0) {
        const startTimeMs = performance.now();
        const results = landmarker.detectForVideo(videoRef.current, startTimeMs);

        // Clear overlay canvas
        if (overlayCanvasRef.current) {
          const ctx = overlayCanvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
            // Draw landmarks on overlay
            if (results.landmarks) {
              drawLandmarks(ctx, results.landmarks);
            }
          }
        }

        // Gesture Logic
        if (results.landmarks && results.landmarks.length > 0) {
          const hand = results.landmarks[0]; // Assume one hand for now
          const thumbTip = hand[4];
          const indexTip = hand[8];

          // Calculate distance (simple euclidean in 3d or 2d normalized space)
          // Coordinates are normalized [0,1]. Aspect ratio matters for "real" distance but check threshold empirically.
          // Let's use 2D distance for simplicity.
          const distance = calculateDistance(
            { x: thumbTip.x, y: thumbTip.y },
            { x: indexTip.x, y: indexTip.y }
          );

          // Threshold for "Pinch" - adjust as needed
          const PINCH_THRESHOLD = 0.05;
          const isPinching = distance < PINCH_THRESHOLD;

          // Map hand coordinates to screen coordinates
          // Note: Video might be mirrored! If so, x = 1 - x
          // If the video element is mirrored via CSS (`transform: scaleX(-1)`), we might not need to flip logic 
          // BUT MediaPipe output matches the source image.
          // Usually local webcam is mirrored for user comfort.
          // For now, let's assume standard mapping:
          const x = (1 - indexTip.x) * window.innerWidth;
          const y = indexTip.y * window.innerHeight;

          if (isPinching) {
            if (!wasPinching) {
              // Start drawing
              triggerEvent('mousedown', x, y);
              setIsDrawing(true);
            } else {
              // Continue drawing
              triggerEvent('mousemove', x, y);
            }
          } else {
            if (wasPinching) {
              // Stop drawing
              triggerEvent('mouseup', x, y);
              setIsDrawing(false);
            }
            // Move hover cursor? Optional.
            triggerEvent('mousemove', x, y);
          }

          wasPinching = isPinching;
        }
      }
      animationFrameId = requestAnimationFrame(predictWebcam);
    };

    import('./services/handTracking').then(({ createHandLandmarker }) => {
      createHandLandmarker().then((lm) => {
        landmarker = lm;
        predictWebcam();
      });
    });

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-900">
      {/* 1. Video Layer (Bottom) - Mirrored for natural feel */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover opacity-50 px-0 pointer-events-none scale-x-[-1]"
      />

      {/* 2. Drawing Layer (Fabric.js) - Middle */}
      {/* Fabric will wrap this canvas, we just need to position the container if needed. 
          Fabric usually appends the upper-canvas automatically. 
          We just place it absolute. */}
      <div className="absolute top-0 left-0 z-10">
        <canvas ref={fabricCanvasRef} />
      </div>

      {/* 3. Hand Tracking Overlay (Top) - Mirrored to match video? 
          Wait, drawingUtils draws based on landmarks. If we mirror video, 
          landmarks x coords needed flipping in our logic.
          If we mirror this canvas via CSS, the drawing matches the video.
      */}
      <canvas
        ref={overlayCanvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="absolute top-0 left-0 w-full h-full z-20 pointer-events-none scale-x-[-1]"
      />

      {/* UI Overlay */}
      <div className="absolute top-4 left-4 z-30 text-white select-none pointer-events-none">
        <h1 className="text-2xl font-bold drop-shadow-md">CV Whiteboard</h1>
        <p className="text-sm opacity-80">
          {isDrawing ? "🖊️ Drawing Mode" : "✋ Hover Mode (Pinch to Draw)"}
        </p>
      </div>
    </div>
  );
}

export default App;
