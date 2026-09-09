import { create } from 'zustand';
import { Room, RoomEvent, Track, RemoteTrack, createLocalAudioTrack, LocalAudioTrack } from 'livekit-client';
import { DjListDto, CreateDjListDto, DjTrackDto, DjStationBroadcastState } from '../types/api';
import { api } from '../services/apiClient';
import { useAuthStore } from './useAuthStore';
import { soundEffects } from '../services/soundEffects';

// Global persistent HTML5 Audio dual decks for zero-latency seamless crossfading & playback
const deckA = typeof window !== 'undefined' ? new Audio() : null;
const deckB = typeof window !== 'undefined' ? new Audio() : null;
let activeDeck = deckA;
let standbyDeck = deckB;

let liveKitRoom: Room | null = null;
let liveKitLocalMicTrack: LocalAudioTrack | null = null;
let listenerRemoteAudio: HTMLAudioElement | null = null;
let seekDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let loopInterval: ReturnType<typeof setInterval> | null = null;
let isLoopSeeking = false;
let isCrossfading = false;
let loopStartTime = 0;

function resolveLiveKitWsUrl(serverUrl: string): string {
  let rawUrl = serverUrl || (import.meta.env.VITE_LIVEKIT_URL as string) || 'ws://92.4.162.183:7880';
  let liveKitUrl = rawUrl;
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    // Browsers forbid insecure ws:// on an HTTPS page (Mixed Content SecurityError).
    // Route through same-origin WSS reverse proxy (/rtc) on Nginx.
    if (liveKitUrl.startsWith('ws://') || liveKitUrl.includes('slooplive.mydev-lab.com')) {
      liveKitUrl = 'wss://' + window.location.host;
    }
  }
  return liveKitUrl;
}

function mapIceServers(iceServers?: { urls: string | string[]; username?: string; credential?: string }[]) {
  return iceServers && iceServers.length > 0
    ? iceServers.map((s) => ({
        urls: Array.isArray(s.urls) ? s.urls : [s.urls],
        username: s.username,
        credential: s.credential,
      }))
    : [
        { urls: ['stun:92.4.162.183:3478', 'stun:stun.l.google.com:19302'] },
        {
          urls: [
            'turn:92.4.162.183:3478?transport=udp',
            'turn:92.4.162.183:3478?transport=tcp',
          ],
          username: 'sparkloop',
          credential: 'SparkLoopTurnSecret2026Secure!',
        },
      ];
}

async function connectListenerLiveKit(stationId: string): Promise<Room | null> {
  if (liveKitRoom && liveKitRoom.state === 'connected') {
    return liveKitRoom;
  }
  try {
    const tokenRes = await api.getDjStationLiveKitToken(stationId);
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) {
        if (!listenerRemoteAudio) {
          listenerRemoteAudio = track.attach();
          listenerRemoteAudio.autoplay = true;
          listenerRemoteAudio.style.position = 'fixed';
          listenerRemoteAudio.style.top = '-9999px';
          listenerRemoteAudio.style.left = '-9999px';
          listenerRemoteAudio.style.opacity = '0';
          listenerRemoteAudio.style.pointerEvents = 'none';
          document.body.appendChild(listenerRemoteAudio);
        } else {
          track.attach(listenerRemoteAudio);
        }
        listenerRemoteAudio.play().catch((e) => console.warn('[DjRadio] Remote voice play error:', e));
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      track.detach();
    });

    const liveKitUrl = resolveLiveKitWsUrl(tokenRes.serverUrl);
    await room.connect(liveKitUrl, tokenRes.token, {
      rtcConfig: {
        iceServers: mapIceServers(tokenRes.iceServers),
      },
    });
    room.startAudio().catch(() => {});
    liveKitRoom = room;
    return room;
  } catch (err) {
    console.warn('[DjRadio] LiveKit SFU listener connect error:', err);
    return null;
  }
}

// Synthetic Web Audio scratch and bass drop
function playSynthesizedDjSound(name: string) {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (name === 'scratch') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(1400, now + 0.05);
      osc.frequency.linearRampToValueAtTime(250, now + 0.12);
      osc.frequency.linearRampToValueAtTime(900, now + 0.18);
      osc.frequency.linearRampToValueAtTime(150, now + 0.25);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    } else if (name === 'drop') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.65);

      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.72);
    } else {
      soundEffects.play(name);
    }
  } catch {
    soundEffects.play(name);
  }
}

function getOrCreateClientId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = sessionStorage.getItem('spark_dj_client_id');
  if (!id) {
    id = 'web_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    sessionStorage.setItem('spark_dj_client_id', id);
  }
  return id;
}

interface DjRadioState {
  // Directory & Active Station
  stations: DjListDto[];
  activeStation: DjListDto | null;
  isOwner: boolean;
  currentTrackIndex: number;
  isLoading: boolean;

