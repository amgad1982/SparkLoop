import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface PodAudioPlayerProps {
  audioUrl: string;
  durationSeconds?: number;
}

export const PodAudioPlayer: React.FC<PodAudioPlayerProps> = ({ audioUrl, durationSeconds }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(Math.round(audio.duration));
      }
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Audio playback error:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 my-1 max-w-sm">
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all shadow-md ${
          isPlaying
            ? 'bg-cyan-500 text-zinc-950 shadow-cyan-500/30 animate-pulse'
            : 'bg-zinc-800 hover:bg-zinc-700 text-cyan-400 hover:text-white'
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current translate-x-0.5" />}
      </button>

      {/* Waveform Bars & Progress */}
      <div className="flex-1 space-y-1.5 min-w-0">
        <div className="flex items-center gap-1 h-5 overflow-hidden">
          {[40, 70, 95, 55, 80, 100, 60, 85, 45, 90, 75, 50, 85, 65, 95, 30].map((h, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-150 ${
                isPlaying
                  ? 'bg-cyan-400 animate-pulse'
                  : i / 16 < (duration ? currentTime / duration : 0)
                  ? 'bg-cyan-500'
                  : 'bg-zinc-700'
              }`}
              style={{
                height: isPlaying ? `${Math.max(20, (h * (Math.sin(currentTime * 8 + i) + 1.2)) / 2.2)}%` : `${h}%`,
              }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-20 sm:w-24 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <Volume2 className={`w-3.5 h-3.5 shrink-0 ${isPlaying ? 'text-cyan-400' : 'text-zinc-600'}`} />
    </div>
  );
};
