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

async function fetchWithAuth<T>(url: string, options: RequestInit = {}): Promise<T> {
  const currentPersona = useAuthStore.getState().currentPersona;
  const locale = useThemeStore.getState().locale;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-Id': safeHeaderValue(currentPersona?.id),
    'X-Username': safeHeaderValue(currentPersona?.username),
    'X-DisplayName': safeHeaderValue(currentPersona?.displayName),
    'X-Avatar-Url': safeHeaderValue(currentPersona?.avatarUrl),
    'X-App-Locale': safeHeaderValue(locale),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'An error occurred';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorJson.title || JSON.stringify(errorJson);
    } catch {
      errorDetail = response.statusText;
    }
    throw new Error(errorDetail);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Auth & Personas
  register: (data: { username: string; email: string; displayName: string; password?: string; avatarUrl?: string; bio?: string }) =>
    fetchWithAuth<AuthResultDto>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCentrifugoToken: (userId?: string, username?: string) =>
    fetchWithAuth<CentrifugoTokenDto>(
      `/auth/centrifugo-token?userId=${encodeURIComponent(userId || '')}&username=${encodeURIComponent(username || '')}`
    ),
  getPersonas: () => fetchWithAuth<UserDto[]>('/auth/personas'),
  login: (username: string, password?: string) =>
    fetchWithAuth<AuthResultDto>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  // User Profile
  getUserProfile: (username?: string) =>
    fetchWithAuth<UserProfileDto>(username ? `/users/profile/${encodeURIComponent(username)}` : '/users/me'),
  updateProfile: (data: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
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

  // Sparks
  getActiveSpark: () => fetchWithAuth<SparkDto>('/sparks/active'),
  submitSparkEntry: (sparkId: string, caption: string, mediaUrl?: string) =>
    fetchWithAuth<SparkSubmissionDto>('/sparks/submit', {
      method: 'POST',
      body: JSON.stringify({ sparkId, caption, mediaUrl }),
    }),
  voteSparkSubmission: (sparkId: string, submissionId: string) =>
    fetchWithAuth<SparkSubmissionDto>(`/sparks/${sparkId}/submissions/${submissionId}/vote`, {
      method: 'POST',
    }),
  resolveSparkWinner: (sparkId: string) =>
    fetchWithAuth<SparkDto>(`/sparks/${sparkId}/resolve-winner`, {
      method: 'POST',
    }),

  // Chains
  getActiveChains: () => fetchWithAuth<ChainDto[]>('/chains'),
  getChainById: (id: string) => fetchWithAuth<ChainDto>(`/chains/${id}`),
  createChain: (
    title: string,
    theme: string,
    maxSteps: number,
    initialContent: string,
    initialAudioUrl?: string,
    initialDurationSeconds?: number
  ) =>
    fetchWithAuth<ChainDto>('/chains', {
      method: 'POST',
      body: JSON.stringify({
        title,
        theme,
        maxSteps,
        initialContent,
        initialAudioUrl,
        initialDurationSeconds,
      }),
    }),
  submitChainStep: (chainId: string, content: string, audioUrl?: string, durationSeconds?: number, expectedVersion?: number) =>
    fetchWithAuth<ChainDto>(`/chains/${chainId}/step`, {
      method: 'POST',
      body: JSON.stringify({ chainId, content, audioUrl, durationSeconds, expectedVersion }),
    }),
  getCompletedChains: () => fetchWithAuth<ChainDto[]>('/chains/completed'),

  // Posts
  getFeed: (page = 1, pageSize = 20, hashtag?: string, search?: string) => {
    let url = `/posts?page=${page}&pageSize=${pageSize}`;
    if (hashtag) url += `&hashtag=${encodeURIComponent(hashtag)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return fetchWithAuth<PostDto[]>(url);
  },
  createPost: (content: string, mediaUrl?: string, mediaType?: string, width?: number, height?: number) =>
    fetchWithAuth<PostDto>('/posts', {
      method: 'POST',
      body: JSON.stringify({ content, mediaUrl, mediaType, mediaWidth: width, mediaHeight: height }),
    }),
  reactToPost: (postId: string, type: string) =>
    fetchWithAuth<PostDto>(`/posts/${postId}/react`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    }),

  // Hashtags & Search
  getTrendingHashtags: (limit = 10) => fetchWithAuth<HashtagDto[]>(`/hashtags/trending?limit=${limit}`),
  searchHashtags: (query: string, limit = 8) =>
    fetchWithAuth<HashtagDto[]>(`/hashtags/search?query=${encodeURIComponent(query)}&limit=${limit}`),
  globalSearch: (query: string, type?: string, limit = 20) => {
    let url = `/search?query=${encodeURIComponent(query)}&limit=${limit}`;
    if (type && type !== 'all') {
      url += `&type=${encodeURIComponent(type)}`;
    }
    return fetchWithAuth<GlobalSearchResultDto>(url);
  },

  // Mood Pods
  // Follow System
  followUser: (targetUserId: string) =>
    fetchWithAuth<UserFollowDto>(`/users/${targetUserId}/follow`, { method: 'POST' }),
  acceptFollowRequest: (requestId: string) =>
    fetchWithAuth<UserFollowDto>(`/users/follow-requests/${requestId}/accept`, { method: 'POST' }),
  declineFollowRequest: (requestId: string) =>
    fetchWithAuth<boolean>(`/users/follow-requests/${requestId}/decline`, { method: 'POST' }),
  unfollowUser: (targetUserId: string) =>
    fetchWithAuth<boolean>(`/users/${targetUserId}/unfollow`, { method: 'DELETE' }),
  getPendingFollowRequests: () =>
    fetchWithAuth<UserFollowDto[]>('/users/follow-requests/pending'),
  getFollowers: (username: string) =>
    fetchWithAuth<UserFollowDto[]>(`/users/${encodeURIComponent(username)}/followers`),
  getFollowing: (username: string) =>
    fetchWithAuth<UserFollowDto[]>(`/users/${encodeURIComponent(username)}/following`),
  getFollowStatus: (username: string) =>
    fetchWithAuth<FollowStatusDto>(`/users/${encodeURIComponent(username)}/follow-status`),

  // Mood Pods
  getActivePods: () => fetchWithAuth<MoodPodDto[]>('/moodpods'),
  getPodById: (id: string, inviteCode?: string) =>
    fetchWithAuth<MoodPodDto>(`/moodpods/${id}${inviteCode ? `?inviteCode=${encodeURIComponent(inviteCode)}` : ''}`),
  joinPodByCode: (inviteCode: string) =>
    fetchWithAuth<MoodPodDto>('/moodpods/join-by-code', {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
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
  }) =>
    fetchWithAuth<MoodPodDto>('/moodpods', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
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
    }
  ) =>
    fetchWithAuth<MoodPodDto>(`/moodpods/${podId}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
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

  // Media Upload
  uploadMedia: async (file: File | Blob, filename = 'meme.webp'): Promise<{ url: string; contentType: string }> => {
    const currentPersona = useAuthStore.getState().currentPersona;
    const locale = useThemeStore.getState().locale;
    const formData = new FormData();
    formData.append('file', file, filename);

    const response = await fetch(`${BASE_URL}/media/upload`, {
      method: 'POST',
      headers: {
        'X-User-Id': safeHeaderValue(currentPersona?.id),
        'X-Username': safeHeaderValue(currentPersona?.username),
        'X-DisplayName': safeHeaderValue(currentPersona?.displayName),
        'X-Avatar-Url': safeHeaderValue(currentPersona?.avatarUrl),
        'X-App-Locale': safeHeaderValue(locale),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Media upload failed');
    }

    return response.json();
  },

  getMediaUrl,
};