  // Media Player State
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;

  // Authentic DJ Features State
  crossfadeDuration: number; // 0, 2, 4, 6s
  tempoRate: number; // 0.8x - 1.2x
  loopMode: 'off' | '4s' | '8s' | '16s';
  loopStartTime: number;
  filterPreset: 'normal' | 'bass' | 'muffled' | 'treble' | 'lofi';

  // Broadcaster & SFU State
  isBroadcasting: boolean;
  isLiveMicActive: boolean;
  listenersCount: number;

  // UI Modal State
  isModalOpen: boolean;
  activeModalTab: 'explore' | 'my' | 'tracks' | 'create' | 'deck';

  // In-memory local audio file URLs (Object URLs created via URL.createObjectURL - zero server upload)
  localTrackUrls: Record<string, string>;

  // Actions
  openModal: (tab?: 'explore' | 'my' | 'tracks' | 'create' | 'deck') => void;
  closeModal: () => void;
  setActiveModalTab: (tab: 'explore' | 'my' | 'tracks' | 'create' | 'deck') => void;
  fetchStations: (genre?: string, userId?: string) => Promise<void>;
  openStation: (station: DjListDto, localUrls?: Record<string, string>, autoPlay?: boolean) => Promise<void>;
  closeStation: () => void;
  playTrack: (index: number, forceSync?: boolean) => Promise<void>;
  crossfadeToTrack: (index: number) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  seek: (seconds: number) => void;
  cueTrack: () => void;
  setTempoRate: (rate: number) => void;
  setLoopMode: (mode: 'off' | '4s' | '8s' | '16s') => void;
  setFilterPreset: (preset: 'normal' | 'bass' | 'muffled' | 'treble' | 'lofi') => void;
  setCrossfadeDuration: (duration: number) => void;
  setVolume: (vol: number) => void;
  toggleBroadcast: () => Promise<void>;
  toggleLiveMic: () => Promise<void>;
  triggerSfx: (effectName: string) => Promise<void>;
  createStation: (dto: CreateDjListDto, localUrls: Record<string, string>) => Promise<DjListDto>;
  toggleStationPrivacy: (stationId: string, isPublic: boolean) => Promise<void>;
  deleteStation: (stationId: string) => Promise<void>;
  handleBroadcastMessage: (data: any) => Promise<void>;
}

