"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FitnessNavigation } from "@/components/FitnessNavigation";
import { WebcamCapture } from "@/components/WebcamCapture";
import { Play, Square, RotateCcw, Camera, CameraOff, Volume2, VolumeX, X } from "lucide-react";
import {
  VoiceFeedbackManager,
  ElevenLabsVoice,
  getRepCountMessage,
  SESSION_MESSAGES,
  VOICE_FEEDBACK_SETTINGS,
  type VoicePriority,
} from "@/lib/voice";
import { useAuth } from "@/hooks/useAuth";
import {
  precomputeFrame,
  compileAnalyzer,
  type AnalysisState,
  type AnalysisResult,
  type ExerciseFrame,
} from "@/lib/video-agents/precompute";
import "./fitness.css";

type AIStatus = 'idle' | 'generating' | 'ready' | 'error';

interface ChatMessage {
  role: 'user' | 'coach';
  text: string;
}

interface ConvEntry {
  role: string;
  text: string;
}

type FitnessSessionStatus = 'completed' | 'stopped_early' | 'abandoned';

interface SessionTracker {
  startedAtMs: number | null;
  frameCount: number;
  validFrameCount: number;
  formScoreSum: number;
  postureScoreSum: number;
  armPositionScoreSum: number;
  visibilityScoreSum: number;
  bestRepScore: number | null;
  worstRepScore: number | null;
  currentRepScoreSum: number;
  currentRepFrameCount: number;
  lastRepCount: number;
  leftElbowSum: number;
  rightElbowSum: number;
  leftEshSum: number;
  rightEshSum: number;
  leftArmBodyAngleSum: number;
  rightArmBodyAngleSum: number;
  leftKneeSum: number;
  rightKneeSum: number;
  biomechanicsFrameCount: number;
  persisted: boolean;
}

const BICEP_CURL_EXERCISE_PATTERN = /\bbicep\b|\bbiceps\b|\bcurl\b/i;

