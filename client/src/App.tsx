import React, { useEffect, useRef } from 'react';
import * as fabric from 'fabric';
import { drawLandmarks } from './utils/drawUtils';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);

  useEffect(() => {
    // Initialize video stream
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(err => console.error("Error accessing webcam:", err));
    }

    // Initialize Fabric canvas
    if (canvasRef.current) {
      // Fabric.Canvas expects the id or element
      const canvas = new fabric.Canvas(canvasRef.current, {
        width: window.innerWidth,
        height: window.innerHeight,
        isDrawingMode: true
      });
      fabricCanvasRef.current = canvas;

      // Clean up
      return () => {
        canvas.dispose();
      };
    }
  }, []);

  // Initialize Hand Tracking
  useEffect(() => {
    let landmarker: any = null;
    let animationFrameId: number;

    const predictWebcam = () => {
      if (landmarker && videoRef.current && videoRef.current.currentTime > 0) {
        // Detect hands
        const results = landmarker.detectForVideo(videoRef.current, performance.now());
        if (results.landmarks && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            drawLandmarks(ctx, results.landmarks);
          }
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
      {/* Video Layer */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="absolute top-0 left-0 w-full h-full object-cover opacity-50 pointer-events-none"
      />

      {/* Canvas Layer */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full z-10"
      />

      {/* UI Overlay */}
      <div className="absolute top-4 left-4 z-20 text-white">
        <h1 className="text-2xl font-bold drop-shadow-md">CV Whiteboard</h1>
        <p className="text-sm opacity-80">Initializing Hand Tracking...</p>
      </div>
    </div>
  );
}

export default App;