export const useDjRadioStore = create<DjRadioState>((set, get) => {
  // Wire dual deck audio event listeners
  function setupDeckEvents(deck: HTMLAudioElement | null) {
    if (!deck) return;

    deck.addEventListener('timeupdate', () => {
      if (activeDeck !== deck) return;
      const curTime = deck.currentTime;
      const dur = deck.duration || 0;
      const state = get();

      // Auto-crossfade near the end of track for seamless continuous radio broadcasting
      if (
        state.isOwner &&
        state.isPlaying &&
        !isCrossfading &&
        state.crossfadeDuration > 0 &&
        state.activeStation &&
        state.activeStation.tracks &&
        state.activeStation.tracks.length > 1 &&
        dur > state.crossfadeDuration + 2
      ) {
        const remaining = dur - curTime;
        if (remaining <= state.crossfadeDuration) {
          state.nextTrack();
        }
      }

      set({ currentTime: curTime, duration: dur });
    });

    deck.addEventListener('ended', () => {
      if (activeDeck !== deck) return;
      if (get().isOwner && !isCrossfading) {
        get().nextTrack();
      }
    });

    deck.addEventListener('play', () => {
      if (activeDeck === deck) {
        set({ isPlaying: true });
      }
    });

    deck.addEventListener('pause', () => {
      if (activeDeck === deck && !isCrossfading) {
        set({ isPlaying: false });
      }
    });

    deck.addEventListener('loadedmetadata', () => {
      const rate = get().tempoRate;
      if (rate && rate !== 1.0) {
        deck.playbackRate = rate;
      }
    });

    deck.addEventListener('error', (e) => {
      if (activeDeck === deck) {
        console.warn('[DjRadioAudio] Audio error:', e);
        set({ isPlaying: false });
      }
    });
  }

  setupDeckEvents(deckA);
  setupDeckEvents(deckB);

  return {
    stations: [],
    activeStation: null,
    isOwner: false,
    currentTrackIndex: 0,
    isLoading: false,

    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.85,

    crossfadeDuration: 2,
    tempoRate: 1.0,
    loopMode: 'off',
    loopStartTime: 0,
    filterPreset: 'normal',

    isBroadcasting: false,
    isLiveMicActive: false,
    listenersCount: 0,

    isModalOpen: false,
    activeModalTab: 'explore',
    localTrackUrls: {},

    openModal: (tab) => {
      set({
        isModalOpen: true,
        ...(tab ? { activeModalTab: tab } : {}),
      });
      get().fetchStations();
    },

    closeModal: () => {
      set({ isModalOpen: false });
    },

    setActiveModalTab: (tab) => {
      set({ activeModalTab: tab });
    },

    fetchStations: async (genre?: string, userId?: string) => {
      set({ isLoading: true });
      try {
        const data = await api.getDjStations(genre, userId);
        set({ stations: data || [] });
      } catch (err) {
        console.error('[DjRadio] Failed to fetch stations:', err);
      } finally {
        set({ isLoading: false });
      }
    },

    openStation: async (station: DjListDto, localUrls?: Record<string, string>, autoPlay = true) => {
      const state = get();
      if (state.activeStation?.id === station.id) {
        set({ isModalOpen: true, activeModalTab: 'deck' });
        return;
      }

      // Close previous station if open
      if (state.activeStation) {
        get().closeStation();
      }

      const mergedUrls = { ...state.localTrackUrls, ...(localUrls || {}) };
      const currentUserId = useAuthStore.getState().currentPersona?.id || '';
      const isOwner = station.userId === currentUserId;

      set({
        activeStation: station,
        isOwner: isOwner,
        currentTrackIndex: 0,
        listenersCount: station.listenersCount || 0,
        isBroadcasting: station.isLive || false,
        localTrackUrls: mergedUrls,
        isModalOpen: true,
        activeModalTab: 'deck',
        tempoRate: 1.0,
        filterPreset: 'normal',
        loopMode: 'off',
      });

      // Fetch broadcast state from backend
      let isLive = station.isLive || false;
      let initialTrackIdx = 0;
      let initialPosSec = 0;
      let stationIsPlaying = false;
      let bTempo = 1.0;
      let bFilter = 'normal';
      try {
        const bState = await api.getStationBroadcastState(station.id);
        if (bState) {
          isLive = bState.isLive;
          initialTrackIdx = Math.max(0, Math.min(bState.currentTrackIndex, station.tracks.length - 1));
          const elapsed = bState.lastUpdatedUtc
            ? Math.max(0, (Date.now() - new Date(bState.lastUpdatedUtc).getTime()) / 1000)
            : 0;
          initialPosSec = Math.max(0, bState.positionSeconds + (bState.isPlaying ? elapsed : 0));
          stationIsPlaying = bState.isPlaying;
          bTempo = bState.tempoRate ?? 1.0;
          bFilter = bState.filterPreset ?? 'normal';
          set({
            isBroadcasting: bState.isLive,
            listenersCount: bState.listenersCount,
            currentTrackIndex: initialTrackIdx,
            tempoRate: bTempo,
            filterPreset: bFilter as any,
          });
        }
      } catch {}

      // If station is offline and user is not owner, do not tune in, connect SFU, or auto-play
      if (!isOwner && !isLive) {
        if (deckA) {
          deckA.pause();
          deckA.src = '';
        }
        if (deckB) {
          deckB.pause();
          deckB.src = '';
        }
        set({
          isPlaying: false,
          isBroadcasting: false,
        });
        return;
      }

      // Tune in on server ONLY if user is a listener (never the host/owner) and station is live
      if (!isOwner && isLive) {
        try {
          const clientId = getOrCreateClientId();
          const rawCount = await api.tuneInStation(station.id, clientId);
          const count = typeof rawCount === 'number' ? rawCount : (typeof (rawCount as any)?.listenersCount === 'number' ? (rawCount as any).listenersCount : 0);
          set({ listenersCount: count });
        } catch {}

        // Connect listener to LiveKit SFU room to hear DJ voice stream
        connectListenerLiveKit(station.id);
      }

      if (!isOwner) {
        // Listener tunes in to the channel with its current status and position
        if (isLive && station.tracks.length > 0) {
          const track = station.tracks[initialTrackIdx];
          const localUrl = mergedUrls[track?.id] || (track?.url && !track.url.startsWith('http') ? track.url : null);
          const streamUrl = localUrl || track?.url;
          if (activeDeck && streamUrl) {
            activeDeck.src = streamUrl;
            activeDeck.currentTime = initialPosSec;
            activeDeck.playbackRate = bTempo;
            if (stationIsPlaying) {
              activeDeck.play().then(() => {
                set({ isPlaying: true, currentTime: initialPosSec, currentTrackIndex: initialTrackIdx });
              }).catch((err) => {
                console.warn('[DjRadio] Listener autoplay deferred:', err);
                set({ isPlaying: false, currentTime: initialPosSec, currentTrackIndex: initialTrackIdx });
              });
            } else {
              set({ isPlaying: false, currentTime: initialPosSec, currentTrackIndex: initialTrackIdx });
            }
          }
        }
      } else if (isOwner && autoPlay && station.tracks.length > 0) {
        get().playTrack(0);
      }
    },

    closeStation: () => {
      const { activeStation, isOwner } = get();
      if (activeStation && !isOwner) {
        try {
          const clientId = getOrCreateClientId();
          api.tuneOutStation(activeStation.id, clientId);
        } catch {}
      }

      if (liveKitLocalMicTrack) {
        liveKitLocalMicTrack.stop();
        liveKitLocalMicTrack = null;
      }

      if (liveKitRoom) {
        liveKitRoom.disconnect();
        liveKitRoom = null;
      }

      if (listenerRemoteAudio) {
        listenerRemoteAudio.pause();
        listenerRemoteAudio.srcObject = null;
        if (listenerRemoteAudio.parentNode) {
          listenerRemoteAudio.parentNode.removeChild(listenerRemoteAudio);
        }
        listenerRemoteAudio = null;
      }

      if (loopInterval) {
        clearInterval(loopInterval);
        loopInterval = null;
      }

      if (deckA) {
        deckA.pause();
        deckA.src = '';
      }
      if (deckB) {
        deckB.pause();
        deckB.src = '';
      }
      activeDeck = deckA;
      standbyDeck = deckB;

      set({
        activeStation: null,
        isOwner: false,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        isBroadcasting: false,
        isLiveMicActive: false,
        listenersCount: 0,
        tempoRate: 1.0,
        loopMode: 'off',
        loopStartTime: 0,
        filterPreset: 'normal',
      });
    },

    playTrack: async (index: number, forceSync = false) => {
      const { activeStation, localTrackUrls, crossfadeDuration, isPlaying, isBroadcasting, isOwner, tempoRate, filterPreset } = get();
      if (!activeStation || !activeStation.tracks || activeStation.tracks.length === 0) return;

      if (!isOwner && !forceSync) return;

      const trackIdx = Math.max(0, Math.min(index, activeStation.tracks.length - 1));

      // If already playing and crossfade duration > 0, crossfade smoothly!
      if (!forceSync && crossfadeDuration > 0 && isPlaying && trackIdx !== get().currentTrackIndex) {
        await get().crossfadeToTrack(trackIdx);
        return;
      }

      const track = activeStation.tracks[trackIdx];
      if (!track) return;

      set({ currentTrackIndex: trackIdx });

      const localUrl = localTrackUrls[track.id] || (track.url && !track.url.startsWith('http') ? track.url : null);
      const streamUrl = localUrl || track.url;

      if (standbyDeck) {
        standbyDeck.pause();
        standbyDeck.src = '';
      }

      if (activeDeck && streamUrl) {
        activeDeck.src = streamUrl;
        activeDeck.currentTime = 0;
        activeDeck.playbackRate = tempoRate;
        activeDeck.volume = get().volume;
        try {
          await activeDeck.play();
          set({ isPlaying: true });
        } catch (err) {
          console.warn('[DjRadio] Autoplay deferred or blocked:', err);
          set({ isPlaying: false });
        }
      }

      if (isOwner && isBroadcasting) {
        try {
          await api.broadcastDjStation(activeStation.id, {
            action: 'track_change',
            trackIndex: trackIdx,
            trackTitle: track.title,
            trackArtist: track.artist,
            positionSeconds: 0,
            isPlaying: true,
            tempoRate: tempoRate,
            filterPreset: filterPreset,
          });
        } catch {}
      }
    },

    crossfadeToTrack: async (index: number) => {
      const { activeStation, localTrackUrls, crossfadeDuration, volume, isBroadcasting, isOwner, tempoRate, filterPreset } = get();
      if (!activeStation || !activeStation.tracks || activeStation.tracks.length === 0) return;
      if (!isOwner) return;

      const trackIdx = Math.max(0, Math.min(index, activeStation.tracks.length - 1));
      const track = activeStation.tracks[trackIdx];
      if (!track) return;

      const outgoing = activeDeck;
      const incoming = standbyDeck;

      if (crossfadeDuration <= 0 || !outgoing || !incoming || !outgoing.src || outgoing.paused) {
        await get().playTrack(trackIdx, true);
        return;
      }

      const localUrl = localTrackUrls[track.id] || (track.url && !track.url.startsWith('http') ? track.url : null);
      const streamUrl = localUrl || track.url;
      if (!streamUrl) return;

      isCrossfading = true;
      set({ currentTrackIndex: trackIdx });

      try {
        // 1. Prepare incoming deck at zero volume and start playback concurrently
        incoming.src = streamUrl;
        incoming.currentTime = 0;
        incoming.playbackRate = tempoRate;
        incoming.volume = 0;

        await incoming.play();

        // 2. Swap active deck reference so time and duration listeners follow incoming deck
        activeDeck = incoming;
        standbyDeck = outgoing;
        set({ isPlaying: true, currentTime: 0 });

        // 3. Smooth simultaneous crossfade ramp
        const steps = 12;
        const stepMs = (crossfadeDuration * 1000) / steps;
        const targetVol = volume;

        for (let i = 1; i <= steps; i++) {
          await new Promise((r) => setTimeout(r, stepMs));
          const factor = i / steps;
          incoming.volume = Math.min(1, Math.max(0, targetVol * factor));
          outgoing.volume = Math.min(1, Math.max(0, targetVol * (1 - factor)));
        }

        incoming.volume = targetVol;
        outgoing.pause();
        outgoing.currentTime = 0;
        outgoing.src = '';
        outgoing.volume = targetVol;
      } catch (err) {
        console.warn('[DjRadio] Crossfade error, falling back to play:', err);
        await get().playTrack(trackIdx, true);
      } finally {
        isCrossfading = false;
      }

      if (isBroadcasting) {
        try {
          await api.broadcastDjStation(activeStation.id, {
            action: 'track_change',
            trackIndex: trackIdx,
            trackTitle: track.title,
            trackArtist: track.artist,
            positionSeconds: 0,
            isPlaying: true,
            tempoRate: tempoRate,
            filterPreset: filterPreset,
          });
        } catch {}
      }
    },

    togglePlayPause: async () => {
      const { isPlaying, activeStation, currentTrackIndex, isBroadcasting, isOwner, tempoRate, filterPreset } = get();
      if (!activeStation || !activeDeck) return;
      if (!isOwner) return; // Exclusive to channel owner

      if (isPlaying) {
        activeDeck.pause();
        if (standbyDeck) standbyDeck.pause();
        set({ isPlaying: false });
        if (isBroadcasting) {
          api.broadcastDjStation(activeStation.id, {
            action: 'pause',
            trackIndex: currentTrackIndex,
            positionSeconds: activeDeck.currentTime,
            isPlaying: false,
            tempoRate: tempoRate,
            filterPreset: filterPreset,
          }).catch(() => {});
        }
      } else {
        if (activeDeck.src) {
          await activeDeck.play().catch(() => {});
          set({ isPlaying: true });
        } else {
          await get().playTrack(currentTrackIndex, true);
        }
        if (isBroadcasting) {
          api.broadcastDjStation(activeStation.id, {
            action: 'play',
            trackIndex: currentTrackIndex,
            positionSeconds: activeDeck.currentTime,
            isPlaying: true,
            tempoRate: tempoRate,
            filterPreset: filterPreset,
          }).catch(() => {});
        }
      }
    },

    nextTrack: async () => {
      const { activeStation, currentTrackIndex, isOwner, crossfadeDuration, isPlaying } = get();
      if (!activeStation || activeStation.tracks.length === 0 || !isOwner) return;

      const nextIdx = (currentTrackIndex + 1) % activeStation.tracks.length;
      if (crossfadeDuration > 0 && isPlaying) {
        await get().crossfadeToTrack(nextIdx);
      } else {
        await get().playTrack(nextIdx, true);
      }
    },

    previousTrack: async () => {
      const { activeStation, currentTrackIndex, isOwner, crossfadeDuration, isPlaying } = get();
      if (!activeStation || activeStation.tracks.length === 0 || !isOwner) return;

      const prevIdx = (currentTrackIndex - 1 + activeStation.tracks.length) % activeStation.tracks.length;
      if (crossfadeDuration > 0 && isPlaying) {
        await get().crossfadeToTrack(prevIdx);
      } else {
        await get().playTrack(prevIdx, true);
      }
    },

    seek: (seconds: number) => {
      if (!activeDeck) return;
      const { activeStation, isBroadcasting, currentTrackIndex, isOwner, isPlaying, tempoRate, filterPreset } = get();
      if (!isOwner) return;

      activeDeck.currentTime = seconds;
      set({ currentTime: seconds });

      if (isBroadcasting && activeStation) {
        if (seekDebounceTimer) {
          clearTimeout(seekDebounceTimer);
        }
        seekDebounceTimer = setTimeout(() => {
          api.broadcastDjStation(activeStation.id, {
            action: 'seek',
            trackIndex: currentTrackIndex,
            positionSeconds: seconds,
            isPlaying: isPlaying,
            tempoRate: tempoRate,
            filterPreset: filterPreset,
          }).catch(() => {});
        }, 150);
      }
    },

    cueTrack: () => {
      const { activeStation, isBroadcasting, currentTrackIndex, isOwner, tempoRate, filterPreset } = get();
      if (!isOwner) return;

      if (activeDeck) {
        activeDeck.pause();
        activeDeck.currentTime = 0;
      }
      if (standbyDeck) {
        standbyDeck.pause();
        standbyDeck.currentTime = 0;
      }
      set({ isPlaying: false, currentTime: 0 });

      if (isBroadcasting && activeStation) {
        api.broadcastDjStation(activeStation.id, {
          action: 'cue',
          trackIndex: currentTrackIndex,
          positionSeconds: 0,
          isPlaying: false,
          tempoRate: tempoRate,
          filterPreset: filterPreset,
        }).catch(() => {});
      }
    },

    setTempoRate: (rate: number) => {
      const clamped = Math.max(0.8, Math.min(1.2, parseFloat(rate.toFixed(2))));
      if (deckA) deckA.playbackRate = clamped;
      if (deckB) deckB.playbackRate = clamped;
      set({ tempoRate: clamped });

      const { activeStation, isBroadcasting, currentTrackIndex, isPlaying, currentTime, isOwner, filterPreset } = get();
      if (isOwner && isBroadcasting && activeStation) {
        api.broadcastDjStation(activeStation.id, {
          action: 'tempo',
          trackIndex: currentTrackIndex,
          positionSeconds: currentTime,
          isPlaying: isPlaying,
          tempoRate: clamped,
          filterPreset: filterPreset,
        }).catch(() => {});
      }
    },

    setLoopMode: (mode: 'off' | '4s' | '8s' | '16s') => {
      const currentMode = get().loopMode;
      const nextMode = currentMode === mode || mode === 'off' ? 'off' : mode;

      if (loopInterval) {
        clearInterval(loopInterval);
        loopInterval = null;
      }

      if (nextMode === 'off') {
        set({ loopMode: 'off' });
        return;
      }

      const active = activeDeck;
      const cur = active?.currentTime || get().currentTime || 0;
      const dur = active?.duration || get().duration || 0;
      const loopSeconds = nextMode === '4s' ? 4 : nextMode === '8s' ? 8 : 16;

      let start = cur;
      if (dur > loopSeconds && start > dur - loopSeconds) {
        start = Math.max(0, dur - loopSeconds);
      }
      loopStartTime = start;
      set({ loopMode: nextMode, loopStartTime: start });

      loopInterval = setInterval(() => {
        const deck = activeDeck;
        if (!deck || get().loopMode === 'off' || !get().isPlaying || isLoopSeeking) return;

        const loopLen = get().loopMode === '4s' ? 4 : get().loopMode === '8s' ? 8 : 16;
        if (deck.currentTime >= loopStartTime + loopLen) {
          isLoopSeeking = true;
          deck.currentTime = loopStartTime;
          setTimeout(() => {
            isLoopSeeking = false;
          }, 120);
        }
      }, 50);
    },

    setFilterPreset: (preset: 'normal' | 'bass' | 'muffled' | 'treble' | 'lofi') => {
      set({ filterPreset: preset });
      playSynthesizedDjSound(preset === 'lofi' ? 'scratch' : 'drop');

      const { activeStation, isBroadcasting, currentTrackIndex, isPlaying, currentTime, isOwner, tempoRate } = get();
      if (isOwner && isBroadcasting && activeStation) {
        api.broadcastDjStation(activeStation.id, {
          action: 'filter',
          trackIndex: currentTrackIndex,
          positionSeconds: currentTime,
          isPlaying: isPlaying,
          tempoRate: tempoRate,
          filterPreset: preset,
        }).catch(() => {});
      }
    },

    setCrossfadeDuration: (duration: number) => {
      set({ crossfadeDuration: Math.max(0, Math.min(8, duration)) });
    },

    setVolume: (vol: number) => {
      const clamped = Math.max(0, Math.min(1, vol));
      if (activeDeck) {
        activeDeck.volume = clamped;
      }
      if (standbyDeck) {
        standbyDeck.volume = clamped;
      }
      set({ volume: clamped });
    },

    toggleBroadcast: async () => {
      const { activeStation, isBroadcasting, currentTrackIndex, isPlaying, currentTime, tempoRate, filterPreset } = get();
      if (!activeStation) return;

      const willBroadcast = !isBroadcasting;
      set({ isBroadcasting: willBroadcast });

      const track = activeStation.tracks[currentTrackIndex];
      try {
        await api.broadcastDjStation(activeStation.id, {
          action: willBroadcast ? 'start' : 'stop',
          trackIndex: currentTrackIndex,
          trackTitle: track?.title,
          trackArtist: track?.artist,
          positionSeconds: currentTime,
          isPlaying: isPlaying,
          tempoRate: tempoRate,
          filterPreset: filterPreset,
        });
      } catch (err) {
        console.error('[DjRadio] Failed to toggle broadcast:', err);
      }
    },

    toggleLiveMic: async () => {
      const { activeStation, isLiveMicActive } = get();
      if (!activeStation) return;

      if (isLiveMicActive) {
        if (liveKitLocalMicTrack) {
          liveKitLocalMicTrack.stop();
          if (liveKitRoom) {
            await liveKitRoom.localParticipant.unpublishTrack(liveKitLocalMicTrack).catch(() => {});
          }
          liveKitLocalMicTrack = null;
        }
        if (activeDeck) {
          activeDeck.volume = get().volume;
        }
        set({ isLiveMicActive: false });
        return;
      }

      try {
        const tokenRes = await api.getDjStationLiveKitToken(activeStation.id);
        const liveKitUrl = resolveLiveKitWsUrl(tokenRes.serverUrl);

        if (!liveKitRoom || liveKitRoom.state !== 'connected') {
          const room = new Room({
            adaptiveStream: true,
            dynacast: true,
          });
          await room.connect(liveKitUrl, tokenRes.token, {
            rtcConfig: {
              iceServers: mapIceServers(tokenRes.iceServers),
            },
          });
          liveKitRoom = room;
        }

        const micTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });

        await liveKitRoom.localParticipant.publishTrack(micTrack);
        liveKitLocalMicTrack = micTrack;

        if (activeDeck) {
          activeDeck.volume = Math.max(0.2, get().volume * 0.4);
        }

        set({ isLiveMicActive: true });
      } catch (err) {
        console.error('[DjRadio] Failed to activate Live DJ Mic over LiveKit SFU:', err);
        if (liveKitLocalMicTrack) {
          liveKitLocalMicTrack.stop();
          liveKitLocalMicTrack = null;
        }
        if (activeDeck) {
          activeDeck.volume = get().volume;
        }
        set({ isLiveMicActive: false });
      }
    },

    triggerSfx: async (effectName: string) => {
      playSynthesizedDjSound(effectName);

      const { activeStation, isBroadcasting } = get();
      if (isBroadcasting && activeStation) {
        api.broadcastDjStation(activeStation.id, {
          action: 'sfx',
          sfxName: effectName,
        }).catch(() => {});
      }
    },

    createStation: async (dto: CreateDjListDto, localUrls: Record<string, string>) => {
      const created = await api.createDjStation(dto);
      set((state) => ({
        stations: [created, ...state.stations],
        localTrackUrls: { ...state.localTrackUrls, ...localUrls },
      }));
      return created;
    },

    toggleStationPrivacy: async (stationId: string, isPublic: boolean) => {
      const { stations, activeStation } = get();
      const station = stations.find((s) => s.id === stationId) || activeStation;
      if (!station) return;

      try {
        const updated = await api.updateDjStation(stationId, {
          title: station.title,
          description: station.description,
          genre: station.genre,
          coverUrl: station.coverUrl,
          isPublic: isPublic,
          followersOnly: station.followersOnly,
          tracks: station.tracks,
        });

        set((state) => ({
          stations: state.stations.map((s) => (s.id === stationId ? updated : s)),
          activeStation: state.activeStation?.id === stationId ? updated : state.activeStation,
        }));
      } catch (err) {
        console.error('[DjRadio] Failed to toggle station privacy:', err);
      }
    },

    deleteStation: async (stationId: string) => {
      await api.deleteDjStation(stationId);
      const { activeStation } = get();
      if (activeStation?.id === stationId) {
        get().closeStation();
      }
      set((state) => ({
        stations: state.stations.filter((s) => s.id !== stationId),
      }));
    },

    handleBroadcastMessage: async (data: any) => {
      if (!data || data.type !== 'DJ_BROADCAST_UPDATE') return;
      const { activeStation, currentTrackIndex, isOwner } = get();
      if (!activeStation || activeStation.id !== data.stationId) return;

      // Update listeners count for everyone (including DJ host broadcaster)
      if (typeof data.listenersCount === 'number') {
        set({ listenersCount: data.listenersCount });
      }

      if (isOwner) return; // Broadcaster drives the stream playback; only listeners follow

      const action = data.action;
      const trackIdx = typeof data.trackIndex === 'number' ? data.trackIndex : currentTrackIndex;
      const isLive = typeof data.isLive === 'boolean' ? data.isLive : true;
      const listeners = typeof data.listenersCount === 'number' ? data.listenersCount : get().listenersCount;
      const posSec = typeof data.positionSeconds === 'number' ? data.positionSeconds : 0;
      const tempo = typeof data.tempoRate === 'number' ? data.tempoRate : undefined;
      const filter = typeof data.filterPreset === 'string' ? data.filterPreset : undefined;

      set({
        listenersCount: listeners,
        isBroadcasting: isLive,
        ...(tempo !== undefined ? { tempoRate: tempo } : {}),
        ...(filter !== undefined ? { filterPreset: filter as any } : {}),
      });

      if (tempo !== undefined) {
        if (deckA) deckA.playbackRate = tempo;
        if (deckB) deckB.playbackRate = tempo;
      }

      // Ensure listener is connected to LiveKit SFU room to hear DJ voice
      if (isLive && (!liveKitRoom || liveKitRoom.state !== 'connected')) {
        connectListenerLiveKit(activeStation.id);
      }

      if (action === 'play') {
        if (currentTrackIndex !== trackIdx) {
          await get().playTrack(trackIdx, true);
          if (activeDeck && posSec > 0) {
            activeDeck.currentTime = posSec;
          }
        } else if (activeDeck) {
          if (posSec >= 0 && Math.abs(activeDeck.currentTime - posSec) > 2) {
            activeDeck.currentTime = posSec;
          }
          await activeDeck.play().catch(() => {});
          set({ isPlaying: true });
        }
      } else if (action === 'pause') {
        if (activeDeck) {
          activeDeck.pause();
        }
        if (standbyDeck) {
          standbyDeck.pause();
        }
        set({ isPlaying: false });
      } else if (action === 'track_change') {
        const nextTrack = activeStation.tracks[trackIdx];
        if (nextTrack) {
          const localUrl = get().localTrackUrls[nextTrack.id] || (nextTrack.url && !nextTrack.url.startsWith('http') ? nextTrack.url : null);
          const streamUrl = localUrl || nextTrack.url;
          if (streamUrl) {
            if (get().crossfadeDuration > 0 && activeDeck && activeDeck.src && standbyDeck) {
              const outgoing = activeDeck;
              const incoming = standbyDeck;
              incoming.src = streamUrl;
              incoming.currentTime = posSec;
              incoming.volume = 0;
              if (tempo !== undefined) incoming.playbackRate = tempo;
              await incoming.play().catch(() => {});

              activeDeck = incoming;
              standbyDeck = outgoing;
              set({ currentTrackIndex: trackIdx, isPlaying: true, currentTime: posSec });

              const steps = 10;
              const stepTime = (get().crossfadeDuration * 1000) / steps;
              const targetVol = get().volume;
              for (let i = 1; i <= steps; i++) {
                await new Promise((r) => setTimeout(r, stepTime));
                const factor = i / steps;
                incoming.volume = Math.min(1, Math.max(0, targetVol * factor));
                outgoing.volume = Math.min(1, Math.max(0, targetVol * (1 - factor)));
              }
              incoming.volume = targetVol;
              outgoing.pause();
              outgoing.src = '';
              outgoing.volume = targetVol;
            } else {
              await get().playTrack(trackIdx, true);
              if (activeDeck && posSec > 0) {
                activeDeck.currentTime = posSec;
              }
            }
          }
        }
      } else if (action === 'seek') {
        if (activeDeck && posSec >= 0) {
          activeDeck.currentTime = posSec;
          set({ currentTime: posSec });
        }
      } else if (action === 'cue') {
        if (activeDeck) {
          activeDeck.pause();
          activeDeck.currentTime = 0;
        }
        if (standbyDeck) {
          standbyDeck.pause();
          standbyDeck.currentTime = 0;
        }
        set({ isPlaying: false, currentTime: 0 });
      } else if (action === 'tempo') {
        if (tempo !== undefined) {
          if (deckA) deckA.playbackRate = tempo;
          if (deckB) deckB.playbackRate = tempo;
        }
      } else if (action === 'filter') {
        if (filter) {
          playSynthesizedDjSound(filter === 'lofi' ? 'scratch' : 'drop');
        }
      } else if (action === 'sfx') {
        const sfx = data.sfxName;
        if (sfx) {
          playSynthesizedDjSound(sfx);
        }
      } else if (action === 'stop') {
        if (deckA) {
          deckA.pause();
          deckA.src = '';
        }
        if (deckB) {
          deckB.pause();
          deckB.src = '';
        }
        if (liveKitRoom) {
          liveKitRoom.disconnect();
          liveKitRoom = null;
        }
        if (listenerRemoteAudio) {
          listenerRemoteAudio.pause();
          listenerRemoteAudio.srcObject = null;
          if (listenerRemoteAudio.parentNode) {
            listenerRemoteAudio.parentNode.removeChild(listenerRemoteAudio);
          }
          listenerRemoteAudio = null;
        }
        set({ isBroadcasting: false, isPlaying: false });
      }
    },
  };
});

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    try {
      const { activeStation, isOwner } = useDjRadioStore.getState();
      if (activeStation && !isOwner) {
        const clientId = getOrCreateClientId();
        api.tuneOutStation(activeStation.id, clientId).catch(() => {});
      }
    } catch {}
  });
}
