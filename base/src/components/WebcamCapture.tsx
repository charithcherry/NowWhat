"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, CameraOff, Loader2 } from "lucide-react";

interface WebcamCaptureProps {
  onPoseDetected?: (landmarks: any) => void;
  isActive: boolean;
  className?: string;
  currentAngles?: { left: number; right: number } | null;
  onCameraStateChange?: (active: boolean) => void;
  cameraCommand?: 'start' | 'stop' | null;
}

export function WebcamCapture({ onPoseDetected, isActive, className = "", currentAngles = null, onCameraStateChange, cameraCommand }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const poseRef = useRef<any>(null); // ONLY ref-based pose storage to prevent re-render issues
  const cameraRef = useRef<any>(null);
  const isInitializingRef = useRef(false);
  const isMountedRef = useRef(true); // Track if component is still mounted/active
  const cameraActiveRef = useRef(false); // Ref for immediate camera state (no async state delay)

  // Draw landmarks on canvas (defined first to avoid initialization issues)
  const drawLandmarks = useCallback((ctx: CanvasRenderingContext2D, landmarks: any[], width: number, height: number) => {
    landmarks.forEach((landmark) => {
      const x = landmark.x * width;
      const y = landmark.y * height;

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "#00ff88";
      ctx.fill();
      ctx.strokeStyle = "#00d9ff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, []);

  // Draw connections between landmarks (skeleton)
  const drawConnections = useCallback((ctx: CanvasRenderingContext2D, landmarks: any[], width: number, height: number) => {
    const connections = [
      [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
      [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
      [24, 26], [26, 28],
    ];

    ctx.strokeStyle = "rgba(0, 255, 136, 0.5)";
    ctx.lineWidth = 3;

    connections.forEach(([startIdx, endIdx]) => {
      const start = landmarks[startIdx];
      const end = landmarks[endIdx];

      if (start && end) {
        ctx.beginPath();
        ctx.moveTo(start.x * width, start.y * height);
        ctx.lineTo(end.x * width, end.y * height);
        ctx.stroke();
      }
    });
  }, []);

  // Handle pose detection results (using handleResults to avoid naming conflicts)
  const handleResults = useCallback(
    (results: any) => {
      // Check if component is still mounted and camera is active
      // This prevents using the pose instance after it's been destroyed
      // CRITICAL: Use cameraActiveRef.current instead of cameraActive state to avoid async state delay
      if (!isMountedRef.current || !cameraActiveRef.current) {
        console.log("Skipping results - component not active");
        return;
      }

      if (!canvasRef.current || !videoRef.current) {
        console.log("Skipping results - canvas or video not available");
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.log("Skipping results - no canvas context");
        return;
      }

      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.poseLandmarks) {
        console.log("Drawing pose landmarks on canvas!");
        // Draw green skeleton on canvas when pose detected
        drawConnections(ctx, results.poseLandmarks, canvas.width, canvas.height);
        drawLandmarks(ctx, results.poseLandmarks, canvas.width, canvas.height);

        // Draw angle text on canvas (matching JavaScript implementation)
        if (currentAngles) {
          const leftElbow = results.poseLandmarks[13]; // Left elbow landmark
          const rightElbow = results.poseLandmarks[14]; // Right elbow landmark

          // Set text style (blue text like the JS reference)
          ctx.fillStyle = "#0000FF";
          ctx.font = "20px serif";

          // Draw left elbow angle
          if (leftElbow) {
            const leftX = leftElbow.x * canvas.width;
            const leftY = leftElbow.y * canvas.height;
            ctx.fillText(`${Math.round(currentAngles.left)}°`, leftX, leftY - 10);
          }

          // Draw right elbow angle
          if (rightElbow) {
            const rightX = rightElbow.x * canvas.width;
            const rightY = rightElbow.y * canvas.height;
            ctx.fillText(`${Math.round(currentAngles.right)}°`, rightX, rightY - 10);
          }
        }

        // Call the callback prop if provided
        if (onPoseDetected) {
          onPoseDetected(results.poseLandmarks);
        }
      } else {
        console.log("No pose landmarks detected in this frame");
      }
    },
    [onPoseDetected, drawConnections, drawLandmarks, currentAngles]
  );

  // Initialize MediaPipe Pose when camera starts
  const initializePose = useCallback(async () => {
    if (typeof window === "undefined") return;

    // Guard against concurrent initialization attempts
    if (isInitializingRef.current) {
      console.log("Initialization already in progress, skipping...");
      return;
    }

    try {
      isInitializingRef.current = true;
      isMountedRef.current = true; // Set mounted flag when starting camera
      setIsLoading(true);
      setError(null);
      console.log("Starting camera initialization...");

      // Get camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        console.log("Video stream started");
      }

      // Load MediaPipe
      const { Pose } = await import("@mediapipe/pose");
      const { Camera: MediaPipeCamera } = await import("@mediapipe/camera_utils");

      console.log("Creating Pose instance...");

      // Fix for WASM Module.arguments error - set up global environment
      if (typeof (window as any).Module === 'undefined') {
        (window as any).Module = {};
      }

      const poseInstance = new Pose({
        locateFile: (file) => {
          // Use unpkg CDN with specific version for better compatibility
          return `https://unpkg.com/@mediapipe/pose@0.5.1675469404/${file}`;
        },
      });

      console.log("Setting Pose options...");
      poseInstance.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      // Store pose instance in ref BEFORE setting up camera
      // This ensures poseRef.current is available when onFrame starts calling
      poseRef.current = poseInstance;

      // Use handleResults as the callback
      poseInstance.onResults(handleResults);

      // CRITICAL: Set camera active flags BEFORE starting camera
      // This ensures handleResults doesn't skip results due to async state updates
      cameraActiveRef.current = true;
      setCameraActive(true);
      if (onCameraStateChange) onCameraStateChange(true);
      console.log("Camera flags set - ready to process results");

      if (videoRef.current) {
        const camera = new MediaPipeCamera(videoRef.current, {
          onFrame: async () => {
            // CRITICAL: Check if pose instance exists before sending frames
            // This prevents "Cannot pass deleted object" error
            if (poseRef.current && videoRef.current && isMountedRef.current) {
              try {
                console.log("Sending frame to pose detection...");
                await poseRef.current.send({ image: videoRef.current });
              } catch (err) {
                console.error("Error sending frame:", err);
                // Don't throw - just log and continue to next frame
              }
            }
          },
          width: 1280,
          height: 720,
        });
        await camera.start();
        cameraRef.current = camera;
        console.log("MediaPipe camera started, sending frames...");
      }

      setIsLoading(false);
      isInitializingRef.current = false;
      console.log("Initialization complete!");
    } catch (err) {
      console.error("Error:", err);
      setError(`Failed to initialize camera: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsLoading(false);
      isInitializingRef.current = false;
    }
  }, [handleResults]);

  // Clean up resources properly when camera stops
  const stopCamera = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Step 1: Set flags to false to prevent handleResults from processing frames
    isMountedRef.current = false;
    cameraActiveRef.current = false;
    setCameraActive(false);
    if (onCameraStateChange) onCameraStateChange(false);

    // Step 2: Stop MediaPipe camera first (stops sending new frames)
    if (cameraRef.current) {
      try {
        cameraRef.current.stop();
      } catch (err) {
        console.log("Camera already stopped");
      }
      cameraRef.current = null;
    }

    // Step 3: Wait briefly for any pending frames to finish processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 4: Close pose instance (safe now that no frames are being sent)
    if (poseRef.current) {
      try {
        poseRef.current.close();
        console.log("Closed pose instance");
      } catch (err) {
        console.log("Pose already closed");
      }
      poseRef.current = null;
    }

    // Step 5: Stop video tracks
    if (video && video.srcObject) {
      const tracks = (video.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      video.srcObject = null;
    }

    // Step 6: Clear canvas
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    // Reset initialization flag
    isInitializingRef.current = false;
  }, []); // No dependencies - use refs only

  // Toggle camera (Turn On Camera / Stop Camera)
  const toggleCamera = () => {
    if (cameraActive) {
      stopCamera();
    } else {
      initializePose();
    }
  };

  // NOTE: Camera should NOT auto-start. User must click "Turn On Camera" button.
  // The isActive prop is used for tracking exercise state, not camera state.
  // Removed auto-start effect to prevent unwanted camera activation.

  // Handle camera commands from parent
  useEffect(() => {
    if (cameraCommand === 'start' && !cameraActive) {
      initializePose();
    } else if (cameraCommand === 'stop' && cameraActive) {
      stopCamera();
    }
  }, [cameraCommand, cameraActive, initializePose, stopCamera]);

  // Cleanup on unmount - ensures camera is stopped when navigating away
  // CRITICAL: Empty dependency array [] ensures cleanup ONLY runs on actual component unmount,
  // not when state changes (like setPose). This prevents the camera from being destroyed
  // immediately after initialization.
  useEffect(() => {
    // Set mounted flag to true when component mounts
    isMountedRef.current = true;

    return () => {
      console.log("Component unmounting - cleaning up camera resources");

      // Step 1: Set flags to false to prevent handleResults from processing frames
      isMountedRef.current = false;
      cameraActiveRef.current = false;

      // Step 2: Stop MediaPipe camera first (stops sending new frames)
      if (cameraRef.current) {
        try {
          cameraRef.current.stop();
          console.log("Stopped MediaPipe camera");
        } catch (err) {
          console.log("Cleanup: Camera already stopped");
        }
        cameraRef.current = null;
      }

      // Step 3: Small delay to let pending frames finish (synchronous in cleanup)
      // Note: We can't use async/await in cleanup, but the stop() above should prevent new frames

      // Step 4: Close pose instance (safe now that camera is stopped)
      // Access pose from ref to get current value (not closure)
      if (poseRef.current) {
        try {
          poseRef.current.close();
          console.log("Closed pose instance");
        } catch (err) {
          console.log("Cleanup: Pose already closed");
        }
        poseRef.current = null;
      }

      // Step 5: Stop video tracks
      const video = videoRef.current;
      if (video && video.srcObject) {
        const tracks = (video.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => {
          track.stop();
          console.log("Stopped video track");
        });
        video.srcObject = null;
      }

      // Reset initialization flag
      isInitializingRef.current = false;
    };
  }, []); // Empty array - cleanup ONLY runs on actual unmount, NOT on state changes

  return (
    <div className={`relative ${className}`}>
      {/* Video Container */}
      <div className="relative w-full aspect-video bg-doom-bg rounded-xl overflow-hidden border-2 border-doom-primary/30">
        {/* Video Element */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          playsInline
          muted
          autoPlay
          style={{ display: cameraActive ? 'block' : 'none' }}
        />

        {/* Canvas for pose overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1] z-10"
          style={{ display: cameraActive ? 'block' : 'none' }}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-doom-bg/80 z-20">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-doom-primary animate-spin mx-auto mb-4" />
              <p className="text-doom-text">Initializing camera...</p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-doom-bg/80 z-20">
            <div className="text-center p-6 max-w-md">
              <CameraOff className="w-12 h-12 text-doom-secondary mx-auto mb-4" />
              <p className="text-doom-text mb-4">{error}</p>
              <button
                onClick={initializePose}
                className="px-6 py-2 bg-doom-primary text-doom-bg rounded-lg hover:scale-105 transition-transform"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Camera Inactive Overlay */}
        {!cameraActive && !isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-doom-bg/80 z-20">
            <div className="text-center">
              <Camera className="w-16 h-16 text-doom-primary mx-auto mb-4" />
              <p className="text-doom-text mb-4">Camera is off</p>
              <button
                onClick={toggleCamera}
                className="px-6 py-2 bg-doom-primary text-doom-bg rounded-lg hover:scale-105 transition-transform font-semibold"
              >
                Turn On Camera
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
