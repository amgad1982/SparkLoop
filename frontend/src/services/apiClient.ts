import { useAuthStore } from '../stores/useAuthStore';
import { useThemeStore } from '../stores/useThemeStore';
import {
  AuthResultDto,
  ChainDto,
  CentrifugoTokenDto,
  MoodPodDto,
  PodMessageDto,
  PostDto,
  UserDto,
  UserProfileDto,
  HashtagDto,
  UserFollowDto,
  FollowStatusDto,
  GlobalSearchResultDto,
  LiveKitTokenDto,
  DeviceSessionDto,
  LinkedSocialAccountDto,
  EmailVerificationResultDto,
  SocialLoginRequest,
  OAuthUrlResponse,
  OAuthCallbackRequest,
  PrivacySettingsDto,
  UserSettingsDto,
  AudioPresetDto,
  DjListDto,
  CreateDjListDto,
  DjStationBroadcastState,
  FeedPageDto,
  MusicUploadResultDto,
  CopyrightPolicyDto,
  CopyrightComplaintDto,
  UserMusicTrackDto,
  UpdateMusicTrackRequest,
  PostCommentDto,
} from '../types/api';

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5195/api';

export const getMediaUrl = (url?: string | null): string => {
  if (!url) return '';
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  ) {
    return url;
  }
  const apiOrigin = BASE_URL.replace(/\/api\/?$/, '');
  return `${apiOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
};

function safeHeaderValue(val?: string | null): string {
  if (!val) return '';
  return encodeURIComponent(val);
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        useAuthStore.getState().logout();
        return null;
      }

      const res = await fetch(`${BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        useAuthStore.getState().logout();
        return null;
      }

      const data = (await res.json()) as AuthResultDto;
      useAuthStore.getState().setTokens(
        data.token,
        data.refreshToken,
        data.centrifugoToken,
        data.refreshTokenExpiresAtUtc
      );
      if (data.user) {
        useAuthStore.getState().setUser(data.user);
      }
      return data.token;
    } catch {
      useAuthStore.getState().logout();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function fetchWithAuth<T>(url: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken;
  const locale = useThemeStore.getState().locale;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-Locale': safeHeaderValue(locale),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (
    response.status === 401 &&
    !isRetry &&
    !url.includes('/auth/login') &&
    !url.includes('/auth/register') &&
    !url.includes('/auth/refresh-token')
  ) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return fetchWithAuth<T>(url, options, true);
    }
  }

  if (!response.ok) {
    let errorDetail = 'An error occurred';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorJson.title || errorJson.error || JSON.stringify(errorJson);
    } catch {
      errorDetail = response.statusText;
    }
    throw new Error(errorDetail);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Auth & Personas & Sessions
  register: (data: {
    username: string;
    email: string;
    displayName: string;
    password?: string;
    avatarUrl?: string;
    bio?: string;
    deviceId?: string;
    deviceName?: string;
    deviceType?: string;
  }) =>
    fetchWithAuth<AuthResultDto>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  login: (username: string, password?: string, deviceId?: string, deviceName?: string, deviceType?: string) =>
    fetchWithAuth<AuthResultDto>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, deviceId, deviceName, deviceType }),
    }),
  verifyEmail: (email: string, code: string) =>
    fetchWithAuth<EmailVerificationResultDto>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
  resendVerificationCode: (email: string) =>
    fetchWithAuth<EmailVerificationResultDto>('/auth/resend-verification-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  socialLogin: (data: SocialLoginRequest) =>
    fetchWithAuth<AuthResultDto>('/auth/social-login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getOAuthUrl: (provider: string, redirectUri: string, action = 'login') =>
    fetchWithAuth<OAuthUrlResponse>(
      `/auth/oauth/${encodeURIComponent(provider)}/url?redirectUri=${encodeURIComponent(redirectUri)}&action=${encodeURIComponent(action)}`
    ),
  processOAuthCallback: (provider: string, data: OAuthCallbackRequest) =>
    fetchWithAuth<AuthResultDto>(`/auth/oauth/${encodeURIComponent(provider)}/callback`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  linkOAuthCallback: (provider: string, data: { code: string; state: string; redirectUri: string }) =>
    fetchWithAuth<LinkedSocialAccountDto>(`/auth/oauth/${encodeURIComponent(provider)}/link-callback`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getLinkedAccounts: () =>
    fetchWithAuth<LinkedSocialAccountDto[]>('/auth/linked-accounts'),
  linkSocialAccount: (data: {
    provider: string;
    providerUserId: string;
    providerEmail?: string;
    displayName?: string;
    avatarUrl?: string;
  }) =>
    fetchWithAuth<LinkedSocialAccountDto>('/auth/link-social', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  unlinkSocialAccount: (provider: string) =>
    fetchWithAuth<boolean>(`/auth/unlink-social/${encodeURIComponent(provider)}`, {
      method: 'DELETE',
    }),
  refreshToken: (refreshToken: string, deviceId?: string, deviceName?: string, deviceType?: string) =>
    fetchWithAuth<AuthResultDto>('/auth/refresh-token', {
      method: 'POST',
      body: JSON.stringify({ refreshToken, deviceId, deviceName, deviceType }),
    }),
  revokeToken: (refreshToken?: string, sessionId?: string) =>
    fetchWithAuth<boolean>('/auth/revoke-token', {
      method: 'POST',
      body: JSON.stringify({ refreshToken, sessionId }),
    }),
  revokeAllSessions: (keepCurrentSession = false, currentRefreshToken?: string) =>
    fetchWithAuth<boolean>('/auth/revoke-all-sessions', {
      method: 'POST',
      body: JSON.stringify({ keepCurrentSession, currentRefreshToken }),
    }),
  getSessions: () => fetchWithAuth<DeviceSessionDto[]>('/auth/sessions'),
  trustSession: (sessionId: string, isTrusted = true) =>
    fetchWithAuth<DeviceSessionDto>(`/auth/sessions/${sessionId}/trust`, {
      method: 'POST',
      body: JSON.stringify({ isTrusted }),
    }),
  deleteSession: (sessionId: string) =>
    fetchWithAuth<boolean>(`/auth/sessions/${sessionId}`, {
      method: 'DELETE',
    }),
  getCentrifugoToken: () =>
    fetchWithAuth<CentrifugoTokenDto>('/auth/centrifugo-token'),

  // User Profile & Creators
  getTopCreators: async (): Promise<UserDto[]> => {
    try {
      const res = await fetchWithAuth<UserDto[]>('/users/top-creators');
      return Array.isArray(res) ? res : [];
    } catch (err) {
      console.warn('[apiClient] getTopCreators error:', err);
      return [];
    }
  },
  getUserProfile: (username?: string) =>
    fetchWithAuth<UserProfileDto>(username ? `/users/profile/${encodeURIComponent(username)}` : '/users/me'),
  updateProfile: (data: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
    bannerUrl?: string;
    email?: string;
    preferredTheme?: string;
    preferredLanguage?: string;
  }) =>
    fetchWithAuth<UserDto>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updatePrivacySettings: (data: PrivacySettingsDto) =>
    fetchWithAuth<UserDto>('/users/privacy-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    fetchWithAuth<boolean>('/users/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  // Social & Follow Relationships
  followUser: (targetUserId: string) =>
    fetchWithAuth<UserFollowDto>(`/users/${targetUserId}/follow`, {
      method: 'POST',
    }),
  unfollowUser: (targetUserId: string) =>
    fetchWithAuth<boolean>(`/users/${targetUserId}/unfollow`, {
      method: 'DELETE',
    }),
  acceptFollowRequest: (requestId: string) =>
    fetchWithAuth<UserFollowDto>(`/users/follow-requests/${requestId}/accept`, {
      method: 'POST',
    }),
  declineFollowRequest: (requestId: string) =>
    fetchWithAuth<boolean>(`/users/follow-requests/${requestId}/decline`, {
      method: 'POST',
    }),
  getPendingFollowRequests: () =>
    fetchWithAuth<UserFollowDto[]>('/users/follow-requests/pending'),
  getFollowers: (username: string) =>
    fetchWithAuth<UserFollowDto[]>(`/users/${encodeURIComponent(username)}/followers`),
  getFollowing: (username: string) =>
    fetchWithAuth<UserFollowDto[]>(`/users/${encodeURIComponent(username)}/following`),
  getFollowStatus: (username: string) =>
    fetchWithAuth<FollowStatusDto>(`/users/${encodeURIComponent(username)}/follow-status`),

  // Pass-the-Mic Chains
  getActiveChains: async (): Promise<ChainDto[]> => {
    try {
      const res = await fetchWithAuth<ChainDto[]>('/chains');
      return Array.isArray(res) ? res : [];
    } catch (err) {
      console.warn('[apiClient] getActiveChains error:', err);
      return [];
    }
  },
  getChainById: (id: string) => fetchWithAuth<ChainDto>(`/chains/${id}`),
  createChain: (
    titleOrData: string | { title: string; theme: string; maxSteps: number; firstStepContent?: string; firstStepAudioUrl?: string; firstStepDuration?: number },
    theme = 'Comedy',
    maxSteps = 10,
    firstStepContent?: string,
    firstStepAudioUrl?: string,
    firstStepDuration?: number
  ) => {
    const payload = typeof titleOrData === 'object'
      ? titleOrData
      : {
          title: titleOrData,
          theme,
          maxSteps,
          firstStepContent,
          firstStepAudioUrl,
          firstStepDuration,
        };
    return fetchWithAuth<ChainDto>('/chains', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  submitChainStep: (
    chainId: string,
    stepNumberOrContent?: number | string | { stepNumber: number; content?: string; audioUrl?: string; durationSeconds?: number; expectedRowVersion?: string },
    contentOrAudio?: string,
    audioUrlOrDuration?: string | number,
    durationOrRowVersion?: number | string,
    expectedRowVersion?: string
  ) => {
    let payload: { stepNumber: number; content?: string; audioUrl?: string; durationSeconds?: number; expectedRowVersion?: string };
    if (typeof stepNumberOrContent === 'object' && stepNumberOrContent !== null) {
      payload = stepNumberOrContent;
    } else if (typeof stepNumberOrContent === 'number') {
      payload = {
        stepNumber: stepNumberOrContent,
        content: contentOrAudio,
        audioUrl: typeof audioUrlOrDuration === 'string' ? audioUrlOrDuration : undefined,
        durationSeconds: typeof durationOrRowVersion === 'number' ? durationOrRowVersion : (typeof audioUrlOrDuration === 'number' ? audioUrlOrDuration : undefined),
        expectedRowVersion,
      };
    } else {
      payload = {
        stepNumber: 1,
        content: typeof stepNumberOrContent === 'string' ? stepNumberOrContent : undefined,
        audioUrl: typeof contentOrAudio === 'string' ? contentOrAudio : undefined,
        durationSeconds: typeof audioUrlOrDuration === 'number' ? audioUrlOrDuration : undefined,
        expectedRowVersion: typeof durationOrRowVersion === 'string' ? durationOrRowVersion : expectedRowVersion,
      };
    }

    return fetchWithAuth<ChainDto>(`/chains/${chainId}/step`, {
      method: 'POST',
      body: JSON.stringify({ chainId, ...payload }),
    });
  },
  getCompletedChains: () => fetchWithAuth<ChainDto[]>('/chains/completed'),

  // Posts & Feed
  getFeed: async (page = 1, pageSize = 20, hashtag?: string, search?: string): Promise<PostDto[]> => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    if (hashtag) params.append('hashtag', hashtag);
    if (search) params.append('search', search);
    try {
      const res = await fetchWithAuth<PostDto[] | FeedPageDto>(`/posts?${params.toString()}`);
      if (Array.isArray(res)) return res;
      if (res && Array.isArray((res as FeedPageDto).items)) return (res as FeedPageDto).items;
      return [];
    } catch (err) {
      console.error('[apiClient] getFeed error:', err);
      return [];
    }
  },
  createPost: (
    contentOrData: string | {
      content: string;
      mediaUrl?: string;
      mediaType?: string;
      mediaWidth?: number;
      mediaHeight?: number;
    },
    mediaUrl?: string,
    mediaType?: string,
    mediaWidth?: number,
    mediaHeight?: number
  ) => {
    const payload = typeof contentOrData === 'object'
      ? contentOrData
      : {
          content: contentOrData,
          mediaUrl,
          mediaType,
          mediaWidth,
          mediaHeight,
        };
    return fetchWithAuth<PostDto>('/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  reactToPost: (postId: string, reactionType: string) =>
    fetchWithAuth<PostDto>(`/posts/${postId}/react`, {
      method: 'POST',
      body: JSON.stringify({ reactionType }),
    }),
  getPostComments: (postId: string, limit = 50, offset = 0) =>
    fetchWithAuth<PostCommentDto[]>(`/posts/${postId}/comments?limit=${limit}&offset=${offset}`),
  addPostComment: (postId: string, content: string) =>
    fetchWithAuth<PostCommentDto>(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  deletePostComment: (postId: string, commentId: string) =>
    fetchWithAuth<void>(`/posts/${postId}/comments/${commentId}`, {
      method: 'DELETE',
    }),

  // Hashtags
  getTrendingHashtags: (limit = 10) => fetchWithAuth<HashtagDto[]>(`/hashtags/trending?limit=${limit}`),
  searchHashtags: (query: string, limit = 10) =>
    fetchWithAuth<HashtagDto[]>(`/hashtags/search?query=${encodeURIComponent(query)}&limit=${limit}`),
  getHashtags: (query?: string, limit = 10) =>
    fetchWithAuth<HashtagDto[]>(query ? `/hashtags?query=${encodeURIComponent(query)}&limit=${limit}` : `/hashtags?limit=${limit}`),

  // Global Search
  search: (query: string, type?: string, limit = 20) => {
    const params = new URLSearchParams({ query, limit: limit.toString() });
    if (type) params.append('type', type);
    return fetchWithAuth<GlobalSearchResultDto>(`/search?${params.toString()}`);
  },
  globalSearch: (query: string, type?: string, limit = 20) => api.search(query, type, limit),

  // Ephemeral Mood Pods
  getActivePods: async (): Promise<MoodPodDto[]> => {
    try {
      const res = await fetchWithAuth<MoodPodDto[]>('/moodpods');
      return Array.isArray(res) ? res : [];
    } catch (err) {
      console.warn('[apiClient] getActivePods error:', err);
      return [];
    }
  },
  getPodById: (id: string, inviteCode?: string) =>
    fetchWithAuth<MoodPodDto>(inviteCode ? `/moodpods/${id}?inviteCode=${encodeURIComponent(inviteCode)}` : `/moodpods/${id}`),
  createMoodPod: (data: {
    title: string;
    moodEmoji: string;
    backgroundTheme: string;
    isPrivate?: boolean;
    inviteCode?: string;
    customBackgroundImageUrl?: string;
    allowParticipantsChangeTheme?: boolean;
    allowParticipantsPlayBgMusic?: boolean;
    allowOpenMic?: boolean;
    durationHours?: number;
  }) =>
    fetchWithAuth<MoodPodDto>('/moodpods', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createPod: (data: {
    title: string;
    moodEmoji: string;
    backgroundTheme: string;
    isPrivate?: boolean;
    inviteCode?: string;
    customBackgroundImageUrl?: string;
    allowParticipantsChangeTheme?: boolean;
    allowParticipantsPlayBgMusic?: boolean;
    allowOpenMic?: boolean;
    durationHours?: number;
  }) => api.createMoodPod(data),
  joinPodByCode: (inviteCode: string) =>
    fetchWithAuth<MoodPodDto>('/moodpods/join-by-code', {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    }),
  getPodVoiceToken: (podId: string, isOnStage = false, inviteCode?: string) =>
    fetchWithAuth<LiveKitTokenDto>(
      `/moodpods/${podId}/livekit-token?isOnStage=${isOnStage}${inviteCode ? `&inviteCode=${encodeURIComponent(inviteCode)}` : ''}`
    ),
  updatePodSettings: (
    podId: string,
    settings: {
      title?: string;
      moodEmoji?: string;
      backgroundTheme?: string;
      customBackgroundImageUrl?: string;
      allowParticipantsChangeTheme?: boolean;
      allowParticipantsPlayBgMusic?: boolean;
      allowOpenMic?: boolean;
      isPrivate?: boolean;
      durationHours?: number;
    }
  ) =>
    fetchWithAuth<MoodPodDto>(`/moodpods/${podId}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
  closePod: (podId: string) =>
    fetchWithAuth<boolean>(`/moodpods/${podId}/close`, {
      method: 'POST',
    }),
  moderatePodParticipant: (
    podId: string,
    targetUserId: string,
    targetUsername: string,
    action: string,
    reason?: string
  ) =>
    fetchWithAuth<boolean>(`/moodpods/${podId}/moderate`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId, targetUsername, action, reason }),
    }),
  inviteUserToPod: (podId: string, targetUserId: string) =>
    fetchWithAuth<boolean>(`/moodpods/${podId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),
  sendPodMessage: (podId: string, text: string, emojiReaction?: string, audioUrl?: string, durationSeconds?: number) =>
    fetchWithAuth<PodMessageDto>(`/moodpods/${podId}/message`, {
      method: 'POST',
      body: JSON.stringify({ podId, text, emojiReaction, audioUrl, durationSeconds }),
    }),
  setPodSpeakingStatus: (podId: string, isSpeaking: boolean, isMuted: boolean) =>
    fetchWithAuth<boolean>(`/moodpods/${podId}/speaking`, {
      method: 'POST',
      body: JSON.stringify({ isSpeaking, isMuted }),
    }),
  sendPodReaction: (podId: string, emoji: string, intensity = 1) =>
    fetchWithAuth<boolean>(`/moodpods/${podId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji, intensity }),
    }),
  sendPodSignal: (podId: string, signalType: string, payload?: unknown, targetUserId?: string) =>
    fetchWithAuth<boolean>(`/moodpods/${podId}/signal`, {
      method: 'POST',
      body: JSON.stringify({ signalType, payload, targetUserId }),
    }),
  sendPodSoundEffect: (podId: string, effectName: string) =>
    fetchWithAuth<boolean>(`/moodpods/${podId}/sound-effect`, {
      method: 'POST',
      body: JSON.stringify({ effectName }),
    }),
  sendPodAudioChunk: (podId: string, audioBase64: string, chunkIndex: number, durationMs?: number) =>
    fetchWithAuth<boolean>(`/moodpods/${podId}/audio-chunk`, {
      method: 'POST',
      body: JSON.stringify({ audioBase64, chunkIndex, durationMs }),
    }),
  sendPodBgMusic: (
    podId: string,
    action: string,
    trackTitle?: string,
    currentTime?: number,
    duration?: number,
    audioBase64?: string,
    chunkIndex?: number,
    trackUrl?: string,
    presetId?: string
  ) =>
    fetchWithAuth<boolean>(`/moodpods/${podId}/bg-music`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        trackTitle,
        currentTime,
        duration,
        audioBase64,
        chunkIndex,
        trackUrl,
        presetId,
      }),
    }),

  // User Settings API
  getUserSettings: () => fetchWithAuth<UserSettingsDto>('/users/settings'),
  updateUserSettings: (settings: Partial<UserSettingsDto>) =>
    fetchWithAuth<UserSettingsDto>('/users/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  // Audio Presets API (Server Offline Royalty-Free Presets)
  getAudioPresets: () => fetchWithAuth<AudioPresetDto[]>('/audio/presets'),

  // DJ Radio Stations API
  getDjStations: async (genre?: string, userId?: string): Promise<DjListDto[]> => {
    const params = new URLSearchParams();
    if (genre) params.append('genre', genre);
    if (userId) params.append('userId', userId);
    const query = params.toString();
    try {
      const res = await fetchWithAuth<DjListDto[]>(`/dj/stations${query ? `?${query}` : ''}`);
      return Array.isArray(res) ? res : [];
    } catch (err) {
      console.warn('[apiClient] getDjStations error:', err);
      return [];
    }
  },
  getDjStationById: (id: string) => fetchWithAuth<DjListDto>(`/dj/stations/${id}`),
  createDjStation: (data: CreateDjListDto) =>
    fetchWithAuth<DjListDto>('/dj/stations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateDjStation: (id: string, data: Partial<CreateDjListDto>) =>
    fetchWithAuth<DjListDto>(`/dj/stations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteDjStation: (id: string) =>
    fetchWithAuth<void>(`/dj/stations/${id}`, {
      method: 'DELETE',
    }),
  getDjStationLiveKitToken: (id: string) =>
    fetchWithAuth<LiveKitTokenDto>(`/dj/stations/${id}/livekit-token`),
  broadcastDjStation: (
    id: string,
    data: {
      action: string;
      trackIndex?: number;
      trackTitle?: string;
      trackArtist?: string;
      positionSeconds?: number;
      isPlaying?: boolean;
      sfxName?: string;
      tempoRate?: number;
      filterPreset?: string;
    }
  ) =>
    fetchWithAuth<void>(`/dj/stations/${id}/broadcast`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  tuneInStation: async (id: string, clientId?: string): Promise<number> => {
    try {
      const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
      const res = await fetchWithAuth<{ listenersCount?: number } | number>(`/dj/stations/${id}/tune-in${query}`, {
        method: 'POST',
      });
      if (typeof res === 'number') return res;
      if (res && typeof res.listenersCount === 'number') return res.listenersCount;
      return 0;
    } catch {
      return 0;
    }
  },
  tuneOutStation: async (id: string, clientId?: string): Promise<number> => {
    try {
      const query = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
      const res = await fetchWithAuth<{ listenersCount?: number } | number>(`/dj/stations/${id}/tune-out${query}`, {
        method: 'POST',
      });
      if (typeof res === 'number') return res;
      if (res && typeof res.listenersCount === 'number') return res.listenersCount;
      return 0;
    } catch {
      return 0;
    }
  },
  getStationBroadcastState: (id: string) =>
    fetchWithAuth<DjStationBroadcastState>(`/dj/stations/${id}/broadcast-state`),

  // DJ Lists API (Aliases / Backwards compatibility)
  getDjLists: (genre?: string, userId?: string) => {
    const params = new URLSearchParams();
    if (genre) params.append('genre', genre);
    if (userId) params.append('userId', userId);
    const query = params.toString();
    return fetchWithAuth<DjListDto[]>(`/dj/lists${query ? `?${query}` : ''}`);
  },
  getDjListById: (id: string) => fetchWithAuth<DjListDto>(`/dj/lists/${id}`),
  createDjList: (data: CreateDjListDto) =>
    fetchWithAuth<DjListDto>('/dj/lists', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteDjList: (id: string) =>
    fetchWithAuth<void>(`/dj/lists/${id}`, {
      method: 'DELETE',
    }),
  streamDjList: (id: string, req?: { podId?: string; title?: string; followersOnly?: boolean }) =>
    fetchWithAuth<MoodPodDto>(`/dj/lists/${id}/stream`, {
      method: 'POST',
      body: JSON.stringify(req || {}),
    }),

  // Media Upload with JWT Authorization
  uploadMedia: async (file: File | Blob, filename = 'meme.webp'): Promise<{ url: string; contentType: string }> => {
    const accessToken = useAuthStore.getState().accessToken;
    const locale = useThemeStore.getState().locale;
    const formData = new FormData();
    formData.append('file', file, filename);

    const headers: Record<string, string> = {
      'X-App-Locale': safeHeaderValue(locale),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };

    const response = await fetch(`${BASE_URL}/media/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      let errorMsg = 'Media upload failed';
      try {
        const errorJson = await response.json();
        errorMsg = errorJson.error || errorJson.detail || errorJson.title || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }

    return response.json();
  },

  // Music Upload with Mandatory Copyright Attestation
  uploadMusicTrack: async (
    file: File | Blob,
    filename: string,
    metadata: {
      title?: string;
      artist?: string;
      durationSeconds?: number;
      acceptCopyrightPolicy: boolean;
      policyVersion?: string;
    }
  ): Promise<MusicUploadResultDto> => {
    const accessToken = useAuthStore.getState().accessToken;
    const locale = useThemeStore.getState().locale;
    const formData = new FormData();
    formData.append('file', file, filename);
    if (metadata.title) formData.append('title', metadata.title);
    if (metadata.artist) formData.append('artist', metadata.artist);
    if (metadata.durationSeconds !== undefined) {
      formData.append('durationSeconds', metadata.durationSeconds.toString());
    }
    formData.append('acceptCopyrightPolicy', metadata.acceptCopyrightPolicy ? 'true' : 'false');
    formData.append('policyVersion', metadata.policyVersion || '1.0');

    const headers: Record<string, string> = {
      'X-App-Locale': safeHeaderValue(locale),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };

    const response = await fetch(`${BASE_URL}/media/upload-music`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      let errorMsg = 'Music upload failed';
      try {
        const errorJson = await response.json();
        errorMsg = errorJson.error || errorJson.detail || errorJson.title || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }

    return response.json();
  },

  getCopyrightPolicy: async (): Promise<CopyrightPolicyDto> => {
    return fetchWithAuth<CopyrightPolicyDto>('/copyright/policy', { method: 'GET' });
  },

  reportCopyrightComplaint: async (complaint: CopyrightComplaintDto): Promise<{ message: string; complaintId: string }> => {
    return fetchWithAuth<{ message: string; complaintId: string }>('/copyright/complaints', {
      method: 'POST',
      body: JSON.stringify(complaint),
    });
  },

  getMyMusicTracks: async (): Promise<UserMusicTrackDto[]> => {
    return fetchWithAuth<UserMusicTrackDto[]>('/media/my-tracks', { method: 'GET' });
  },

  deleteMyMusicTrack: async (id: string): Promise<void> => {
    return fetchWithAuth<void>(`/media/my-tracks/${id}`, { method: 'DELETE' });
  },

  updateMyMusicTrack: async (id: string, req: UpdateMusicTrackRequest): Promise<UserMusicTrackDto> => {
    return fetchWithAuth<UserMusicTrackDto>(`/media/my-tracks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(req),
    });
  },

  getMediaUrl,
};

export const apiClient = api;

