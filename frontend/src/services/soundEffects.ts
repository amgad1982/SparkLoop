// Web Audio API procedural sound synthesizer for MoodPod room soundboard

class SoundEffectsEngine {
  private ctx: AudioContext | null = null;

  private getAudioContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // 1. DJ Airhorn
  playAirhorn(volume = 0.5) {
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;

    const playBeep = (startTime: number, duration: number) => {
      // Classic DJ Airhorn is two notes (around F#5 740Hz and B5 987Hz)
      const frequencies = [740, 987.77];
      frequencies.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, startTime);
        // Add subtle pitch bend drop at the end of each blast
        osc.frequency.exponentialRampToValueAtTime(freq * 0.95, startTime + duration);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, startTime);
        filter.Q.setValueAtTime(2.0, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(volume * 0.4, startTime + 0.02);
        gain.gain.setValueAtTime(volume * 0.4, startTime + duration - 0.03);
        gain.gain.linearRampToValueAtTime(0.001, startTime + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      });
    };

    // Traditional pattern: Beep-beep-beep-beeep!
    playBeep(now, 0.12);
    playBeep(now + 0.15, 0.12);
    playBeep(now + 0.30, 0.12);
    playBeep(now + 0.45, 0.35);
  }

  // 2. Applause / Clapping
  playApplause(volume = 0.5) {
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;
    const duration = 2.0;

    // Buffer of white noise
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.Q.setValueAtTime(0.8, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.6, now + 0.3);
    gain.gain.setValueAtTime(volume * 0.6, now + 1.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + duration);
  }

  // 3. Drum Roll & Rimshot
  playDrumroll(volume = 0.5) {
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;

    // Drum roll noise
    const rollDuration = 1.2;
    const bufferSize = ctx.sampleRate * rollDuration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const rollNoise = ctx.createBufferSource();
    rollNoise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(400, now);

    const rollGain = ctx.createGain();
    rollGain.gain.setValueAtTime(0.05 * volume, now);
    rollGain.gain.exponentialRampToValueAtTime(0.4 * volume, now + rollDuration);

    rollNoise.connect(filter);
    filter.connect(rollGain);
    rollGain.connect(ctx.destination);

    rollNoise.start(now);
    rollNoise.stop(now + rollDuration);

    // Rimshot / Crash at end
    const crashTime = now + rollDuration;
    const crashOsc = ctx.createOscillator();
    const crashGain = ctx.createGain();
    crashOsc.type = 'triangle';
    crashOsc.frequency.setValueAtTime(150, crashTime);
    crashOsc.frequency.exponentialRampToValueAtTime(40, crashTime + 0.15);

    crashGain.gain.setValueAtTime(volume * 0.8, crashTime);
    crashGain.gain.exponentialRampToValueAtTime(0.001, crashTime + 0.35);

    crashOsc.connect(crashGain);
    crashGain.connect(ctx.destination);

    crashOsc.start(crashTime);
    crashOsc.stop(crashTime + 0.35);
  }

  // 4. Cheering & Whistle
  playCheer(volume = 0.5) {
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;
    const duration = 2.2;

    // Warm resonant crowd cheer
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(1400, now + 0.8);
    filter.Q.setValueAtTime(1.2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(volume * 0.6, now + 0.4);
    gain.gain.setValueAtTime(volume * 0.5, now + 1.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + duration);

    // Whistle glissando
    const whistle = ctx.createOscillator();
    const whistleGain = ctx.createGain();
    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(1800, now + 0.2);
    whistle.frequency.exponentialRampToValueAtTime(2600, now + 0.7);

    whistleGain.gain.setValueAtTime(0, now + 0.2);
    whistleGain.gain.linearRampToValueAtTime(volume * 0.3, now + 0.35);
    whistleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    whistle.connect(whistleGain);
    whistleGain.connect(ctx.destination);

    whistle.start(now + 0.2);
    whistle.stop(now + 0.9);
  }

  // 5. Laughter / Giggles
  playLaugh(volume = 0.5) {
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;

    const notes = [
      { f: 520, t: 0.00, d: 0.12 },
      { f: 580, t: 0.14, d: 0.12 },
      { f: 520, t: 0.28, d: 0.12 },
      { f: 620, t: 0.42, d: 0.14 },
      { f: 520, t: 0.58, d: 0.16 },
    ];

    notes.forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.85, now + t + d);

      gain.gain.setValueAtTime(0, now + t);
      gain.gain.linearRampToValueAtTime(volume * 0.4, now + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + t);
      osc.stop(now + t + d);
    });
  }

  // 6. Spark Magic Chime & Shimmer
  playMagic(volume = 0.5) {
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;
    const chimeFreqs = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0];

    chimeFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0, now + idx * 0.07);
      gain.gain.linearRampToValueAtTime(volume * 0.35, now + idx * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.8);
    });
  }

  // 7. Pop reaction sound
  playPop(volume = 0.3) {
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);

    gain.gain.setValueAtTime(volume * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Trigger effect by string key
  play(effectName: string, volume = 0.5) {
    switch (effectName.toLowerCase()) {
      case 'airhorn':
      case '📢':
        this.playAirhorn(volume);
        break;
      case 'applause':
      case '👏':
        this.playApplause(volume);
        break;
      case 'drumroll':
      case '🥁':
        this.playDrumroll(volume);
        break;
      case 'cheer':
      case '🥳':
        this.playCheer(volume);
        break;
      case 'laugh':
      case '😂':
        this.playLaugh(volume);
        break;
      case 'magic':
      case '✨':
        this.playMagic(volume);
        break;
      case 'pop':
        this.playPop(volume);
        break;
      default:
        this.playPop(volume);
        break;
    }
  }
}

export const soundEffects = new SoundEffectsEngine();
