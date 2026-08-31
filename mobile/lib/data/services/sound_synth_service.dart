import 'dart:math' as math;
import 'dart:typed_data';

/// In-memory Audio Synthesizer for high-fidelity, zero-latency Soundboard SFX
/// Generates standard 16-bit PCM RIFF WAV audio bytes that play instantaneously on iOS & Android
/// without network dependencies, download limits, or AVPlayer item failures.
class SoundSynthService {
  static const int sampleRate = 22050;

  static final Map<String, Uint8List> _cache = {};

  static Uint8List getSoundEffectWav(String effectName) {
    final key = effectName.toLowerCase().trim();
    if (_cache.containsKey(key)) {
      return _cache[key]!;
    }

    Uint8List wav;
    switch (key) {
      case 'airhorn':
        wav = _synthAirhorn();
        break;
      case 'applause':
        wav = _synthApplause();
        break;
      case 'drumroll':
        wav = _synthDrumRoll();
        break;
      case 'cheer':
        wav = _synthCheer();
        break;
      case 'laugh':
        wav = _synthLaugh();
        break;
      case 'magic':
        wav = _synthMagicChime();
        break;
      case 'victory':
        wav = _synthVictoryFanfare();
        break;
      case 'tada':
        wav = _synthTada();
        break;
      case 'boo':
        wav = _synthBoo();
        break;
      case 'gasp':
        wav = _synthGasp();
        break;
      case 'mic_chime':
      default:
        wav = _synthMicChime();
        break;
    }

    _cache[key] = wav;
    return wav;
  }

  static Uint8List _buildWavFromSamples(List<double> samples) {
    final numSamples = samples.length;
    final dataSize = numSamples * 2; // 16-bit mono = 2 bytes per sample
    final byteData = ByteData(44 + dataSize);

    // RIFF Header
    byteData.setUint8(0, 0x52); // 'R'
    byteData.setUint8(1, 0x49); // 'I'
    byteData.setUint8(2, 0x46); // 'F'
    byteData.setUint8(3, 0x46); // 'F'
    byteData.setUint32(4, 36 + dataSize, Endian.little);
    byteData.setUint8(8, 0x57);  // 'W'
    byteData.setUint8(9, 0x41);  // 'A'
    byteData.setUint8(10, 0x56); // 'V'
    byteData.setUint8(11, 0x45); // 'E'

    // fmt sub-chunk
    byteData.setUint8(12, 0x66); // 'f'
    byteData.setUint8(13, 0x6D); // 'm'
    byteData.setUint8(14, 0x74); // 't'
    byteData.setUint8(15, 0x20); // ' '
    byteData.setUint32(16, 16, Endian.little); // PCM header size
    byteData.setUint16(20, 1, Endian.little);  // 1 = PCM format
    byteData.setUint16(22, 1, Endian.little);  // 1 channel (mono)
    byteData.setUint32(24, sampleRate, Endian.little); // 22050 Hz
    byteData.setUint32(28, sampleRate * 2, Endian.little); // Byte rate
    byteData.setUint16(32, 2, Endian.little);  // Block align
    byteData.setUint16(34, 16, Endian.little); // 16 bits per sample

    // data sub-chunk
    byteData.setUint8(36, 0x64); // 'd'
    byteData.setUint8(37, 0x61); // 'a'
    byteData.setUint8(38, 0x74); // 't'
    byteData.setUint8(39, 0x61); // 'a'
    byteData.setUint32(40, dataSize, Endian.little);

    // PCM 16-bit audio samples
    for (int i = 0; i < numSamples; i++) {
      final s = samples[i].clamp(-1.0, 1.0);
      final intSample = (s * 32767).round().clamp(-32768, 32767);
      byteData.setInt16(44 + (i * 2), intSample, Endian.little);
    }

    return byteData.buffer.asUint8List();
  }

  // 1. DJ Airhorn (Signature reggae airhorn blast: 320Hz + 466Hz)
  static Uint8List _synthAirhorn() {
    const duration = 1.1;
    final totalSamples = (sampleRate * duration).round();
    final samples = List<double>.filled(totalSamples, 0.0);

    for (int i = 0; i < totalSamples; i++) {
      final t = i / sampleRate;
      // 3 rhythmic blasts: 0.0-0.22s, 0.28-0.50s, 0.56-1.05s
      double env = 0.0;
      if (t < 0.22) {
        env = math.sin((t / 0.22) * math.pi);
      } else if (t >= 0.28 && t < 0.50) {
        env = math.sin(((t - 0.28) / 0.22) * math.pi);
      } else if (t >= 0.56 && t < 1.05) {
        env = math.sin(((t - 0.56) / 0.49) * math.pi);
      }

      if (env > 0) {
        // Dual harmonic horn frequencies
        final f1 = 320.0;
        final f2 = 466.16; // B-flat
        final f3 = 640.0;
        final s1 = math.sin(2 * math.pi * f1 * t);
        final s2 = 0.8 * math.sin(2 * math.pi * f2 * t);
        final s3 = 0.3 * math.sin(2 * math.pi * f3 * t);
        // Add brassy distortion
        final raw = (s1 + s2 + s3) * 0.7;
        final distorted = raw > 0.6 ? 0.6 : (raw < -0.6 ? -0.6 : raw);
        samples[i] = distorted * env * 0.95;
      }
    }
    return _buildWavFromSamples(samples);
  }

