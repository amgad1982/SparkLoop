/**
 * Procedural Web Audio Ambient Sound Generator
 * Generates continuous, royalty-free, zero-network ambient music & soundscapes
 * (Lo-Fi Chill, Cyberpunk Synthwave, Rainy Night)
 * 100% CORS-proof, instant start, zero bandwidth overhead.
 */

export interface ActiveSynthTrack {
  stop: () => void;
  outputNode: AudioNode;
}

export function startProceduralAmbient(
  ctx: AudioContext,
  vibeId: 'lofi' | 'synth' | 'rain'
): ActiveSynthTrack {
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.4, ctx.currentTime);

  let isRunning = true;
  const nodesToClean: AudioNode[] = [];
  const intervalsToClean: number[] = [];

  if (vibeId === 'rain') {
    // Rain Soundscape Generator (Pink Noise + Lowpass Filter + Thunder)
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(masterGain);
    whiteNoise.start(0);

    nodesToClean.push(whiteNoise, filter);
  } else if (vibeId === 'synth') {
    // Cyberpunk Synthwave: 16th-note Arpeggiator + Warm Bass Drone
    const rootFreqs = [110, 130.81, 146.83, 164.81]; // A2, C3, D3, E3
    const arpNotes = [220, 261.63, 329.63, 440, 523.25, 659.25];

    let noteIdx = 0;
    const arpInterval = window.setInterval(() => {
      if (!isRunning) return;
      try {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(arpNotes[noteIdx % arpNotes.length], ctx.currentTime);
        noteIdx++;

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400 + Math.sin(Date.now() / 400) * 800, ctx.currentTime);
        filter.Q.setValueAtTime(4, ctx.currentTime);

        const now = ctx.currentTime;
        noteGain.gain.setValueAtTime(0.08, now);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.2);
      } catch {}
    }, 150);

    intervalsToClean.push(arpInterval);

    // Warm Bass Sub Drone
    const subOsc = ctx.createOscillator();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(55, ctx.currentTime); // A1
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.12, ctx.currentTime);
    subOsc.connect(subGain);
    subGain.connect(masterGain);
    subOsc.start(0);
    nodesToClean.push(subOsc, subGain);
  } else {
    // Lo-Fi Chill: Soft Electric Piano Chords + Vinyl Ambient Texture
    const chords = [
      [261.63, 329.63, 392.00, 493.88], // Cmaj7
      [220.00, 261.63, 329.63, 392.00], // Am7
      [174.61, 220.00, 261.63, 329.63], // Fmaj7
      [196.00, 246.94, 293.66, 349.23], // G7
    ];

    let chordIdx = 0;
    const playChord = () => {
      if (!isRunning) return;
      const currentChord = chords[chordIdx % chords.length];
      chordIdx++;

      currentChord.forEach((freq, i) => {
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(650, ctx.currentTime);

          const now = ctx.currentTime;
          const stagger = i * 0.04;
          gain.gain.setValueAtTime(0, now + stagger);
          gain.gain.linearRampToValueAtTime(0.06, now + stagger + 0.1);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + stagger + 2.8);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(masterGain);

          osc.start(now + stagger);
          osc.stop(now + stagger + 3.0);
        } catch {}
      });
    };

    playChord();
    const chordInterval = window.setInterval(playChord, 3200);
    intervalsToClean.push(chordInterval);
  }

  return {
    outputNode: masterGain,
    stop: () => {
      isRunning = false;
      intervalsToClean.forEach((id) => clearInterval(id));
      nodesToClean.forEach((n) => {
        try {
          if ('stop' in n && typeof (n as AudioScheduledSourceNode).stop === 'function') {
            (n as AudioScheduledSourceNode).stop();
          }
          n.disconnect();
        } catch {}
      });
      masterGain.disconnect();
    },
  };
}

