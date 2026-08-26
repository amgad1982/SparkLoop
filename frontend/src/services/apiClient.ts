import { useAuthStore } from '../stores/useAuthStore';
import { useThemeStore } from '../stores/useThemeStore';
import {
  AuthResultDto,
  ChainDto,
  CentrifugoTokenDto,
  MoodPodDto,
  PodMessageDto,
  PostDto,
  SparkDto,
  SparkSubmissionDto,
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
  getTopCreators: () =>
    fetchWithAuth<UserDto[]>('/users/top-creators'),
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

  // Sparks
  getActiveSpark: () => fetchWithAuth<SparkDto>('/sparks/active'),
  submitSparkEntry: (
    sparkIdOrData: string | { sparkId: string; mediaUrl?: string; caption: string },
    caption?: string,
    mediaUrl?: string
  ) => {
    const payload = typeof sparkIdOrData === 'object'
      ? sparkIdOrData
      : { sparkId: sparkIdOrData, caption: caption ?? '', mediaUrl };
    return fetchWithAuth<SparkSubmissionDto>('/sparks/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  voteSparkSubmission: (sparkId: string, submissionId: string) =>
    fetchWithAuth<SparkSubmissionDto>(`/sparks/${sparkId}/submissions/${submissionId}/vote`, {
      method: 'POST',
    }),
  resolveSparkWinner: (sparkId: string) =>
    fetchWithAuth<SparkDto>(`/sparks/${sparkId}/resolve-winner`, {
      method: 'POST',
    }),
  getSparkHistory: () => fetchWithAuth<SparkDto[]>('/sparks/history'),

  // Pass-the-Mic Chains
  getActiveChains: () => fetchWithAuth<ChainDto[]>('/chains'),
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
  getFeed: (page = 1, pageSize = 20, hashtag?: string, search?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    if (hashtag) params.append('hashtag', hashtag);
    if (search) params.append('search', search);
    return fetchWithAuth<PostDto[]>(`/posts?${params.toString()}`);
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
  getActivePods: () => fetchWithAuth<MoodPodDto[]>('/moodpods'),
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
    chunkIndex?: number
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
      }),
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

  getMediaUrl,
};
