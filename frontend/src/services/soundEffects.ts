// High-Quality Studio Soundboard Audio Player with Preloading & Web Audio Fallback

interface SoundDefinition {
  url: string;
  defaultVolume: number;
}

const SOUND_LIBRARY: Record<string, SoundDefinition> = {
  airhorn: { url: '/sounds/airhorn.mp3', defaultVolume: 0.6 },
  applause: { url: '/sounds/applause.mp3', defaultVolume: 0.65 },
  drumroll: { url: '/sounds/drumroll.wav', defaultVolume: 0.7 },
  cheer: { url: '/sounds/cheer.wav', defaultVolume: 0.65 },
  laugh: { url: '/sounds/laugh.wav', defaultVolume: 0.65 },
  magic: { url: '/sounds/magic.wav', defaultVolume: 0.55 },
  victory: { url: '/sounds/victory.mp3', defaultVolume: 0.65 },
  tada: { url: '/sounds/tada.mp3', defaultVolume: 0.65 },
  boo: { url: '/sounds/boo.mp3', defaultVolume: 0.6 },
  gasp: { url: '/sounds/gasp.mp3', defaultVolume: 0.6 },
  pop: { url: '/sounds/pop.ogg', defaultVolume: 0.45 },
  whistle: { url: '/sounds/slide_whistle.ogg', defaultVolume: 0.5 },
};

class SoundEffectsEngine {
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  private ctx: AudioContext | null = null;
  private isPreloaded = false;

  constructor() {
    // Preload sounds when running in the browser
    if (typeof window !== 'undefined') {
      this.preload();
    }
  }

  private getAudioContext(): AudioContext | null {
    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  // Preload sound files into HTML5 Audio cache for zero-lag playback
  preload() {
    if (this.isPreloaded || typeof window === 'undefined') return;
    this.isPreloaded = true;

    Object.entries(SOUND_LIBRARY).forEach(([key, sound]) => {
      try {
        const audio = new Audio();
        audio.src = sound.url;
        audio.preload = 'auto';
        this.audioCache.set(key, audio);
      } catch (err) {
        console.warn(`[SoundEffects] Failed to preload ${key}:`, err);
      }
    });
  }

  // Play a sound effect by name
  play(effectName: string, masterVolume = 1.0) {
    if (typeof window === 'undefined') return;

    const normalizedKey = this.normalizeKey(effectName);
    const soundDef = SOUND_LIBRARY[normalizedKey] || SOUND_LIBRARY['pop'];

    if (!soundDef) return;

    try {
      // Create or clone audio instance to allow multiple overlapping sounds
      const audio = new Audio(soundDef.url);
      const effectiveVol = Math.max(0, Math.min(1, soundDef.defaultVolume * masterVolume));
      audio.volume = effectiveVol;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // If autoplay policy or network error, fallback to Web Audio synthetic beep
          console.debug(`[SoundEffects] Audio play deferred or failed (${normalizedKey}):`, err);
          this.playSyntheticFallback(normalizedKey, masterVolume);
        });
      }
    } catch {
      this.playSyntheticFallback(normalizedKey, masterVolume);
    }
  }

  private normalizeKey(name: string): string {
    const lower = name.toLowerCase().trim();
    switch (lower) {
      case 'airhorn':
      case '📢':
      case 'horn':
        return 'airhorn';
      case 'applause':
      case '👏':
      case 'clap':
      case 'clapping':
        return 'applause';
      case 'drumroll':
      case '🥁':
      case 'drum':
      case 'drums':
        return 'drumroll';
      case 'cheer':
      case 'cheering':
      case '🥳':
      case 'celebrate':
        return 'cheer';
      case 'laugh':
      case 'laughter':
      case '😂':
      case 'funny':
        return 'laugh';
      case 'magic':
      case '✨':
      case 'sparkle':
      case 'chime':
        return 'magic';
      case 'victory':
      case '🏆':
      case 'win':
      case 'winner':
        return 'victory';
      case 'tada':
      case '🎉':
      case 'fanfare':
        return 'tada';
      case 'boo':
      case '👎':
        return 'boo';
      case 'gasp':
      case '😱':
      case 'gasping':
        return 'gasp';
      case 'pop':
      case 'bubble':
      case '🫧':
        return 'pop';
      default:
        return lower;
    }
  }

  // Graceful Web Audio synth fallback if audio file cannot be loaded
  private playSyntheticFallback(key: string, masterVolume = 1.0) {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);

      gain.gain.setValueAtTime(masterVolume * 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // ignore
    }
  }
}

export const soundEffects = new SoundEffectsEngine();
