"use client";

import { useState, useCallback, useRef } from "react";
import { Navigation } from "@/components/Navigation";
import { WebcamCapture } from "@/components/WebcamCapture";
import { BicepCurlAnalyzer, type BicepCurlMetrics } from "@/lib/BicepCurlAnalyzer";
import { Play, Square, RotateCcw, Save, FileText, Trash2 } from "lucide-react";
import "./fitness.css";

export default function FitnessPage() {
  const [isExerciseActive, setIsExerciseActive] = useState(false);
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
      <Navigation />
      <main className="min-h-screen pt-16 pb-8 bg-doom-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="exercise-title">
              Bicep Curl Tracker
            </h1>
            <p className="exercise-subtitle">
              Real-time form analysis with posture and technique validation
            </p>
          </div>

          {/* Main Content - Responsive Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Webcam Feed - Takes 2 columns on large screens */}
            <div className="lg:col-span-2">
              <WebcamCapture
                onPoseDetected={handlePoseDetected}
                isActive={isExerciseActive}
                className="w-full"
                currentAngles={metrics.currentAngle}
              />

              {/* Exercise Controls */}
              <div className="controls-container">
                {!isExerciseActive ? (
                  <button
                    onClick={startExercise}
                    className="control-button-primary"
                  >
                    <Play className="w-5 h-5" />
                    <span>Start Exercise</span>
                  </button>
                ) : (
                  <button
                    onClick={stopExercise}
                    className="control-button-secondary"
                  >
                    <Square className="w-5 h-5" />
                    <span>Stop Exercise</span>
                  </button>
                )}

                <button
                  onClick={resetExercise}
                  className="control-button-outline"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>Reset</span>
                </button>

                {metrics.repCount > 0 && (
                  <button
                    onClick={saveSession}
                    className="control-button-save"
                  >
                    <Save className="w-5 h-5" />
                    <span>Save Session</span>
                  </button>
                )}

                <button
                  onClick={viewLogs}
                  className="control-button-outline"
                  title="View logs in console"
                >
                  <FileText className="w-5 h-5" />
                  <span>View Logs</span>
                </button>

                <button
                  onClick={clearLogs}
                  className="control-button-outline"
                  title="Clear all logs"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Clear Logs</span>
                </button>
              </div>
            </div>

            {/* Metrics Panel - 1 column on large screens, full width on mobile */}
            <div className="space-y-4">
              {/* Rep Counter - Large Display */}
              <div className="metric-card-primary">
                <div className="metric-label">Reps Completed</div>
                <div className="metric-value-large">
                  {metrics.repCount}
                </div>
                <div className="phase-indicator">
                  {isExerciseActive && (
                    <span className={`phase-badge phase-${metrics.phase}`}>
                      {metrics.phase === 'up' ? '⬆️ Curling' : '⬇️ Lowering'}
                    </span>
                  )}
                </div>
              </div>

              {/* Form Scores */}
              <div className="metric-card">
                <h3 className="metric-card-title">Form Analysis</h3>
                <div className="space-y-3">
                  <ScoreBar
                    label="Overall Form"
                    score={metrics.formScore}
                    color="primary"
                  />
                  <ScoreBar
                    label="Posture"
                    score={metrics.postureScore}
                    color="accent"
                  />
                  <ScoreBar
                    label="Arm Position"
                    score={metrics.armPositionScore}
                    color="secondary"
                  />
                  <ScoreBar
                    label="Visibility"
                    score={metrics.visibilityScore}
                    color="muted"
                  />
                </div>
              </div>

              {/* Angle Display */}
              <div className="metric-card">
                <h3 className="metric-card-title">Elbow Angles</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="angle-label">Left</div>
                    <div className="angle-value">
                      {Math.round(metrics.currentAngle.left)}°
                    </div>
                  </div>
                  <div>
                    <div className="angle-label">Right</div>
                    <div className="angle-value">
                      {Math.round(metrics.currentAngle.right)}°
                    </div>
                  </div>
                </div>
              </div>

              {/* Position Status */}
              <div className={`status-card ${metrics.isInValidPosition ? 'status-valid' : 'status-invalid'}`}>
                <div className="status-indicator">
                  {metrics.isInValidPosition ? '✅' : '⚠️'}
                </div>
                <div className="status-text">
                  {metrics.isInValidPosition
                    ? 'Ready to Track'
                    : 'Check Form Below'}
                </div>
              </div>
            </div>
          </div>

          {/* Feedback Panel - Full Width */}
          {metrics.feedback.length > 0 && (
            <div className="feedback-panel">
              <h3 className="feedback-title">Live Feedback</h3>
              <div className="feedback-list">
                {metrics.feedback.map((item, index) => (
                  <div key={index} className="feedback-item">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

interface ScoreBarProps {
  label: string;
  score: number;
  color: 'primary' | 'secondary' | 'accent' | 'muted';
}

function ScoreBar({ label, score, color }: ScoreBarProps) {
  const getColorClass = () => {
    switch (color) {
      case 'primary': return 'score-bar-primary';
      case 'secondary': return 'score-bar-secondary';
      case 'accent': return 'score-bar-accent';
      default: return 'score-bar-muted';
    }
  };

  return (
    <div>
      <div className="score-label">
        <span>{label}</span>
        <span className="score-number">{score}%</span>
      </div>
      <div className="score-bar-bg">
        <div
          className={`score-bar ${getColorClass()}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