  // 2. Crowd Applause (Filtered noise bursts)
  static Uint8List _synthApplause() {
    const duration = 1.6;
    final totalSamples = (sampleRate * duration).round();
    final samples = List<double>.filled(totalSamples, 0.0);
    final rand = math.Random(42);

    for (int i = 0; i < totalSamples; i++) {
      final t = i / sampleRate;
      final env = math.exp(-1.8 * t) * (t < 0.1 ? (t / 0.1) : 1.0);
      final noise = (rand.nextDouble() * 2.0 - 1.0);
      final clapMod = math.sin(2 * math.pi * 18 * t) * 0.4 + 0.6;
      samples[i] = noise * env * clapMod * 0.65;
    }
    return _buildWavFromSamples(samples);
  }

  // 3. Drum Roll + Rimshot
  static Uint8List _synthDrumRoll() {
    const duration = 1.4;
    final totalSamples = (sampleRate * duration).round();
    final samples = List<double>.filled(totalSamples, 0.0);
    final rand = math.Random(1337);

    for (int i = 0; i < totalSamples; i++) {
      final t = i / sampleRate;
      if (t < 1.1) {
        // Accelerating snare drum roll
        final rollRate = 14.0 + (t / 1.1) * 22.0; // 14 to 36 taps/sec
        final tapPhase = (t * rollRate) % 1.0;
        final tapEnv = math.exp(-12.0 * tapPhase);
        final noise = (rand.nextDouble() * 2.0 - 1.0);
        final tone = math.sin(2 * math.pi * 180 * t);
        final snare = (0.7 * noise + 0.3 * tone) * tapEnv;
        final crescendo = (t / 1.1) * 0.6 + 0.2;
        samples[i] = snare * crescendo * 0.8;
      } else if (t >= 1.15 && t < 1.4) {
        // Final rimshot crash
        final rimT = t - 1.15;
        final rimEnv = math.exp(-6.0 * rimT);
        final noise = (rand.nextDouble() * 2.0 - 1.0);
        final rimTone = math.sin(2 * math.pi * 320 * t);
        samples[i] = (0.6 * noise + 0.4 * rimTone) * rimEnv * 0.95;
      }
    }
    return _buildWavFromSamples(samples);
  }

  // 4. Crowd Cheer (High-energy cheering swell)
  static Uint8List _synthCheer() {
    const duration = 1.5;
    final totalSamples = (sampleRate * duration).round();
    final samples = List<double>.filled(totalSamples, 0.0);
    final rand = math.Random(777);

    for (int i = 0; i < totalSamples; i++) {
      final t = i / sampleRate;
      final env = (t < 0.3 ? (t / 0.3) : math.exp(-1.2 * (t - 0.3)));
      final noise = (rand.nextDouble() * 2.0 - 1.0);
      final harmonic = math.sin(2 * math.pi * (450 + 200 * (t / 1.5)) * t);
      samples[i] = (0.65 * noise + 0.35 * harmonic) * env * 0.7;
    }
    return _buildWavFromSamples(samples);
  }

  // 5. Laugh Track (Rhythmic laughing bursts)
  static Uint8List _synthLaugh() {
    const duration = 1.3;
    final totalSamples = (sampleRate * duration).round();
    final samples = List<double>.filled(totalSamples, 0.0);

    final freqs = [440.0, 400.0, 460.0, 380.0, 420.0];
    for (int i = 0; i < totalSamples; i++) {
      final t = i / sampleRate;
      final burstIdx = (t / 0.24).floor();
      if (burstIdx < freqs.length) {
        final burstT = t - (burstIdx * 0.24);
        if (burstT < 0.18) {
          final env = math.sin((burstT / 0.18) * math.pi);
          final f = freqs[burstIdx];
          final tone = math.sin(2 * math.pi * f * t) + 0.3 * math.sin(2 * math.pi * f * 2 * t);
          samples[i] = tone * env * 0.75;
        }
      }
    }
    return _buildWavFromSamples(samples);
  }

  // 6. Magic Chime (Sparkling celestial arpeggio)
  static Uint8List _synthMagicChime() {
    const duration = 1.4;
    final totalSamples = (sampleRate * duration).round();
    final samples = List<double>.filled(totalSamples, 0.0);

    // C6, E6, G6, B6, C7
    final notes = [1046.50, 1318.51, 1567.98, 1975.53, 2093.00];
    for (int n = 0; n < notes.length; n++) {
      final noteStart = n * 0.12;
      final freq = notes[n];
      for (int i = 0; i < totalSamples; i++) {
        final t = i / sampleRate;
        if (t >= noteStart) {
          final noteT = t - noteStart;
          final env = math.exp(-3.5 * noteT);
          final tone = math.sin(2 * math.pi * freq * t);
          final shimmer = math.sin(2 * math.pi * (freq * 2.01) * t) * 0.3;
          samples[i] += (tone + shimmer) * env * 0.25;
        }
      }
    }
    return _buildWavFromSamples(samples);
  }

