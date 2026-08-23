import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { PodSpeaker } from '../types/api';
import { api } from '../services/apiClient';
import { soundEffects } from '../services/soundEffects';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export interface UsePodVoiceEngineOptions {
  podId: string;
  hostUsername: string;
  onSpeakersUpdated?: (speakers: PodSpeaker[]) => void;
  onSoundEffectReceived?: (effect: string, senderName: string) => void;
  onReactionReceived?: (emoji: string) => void;
}

export function usePodVoiceEngine({
  podId,
  hostUsername,
  onSpeakersUpdated,
  onSoundEffectReceived,
  onReactionReceived,
}: UsePodVoiceEngineOptions) {
  const currentPersona = useAuthStore((s) => s.currentPersona);

  const [isOnStage, setIsOnStage] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [speakers, setSpeakers] = useState<PodSpeaker[]>([]);
  const [handRaisedUsers, setHandRaisedUsers] = useState<{ userId: string; username: string; displayName: string }[]>([]);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [roomVolume, setRoomVolume] = useState(1.0);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // Audio & WebRTC Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isSpeakingRef = useRef(false);
  const lastSpeakingStateSentRef = useRef<number>(0);

  // WebRTC Peer Connections: peerUserId -> RTCPeerConnection
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Audio Chunk Recorder Ref (Fallback Streamer)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkIndexRef = useRef(0);

  // Audio Chunk Playback Queue (for fallback audio chunks)
  const audioQueueRef = useRef<{ buffer: AudioBuffer; time: number }[]>([]);
  const nextPlayTimeRef = useRef<number>(0);

  // Helper to ensure AudioContext exists
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(isAudioMuted ? 0 : roomVolume, ctx.currentTime);
      gain.connect(ctx.destination);

      audioCtxRef.current = ctx;
      masterGainRef.current = gain;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, [isAudioMuted, roomVolume]);

  // Update master gain when volume or mute changes
  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setValueAtTime(
        isAudioMuted ? 0 : roomVolume,
        audioCtxRef.current.currentTime
      );
    }
    remoteAudiosRef.current.forEach((audio) => {
      audio.volume = isAudioMuted ? 0 : roomVolume;
    });
  }, [roomVolume, isAudioMuted]);

  // -------------------------------------------------------------
  // WebRTC Connection Setup for a given peer
  // -------------------------------------------------------------
  const createPeerConnection = useCallback(
    (peerUserId: string): RTCPeerConnection => {
      if (peerConnectionsRef.current.has(peerUserId)) {
        return peerConnectionsRef.current.get(peerUserId)!;
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);

      // If we have a local microphone stream, add tracks to the peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          api.sendPodSignal(podId, 'ICE_CANDIDATE', event.candidate, peerUserId).catch(() => {});
        }
      };

      // Handle incoming remote audio track
      pc.ontrack = (event) => {
        const stream = event.streams[0] || new MediaStream([event.track]);
        let audioEl = remoteAudiosRef.current.get(peerUserId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          audioEl.volume = isAudioMuted ? 0 : roomVolume;
          remoteAudiosRef.current.set(peerUserId, audioEl);
        }
        audioEl.srcObject = stream;
        audioEl.play().catch((err) => console.warn('Autoplay prevented on peer audio:', err));
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          pc.close();
          peerConnectionsRef.current.delete(peerUserId);
        }
      };

      peerConnectionsRef.current.set(peerUserId, pc);
      return pc;
    },
    [podId, isAudioMuted, roomVolume]
  );

  // -------------------------------------------------------------
  // Handle Incoming Centrifugo Signals & WebRTC Negotiation
  // -------------------------------------------------------------
  const handleIncomingData = useCallback(
    async (data: { type: string; [key: string]: unknown }) => {
      // 1. WEBRTC SIGNALING
      if (data.type === 'WEBRTC_SIGNAL') {
        const signal = data as unknown as {
          signalType: string;
          senderId: string;
          senderUsername: string;
          senderDisplayName: string;
          senderAvatarUrl?: string;
          targetUserId?: string;
          payload: unknown;
        };

        if (signal.senderId === currentPersona.id) return; // Ignore own signals

        // If targeted to a specific user and it's not us, ignore
        if (signal.targetUserId && signal.targetUserId !== currentPersona.id) return;

        switch (signal.signalType) {
          case 'STAGE_JOIN': {
            // A new speaker joined the stage. If we are on stage or listening, create offer to peer
            setSpeakers((prev) => {
              if (prev.some((s) => s.userId === signal.senderId)) return prev;
              const newSpeaker: PodSpeaker = {
                userId: signal.senderId,
                username: signal.senderUsername,
                displayName: signal.senderDisplayName,
                avatarUrl: signal.senderAvatarUrl,
                isSpeaking: false,
                isMuted: false,
                joinedAtUtc: Date.now(),
              };
              const updated = [...prev, newSpeaker];
              onSpeakersUpdated?.(updated);
              return updated;
            });

            // If we are currently transmitting on stage, send SDP offer to the new participant
            if (localStreamRef.current) {
              const pc = createPeerConnection(signal.senderId);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              await api.sendPodSignal(podId, 'OFFER', offer, signal.senderId);
            }
            break;
          }

          case 'STAGE_LEAVE': {
            setSpeakers((prev) => {
              const updated = prev.filter((s) => s.userId !== signal.senderId);
              onSpeakersUpdated?.(updated);
              return updated;
            });
            const pc = peerConnectionsRef.current.get(signal.senderId);
            if (pc) {
              pc.close();
              peerConnectionsRef.current.delete(signal.senderId);
            }
            const audioEl = remoteAudiosRef.current.get(signal.senderId);
            if (audioEl) {
              audioEl.pause();
              audioEl.srcObject = null;
              remoteAudiosRef.current.delete(signal.senderId);
            }
            break;
          }

          case 'OFFER': {
            const pc = createPeerConnection(signal.senderId);
            const offer = signal.payload as RTCSessionDescriptionInit;
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await api.sendPodSignal(podId, 'ANSWER', answer, signal.senderId);
            break;
          }

          case 'ANSWER': {
            const pc = peerConnectionsRef.current.get(signal.senderId);
            if (pc) {
              const answer = signal.payload as RTCSessionDescriptionInit;
              await pc.setRemoteDescription(new RTCSessionDescription(answer));
            }
            break;
          }

          case 'ICE_CANDIDATE': {
            const pc = peerConnectionsRef.current.get(signal.senderId);
            if (pc && signal.payload) {
              const candidate = signal.payload as RTCIceCandidateInit;
              await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            }
            break;
          }

          case 'HAND_RAISE': {
            setHandRaisedUsers((prev) => {
              if (prev.some((u) => u.userId === signal.senderId)) return prev;
              return [
                ...prev,
                {
                  userId: signal.senderId,
                  username: signal.senderUsername,
                  displayName: signal.senderDisplayName,
                },
              ];
            });
            break;
          }

          case 'HAND_LOWER': {
            setHandRaisedUsers((prev) => prev.filter((u) => u.userId !== signal.senderId));
            break;
          }

          case 'INVITE_SPEAKER': {
            if (signal.targetUserId === currentPersona.id) {
              // We are invited to speak! Automatically trigger stage join prompt
              handleJoinStage();
            }
            break;
          }
        }
      }

      // 2. REAL-TIME AUDIO CHUNK STREAMING (Fallback & companion stream)
      else if (data.type === 'AUDIO_CHUNK') {
        const chunk = data as unknown as {
          senderId: string;
          senderUsername: string;
          chunkIndex: number;
          audioBase64: string;
          durationMs?: number;
        };

        if (chunk.senderId === currentPersona.id) return; // Don't playback own voice

        try {
          const ctx = getAudioContext();
          const base64Data = chunk.audioBase64.split(',')[1] || chunk.audioBase64;
          const binaryStr = atob(base64Data);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }

          ctx.decodeAudioData(
            bytes.buffer.slice(0),
            (buffer) => {
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              if (masterGainRef.current) {
                source.connect(masterGainRef.current);
              } else {
                source.connect(ctx.destination);
              }

              const currentTime = ctx.currentTime;
              const startTime = Math.max(currentTime, nextPlayTimeRef.current);
              source.start(startTime);
              nextPlayTimeRef.current = startTime + buffer.duration;
            },
            () => {
              // If slice is too small or incomplete header, ignore silently
            }
          );
        } catch {
          // Silent fallback ignore
        }
      }

      // 3. SOUND EFFECT SYNCHRONIZATION
      else if (data.type === 'SOUND_EFFECT') {
        const effect = data as unknown as {
          effect: string;
          senderId: string;
          senderUsername: string;
          senderDisplayName: string;
        };
        soundEffects.play(effect.effect, isAudioMuted ? 0 : roomVolume);
        onSoundEffectReceived?.(effect.effect, effect.senderDisplayName || effect.senderUsername);
      }

      // 4. SPEAKING STATUS UPDATES
      else if (data.type === 'SPEAKING_STATUS') {
        const status = data as unknown as {
          userId: string;
          username: string;
          displayName: string;
          avatarUrl?: string;
          isSpeaking: boolean;
          isMuted: boolean;
        };

        setSpeakers((prev) => {
          const exists = prev.some((s) => s.userId === status.userId);
          if (exists) {
            return prev.map((s) =>
              s.userId === status.userId
                ? { ...s, isSpeaking: status.isSpeaking, isMuted: status.isMuted }
                : s
            );
          } else {
            return [
              ...prev,
              {
                userId: status.userId,
                username: status.username,
                displayName: status.displayName,
                avatarUrl: status.avatarUrl,
                isSpeaking: status.isSpeaking,
                isMuted: status.isMuted,
                joinedAtUtc: Date.now(),
              },
            ];
          }
        });
      }

      // 5. REACTION BURST
      else if (data.type === 'REACTION_BURST') {
        const reaction = data as unknown as { emoji: string };
        soundEffects.play('pop', 0.2);
        onReactionReceived?.(reaction.emoji);
      }
    },
    [
      currentPersona.id,
      podId,
      createPeerConnection,
      getAudioContext,
      isAudioMuted,
      roomVolume,
      onSpeakersUpdated,
      onSoundEffectReceived,
      onReactionReceived,
    ]
  );

  // -------------------------------------------------------------
  // Step onto Stage ("Grab Mic 🎙️")
  // -------------------------------------------------------------
  const handleJoinStage = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;

      const ctx = getAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsOnStage(true);
      setIsMuted(false);
      setIsHandRaised(false);

      // Add self to local speakers
      const mySpeaker: PodSpeaker = {
        userId: currentPersona.id,
        username: currentPersona.username,
        displayName: currentPersona.displayName,
        avatarUrl: currentPersona.avatarUrl,
        isSpeaking: false,
        isMuted: false,
        joinedAtUtc: Date.now(),
      };
      setSpeakers((prev) => {
        const updated = [...prev.filter((s) => s.userId !== currentPersona.id), mySpeaker];
        onSpeakersUpdated?.(updated);
        return updated;
      });

      // Broadcast STAGE_JOIN signal to room
      await api.sendPodSignal(podId, 'STAGE_JOIN');

      // Start Audio Level Monitoring Loop
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const monitorAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setMicLevel(normalized);

        const speakingNow = avg > 12;
        const now = Date.now();
        if (
          speakingNow !== isSpeakingRef.current ||
          (speakingNow && now - lastSpeakingStateSentRef.current > 3000)
        ) {
          isSpeakingRef.current = speakingNow;
          lastSpeakingStateSentRef.current = now;
          api.setPodSpeakingStatus(podId, speakingNow, false).catch(() => {});
        }

        animFrameRef.current = requestAnimationFrame(monitorAudio);
      };
      monitorAudio();

      // Start Fallback Audio Chunk Streaming (250ms chunks)
      try {
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        mediaRecorderRef.current = recorder;
        chunkIndexRef.current = 0;

        recorder.ondataavailable = async (e) => {
          if (e.data && e.data.size > 0 && !isMuted) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result as string;
              if (base64) {
                api
                  .sendPodAudioChunk(podId, base64, chunkIndexRef.current++, 250)
                  .catch(() => {});
              }
            };
            reader.readAsDataURL(e.data);
          }
        };

        recorder.start(250);
      } catch (recErr) {
        console.warn('Fallback media recorder not supported in current browser:', recErr);
      }
    } catch (err) {
      console.warn('Microphone access denied or error:', err);
      alert('Could not access microphone. Please grant mic permissions in your browser.');
    }
  };

  // -------------------------------------------------------------
  // Leave Stage
  // -------------------------------------------------------------
  const handleLeaveStage = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    setIsOnStage(false);
    setMicLevel(0);
    isSpeakingRef.current = false;

    // Close all active peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    // Broadcast STAGE_LEAVE
    api.sendPodSignal(podId, 'STAGE_LEAVE').catch(() => {});
    api.setPodSpeakingStatus(podId, false, true).catch(() => {});

    setSpeakers((prev) => {
      const updated = prev.filter((s) => s.userId !== currentPersona.id);
      onSpeakersUpdated?.(updated);
      return updated;
    });
  };

  // -------------------------------------------------------------
  // Mute / Unmute Mic
  // -------------------------------------------------------------
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
    }

    setSpeakers((prev) =>
      prev.map((s) =>
        s.userId === currentPersona.id ? { ...s, isMuted: nextMuted, isSpeaking: false } : s
      )
    );

    api.setPodSpeakingStatus(podId, false, nextMuted).catch(() => {});
  };

  // -------------------------------------------------------------
  // Hand Raise & Invites
  // -------------------------------------------------------------
  const toggleHandRaise = async () => {
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);
    if (nextState) {
      soundEffects.play('pop', 0.4);
      await api.sendPodSignal(podId, 'HAND_RAISE');
    } else {
      await api.sendPodSignal(podId, 'HAND_LOWER');
    }
  };

  const inviteUserToStage = async (userId: string) => {
    await api.sendPodSignal(podId, 'INVITE_SPEAKER', null, userId);
    setHandRaisedUsers((prev) => prev.filter((u) => u.userId !== userId));
  };

  // -------------------------------------------------------------
  // Soundboard Trigger
  // -------------------------------------------------------------
  const triggerSoundEffect = async (effectName: string) => {
    soundEffects.play(effectName, isAudioMuted ? 0 : roomVolume);
    await api.sendPodSoundEffect(podId, effectName).catch(() => {});
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      remoteAudiosRef.current.forEach((audio) => {
        audio.pause();
        audio.srcObject = null;
      });
      remoteAudiosRef.current.clear();
    };
  }, []);

  return {
    isOnStage,
    isMuted,
    micLevel,
    speakers,
    setSpeakers,
    handRaisedUsers,
    isHandRaised,
    roomVolume,
    setRoomVolume,
    isAudioMuted,
    setIsAudioMuted,
    handleJoinStage,
    handleLeaveStage,
    toggleMute,
    toggleHandRaise,
    inviteUserToStage,
    triggerSoundEffect,
    handleIncomingData,
  };
}