function createEmptySessionTracker(): SessionTracker {
  return {
    startedAtMs: null,
    frameCount: 0,
    validFrameCount: 0,
    formScoreSum: 0,
    postureScoreSum: 0,
    armPositionScoreSum: 0,
    visibilityScoreSum: 0,
    bestRepScore: null,
    worstRepScore: null,
    currentRepScoreSum: 0,
    currentRepFrameCount: 0,
    lastRepCount: 0,
    leftElbowSum: 0,
    rightElbowSum: 0,
    leftEshSum: 0,
    rightEshSum: 0,
    leftArmBodyAngleSum: 0,
    rightArmBodyAngleSum: 0,
    leftKneeSum: 0,
    rightKneeSum: 0,
    biomechanicsFrameCount: 0,
    persisted: false,
  };
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function averageValue(sum: number, count: number): number {
  return count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
}

function averageScore(sum: number, count: number): number {
  return clampScore(averageValue(sum, count));
}

function getSeverityPenalty(severity: 'LOW' | 'MEDIUM' | 'HIGH'): number {
  switch (severity) {
    case 'HIGH':
      return 35;
    case 'MEDIUM':
      return 18;
    default:
      return 8;
  }
}

function calculateArmBodyAngle(
  shoulder: ExerciseFrame['landmarks'][number] | undefined,
  elbow: ExerciseFrame['landmarks'][number] | undefined,
  hip: ExerciseFrame['landmarks'][number] | undefined
): number {
  if (!shoulder || !elbow || !hip) {
    return 0;
  }

  const radians =
    Math.atan2(elbow.y - shoulder.y, elbow.x - shoulder.x) -
    Math.atan2(hip.y - shoulder.y, hip.x - shoulder.x);

  let angle = Math.abs(radians * (180 / Math.PI));

  if (angle > 180) {
    angle = 360 - angle;
  }

  if (angle > 90) {
    angle = 180 - angle;
  }

  return angle;
}

function isBicepCurlExercise(exerciseName: string): boolean {
  return BICEP_CURL_EXERCISE_PATTERN.test(exerciseName);
}

function normalizeVoicePriority(priority?: string): VoicePriority {
  switch ((priority || '').toLowerCase()) {
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    default:
      return 'high';
  }
}

function deriveFrameScores(frame: ExerciseFrame, result: AnalysisResult) {
  let postureScore = 100;
  let armPositionScore = 100;
  let visibilityScore = frame.meta.fullBodyVisible ? 100 : 55;

  if (frame.meta.bodyHeightRatio < 0.55 || frame.meta.bodyHeightRatio > 0.92) {
    visibilityScore -= 25;
  }

  if (frame.meta.orientation === 'unclear') {
    visibilityScore -= 10;
  }

  for (const issue of result.formIssues || []) {
    const penalty = getSeverityPenalty(issue.severity);
    const bucket = issue.joint === 'spine' || issue.joint === 'neck' || issue.joint === 'hip' || issue.joint === 'knee'
      ? 'posture'
      : issue.joint === 'shoulder' || issue.joint === 'elbow' || issue.joint === 'arm'
        ? 'arm'
        : 'visibility';

    if (bucket === 'posture') {
      postureScore -= penalty;
    } else if (bucket === 'arm') {
      armPositionScore -= penalty;
    } else {
      visibilityScore -= penalty;
    }
  }

  postureScore = clampScore(postureScore);
  armPositionScore = clampScore(armPositionScore);
  visibilityScore = clampScore(visibilityScore);

  return {
    formScore: averageScore(postureScore + armPositionScore + visibilityScore, 3),
    postureScore,
    armPositionScore,
    visibilityScore,
  };
}

export default function FitnessPage() {
  const { user } = useAuth();

  // ── Camera & exercise state ────────────────────────────────────────────────
  const [isExerciseActive, setIsExerciseActive] = useState(false);
  const isExerciseActiveRef = useRef(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraCommand, setCameraCommand] = useState<'start' | 'stop' | null>(null);

  // ── Voice ─────────────────────────────────────────────────────────────────
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const voiceManagerRef = useRef<VoiceFeedbackManager | null>(null);
  const lastRepCountRef = useRef(0);
  const lastFormWarningRef = useRef(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && !voiceManagerRef.current) {
      const provider = new ElevenLabsVoice({
        apiKey: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '',
        volume: VOICE_FEEDBACK_SETTINGS.DEFAULT_VOLUME,
        rate: 1.0, pitch: 1.0, language: 'en-US',
      });
      voiceManagerRef.current = new VoiceFeedbackManager(provider, {
        minMessageInterval: VOICE_FEEDBACK_SETTINGS.MIN_MESSAGE_INTERVAL,
        maxQueueSize: VOICE_FEEDBACK_SETTINGS.MAX_QUEUE_SIZE,
        priorityInterrupts: true,
      });
      if (voiceEnabled) voiceManagerRef.current.enable();
      else voiceManagerRef.current.disable();
    }
  }, []);

  useEffect(() => {
    if (voiceManagerRef.current) {
      if (voiceEnabled) voiceManagerRef.current.enable();
      else { voiceManagerRef.current.disable(); voiceManagerRef.current.stopAndClear(); }
    }
  }, [voiceEnabled]);

  const speak = (text: string, priority: VoicePriority | string = 'high') => {
    if (!voiceManagerRef.current || !voiceEnabled || !text?.trim()) {
      return;
    }

    voiceManagerRef.current.queueMessage(text, normalizeVoicePriority(priority));
  };

  const isSpeakingRef = useRef(false);

  const speakMaster = (text: string) => {
    if (typeof window === 'undefined' || !text?.trim() || !voiceEnabled) return;

    // Stop mic immediately before speaking
    isSpeakingRef.current = true;
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    voiceManagerRef.current?.stopAndClear();

    const finish = () => {
      // Wait 600ms after speech fully ends before re-enabling mic
      // This prevents the mic from capturing the tail end of TTS audio
      setTimeout(() => {
        isSpeakingRef.current = false;
        if (recognitionRef.current) { try { recognitionRef.current.start(); } catch {} }
      }, 600);
    };

    const provider = voiceManagerRef.current?.getProvider();

    if (provider) {
      void provider
        .speak(text, { rate: 1.05, pitch: 1.0, volume: 1.0, language: 'en-US' })
        .then(finish)
        .catch((error) => {
          console.error('Master voice provider error:', error);
          finish();
        });
      return;
    }

    if (!('speechSynthesis' in window)) {
      console.warn('speechSynthesis is not available in this browser');
      finish();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';
    utterance.onend = finish;
    utterance.onerror = (event) => {
      console.error('Master speech synthesis error:', event.error);
      finish();
    };
    window.speechSynthesis.speak(utterance);
  };

  // ── AI analyzer state ─────────────────────────────────────────────────────
  const [aiStatus, setAiStatus] = useState<AIStatus>('idle');
  const [aiExerciseName, setAiExerciseName] = useState('');
  const [aiCameraInstructions, setAiCameraInstructions] = useState('');
  const [aiTesterResult, setAiTesterResult] = useState<any>(null);
  const aiAnalyzerFnRef = useRef<((frame: any, state: any) => AnalysisResult) | null>(null);
  const aiAnalyzerStateRef = useRef<AnalysisState>({ phase: 'neutral', reps: 0 });
  const [aiMetrics, setAiMetrics] = useState<AnalysisResult>({ reps: 0, phase: 'neutral', formIssues: [], isValidPosition: false });
  const sessionTrackingRef = useRef<SessionTracker>(createEmptySessionTracker());

  // ── Job state ─────────────────────────────────────────────────────────────
  const currentJobIdRef = useRef<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobStatusDetail, setJobStatusDetail] = useState<string>('');
  const [jobLog, setJobLog] = useState<string[]>([]);
  const [showJobLog, setShowJobLog] = useState(true);
  const jobPollingRef = useRef<any>(null);
  const jobStatusRef = useRef<string | null>(null); // for use inside closures
  const jobLogEndRef = useRef<HTMLDivElement>(null);

  // ── Conversation state ────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [masterState, setMasterState] = useState('greeting');
  const [sessionStarted, setSessionStarted] = useState(false);
  const masterStateRef = useRef('greeting');
  const sessionStartedRef = useRef(false);
  const sessionStartingRef = useRef(false);
  // Full conversation history — sent to master on every call (standard chatbot pattern)
  const conversationHistoryRef = useRef<ConvEntry[]>([]);
  const aiExerciseNameRef = useRef('');
  const recognitionRef = useRef<any>(null);
  const frameMonitorTimerRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);
  const lastTranscriptRef = useRef('');
  const lastTranscriptAtRef = useRef(0);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Job polling ───────────────────────────────────────────────────────────
  const stopJobPolling = () => {
    if (jobPollingRef.current) {
      clearInterval(jobPollingRef.current);
      jobPollingRef.current = null;
    }
  };

  const startJobPolling = (jobId: string) => {
    stopJobPolling();
    jobPollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/video-agents/job/${jobId}`);
        if (!res.ok) return;
        const job = await res.json();

        setJobStatus(job.status);
        jobStatusRef.current = job.status;
        setJobStatusDetail(job.statusDetail || '');
        setJobLog(job.log || []);
        setTimeout(() => jobLogEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

        if (job.status === 'done' || job.status === 'failed') {
          stopJobPolling();
          currentJobIdRef.current = null;

          if (job.status === 'done' && job.result) {
            try {
              aiAnalyzerFnRef.current = compileAnalyzer(job.result.spec);
              setAiCameraInstructions(job.result.cameraInstructions);
              setAiTesterResult(job.result.testerResult);
              setAiStatus('ready');
              masterStateRef.current = 'ready';
              setMasterState('ready');
              // Notify master — it will tell the user naturally
              sendToMaster(
                `[System: analyzer ready. Camera: ${job.result.cameraInstructions}]`,
                undefined,
                true
              );
            } catch (e: any) {
              setAiStatus('error');
              speakMaster('Sorry, had trouble loading the exercise code.');
            }
          } else if (job.status === 'failed') {
            setAiStatus('error');
            sendToMaster('[System: Exercise generation failed. Ask the user if they want to try again.]', undefined, true);
          }
        }
      } catch (e) {
        console.error('Job poll error:', e);
      }
    }, 2000);
  };

  // ── Send to master agent ──────────────────────────────────────────────────
  const sendToMaster = async (
    userMessage: string,
    frameSnapshot?: any,
    isSystemMsg = false
  ) => {
    if (!userMessage.trim() && !frameSnapshot) return;
    // Prevent concurrent non-snapshot calls
    if (!frameSnapshot && isSendingRef.current) return;
    if (!frameSnapshot) isSendingRef.current = true;

    // Add user message to chat log + history
    if (userMessage && !isSystemMsg) {
      setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
      conversationHistoryRef.current = [
        ...conversationHistoryRef.current,
        { role: 'user', text: userMessage },
      ];
    }

    try {
      const res = await fetch('/api/video-agents/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: userMessage || '',
          // Send FULL conversation history every call — this is how chatbots maintain context
          conversationHistory: conversationHistoryRef.current,
          currentState: masterStateRef.current,
          frameSnapshot: frameSnapshot || null,
          exerciseName: aiExerciseNameRef.current || null,
          jobStatus: jobStatusRef.current,
        }),
      });

      const data = await res.json();
      if (!res.ok) { console.error('[Master] error:', data.error); return; }

      if (data.response) {
        speakMaster(data.response);
        // Show in chat (not for frame snapshots — those are silent coaching cues)
        if (!frameSnapshot) {
          setMessages(prev => [...prev, { role: 'coach', text: data.response }]);
        }
        // Always add to history so context is maintained
        conversationHistoryRef.current = [
          ...conversationHistoryRef.current,
          { role: 'assistant', text: data.response },
        ];
      }

      masterStateRef.current = data.nextState;
      setMasterState(data.nextState);

      // Start generation — fire once, only if no job is running
      if (
        !isSystemMsg &&
        data.action === 'generate_exercise' &&
        data.exerciseName &&
        !currentJobIdRef.current
      ) {
        aiExerciseNameRef.current = data.exerciseName;
        setAiExerciseName(data.exerciseName);
        startExerciseGeneration(data.exerciseName);
      }

    } catch (e) {
      console.error('Master agent error:', e);
    } finally {
      if (!frameSnapshot) isSendingRef.current = false;
    }
  };

  // ── Start exercise generation (async job) ─────────────────────────────────
  const startExerciseGeneration = async (name: string) => {
    if (currentJobIdRef.current) return; // already running
    setAiStatus('generating');
    setAiTesterResult(null);
    aiAnalyzerFnRef.current = null;
    aiAnalyzerStateRef.current = { phase: 'neutral', reps: 0 };

    try {
      const res = await fetch('/api/video-agents/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exerciseName: name }),
      });
      const { jobId, error } = await res.json();
      if (!jobId) throw new Error(error || 'No jobId returned');

      currentJobIdRef.current = jobId;
      setJobStatus('queued');
      jobStatusRef.current = 'queued';
      setJobLog([]);
      setShowJobLog(true);
      startJobPolling(jobId);
    } catch (e: any) {
      setAiStatus('error');
      console.error('Generate start error:', e);
      speakMaster(`Sorry, couldn't start generating ${name}.`);
    }
  };

  // ── Manual generate (text input) ─────────────────────────────────────────
  const handleManualGenerate = async () => {
    if (!aiExerciseName.trim()) return;
    aiExerciseNameRef.current = aiExerciseName;
    currentJobIdRef.current = null; // reset so it runs again
    aiAnalyzerFnRef.current = null;
    setJobStatus(null);
    jobStatusRef.current = null;
    await startExerciseGeneration(aiExerciseName);
  };

  // ── Speech recognition ───────────────────────────────────────────────────
  const startListening = () => {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { speak("Speech recognition not supported. Please use Chrome."); return; }

    if (recognitionRef.current) {
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      if (!result.isFinal) return;
      const transcript = result[0].transcript.trim();
      if (!transcript) return;
      // Discard anything captured while the agent is speaking
      if (isSpeakingRef.current) return;
      if (isExerciseActiveRef.current) return;
      const now = Date.now();
      if (
        transcript === lastTranscriptRef.current &&
        now - lastTranscriptAtRef.current < 5000
      ) {
        return;
      }
      lastTranscriptRef.current = transcript;
      lastTranscriptAtRef.current = now;
      setVoiceTranscript(transcript);
      sendToMaster(transcript);
    };
    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        setIsListening(false);
        recognitionRef.current = null;
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      // Only restart if we stopped because of natural end, NOT because speakMaster paused it
      if (sessionStartedRef.current && !isSpeakingRef.current && !isExerciseActiveRef.current) {
        setTimeout(() => {
          if (sessionStartedRef.current && !recognitionRef.current && !isSpeakingRef.current && !isExerciseActiveRef.current) {
            startListening();
          }
        }, 150);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const startSession = async () => {
    if (sessionStartedRef.current || sessionStartingRef.current) {
      return;
    }

    sessionStartingRef.current = true;
    sessionStartedRef.current = true;
    setSessionStarted(true);
    try {
      await sendToMaster('Hello, I just opened the fitness assistant.');
      setTimeout(() => {
        if (sessionStartedRef.current && !isExerciseActiveRef.current) {
          startListening();
        }
      }, 900);
    } finally {
      sessionStartingRef.current = false;
    }
  };

  const persistSession = useCallback(async (sessionStatus: FitnessSessionStatus) => {
    const tracker = sessionTrackingRef.current;
    if (!tracker.startedAtMs || tracker.persisted) {
      return;
    }

    tracker.persisted = true;

    const exerciseName = aiExerciseNameRef.current.trim() || aiExerciseName.trim() || 'AI Exercise';
    const endedAtMs = Date.now();
    const repsCompleted = aiAnalyzerStateRef.current.reps ?? 0;
    const sessionPayload = {
      userId: user?.userId,
      exerciseName,
      startedAt: new Date(tracker.startedAtMs).toISOString(),
      endedAt: new Date(endedAtMs).toISOString(),
      durationSeconds: Math.max(1, Math.round((endedAtMs - tracker.startedAtMs) / 1000)),
      repsCompleted,
      sessionStatus,
      avgFormScore: averageScore(tracker.formScoreSum, tracker.frameCount),
      avgPostureScore: averageScore(tracker.postureScoreSum, tracker.frameCount),
      avgArmPositionScore: averageScore(tracker.armPositionScoreSum, tracker.frameCount),
      avgVisibilityScore: averageScore(tracker.visibilityScoreSum, tracker.frameCount),
      validPositionPct: averageScore(tracker.validFrameCount * 100, tracker.frameCount),
      bestRepScore: tracker.bestRepScore ?? 0,
      worstRepScore: tracker.worstRepScore ?? 0,
    };

    const exerciseBiomechanics = tracker.biomechanicsFrameCount > 0
      ? {
          fitnessSessionId: '',
          userId: user?.userId,
          exerciseName,
          avgLeftElbowAngle: averageValue(tracker.leftElbowSum, tracker.biomechanicsFrameCount),
          avgRightElbowAngle: averageValue(tracker.rightElbowSum, tracker.biomechanicsFrameCount),
          avgEshLeft: averageValue(tracker.leftEshSum, tracker.biomechanicsFrameCount),
          avgEshRight: averageValue(tracker.rightEshSum, tracker.biomechanicsFrameCount),
          avgArmBodyAngleLeft: averageValue(tracker.leftArmBodyAngleSum, tracker.biomechanicsFrameCount),
          avgArmBodyAngleRight: averageValue(tracker.rightArmBodyAngleSum, tracker.biomechanicsFrameCount),
          avgLeftKneeAngle: averageValue(tracker.leftKneeSum, tracker.biomechanicsFrameCount),
          avgRightKneeAngle: averageValue(tracker.rightKneeSum, tracker.biomechanicsFrameCount),
        }
      : undefined;

    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: sessionPayload,
          exerciseBiomechanics,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to persist workout session');
      }

      sessionTrackingRef.current = createEmptySessionTracker();
    } catch (error) {
      tracker.persisted = false;
      console.error('Persist session error:', error);
    }
  }, [aiExerciseName, user?.userId]);

  const updateSessionTracking = useCallback((frame: ExerciseFrame, result: AnalysisResult) => {
    const tracker = sessionTrackingRef.current;
    if (!tracker.startedAtMs || tracker.persisted) {
      return;
    }

    const scores = deriveFrameScores(frame, result);
    tracker.frameCount += 1;
    tracker.formScoreSum += scores.formScore;
    tracker.postureScoreSum += scores.postureScore;
    tracker.armPositionScoreSum += scores.armPositionScore;
    tracker.visibilityScoreSum += scores.visibilityScore;

    if (result.isValidPosition) {
      tracker.validFrameCount += 1;
    }

    tracker.currentRepScoreSum += scores.formScore;
    tracker.currentRepFrameCount += 1;

    if (result.reps > tracker.lastRepCount && tracker.currentRepFrameCount > 0) {
      const repScore = averageScore(tracker.currentRepScoreSum, tracker.currentRepFrameCount);
      tracker.bestRepScore = tracker.bestRepScore === null ? repScore : Math.max(tracker.bestRepScore, repScore);
      tracker.worstRepScore = tracker.worstRepScore === null ? repScore : Math.min(tracker.worstRepScore, repScore);
      tracker.lastRepCount = result.reps;
      tracker.currentRepScoreSum = 0;
      tracker.currentRepFrameCount = 0;
    }

    if (isBicepCurlExercise(aiExerciseNameRef.current || aiExerciseName)) {
      tracker.biomechanicsFrameCount += 1;
      tracker.leftElbowSum += frame.angles.leftElbow;
      tracker.rightElbowSum += frame.angles.rightElbow;
      tracker.leftEshSum += frame.angles.leftShoulder;
      tracker.rightEshSum += frame.angles.rightShoulder;
      tracker.leftKneeSum += frame.angles.leftKnee;
      tracker.rightKneeSum += frame.angles.rightKnee;
      tracker.leftArmBodyAngleSum += calculateArmBodyAngle(frame.landmarks[11], frame.landmarks[13], frame.landmarks[23]);
      tracker.rightArmBodyAngleSum += calculateArmBodyAngle(frame.landmarks[12], frame.landmarks[14], frame.landmarks[24]);
    }
  }, [aiExerciseName]);

  const exitAIMode = async () => {
    if (isExerciseActiveRef.current) {
      await persistSession('abandoned');
    }
    stopListening();
    stopJobPolling();
    window.speechSynthesis?.cancel();
    voiceManagerRef.current?.stopAndClear();
    setSessionStarted(false);
    sessionStartedRef.current = false;
    sessionStartingRef.current = false;
    setIsExerciseActive(false);
    isExerciseActiveRef.current = false;
    setAiStatus('idle');
    setAiExerciseName('');
    setAiTesterResult(null);
    setAiCameraInstructions('');
    aiAnalyzerFnRef.current = null;
    aiAnalyzerStateRef.current = { phase: 'neutral', reps: 0 };
    masterStateRef.current = 'greeting';
    conversationHistoryRef.current = [];
    currentJobIdRef.current = null;
    setJobStatus(null);
    jobStatusRef.current = null;
    setJobStatusDetail('');
    setJobLog([]);
    setShowJobLog(false);
    setMasterState('greeting');
    setMessages([]);
    setVoiceTranscript('');
    lastTranscriptRef.current = '';
    lastTranscriptAtRef.current = 0;
    setAiMetrics({ reps: 0, phase: 'neutral', formIssues: [], isValidPosition: false });
    sessionTrackingRef.current = createEmptySessionTracker();
  };

  useEffect(() => {
    return () => {
      if (isExerciseActiveRef.current) {
        void persistSession('abandoned');
      }
      stopListening();
      sessionStartedRef.current = false;
      sessionStartingRef.current = false;
      stopJobPolling();
      clearInterval(frameMonitorTimerRef.current);
      window.speechSynthesis?.cancel();
    };
  }, [persistSession]);

  // ── Pose handler ─────────────────────────────────────────────────────────
  const handlePoseDetected = useCallback((landmarks: any) => {
    if (!isExerciseActiveRef.current || !aiAnalyzerFnRef.current) return;
    try {
      const frame = precomputeFrame(landmarks);
      const result = aiAnalyzerFnRef.current(frame, aiAnalyzerStateRef.current);
      aiAnalyzerStateRef.current.phase = (result.phase as any) ?? aiAnalyzerStateRef.current.phase;
      aiAnalyzerStateRef.current.reps  = result.reps ?? aiAnalyzerStateRef.current.reps;
      setAiMetrics(result);
      updateSessionTracking(frame, result);

      if (voiceManagerRef.current && voiceEnabled) {
        const now = Date.now();
        if (result.reps > lastRepCountRef.current) {
          const msg = getRepCountMessage(result.reps);
          if (msg.text) { voiceManagerRef.current.clearRepCountMessages(); speak(msg.text, msg.priority); }
          lastRepCountRef.current = result.reps;
        }
        if (now - lastFormWarningRef.current > 6000) {
          const high = result.formIssues?.find(i => i.severity === 'HIGH');
          if (high) { speak(high.message); lastFormWarningRef.current = now; }
        }
      }
    } catch (e) { console.error('AI analyzer error:', e); }
  }, [updateSessionTracking, voiceEnabled]);

  // ── Exercise controls ─────────────────────────────────────────────────────
  const startExercise = () => {
    if (!cameraActive) { speakMaster("Please turn on the camera first."); return; }
    if (!aiAnalyzerFnRef.current) { speakMaster("Please choose an exercise first."); return; }
    aiExerciseNameRef.current = aiExerciseName.trim() || aiExerciseNameRef.current.trim() || 'AI Exercise';
    stopListening();
    setIsExerciseActive(true);
    isExerciseActiveRef.current = true;
    aiAnalyzerStateRef.current = { phase: 'neutral', reps: 0 };
    sessionTrackingRef.current = {
      ...createEmptySessionTracker(),
      startedAtMs: Date.now(),
    };
    setAiMetrics({ reps: 0, phase: 'neutral', formIssues: [], isValidPosition: false });
    lastRepCountRef.current = 0;
    lastFormWarningRef.current = 0;
    masterStateRef.current = 'exercising';
    setMasterState('exercising');
    speak(SESSION_MESSAGES.START.text, SESSION_MESSAGES.START.priority);
  };

  const stopExercise = async () => {
    setIsExerciseActive(false);
    isExerciseActiveRef.current = false;
    voiceManagerRef.current?.stopAndClear();
    await persistSession(aiAnalyzerStateRef.current.reps > 0 ? 'completed' : 'stopped_early');
    masterStateRef.current = 'reviewing';
    setMasterState('reviewing');
    const reps = aiAnalyzerStateRef.current.reps;
    await sendToMaster(`[System: set complete — ${reps} reps. Give summary and ask what's next.]`, undefined, true);
    startListening();
    speak(SESSION_MESSAGES.PAUSE.text, SESSION_MESSAGES.PAUSE.priority);
  };

  const resetExercise = () => {
    aiAnalyzerStateRef.current = { phase: 'neutral', reps: 0 };
    sessionTrackingRef.current = isExerciseActiveRef.current
      ? {
          ...createEmptySessionTracker(),
          startedAtMs: Date.now(),
        }
      : createEmptySessionTracker();
    setAiMetrics({ reps: 0, phase: 'neutral', formIssues: [], isValidPosition: false });
    lastRepCountRef.current = 0;
  };

  const startCamera = () => { setCameraCommand('start'); setTimeout(() => setCameraCommand(null), 100); };
  const stopCamera  = () => { setCameraCommand('stop');  setTimeout(() => setCameraCommand(null), 100); };

  // Job status label for display
  const jobStatusLabel = jobStatus ? ({
    queued: 'Queued...',
    running: 'Generating...',
    testing: 'Testing...',
    retrying: 'Retrying...',
    done: 'Ready ✓',
    failed: 'Failed',
  } as Record<string, string>)[jobStatus] || jobStatus : null;

  // ── Tap to start overlay ─────────────────────────────────────────────────
  if (!sessionStarted) {
    return (
      <>
        <FitnessNavigation user={user} />
        <main className="min-h-screen bg-doom-bg pt-16 flex items-center justify-center">
          <button
            onClick={startSession}
            className="flex flex-col items-center gap-4 p-10 bg-black border border-[#00ff9f33] rounded-2xl hover:border-[#00ff9f] transition-colors group"
          >
            <div className="w-16 h-16 rounded-full border-2 border-[#00ff9f] flex items-center justify-center group-hover:bg-[#00ff9f11] transition-colors">
              <span className="text-3xl">🎙️</span>
            </div>
            <div className="text-[#00ff9f] text-xl font-bold">Tap to Start</div>
            <div className="text-[#555] text-sm">Your AI fitness coach will greet you</div>
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      {!isExerciseActive && <FitnessNavigation user={user} />}

      <main className={`min-h-screen bg-doom-bg ${!isExerciseActive ? 'pt-16' : 'pt-0'} pb-8 max-w-full overflow-x-hidden`}>
        <div className="px-3 sm:px-4 py-4 pb-8 max-w-full">

          {/* Top bar */}
          <div className="top-bar">
            <div className="exercise-selector-container">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={aiExerciseName}
                  onChange={e => setAiExerciseName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleManualGenerate()}
                  placeholder="or type an exercise..."
                  className="bg-black border border-[#333] text-white text-sm px-3 py-1.5 rounded outline-none focus:border-[#00ff9f] w-44"
                  disabled={isExerciseActive}
                />
                <button
                  onClick={handleManualGenerate}
                  disabled={isExerciseActive || aiStatus === 'generating' || !aiExerciseName.trim()}
                  className="btn-outline text-xs px-3 py-1.5"
                >
                  {aiStatus === 'generating' ? '...' : 'Generate'}
                </button>
              </div>
            </div>

            <div className="control-buttons-horizontal">
              {!isExerciseActive ? (
                <button onClick={startExercise} className="btn-primary" disabled={aiStatus !== 'ready'}>
                  <Play className="w-4 h-4" /><span>Start</span>
                </button>
              ) : (
                <button onClick={stopExercise} className="btn-secondary">
                  <Square className="w-4 h-4" /><span>Stop</span>
                </button>
              )}

              <button onClick={resetExercise} className="btn-outline">
                <RotateCcw className="w-4 h-4" /><span className="hidden sm:inline">Reset</span>
              </button>

              {cameraActive ? (
                <button onClick={stopCamera} className="btn-outline">
                  <CameraOff className="w-4 h-4" /><span className="hidden sm:inline">Stop Camera</span>
                </button>
              ) : (
                <button onClick={startCamera} className="btn-outline">
                  <Camera className="w-4 h-4" /><span className="hidden sm:inline">Start Camera</span>
                </button>
              )}

              <button
                onClick={() => setVoiceEnabled(v => !v)}
                className={`btn-outline ${voiceEnabled ? 'bg-green-500/20' : ''}`}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span className="hidden sm:inline">{voiceEnabled ? 'Voice On' : 'Voice Off'}</span>
              </button>

              <button
                onClick={exitAIMode}
                className="btn-outline text-[#ff4444] border-[#ff444433] hover:bg-[#ff444411]"
                disabled={isExerciseActive}
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Exit</span>
              </button>
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-black border border-[#1a1a1a] rounded mb-2 text-xs">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isListening ? 'bg-[#00ff9f] animate-pulse' : 'bg-[#333]'}`} />
            <span className="text-[#555]">{isListening ? 'Listening' : 'Mic off'}</span>

            {voiceTranscript && (
              <span className="text-[#444] italic truncate max-w-[140px]">"{voiceTranscript}"</span>
            )}

            {jobStatusLabel && (
              <span className={`ml-1 font-mono ${
                jobStatus === 'failed'  ? 'text-[#ff4444]' :
                jobStatus === 'done'    ? 'text-[#00ff9f]' :
                'text-[#00d4ff] animate-pulse'
              }`}>
                ⚙ {jobStatusLabel}
              </span>
            )}

            <span className="ml-auto text-[#2a2a2a] uppercase tracking-widest font-mono">{masterState}</span>
          </div>



          {/* Tester result */}
          {aiTesterResult && (
            <div className={`text-xs px-3 py-1.5 rounded border flex flex-wrap gap-x-3 mb-2 ${
              aiTesterResult.passed ? 'border-[#00ff9f22] text-[#00ff9f55]' : 'border-[#ff444422] text-[#ff444466]'
            }`}>
              {aiTesterResult.passed ? '✓ Tester passed' : '✗ Tester partial'}
              {aiTesterResult.checks?.filter((c: any) => !c.passed).map((c: any) => (
                <span key={c.name} className="text-[#ff4444]">· {c.name}</span>
              ))}
            </div>
          )}

          {/* Live metrics during exercise */}
          {isExerciseActive && (
            <div className="flex gap-3 font-mono text-xs mb-2">
              <div className="bg-black border border-[#222] rounded px-4 py-2 text-center min-w-[64px]">
                <div className="text-3xl font-bold text-[#00ff9f]">{aiMetrics.reps}</div>
                <div className="text-[#444]">REPS</div>
              </div>
              <div className="bg-black border border-[#222] rounded px-4 py-2 text-center">
                <div className={`text-xl font-bold ${aiMetrics.phase === 'up' ? 'text-[#00ff9f]' : 'text-[#00d4ff]'}`}>
                  {String(aiMetrics.phase).toUpperCase()}
                </div>
                <div className="text-[#444]">PHASE</div>
              </div>
              <div className="bg-black border border-[#222] rounded px-3 py-2 flex-1 flex flex-col justify-center gap-0.5">
                {aiMetrics.formIssues?.slice(0, 2).map((issue, i) => (
                  <div key={i} className={
                    issue.severity === 'HIGH' ? 'text-[#ff4444]' :
                    issue.severity === 'MEDIUM' ? 'text-[#ffaa00]' : 'text-[#666]'
                  }>
                    {issue.message}
                  </div>
                ))}
                {!aiMetrics.formIssues?.length && <div className="text-[#00ff9f44]">✓ Good form</div>}
              </div>
            </div>
          )}

              {/* Camera + chat overlay */}
          <div className="camera-container relative">
            {/* Chat overlay — last 4 messages shown at bottom of camera */}
            {messages.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 z-10 p-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none">
                <div className="space-y-1.5 max-h-36 overflow-hidden flex flex-col justify-end">
                  {messages.slice(-4).map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <span className={`text-xs px-2.5 py-1 rounded-lg max-w-[75%] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#00ff9f22] text-[#00ff9f] border border-[#00ff9f33]'
                          : 'bg-black/60 text-[#ccc] border border-white/10'
                      }`}>
                        {msg.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <WebcamCapture
              onPoseDetected={handlePoseDetected}
              isActive={isExerciseActive}
              className="w-full h-full"
              onCameraStateChange={setCameraActive}
              cameraCommand={cameraCommand}
              formValidation={isExerciseActive ? {
                bodyHeightRatio: 0.9,
                backAngle: aiMetrics.isValidPosition ? 180 : 150,
              } : null}
              metricsOverlay={isExerciseActive ? {
                reps: aiMetrics.reps,
                formScore: aiMetrics.isValidPosition ? 100 : 50,
                postureScore: aiMetrics.formIssues?.some(i => i.joint === 'spine') ? 50 : 100,
                armMetricLabel: 'Form',
                armMetricScore: aiMetrics.isValidPosition ? 100 : 50,
                leftAngleLabel: 'Debug',
                leftAngleValue: aiMetrics.debugInfo ? Object.values(aiMetrics.debugInfo)[0] as number || 0 : 0,
                rightAngleLabel: 'Debug',
                rightAngleValue: aiMetrics.debugInfo ? Object.values(aiMetrics.debugInfo)[1] as number || 0 : 0,
                phaseLabel: String(aiMetrics.phase),
              } : null}
            />
          </div>

        </div>
      </main>
      {/* Pipeline log link — fixed bottom-right */}
      {jobStatus && jobStatus !== 'done' && (
        <a
          href="/fitness/logs"
          target="_blank"
          rel="noopener noreferrer"
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono shadow-xl bg-[#050505] transition-colors ${
            jobStatus === 'failed'  ? 'border-[#ff444433] text-[#ff4444]' :
            jobStatus === 'done'    ? 'border-[#00ff9f33] text-[#00ff9f]' :
            'border-[#00d4ff33] text-[#00d4ff]'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          {jobStatusDetail || jobStatus}
          <span className="text-[#333] ml-1">↗ logs</span>
        </a>
      )}
    </>
  );
}