  // 7. Victory Fanfare (Triumphant ascending brass flourish)
  static Uint8List _synthVictoryFanfare() {
    const duration = 1.5;
    final totalSamples = (sampleRate * duration).round();
    final samples = List<double>.filled(totalSamples, 0.0);

    // Triad: C5, E5, G5, high C6
    final noteTimes = [0.0, 0.15, 0.30, 0.45];
    final noteDurs = [0.13, 0.13, 0.13, 0.95];
    final noteFreqs = [523.25, 659.25, 783.99, 1046.50];

    for (int n = 0; n < noteFreqs.length; n++) {
      final startT = noteTimes[n];
      final dur = noteDurs[n];
      final freq = noteFreqs[n];

      for (int i = 0; i < totalSamples; i++) {
        final t = i / sampleRate;
        if (t >= startT && t < (startT + dur)) {
          final noteT = t - startT;
          final env = math.exp(-2.2 * (noteT / dur)) * (noteT < 0.02 ? (noteT / 0.02) : 1.0);
          final s1 = math.sin(2 * math.pi * freq * t);
          final s2 = 0.5 * math.sin(2 * math.pi * (freq * 2) * t);
          final s3 = 0.25 * math.sin(2 * math.pi * (freq * 3) * t);
          samples[i] = (s1 + s2 + s3) * env * 0.65;
        }
      }
    }
    return _buildWavFromSamples(samples);
  }

  // 8. Tada Fanfare
  static Uint8List _synthTada() {
    const duration = 1.3;
    final totalSamples = (sampleRate * duration).round();
    final samples = List<double>.filled(totalSamples, 0.0);

    // G4 -> high C5 + E5 chord
    for (int i = 0; i < totalSamples; i++) {
      final t = i / sampleRate;
      if (t < 0.2) {
        final env = math.sin((t / 0.2) * math.pi);
        samples[i] = math.sin(2 * math.pi * 392.0 * t) * env * 0.7;
      } else if (t >= 0.22) {
        final chordT = t - 0.22;
        final env = math.exp(-2.5 * chordT);
        final c5 = math.sin(2 * math.pi * 523.25 * t);
        final e5 = math.sin(2 * math.pi * 659.25 * t);
        final g5 = math.sin(2 * math.pi * 783.99 * t);
        samples[i] = (c5 + e5 + g5) * 0.33 * env * 0.85;
      }
    }
    return _buildWavFromSamples(samples);
  }

  // 9. Crowd Boo
  static Uint8List _synthBoo() {
    const duration = 1.3;
    final totalSamples = (sampleRate * duration).round();
    final samples = List<double>.filled(totalSamples, 0.0);

    for (int i = 0; i < totalSamples; i++) {
      final t = i / sampleRate;
      final env = math.sin((t / 1.3) * math.pi);
      // Descending low groan: 160Hz -> 95Hz
      final f = 160.0 - (65.0 * (t / 1.3));
      final tone = math.sin(2 * math.pi * f * t) + 0.3 * math.sin(2 * math.pi * (f * 1.5) * t);
      samples[i] = tone * env * 0.7;
    }
    return _buildWavFromSamples(samples);
  }

  // 10. Audience Gasp
  static Uint8List _synthGasp() {
    const duration = 0.7;
    final totalSamples = (sampleRate * duration).round();
    final samples = List<double>.filled(totalSamples, 0.0);
    final rand = math.Random(999);

    for (int i = 0; i < totalSamples; i++) {
      final t = i / sampleRate;
      final env = math.sin((t / 0.7) * math.pi);
      final noise = (rand.nextDouble() * 2.0 - 1.0);
      final tone = math.sin(2 * math.pi * (300 + 400 * (t / 0.7)) * t);
      samples[i] = (0.7 * noise + 0.3 * tone) * env * 0.6;
    }
    return _buildWavFromSamples(samples);
  }

  // 11. Soft Mic Confirmation Chime
  static Uint8List _synthMicChime() {
    const duration = 0.45;
    final totalSamples = (sampleRate * duration).round();
    final samples = List<double>.filled(totalSamples, 0.0);

    for (int i = 0; i < totalSamples; i++) {
      final t = i / sampleRate;
      final env = math.exp(-7.0 * t);
      final s1 = math.sin(2 * math.pi * 880.0 * t);
      final s2 = 0.4 * math.sin(2 * math.pi * 1760.0 * t);
      samples[i] = (s1 + s2) * env * 0.55;
    }
    return _buildWavFromSamples(samples);
  }
}
