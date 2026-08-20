import React, { useState, useRef, useEffect } from 'react';
import { useThemeStore } from '../../stores/useThemeStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { usePodStore } from '../../stores/usePodStore';
import { MoodPodDto, PodMessageDto } from '../../types/api';
import { useCentrifugo } from '../../hooks/useCentrifugo';
import { FloatingReactions } from './FloatingReactions';
import { api } from '../../services/apiClient';
import { Clock, Flame, Radio, Send, Sparkles, Users } from 'lucide-react';
import { motion } from 'framer-motion';

interface MoodPodRoomProps {
  initialPod: MoodPodDto;
  onBack?: () => void;
}

const BURST_EMOJIS = ['🔥', '💖', '🚀', '😂', '⚡', '🤯', '🌙', '✨'];

export const MoodPodRoom: React.FC<MoodPodRoomProps> = ({ initialPod }) => {
  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const { currentPersona } = useAuthStore();
  const { addReaction } = usePodStore();

  const [pod, setPod] = useState<MoodPodDto>(initialPod);
  const [messages, setMessages] = useState<PodMessageDto[]>(initialPod.recentMessages || []);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Real-Time Centrifugo Subscription for `pod:{podId}`
  useCentrifugo(`pod:${pod.id}`, (data) => {
    if (data.type === 'POD_MESSAGE' && data.message) {
      const newMsg = data.message as PodMessageDto;
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    } else if (data.type === 'REACTION_BURST') {
      const { emoji } = data as unknown as { emoji: string };
      addReaction(emoji);
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setIsSending(true);
    try {
      const msg = await api.sendPodMessage(pod.id, inputText.trim());
      setMessages((prev) => [...prev, msg]);
      setInputText('');
    } catch (err) {
      console.error('Send message error:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleReactionBurst = async (emoji: string) => {
    addReaction(emoji); // local instant feedback
    try {
      await api.sendPodReaction(pod.id, emoji, 1);
    } catch (err) {
      console.error('Reaction burst error:', err);
    }
  };

  return (
    <div className="relative h-[calc(100vh-140px)] flex flex-col glass-panel rounded-3xl border border-zinc-800/80 overflow-hidden text-white">
      {/* Floating Emoji Particle Canvas */}
      <FloatingReactions />

      {/* Pod Room Header */}
      <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-fuchsia-600 to-cyan-500 p-0.5 flex items-center justify-center text-xl shadow-lg">
            <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
              {pod.moodEmoji}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-zinc-100">{pod.title}</h3>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3 text-cyan-400" />
                <span>{pod.activeParticipantCount} {isArabic ? 'متواجدين' : 'online'}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-amber-400">
                <Clock className="w-3 h-3" />
                <span>{isArabic ? 'ينتهي خلال 24 ساعة' : '24h Ephemeral TTL'}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-fuchsia-500/20 text-fuchsia-300 rounded-full border border-fuchsia-500/30 text-[10px] font-black uppercase">
          <Radio className="w-3 h-3 text-fuchsia-400 animate-pulse" />
          <span>POD LIVE</span>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 no-scrollbar z-10">
        {messages.map((msg) => {
          const isMe = msg.senderId === currentPersona.id;
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}
            >
              <img
                src={msg.senderAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.senderUsername}`}
                alt={msg.senderUsername}
                className="w-7 h-7 rounded-full border border-zinc-700 object-cover flex-shrink-0"
              />
              <div
                className={`max-w-[75%] p-3 rounded-2xl text-xs space-y-0.5 ${
                  isMe
                    ? 'bg-gradient-to-tr from-fuchsia-600 to-purple-600 text-white rounded-tr-none'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-none'
                }`}
              >
                {!isMe && (
                  <span className="text-[10px] font-bold text-fuchsia-400 block">
                    {msg.senderDisplayName || msg.senderUsername}
                  </span>
                )}
                <p className="leading-relaxed">{msg.text}</p>
              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Reaction Fountain Bar */}
      <div className="px-4 py-2 border-t border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between gap-1 overflow-x-auto no-scrollbar z-10">
        <span className="text-[10px] font-bold text-zinc-500 flex-shrink-0">
          {isArabic ? 'تفاعل سريع:' : 'Burst:'}
        </span>
        {BURST_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleReactionBurst(emoji)}
            className="text-xl p-1.5 hover:scale-125 active:scale-90 transition-transform rounded-xl hover:bg-zinc-800/60 flex-shrink-0"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Message Input Bar */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-800 bg-zinc-900/90 flex items-center gap-2 z-10">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isArabic ? 'اكتب رسالة في حجرة المزاج...' : 'Drop a thought in the pod...'}
          className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-2xl text-xs text-white focus:outline-none focus:border-fuchsia-500"
        />
        <button
          type="submit"
          disabled={isSending || !inputText.trim()}
          className="p-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white rounded-2xl active:scale-95 transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
