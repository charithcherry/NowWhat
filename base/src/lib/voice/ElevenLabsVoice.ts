import { IVoiceFeedback, VoiceConfig } from './IVoiceFeedback';
import { WebSpeechVoice } from './WebSpeechVoice';

export interface ElevenLabsConfig extends VoiceConfig {
  apiKey: string;
  voiceId?: string;
  modelId?: string;
}

export class ElevenLabsVoice implements IVoiceFeedback {
  private config: ElevenLabsConfig;
  private fallback: WebSpeechVoice;

  // Track current playback so stop() can cancel it cleanly
  private currentAudio: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
  private currentAbortController: AbortController | null = null;
  private pendingResolve: (() => void) | null = null;

  constructor(config: ElevenLabsConfig) {
    this.config = {
      rate:     config.rate     ?? 1.0,
      pitch:    config.pitch    ?? 1.0,
      volume:   config.volume   ?? 0.9,
      language: config.language ?? 'en-US',
      apiKey:   config.apiKey,
      // eleven_turbo_v2_5 — good quality + fast (better than flash for coaching)
      modelId:  config.modelId  ?? 'eleven_turbo_v2_5',
      // EXAVITQu4vr4xnSDxMaL = Sarah — clear, friendly female coaching voice
      voiceId:  config.voiceId  ?? 'EXAVITQu4vr4xnSDxMaL',
    };

    this.fallback = new WebSpeechVoice({
      rate:     this.config.rate,
      pitch:    this.config.pitch,
      volume:   this.config.volume,
      language: this.config.language,
    });
  }

  async speak(text: string, config?: Partial<VoiceConfig>): Promise<void> {
    // Cancel anything currently in flight before starting a new utterance
    this.stop();

    const volume = (config?.volume ?? this.config.volume ?? 0.9) as number;
    const abortController = new AbortController();
    this.currentAbortController = abortController;

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.config.voiceId}`,
        {
          method:  'POST',
          signal:  abortController.signal,
          headers: {
            'Accept':       'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key':   this.config.apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: this.config.modelId,
            voice_settings: {
              stability:         0.55,
              similarity_boost:  0.75,
              style:             0.2,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.text().catch(() => '');
        console.warn(`[ElevenLabs] ${response.status} error: ${err} — using Web Speech fallback`);
        return this.fallback.speak(text, config);
      }

      const audioBlob = await response.blob();

      // If stop() was called while waiting for the blob, bail out
      if (abortController.signal.aborted) return;

      const objectUrl = URL.createObjectURL(audioBlob);
      this.currentObjectUrl = objectUrl;

      const audio = new Audio(objectUrl);
      audio.volume = Math.max(0, Math.min(1, volume));
      this.currentAudio = audio;

      return new Promise<void>((resolve) => {
        // Store resolve so stop() can unblock VoiceFeedbackManager
        this.pendingResolve = resolve;

        const finish = () => {
          this.pendingResolve = null;
          this.cleanup();
          resolve();
        };

        audio.onended = finish;

        audio.onerror = () => {
          console.warn('[ElevenLabs] Audio playback error — using Web Speech fallback');
          this.pendingResolve = null;
          this.cleanup();
          this.fallback.speak(text, config).then(resolve).catch(resolve);
        };

        audio.play().catch((err) => {
          console.warn('[ElevenLabs] play() failed — using Web Speech fallback:', err);
          this.pendingResolve = null;
          this.cleanup();
          this.fallback.speak(text, config).then(resolve).catch(resolve);
        });
      });

    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // Cancelled by stop() — resolve cleanly so the manager isn't stuck
        return;
      }
      console.warn('[ElevenLabs] Request failed — using Web Speech fallback:', err);
      return this.fallback.speak(text, config);
    }
  }

  stop(): void {
    // 1. Abort any in-flight API fetch
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }

    // 2. Stop audio playback
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }

    // 3. Resolve the pending promise so VoiceFeedbackManager doesn't get stuck
    if (this.pendingResolve) {
      this.pendingResolve();
      this.pendingResolve = null;
    }

    // 4. Clean up resources
    this.cleanup();

    // 5. Also stop fallback in case it was speaking
    this.fallback.stop();
  }

  setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume));
    if (this.currentAudio) {
      this.currentAudio.volume = this.config.volume;
    }
    this.fallback.setVolume(volume);
  }

  isSupported(): boolean {
    return true;
  }

  getConfig(): VoiceConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<ElevenLabsConfig>): void {
    this.config = { ...this.config, ...config };
    this.fallback.updateConfig(config);
  }

  setVoiceId(voiceId: string): void {
    this.config.voiceId = voiceId;
  }

  private cleanup(): void {
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    this.currentAudio = null;
  }
}
