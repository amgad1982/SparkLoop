import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteParticipant,
  Participant,
  LocalAudioTrack,
} from 'livekit-client';
import { useAuthStore } from '../stores/useAuthStore';
import { PodSpeaker } from '../types/api';
import { api } from '../services/apiClient';
import { soundEffects } from '../services/soundEffects';
import { startProceduralAmbient, ActiveSynthTrack } from '../services/ambientAudioGenerator';

export interface PodBgMusicState {
  isActive: boolean;
  isPlaying: boolean;
  djUserId: string | null;
  djUsername: string | null;
  djDisplayName: string | null;
  djAvatarUrl?: string | null;
  trackTitle: string;
  currentTime: number;
  duration: number;
}

export interface UsePodVoiceEngineOptions {
  podId: string;
  hostUsername: string;
  onSpeakersUpdated?: (speakers: PodSpeaker[]) => void;
  onSoundEffectReceived?: (effect: string, senderName: string) => void;
  onReactionReceived?: (emoji: string) => void;
  onDjTakeoverStatus?: (status: 'approved' | 'declined' | 'requested') => void;
}

interface AttachedAudioTrackEntry {
  element: HTMLMediaElement;
  source: Track.Source;
  isDjMusic: boolean;
}

export function usePodVoiceEngine({
  podId,
  hostUsername,
  onSpeakersUpdated,
  onSoundEffectReceived,
  onReactionReceived,
  onDjTakeoverStatus,
}: UsePodVoiceEngineOptions) {
  const currentPersona = useAuthStore((s) => s.currentPersona);

  const [isOnStage, setIsOnStage] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [speakers, setSpeakers] = useState<PodSpeaker[]>([]);
  const [handRaisedUsers, setHandRaisedUsers] = useState<{ userId: string; username: string; displayName: string }[]>([]);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [roomVolume, setRoomVolumeState] = useState(1.0);
  const [isAudioMuted, setIsAudioMutedState] = useState(false);
  const [isLiveKitConnected, setIsLiveKitConnected] = useState(false);
  const [canPlaybackAudio, setCanPlaybackAudio] = useState(true);

  // DJ Takeover Request State
  const [djTakeoverRequest, setDjTakeoverRequest] = useState<{
    requesterId: string;
    requesterName: string;
  } | null>(null);
  const [isDjTakeoverApprovedForMe, setIsDjTakeoverApprovedForMe] = useState(false);
  const [isRequestingTakeover, setIsRequestingTakeover] = useState(false);

  // Synchronous State References to prevent stale closures
  const isOnStageRef = useRef(isOnStage);
  isOnStageRef.current = isOnStage;

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const roomVolumeRef = useRef(roomVolume);
  roomVolumeRef.current = roomVolume;

  const isAudioMutedRef = useRef(isAudioMuted);
  isAudioMutedRef.current = isAudioMuted;

  const lastMicLevelRef = useRef(0);
  const lastVisualizerUpdateRef = useRef(0);
  const lastSpeakingBroadcastRef = useRef(0);

  // Background Music State
  const [bgMusic, setBgMusic] = useState<PodBgMusicState>({
    isActive: false,
    isPlaying: false,
    djUserId: null,
    djUsername: null,
    djDisplayName: null,
    djAvatarUrl: null,
    trackTitle: '',
    currentTime: 0,
    duration: 0,
  });
  const [bgMusicVolume, setBgMusicVolumeState] = useState(0.4);
  const [isBgMusicMuted, setIsBgMusicMutedState] = useState(false);

  const bgMusicVolumeRef = useRef(bgMusicVolume);
  bgMusicVolumeRef.current = bgMusicVolume;

  const isBgMusicMutedRef = useRef(isBgMusicMuted);
  isBgMusicMutedRef.current = isBgMusicMuted;

  // LiveKit Room & Audio Elements Map
  const roomRef = useRef<Room | null>(null);
  const attachedAudioElementsRef = useRef<Map<string, AttachedAudioTrackEntry>>(new Map());
  const djTrackRef = useRef<LocalAudioTrack | null>(null);
  const djBufferSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const djSynthRef = useRef<ActiveSynthTrack | null>(null);
  const djGainNodeRef = useRef<GainNode | null>(null);

  // Audio Context & Analyser for Local Visualizer
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Stage Presence Map to track participants on stage across LiveKit & Centrifugo
  const stagePresenceMapRef = useRef<Map<string, PodSpeaker>>(new Map());

  // Check if current user is host
  const isHost =
    hostUsername.toLowerCase() === currentPersona.username.toLowerCase() ||
    hostUsername.toLowerCase() === (currentPersona.displayName || '').toLowerCase();

  // Audio Context initialization
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  // Internal local stream cleanup to stop overlapping music immediately
  const cleanupLocalDjAudio = useCallback(async () => {
    if (djSynthRef.current) {
      try {
        djSynthRef.current.stop();
      } catch {}
      djSynthRef.current = null;
    }
    if (djBufferSourceRef.current) {
      try {
        djBufferSourceRef.current.stop();
      } catch {}
      djBufferSourceRef.current = null;
    }
    if (djGainNodeRef.current) {
      try {
        djGainNodeRef.current.disconnect();
      } catch {}
      djGainNodeRef.current = null;
    }
    if (djTrackRef.current && roomRef.current) {
      try {
        await roomRef.current.localParticipant.unpublishTrack(djTrackRef.current);
        djTrackRef.current.stop();
      } catch {}
      djTrackRef.current = null;
    }
  }, []);

  // Unlock Audio Playback on demand
  const unlockAudioPlayback = useCallback(async () => {
    try {
      if (roomRef.current) {
        await roomRef.current.startAudio();
        setCanPlaybackAudio(roomRef.current.canPlaybackAudio);
      }
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      attachedAudioElementsRef.current.forEach(({ element }) => {
        element.play().catch(() => {});
      });
    } catch (err) {
      console.warn('Unlock audio playback:', err);
    }
  }, [getAudioContext]);

  // Synchronize speaker list from LiveKit participants & stage presence
  const syncSpeakerList = useCallback(
    (room: Room | null) => {
      const speakerList: PodSpeaker[] = [];
      const seenIds = new Set<string>();

      // 1. Self (if on stage)
      if (isOnStageRef.current) {
        seenIds.add(currentPersona.id);
        speakerList.push({
          userId: currentPersona.id,
          username: currentPersona.username,
          displayName: currentPersona.displayName || currentPersona.username,
          avatarUrl: currentPersona.avatarUrl,
          isMuted: isMutedRef.current,
          isSpeaking: lastMicLevelRef.current > 0.05,
          joinedAtUtc: Date.now(),
        });
      }

      // 2. Remote LiveKit Participants
      if (room) {
        room.remoteParticipants.forEach((p: RemoteParticipant) => {
          let meta: { username?: string; displayName?: string; isOnStage?: boolean } = {};
          try {
            if (p.metadata) meta = JSON.parse(p.metadata);
          } catch {}

          const hasAudio = p.audioTrackPublications.size > 0;
          const isParticipantOnStage = hasAudio || meta.isOnStage || stagePresenceMapRef.current.has(p.identity);

          if (isParticipantOnStage) {
            seenIds.add(p.identity);
            speakerList.push({
              userId: p.identity,
              username: meta.username || p.name || p.identity,
              displayName: meta.displayName || p.name || meta.username || p.identity,
              avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${meta.username || p.identity}`,
              isMuted: !p.isMicrophoneEnabled,
              isSpeaking: p.isSpeaking,
              joinedAtUtc: Date.now(),
            });
          }
        });
      }

      // 3. Any additional stage speakers received via Centrifugo signals
      stagePresenceMapRef.current.forEach((speaker, id) => {
        if (!seenIds.has(id)) {
          seenIds.add(id);
          speakerList.push(speaker);
        }
      });

      setSpeakers(speakerList);
      if (onSpeakersUpdated) {
        onSpeakersUpdated(speakerList);
      }
    },
    [currentPersona, onSpeakersUpdated]
  );

  // Visualizer attached to active mic stream
  const attachVisualizerToStream = useCallback(
    (mediaStreamTrack: MediaStreamTrack) => {
      try {
        const ctx = getAudioContext();
        const stream = new MediaStream([mediaStreamTrack]);
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!analyserRef.current || isMutedRef.current || !isOnStageRef.current) {
            if (lastMicLevelRef.current !== 0) {
              lastMicLevelRef.current = 0;
              setMicLevel(0);
            }
          } else {
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const normalized = Math.min(1, avg / 128);

            const now = Date.now();
            if (now - lastVisualizerUpdateRef.current > 50 || Math.abs(normalized - lastMicLevelRef.current) > 0.08) {
              lastVisualizerUpdateRef.current = now;
              lastMicLevelRef.current = normalized;
              setMicLevel(normalized);

              // Periodic broadcast of speaking state to other pod attendees
              if (normalized > 0.08 && now - lastSpeakingBroadcastRef.current > 2000) {
                lastSpeakingBroadcastRef.current = now;
                api.sendPodSignal(podId, 'STAGE_SPEAKING', {
                  userId: currentPersona.id,
                  isSpeaking: true,
                  isMuted: isMutedRef.current,
                }).catch(() => {});
              }
            }
          }
          animFrameRef.current = requestAnimationFrame(tick);
        };

        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.warn('Could not attach visualizer to stream:', err);
      }
    },
    [getAudioContext, podId, currentPersona.id]
  );

  const stopMicVisualizer = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    lastMicLevelRef.current = 0;
    setMicLevel(0);
  }, []);

  // Initial stage check (if host)
  useEffect(() => {
    if (isHost) {
      setIsOnStage(true);
    }
  }, [isHost]);

  // 1. LiveKit Room Connection & Event Management
  useEffect(() => {
    let isMounted = true;
    let roomInstance: Room | null = null;

    const connectLiveKit = async () => {
      try {
        const tokenDto = await api.getPodVoiceToken(podId, true);
        if (!isMounted) return;

        roomInstance = new Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        roomRef.current = roomInstance;

        // Remote Track Subscribed
        roomInstance.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: any, participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Audio) {
            const isDjMusic =
              publication.source === Track.Source.ScreenShareAudio ||
              publication.trackName === 'dj-music' ||
              publication.trackName === 'system-audio';

            const el = track.attach();
            el.autoplay = true;
            if (isDjMusic) {
              el.volume = isBgMusicMutedRef.current ? 0 : bgMusicVolumeRef.current;
              el.muted = isBgMusicMutedRef.current;
            } else {
              el.volume = isAudioMutedRef.current ? 0 : roomVolumeRef.current;
              el.muted = isAudioMutedRef.current;
            }
            el.style.position = 'fixed';
            el.style.top = '-9999px';
            el.style.left = '-9999px';
            el.style.width = '1px';
            el.style.height = '1px';
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
            document.body.appendChild(el);
            el.play().catch((err: unknown) => {
              console.warn('Remote track audio play blocked:', err);
            });
            attachedAudioElementsRef.current.set(`${participant.identity}-${publication.trackSid}`, {
              element: el,
              source: publication.source,
              isDjMusic,
            });
          }
          syncSpeakerList(roomInstance);
        });

        // Remote Track Unsubscribed
        roomInstance.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication: any, participant: RemoteParticipant) => {
          track.detach();
          const key = `${participant.identity}-${publication.trackSid}`;
          const entry = attachedAudioElementsRef.current.get(key);
          if (entry) {
            entry.element.remove();
            attachedAudioElementsRef.current.delete(key);
          }
          syncSpeakerList(roomInstance);
        });

        // Local Track Published
        roomInstance.on(RoomEvent.LocalTrackPublished, (publication: any) => {
          if (publication.track?.mediaStreamTrack && publication.source === Track.Source.Microphone) {
            attachVisualizerToStream(publication.track.mediaStreamTrack);
          }
        });

        // Active Speakers Changed
        roomInstance.on(RoomEvent.ActiveSpeakersChanged, (activeSpeakers: Participant[]) => {
          const speakingIdentities = new Set(activeSpeakers.map((s) => s.identity));
          setSpeakers((prev) =>
            prev.map((s) => ({
              ...s,
              isSpeaking: s.userId === currentPersona.id ? lastMicLevelRef.current > 0.05 : speakingIdentities.has(s.userId),
            }))
          );
        });

        // Audio Playback Status Changed
        roomInstance.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          if (isMounted && roomInstance) {
            setCanPlaybackAudio(roomInstance.canPlaybackAudio);
          }
        });

        // Participants Connected / Disconnected
        roomInstance.on(RoomEvent.ParticipantConnected, () => syncSpeakerList(roomInstance));
        roomInstance.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
          stagePresenceMapRef.current.delete(p.identity);
          syncSpeakerList(roomInstance);
        });

        // Connected
        roomInstance.on(RoomEvent.Connected, async () => {
          if (isMounted) {
            setIsLiveKitConnected(true);
            setCanPlaybackAudio(roomInstance?.canPlaybackAudio ?? true);
          }
          roomInstance?.startAudio().catch(() => {});
          syncSpeakerList(roomInstance);

          // If host on stage, acquire mic
          if (isOnStageRef.current && !isMutedRef.current) {
            try {
              await roomInstance?.localParticipant.setMicrophoneEnabled(true);
              const micPub = roomInstance?.localParticipant.getTrackPublication(Track.Source.Microphone);
              if (micPub?.track?.mediaStreamTrack) {
                attachVisualizerToStream(micPub.track.mediaStreamTrack);
              }
            } catch (micErr) {
              console.warn('Initial mic acquisition (requires user gesture):', micErr);
            }
          }
        });

        roomInstance.on(RoomEvent.Disconnected, () => {
          if (isMounted) setIsLiveKitConnected(false);
        });

        // Connect
        await roomInstance.connect(tokenDto.serverUrl, tokenDto.token);
        roomInstance.startAudio().catch(() => {});
      } catch (err) {
        console.error('Failed to connect to LiveKit voice room:', err);
      }
    };

    connectLiveKit();

    // Global interaction listener to unlock AudioContext autoplay
    const unlockAudio = () => {
      if (roomRef.current) {
        roomRef.current.startAudio().catch(() => {});
        setCanPlaybackAudio(roomRef.current.canPlaybackAudio);
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    return () => {
      isMounted = false;
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      stopMicVisualizer();
      attachedAudioElementsRef.current.forEach(({ element }) => element.remove());
      attachedAudioElementsRef.current.clear();
      cleanupLocalDjAudio();
      if (roomInstance) {
        roomInstance.disconnect();
      }
      roomRef.current = null;
    };
  }, [podId, attachVisualizerToStream, stopMicVisualizer, syncSpeakerList, cleanupLocalDjAudio]);

  // 2. Room Voice Volume & Audio Mute Updates (Applies ONLY to remote speakers, not DJ music)
  const setRoomVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    setRoomVolumeState(clamped);
    roomVolumeRef.current = clamped;
    attachedAudioElementsRef.current.forEach(({ element, isDjMusic }) => {
      if (!isDjMusic) {
        try {
          element.volume = isAudioMutedRef.current ? 0 : clamped;
        } catch {}
      }
    });
  }, []);

  const setIsAudioMuted = useCallback((muted: boolean) => {
    setIsAudioMutedState(muted);
    isAudioMutedRef.current = muted;
    attachedAudioElementsRef.current.forEach(({ element, isDjMusic }) => {
      if (!isDjMusic) {
        try {
          element.muted = muted;
          element.volume = muted ? 0 : roomVolumeRef.current;
        } catch {}
      }
    });
  }, []);

  // 3. Background Music Volume & Mute Updates (Applies to DJ local monitor AND remote listeners)
  const setBgMusicVolume = useCallback((volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    setBgMusicVolumeState(clamped);
    bgMusicVolumeRef.current = clamped;

    // A. Update local DJ monitor gain
    if (djGainNodeRef.current && audioCtxRef.current) {
      djGainNodeRef.current.gain.setValueAtTime(
        isBgMusicMutedRef.current ? 0 : clamped,
        audioCtxRef.current.currentTime
      );
    }

    // B. Update remote DJ music audio elements for listeners
    attachedAudioElementsRef.current.forEach(({ element, isDjMusic }) => {
      if (isDjMusic) {
        try {
          element.volume = isBgMusicMutedRef.current ? 0 : clamped;
        } catch {}
      }
    });
  }, []);

  const setIsBgMusicMuted = useCallback((muted: boolean) => {
    setIsBgMusicMutedState(muted);
    isBgMusicMutedRef.current = muted;

    // A. Update local DJ monitor gain
    if (djGainNodeRef.current && audioCtxRef.current) {
      djGainNodeRef.current.gain.setValueAtTime(
        muted ? 0 : bgMusicVolumeRef.current,
        audioCtxRef.current.currentTime
      );
    }

    // B. Update remote DJ music audio elements for listeners
    attachedAudioElementsRef.current.forEach(({ element, isDjMusic }) => {
      if (isDjMusic) {
        try {
          element.muted = muted;
          element.volume = muted ? 0 : bgMusicVolumeRef.current;
        } catch {}
      }
    });
  }, []);

  const toggleBgMusicMute = useCallback(() => {
    setIsBgMusicMuted(!isBgMusicMutedRef.current);
  }, [setIsBgMusicMuted]);

  // 4. Microphone Mute / Unmute Toggle (Direct User Action)
  const toggleMute = useCallback(async () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    isMutedRef.current = newMuted;

    const room = roomRef.current;
    if (room && room.state === 'connected' && isOnStageRef.current) {
      try {
        await room.localParticipant.setMicrophoneEnabled(!newMuted);
        const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (!newMuted && micPub?.track?.mediaStreamTrack) {
          attachVisualizerToStream(micPub.track.mediaStreamTrack);
        } else if (newMuted) {
          stopMicVisualizer();
        }
        syncSpeakerList(room);
      } catch (err) {
        console.error('Failed to toggle mic in LiveKit:', err);
      }
    }

    // Broadcast mute state
    api.sendPodSignal(podId, 'STAGE_MUTE_STATUS', {
      userId: currentPersona.id,
      isMuted: newMuted,
    }).catch(() => {});
  }, [isMuted, podId, currentPersona.id, attachVisualizerToStream, stopMicVisualizer, syncSpeakerList]);

  // 5. Stage Join / Leave
  const handleJoinStage = useCallback(async () => {
    setIsOnStage(true);
    isOnStageRef.current = true;
    setIsMuted(false);
    isMutedRef.current = false;
    setIsHandRaised(false);
    setHandRaisedUsers((prev) => prev.filter((u) => u.userId !== currentPersona.id));

    const room = roomRef.current;
    if (room) {
      room.startAudio().catch(() => {});
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (micPub?.track?.mediaStreamTrack) {
          attachVisualizerToStream(micPub.track.mediaStreamTrack);
        }
        await room.localParticipant.setMetadata(
          JSON.stringify({
            userId: currentPersona.id,
            username: currentPersona.username,
            displayName: currentPersona.displayName,
            isOnStage: true,
          })
        );
      } catch (err) {
        console.error('Failed to enable mic on stage join:', err);
      }
      syncSpeakerList(room);
    }

    await api.sendPodSignal(podId, 'STAGE_JOIN', {
      userId: currentPersona.id,
      username: currentPersona.username,
      displayName: currentPersona.displayName,
      avatarUrl: currentPersona.avatarUrl,
    });
  }, [podId, currentPersona, attachVisualizerToStream, syncSpeakerList]);

  const handleLeaveStage = useCallback(async () => {
    setIsOnStage(false);
    isOnStageRef.current = false;
    setIsMuted(false);
    isMutedRef.current = false;
    stopMicVisualizer();

    const room = roomRef.current;
    if (room) {
      try {
        await room.localParticipant.setMicrophoneEnabled(false);
        await room.localParticipant.setMetadata(
          JSON.stringify({
            userId: currentPersona.id,
            username: currentPersona.username,
            displayName: currentPersona.displayName,
            isOnStage: false,
          })
        );
      } catch {}
      syncSpeakerList(room);
    }

    await api.sendPodSignal(podId, 'STAGE_LEAVE', {
      userId: currentPersona.id,
    });
  }, [podId, currentPersona, stopMicVisualizer, syncSpeakerList]);

  // Hand Raise Controls
  const toggleHandRaise = useCallback(async () => {
    if (isHandRaised) {
      setIsHandRaised(false);
      setHandRaisedUsers((prev) => prev.filter((u) => u.userId !== currentPersona.id));
      await api.sendPodSignal(podId, 'HAND_LOWER', {
        userId: currentPersona.id,
      });
    } else {
      setIsHandRaised(true);
      setHandRaisedUsers((prev) => [
        ...prev.filter((u) => u.userId !== currentPersona.id),
        {
          userId: currentPersona.id,
          username: currentPersona.username,
          displayName: currentPersona.displayName || currentPersona.username,
        },
      ]);
      await api.sendPodSignal(podId, 'HAND_RAISE', {
        userId: currentPersona.id,
        username: currentPersona.username,
        displayName: currentPersona.displayName,
      });
    }
  }, [isHandRaised, podId, currentPersona]);

  const inviteUserToStage = useCallback(
    async (targetUserId: string) => {
      await api.sendPodSignal(podId, 'STAGE_INVITE', {
        targetUserId,
      });
    },
    [podId]
  );

  const hostApproveSpeaker = useCallback(
    async (userId: string, username?: string, displayName?: string) => {
      setHandRaisedUsers((prev) => prev.filter((u) => u.userId !== userId));
      await api.sendPodSignal(podId, 'STAGE_APPROVE', {
        targetUserId: userId,
        username: username || '',
        displayName: displayName || username || '',
      });
    },
    [podId]
  );

  const hostMuteSpeaker = useCallback(
    async (userId: string) => {
      await api.sendPodSignal(podId, 'STAGE_MUTE', {
        targetUserId: userId,
      });
    },
    [podId]
  );

  const hostRemoveSpeaker = useCallback(
    async (userId: string) => {
      await api.sendPodSignal(podId, 'STAGE_REMOVE', {
        targetUserId: userId,
      });
    },
    [podId]
  );

  // Soundboard Effect Broadcaster
  const triggerSoundEffect = useCallback(
    async (effectName: string) => {
      soundEffects.play(effectName, isAudioMutedRef.current ? 0 : roomVolumeRef.current);
      await api.sendPodSoundEffect(podId, effectName);
      if (onSoundEffectReceived) {
        onSoundEffectReceived(effectName, currentPersona.displayName || currentPersona.username);
      }
    },
    [podId, currentPersona, onSoundEffectReceived]
  );

  // Background Music State Sender
  const sendBgMusicState = useCallback(
    async (
      action: 'play' | 'pause' | 'stop' | 'track_change' | 'seek',
      trackTitle?: string,
      currentTime?: number,
      duration?: number,
      audioBase64?: string
    ) => {
      const next: PodBgMusicState = {
        isActive: action !== 'stop',
        isPlaying: action === 'play' || action === 'track_change',
        djUserId: currentPersona.id,
        djUsername: currentPersona.username,
        djDisplayName: currentPersona.displayName || currentPersona.username,
        djAvatarUrl: currentPersona.avatarUrl,
        trackTitle: trackTitle ?? bgMusic.trackTitle,
        currentTime: currentTime ?? bgMusic.currentTime,
        duration: duration ?? bgMusic.duration,
      };
      setBgMusic(next);

      await api.sendPodBgMusic(
        podId,
        action,
        next.trackTitle,
        next.currentTime,
        next.duration,
        audioBase64,
        audioBase64 ? 0 : undefined
      );
    },
    [podId, currentPersona, bgMusic]
  );

  // DJ Takeover Request & Approval Workflows
  const requestDjTakeover = useCallback(async () => {
    setIsRequestingTakeover(true);
    await api.sendPodSignal(podId, 'DJ_TAKEOVER_REQUEST', {
      requesterId: currentPersona.id,
      requesterUsername: currentPersona.username,
      requesterDisplayName: currentPersona.displayName || currentPersona.username,
      requesterAvatarUrl: currentPersona.avatarUrl,
    });
  }, [podId, currentPersona]);

  const approveDjTakeover = useCallback(
    async (targetUserId: string) => {
      setDjTakeoverRequest(null);
      await cleanupLocalDjAudio();
      await api.sendPodSignal(podId, 'DJ_TAKEOVER_APPROVED', {
        targetUserId,
      });
      await sendBgMusicState('stop');
    },
    [podId, cleanupLocalDjAudio, sendBgMusicState]
  );

  const declineDjTakeover = useCallback(
    async (targetUserId: string) => {
      setDjTakeoverRequest(null);
      await api.sendPodSignal(podId, 'DJ_TAKEOVER_DECLINED', {
        targetUserId,
      });
    },
    [podId]
  );

  const takeOverDjBooth = useCallback(async () => {
    setIsDjTakeoverApprovedForMe(true);
    await cleanupLocalDjAudio();
  }, [cleanupLocalDjAudio]);

  const stopSharingBgMusic = useCallback(async () => {
    await cleanupLocalDjAudio();
    setIsDjTakeoverApprovedForMe(false);
    await sendBgMusicState('stop');
  }, [cleanupLocalDjAudio, sendBgMusicState]);

  // 1. Procedural Ambient Synth Sharing (Lo-Fi, Synthwave, Rain)
  const startSharingPresetAmbient = useCallback(
    async (vibeId: 'lofi' | 'synth' | 'rain', trackTitle: string) => {
      try {
        await cleanupLocalDjAudio();
        const ctx = getAudioContext();
        await ctx.resume();

        const synth = startProceduralAmbient(ctx, vibeId);
        djSynthRef.current = synth;

        const dest = ctx.createMediaStreamDestination();
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(isBgMusicMutedRef.current ? 0 : bgMusicVolumeRef.current, ctx.currentTime);
        djGainNodeRef.current = gainNode;

        synth.outputNode.connect(dest);
        synth.outputNode.connect(gainNode);
        gainNode.connect(ctx.destination); // DJ hears locally

        const audioTracks = dest.stream.getAudioTracks();
        if (audioTracks.length > 0 && roomRef.current) {
          const localTrack = new LocalAudioTrack(audioTracks[0]);
          await roomRef.current.localParticipant.publishTrack(localTrack, {
            name: 'dj-music',
            source: Track.Source.ScreenShareAudio,
          });
          djTrackRef.current = localTrack;
        }

        setIsDjTakeoverApprovedForMe(false);
        setIsRequestingTakeover(false);
        sendBgMusicState('play', trackTitle, 0, 0);
      } catch (err) {
        console.error('Failed to start ambient music synth:', err);
      }
    },
    [cleanupLocalDjAudio, getAudioContext, sendBgMusicState]
  );

  // 2. Local Audio File Sharing (MP3, WAV, M4A)
  const startSharingLocalFile = useCallback(
    async (file: File) => {
      try {
        await cleanupLocalDjAudio();
        const ctx = getAudioContext();
        await ctx.resume();

        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = true;
        djBufferSourceRef.current = source;

        const dest = ctx.createMediaStreamDestination();
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(isBgMusicMutedRef.current ? 0 : bgMusicVolumeRef.current, ctx.currentTime);
        djGainNodeRef.current = gainNode;

        source.connect(dest);
        source.connect(gainNode);
        gainNode.connect(ctx.destination); // Play locally for DJ

        source.start(0);

        const audioTracks = dest.stream.getAudioTracks();
        if (audioTracks.length > 0 && roomRef.current) {
          const localTrack = new LocalAudioTrack(audioTracks[0]);
          await roomRef.current.localParticipant.publishTrack(localTrack, {
            name: 'dj-music',
            source: Track.Source.ScreenShareAudio,
          });
          djTrackRef.current = localTrack;
        }

        setIsDjTakeoverApprovedForMe(false);
        setIsRequestingTakeover(false);
        sendBgMusicState('play', file.name, 0, audioBuffer.duration);
      } catch (err) {
        console.error('Failed to share local audio file via LiveKit:', err);
      }
    },
    [cleanupLocalDjAudio, getAudioContext, sendBgMusicState]
  );

  // 3. System / Tab Audio Sharing
  const startSharingSystemAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0 && roomRef.current) {
        await cleanupLocalDjAudio();
        const ctx = getAudioContext();
        await ctx.resume();

        const mediaStream = new MediaStream([audioTracks[0]]);
        const source = ctx.createMediaStreamSource(mediaStream);
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(isBgMusicMutedRef.current ? 0 : bgMusicVolumeRef.current, ctx.currentTime);
        djGainNodeRef.current = gainNode;
        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        const localTrack = new LocalAudioTrack(audioTracks[0]);
        await roomRef.current.localParticipant.publishTrack(localTrack, {
          name: 'dj-music',
          source: Track.Source.ScreenShareAudio,
        });
        djTrackRef.current = localTrack;

        setIsDjTakeoverApprovedForMe(false);
        setIsRequestingTakeover(false);
        sendBgMusicState('play', 'Live System Audio', 0, 0);

        audioTracks[0].onended = () => {
          stopSharingBgMusic();
        };
      }
    } catch {
      // Screen share cancelled by user
    }
  }, [cleanupLocalDjAudio, getAudioContext, sendBgMusicState, stopSharingBgMusic]);

  const pauseBgMusic = useCallback(async () => {
    if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
      await audioCtxRef.current.suspend();
    }
    if (djTrackRef.current) {
      try {
        await djTrackRef.current.mute();
      } catch {}
    }
    await sendBgMusicState('pause');
  }, [sendBgMusicState]);

  const resumeBgMusic = useCallback(async () => {
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }
    if (djTrackRef.current) {
      try {
        await djTrackRef.current.unmute();
      } catch {}
    }
    await sendBgMusicState('play');
  }, [sendBgMusicState]);

  // Centralized Centrifugo Message Dispatcher
  const handleIncomingData = useCallback(
    (data: any) => {
      if (!data) return;

      const eventType = data.type;
      const signalType = data.signalType || data.payload?.signalType || eventType;
      const payload = data.payload || data;

      // 1. Stage Approvals (promoted to stage)
      if (
        (eventType === 'STAGE_APPROVE' || signalType === 'STAGE_APPROVE') &&
        (data.targetUserId === currentPersona.id || payload.targetUserId === currentPersona.id)
      ) {
        handleJoinStage();
      }
      // 2. Stage Remote Mutes
      else if (
        (eventType === 'STAGE_MUTE' || signalType === 'STAGE_MUTE') &&
        (data.targetUserId === currentPersona.id || payload.targetUserId === currentPersona.id)
      ) {
        setIsMuted(true);
        isMutedRef.current = true;
        if (roomRef.current && roomRef.current.state === 'connected') {
          roomRef.current.localParticipant.setMicrophoneEnabled(false).catch(() => {});
        }
        stopMicVisualizer();
      }
      // 3. Stage Removals
      else if (
        (eventType === 'STAGE_REMOVE' || signalType === 'STAGE_REMOVE') &&
        (data.targetUserId === currentPersona.id || payload.targetUserId === currentPersona.id)
      ) {
        handleLeaveStage();
      }
      // 4. Stage Join from remote participant
      else if (signalType === 'STAGE_JOIN' || eventType === 'STAGE_JOIN') {
        const uId = payload.userId || data.senderId;
        const uName = payload.username || data.senderUsername;
        const dName = payload.displayName || data.senderDisplayName || uName;
        const avUrl = payload.avatarUrl || data.senderAvatarUrl;
        if (uId && uId !== currentPersona.id) {
          stagePresenceMapRef.current.set(uId, {
            userId: uId,
            username: uName,
            displayName: dName,
            avatarUrl: avUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${uName}`,
            isMuted: false,
            isSpeaking: false,
            joinedAtUtc: Date.now(),
          });
          syncSpeakerList(roomRef.current);
        }
      }
      // 5. Stage Leave from remote participant
      else if (signalType === 'STAGE_LEAVE' || eventType === 'STAGE_LEAVE') {
        const uId = payload.userId || data.senderId;
        if (uId) {
          stagePresenceMapRef.current.delete(uId);
          syncSpeakerList(roomRef.current);
        }
      }
      // 6. Stage Speaking / Mute Status Indicator from remote participant
      else if (signalType === 'STAGE_SPEAKING' || signalType === 'STAGE_MUTE_STATUS') {
        const uId = payload.userId || data.senderId;
        const isSpk = payload.isSpeaking;
        const isMt = payload.isMuted;
        if (uId) {
          setSpeakers((prev) =>
            prev.map((s) =>
              s.userId === uId
                ? {
                    ...s,
                    isSpeaking: isSpk !== undefined ? isSpk : s.isSpeaking,
                    isMuted: isMt !== undefined ? isMt : s.isMuted,
                  }
                : s
            )
          );
        }
      }
      // 7. Hand Raises
      else if (eventType === 'HAND_RAISE' || signalType === 'HAND_RAISE') {
        const uId = payload.userId || data.senderId;
        const uName = payload.username || data.senderUsername;
        const dName = payload.displayName || data.senderDisplayName || uName;
        if (uId) {
          setHandRaisedUsers((prev) => [
            ...prev.filter((u) => u.userId !== uId),
            { userId: uId, username: uName, displayName: dName },
          ]);
        }
      }
      // 8. Hand Lowers
      else if (eventType === 'HAND_LOWER' || signalType === 'HAND_LOWER') {
        const uId = payload.userId || data.senderId;
        if (uId) {
          setHandRaisedUsers((prev) => prev.filter((u) => u.userId !== uId));
        }
      }
      // 9. Soundboard Effects
      else if (eventType === 'SOUND_EFFECT' || eventType === 'POD_SOUND_EFFECT') {
        const eff = data.effect || data.effectName;
        const sName = data.senderDisplayName || data.senderUsername || 'Someone';
        if (eff) {
          soundEffects.play(eff, isAudioMutedRef.current ? 0 : roomVolumeRef.current);
          if (onSoundEffectReceived) {
            onSoundEffectReceived(eff, sName);
          }
        }
      }
      // 10. Reaction Burst (Floating Emojis)
      else if (eventType === 'REACTION_BURST' || eventType === 'POD_REACTION') {
        const emoji = data.emoji;
        if (emoji && onReactionReceived) {
          onReactionReceived(emoji);
        }
      }
      // 11. DJ Background Music State
      else if (eventType === 'BG_MUSIC_STATE' || eventType === 'POD_BG_MUSIC') {
        // If another DJ took over, stop any local stream immediately to avoid dual tracks
        if (data.action !== 'stop' && data.djUserId && data.djUserId !== currentPersona.id) {
          cleanupLocalDjAudio();
        }

        setBgMusic((prev) => ({
          ...prev,
          isActive: data.action !== 'stop',
          isPlaying: data.action === 'play' || data.action === 'track_change',
          djUserId: data.djUserId,
          djUsername: data.djUsername,
          djDisplayName: data.djDisplayName,
          djAvatarUrl: data.djAvatarUrl,
          trackTitle: data.trackTitle ?? prev.trackTitle,
          currentTime: data.currentTime ?? prev.currentTime,
          duration: data.duration ?? prev.duration,
        }));
      }
      // 12. DJ Takeover Request Received (for current DJ or Host)
      else if (signalType === 'DJ_TAKEOVER_REQUEST') {
        const reqId = payload.requesterId || data.senderId;
        const reqName = payload.requesterDisplayName || payload.requesterUsername || data.senderDisplayName || 'Someone';
        if (reqId && reqId !== currentPersona.id) {
          setDjTakeoverRequest({
            requesterId: reqId,
            requesterName: reqName,
          });
          if (onDjTakeoverStatus) {
            onDjTakeoverStatus('requested');
          }
        }
      }
      // 13. DJ Takeover Approved (for requester)
      else if (signalType === 'DJ_TAKEOVER_APPROVED') {
        const targetId = payload.targetUserId || data.targetUserId;
        if (targetId === currentPersona.id) {
          setIsRequestingTakeover(false);
          setIsDjTakeoverApprovedForMe(true);
          if (onDjTakeoverStatus) {
            onDjTakeoverStatus('approved');
          }
        }
      }
      // 14. DJ Takeover Declined (for requester)
      else if (signalType === 'DJ_TAKEOVER_DECLINED') {
        const targetId = payload.targetUserId || data.targetUserId;
        if (targetId === currentPersona.id) {
          setIsRequestingTakeover(false);
          setIsDjTakeoverApprovedForMe(false);
          if (onDjTakeoverStatus) {
            onDjTakeoverStatus('declined');
          }
        }
      }
    },
    [
      currentPersona.id,
      handleJoinStage,
      handleLeaveStage,
      stopMicVisualizer,
      syncSpeakerList,
      onSoundEffectReceived,
      onReactionReceived,
      onDjTakeoverStatus,
      cleanupLocalDjAudio,
    ]
  );

  return {
    isOnStage,
    isMuted,
    micLevel,
    speakers,
    handRaisedUsers,
    isHandRaised,
    roomVolume,
    isAudioMuted,
    isLiveKitConnected,
    canPlaybackAudio,
    bgMusic,
    bgMusicVolume,
    isBgMusicMuted,
    djTakeoverRequest,
    isDjTakeoverApprovedForMe,
    isRequestingTakeover,
    requestDjTakeover,
    approveDjTakeover,
    declineDjTakeover,
    takeOverDjBooth,
    unlockAudioPlayback,
    toggleMute,
    handleJoinStage,
    handleLeaveStage,
    toggleHandRaise,
    inviteUserToStage,
    hostApproveSpeaker,
    hostMuteSpeaker,
    hostRemoveSpeaker,
    triggerSoundEffect,
    toggleBgMusicMute,
    startSharingPresetAmbient,
    startSharingLocalFile,
    startSharingSystemAudio,
    pauseBgMusic,
    resumeBgMusic,
    stopSharingBgMusic,
    sendBgMusicState,
    setRoomVolume,
    setIsAudioMuted,
    setBgMusicVolume,
    setIsBgMusicMuted,
    handleIncomingData,
  };
}
