"use client";

import { useState, useCallback, useRef } from "react";
import { Navigation } from "@/components/Navigation";
import { WebcamCapture } from "@/components/WebcamCapture";
import { BicepCurlAnalyzer, type BicepCurlMetrics } from "@/lib/BicepCurlAnalyzer";
import { Play, Square, RotateCcw, FileText, Trash2, ChevronDown, Camera, CameraOff } from "lucide-react";
import "./fitness.css";

type ExerciseType = 'bicep-curl' | 'lateral-raises';

export default function FitnessPage() {
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType>('bicep-curl');
  const [isExerciseActive, setIsExerciseActive] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraCommand, setCameraCommand] = useState<'start' | 'stop' | null>(null);
  const isExerciseActiveRef = useRef(false); // Ref to avoid closure issues in useCallback
  const [metrics, setMetrics] = useState<BicepCurlMetrics>({
    repCount: 0,
    currentAngle: { left: 180, right: 180 },
    formScore: 0,
    postureScore: 0,
    armPositionScore: 0,
    visibilityScore: 0,
    feedback: [],
    isInValidPosition: false,
    phase: 'down',
  });

  const analyzerRef = useRef<BicepCurlAnalyzer | null>(null);
  const webcamRef = useRef<any>(null);

  // Initialize analyzer with logging callback
  if (!analyzerRef.current) {
    analyzerRef.current = new BicepCurlAnalyzer(async (message: string) => {
      // Send log to API endpoint
      try {
        await fetch('/api/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message }),
        });
      } catch (error) {
        console.error('Failed to send log to API:', error);
      }
    });
  }

  const handlePoseDetected = useCallback((landmarks: any) => {
    console.log(`🔍 handlePoseDetected called | Exercise Active (ref): ${isExerciseActiveRef.current} | Analyzer exists: ${!!analyzerRef.current} | Landmarks: ${landmarks?.length || 0}`);

    if (!isExerciseActiveRef.current || !analyzerRef.current) {
      console.log(`⚠️ Skipping analysis - Exercise Active: ${isExerciseActiveRef.current}, Analyzer: ${!!analyzerRef.current}`);
      return;
    }

    console.log("✅ Calling analyzer.analyze()...");
    const analyzer = analyzerRef.current;
    const newMetrics = analyzer.analyze(landmarks);
    setMetrics(newMetrics);
    console.log(`📊 Metrics updated - Reps: ${newMetrics.repCount}, Left: ${newMetrics.currentAngle.left}°, Right: ${newMetrics.currentAngle.right}°`);
  }, []); // Empty deps - use ref instead of state

  const startExercise = () => {
    if (!cameraActive) {
      alert('Please turn on the camera first!');
      return;
    }
    setIsExerciseActive(true);
    isExerciseActiveRef.current = true; // Update ref immediately
    if (analyzerRef.current) {
      analyzerRef.current.reset();
    }
    setMetrics({
      repCount: 0,
      currentAngle: { left: 180, right: 180 },
      formScore: 0,
      postureScore: 0,
      armPositionScore: 0,
      visibilityScore: 0,
      feedback: [],
      isInValidPosition: false,
      phase: 'down',
    });
    console.log('🏋️ Exercise Started - Logging to console and file');
  };

  const stopExercise = () => {
    setIsExerciseActive(false);
    isExerciseActiveRef.current = false; // Update ref immediately
  };

  const handleCameraStateChange = (active: boolean) => {
    setCameraActive(active);
  };

  const startCamera = () => {
    setCameraCommand('start');
    setTimeout(() => setCameraCommand(null), 100); // Reset command after triggering
  };

  const stopCamera = () => {
    setCameraCommand('stop');
    setTimeout(() => setCameraCommand(null), 100); // Reset command after triggering
  };

  const resetExercise = () => {
    if (analyzerRef.current) {
      analyzerRef.current.reset();
    }
    setMetrics({
      repCount: 0,
      currentAngle: { left: 180, right: 180 },
      formScore: 0,
      postureScore: 0,
      armPositionScore: 0,
      visibilityScore: 0,
      feedback: [],
      isInValidPosition: false,
      phase: 'down',
    });
    console.log('🔄 Exercise Reset');
  };

  const saveSession = async () => {
    try {
      const sessionData = {
        exercise: 'Bicep Curl',
        reps: metrics.repCount,
        duration: 0, // TODO: Track actual duration
        formScore: metrics.formScore,
        postureScore: metrics.postureScore,
        armPositionScore: metrics.armPositionScore,
        visibilityScore: metrics.visibilityScore,
        avgElbowAngle: (metrics.currentAngle.left + metrics.currentAngle.right) / 2,
      };

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData),
      });

      if (response.ok) {
        alert(`Session saved! Reps: ${metrics.repCount}, Form Score: ${metrics.formScore}`);
        resetExercise();
      } else {
        alert('Failed to save session. Please try again.');
      }
    } catch (error) {
      console.error('Error saving session:', error);
      alert('Failed to save session. Please try again.');
    }
  };

  const viewLogs = async () => {
    try {
      const response = await fetch('/api/log');
      const data = await response.json();

      if (data.logs && data.logs.length > 0) {
        console.log('=== EXERCISE LOGS ===');
        data.logs.forEach((log: string) => console.log(log));
        console.log('===================');
        alert(`Logs displayed in console. Total: ${data.logs.length} entries`);
      } else {
        alert('No logs found. Start exercising to generate logs!');
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      alert('Failed to fetch logs.');
    }
  };

  const clearLogs = async () => {
    if (!confirm('Are you sure you want to clear all logs?')) {
      return;
    }

    try {
      const response = await fetch('/api/log', {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Logs cleared successfully!');
        console.log('📝 All exercise logs have been cleared');
      } else {
        alert('Failed to clear logs.');
      }
    } catch (error) {
      console.error('Error clearing logs:', error);
      alert('Failed to clear logs.');
    }
  };

  return (
    <>
      {/* Conditionally show navigation - hide during exercise */}
      {!isExerciseActive && <Navigation />}

      <main className={`min-h-screen bg-doom-bg ${!isExerciseActive ? 'pt-16' : 'pt-0'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">

          {/* Top Bar - Exercise Selector + Controls */}
          <div className="top-bar">
            {/* Left: Exercise Selector */}
            <div className="exercise-selector-container">
              <label className="exercise-selector-label">Exercise Tracker:</label>
              <div className="exercise-dropdown">
                <select
                  value={selectedExercise}
                  onChange={(e) => setSelectedExercise(e.target.value as ExerciseType)}
                  className="exercise-select"
                  disabled={isExerciseActive}
                >
                  <option value="bicep-curl">Bicep Curl</option>
                  <option value="lateral-raises">Lateral Raises</option>
                </select>
                <ChevronDown className="dropdown-icon" />
              </div>
            </div>

            {/* Right: Control Buttons */}
            <div className="control-buttons-horizontal">
              {!isExerciseActive ? (
                <button onClick={startExercise} className="btn-primary">
                  <Play className="w-4 h-4" />
                  <span>Start Exercise</span>
                </button>
              ) : (
                <button onClick={stopExercise} className="btn-secondary">
                  <Square className="w-4 h-4" />
                  <span>Stop Exercise</span>
                </button>
              )}

              <button onClick={resetExercise} className="btn-outline">
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
              </button>

              {cameraActive ? (
                <button onClick={stopCamera} className="btn-outline">
                  <CameraOff className="w-4 h-4" />
                  <span className="hidden sm:inline">Stop Camera</span>
                </button>
              ) : (
                <button onClick={startCamera} className="btn-outline">
                  <Camera className="w-4 h-4" />
                  <span className="hidden sm:inline">Start Camera</span>
                </button>
              )}

              <button onClick={viewLogs} className="btn-outline" title="View logs in console">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">View Logs</span>
              </button>

              <button onClick={clearLogs} className="btn-outline" title="Clear all logs">
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Clear Logs</span>
              </button>
            </div>
          </div>

          {/* Camera View - Maximum Size */}
          <div className="camera-container">
            <WebcamCapture
              onPoseDetected={handlePoseDetected}
              isActive={isExerciseActive}
              className="w-full"
              currentAngles={metrics.currentAngle}
              onCameraStateChange={handleCameraStateChange}
              cameraCommand={cameraCommand}
            />
          </div>

          {/* Compact Metrics Bar - One Line */}
          <div className="metrics-bar">
            <div className="metric-pill">
              <span className="metric-pill-label">Reps:</span>
              <span className="metric-pill-value">{metrics.repCount}</span>
            </div>
            <div className="metric-pill">
              <span className="metric-pill-label">Form:</span>
              <span className="metric-pill-value">{metrics.formScore}%</span>
            </div>
            <div className="metric-pill">
              <span className="metric-pill-label">Posture:</span>
              <span className="metric-pill-value">{metrics.postureScore}%</span>
            </div>
            <div className="metric-pill">
              <span className="metric-pill-label">Arm Position:</span>
              <span className="metric-pill-value">{metrics.armPositionScore}%</span>
            </div>
            {isExerciseActive && (
              <div className={`metric-pill phase-pill phase-${metrics.phase}`}>
                <span className="metric-pill-value">
                  {metrics.phase === 'up' ? '↑ Curling' : '↓ Lowering'}
                </span>
              </div>
            )}
          </div>

          {/* Collapsible Instructions */}
          <div className="instructions-container">
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="instructions-toggle"
            >
              <span>Setup Instructions</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showInstructions ? 'rotate-180' : ''}`} />
            </button>

            {showInstructions && (
              <div className="instructions-content">
                <ul className="instructions-list">
                  <li>Stand 6-8 feet away from the camera</li>
                  <li>Ensure your full body is visible in the frame</li>
                  <li>Stand straight with good posture</li>
                  <li>Good lighting helps improve accuracy</li>
                  <li>Keep your elbows close to your sides during bicep curls</li>
                  <li>Perform movements slowly and with control</li>
                </ul>
              </div>
            )}
          </div>

        </div>
      </main>
    </>
  );
}