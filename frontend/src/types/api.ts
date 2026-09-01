export interface UserDto {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  repScore: number;
  badges: BadgeDto[];
  createdAtUtc: string;
  preferredTheme?: 'dark' | 'light';
  preferredLanguage?: 'en' | 'ar';
  bannerUrl?: string;
  isEmailConfirmed?: boolean;
  isPrivateProfile?: boolean;
  isSearchDiscoverable?: boolean;
  showBio?: boolean;
  showFollowersCount?: boolean;
  showBadges?: boolean;
  showActivityStats?: boolean;
}

export interface PrivacySettingsDto {
  isPrivateProfile: boolean;
  isSearchDiscoverable: boolean;
  showBio: boolean;
  showFollowersCount: boolean;
  showBadges: boolean;
  showActivityStats: boolean;
}

export interface BadgeDto {
  id: string;
  name: string;
  description: string;
  icon: string;
  awardedAtUtc: string;
}

export interface MediaAttachmentDto {
  url: string;
  type: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
}

export interface ReactionDto {
  id: string;
  userId: string;
  username: string;
  type: string;
  createdAtUtc: string;
}

export interface PostDto {
  id: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl?: string;
  content: string;
  media?: MediaAttachmentDto;
  reactionCount: number;
  reactions: ReactionDto[];
  createdAtUtc: string;
}

export interface ChainStepDto {
  id: string;
  chainId: string;
  stepNumber: number;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl?: string;
  content: string;
  audioUrl?: string;
  durationSeconds?: number;
  createdAtUtc: string;
}

export interface ChainDto {
  id: string;
  title: string;
  theme: string;
  maxSteps: number;
  currentStepCount: number;
  remainingSteps: number;
  status: 'Open' | 'Locked' | 'Completed';
  createdByUserId: string;
  createdByUsername: string;
  rowVersion: number;
  createdAtUtc: string;
  completedAtUtc?: string;
  canCurrentUserSubmit: boolean;
  turnLockReason?: string;
  steps: ChainStepDto[];
}

export interface PodMessageDto {
  id: string;
  podId: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl?: string;
  text: string;
  emojiReaction?: string;
  audioUrl?: string;
  durationSeconds?: number;
  createdAtUtc: string;
}

export interface PodSpeaker {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isSpeaking: boolean;
  isMuted: boolean;
  joinedAtUtc: number;
}

export interface MoodPodDto {
  id: string;
  title: string;
  moodEmoji: string;
  backgroundTheme: string;
  hostUserId: string;
  hostUsername: string;
  hostDisplayName: string;
  hostAvatarUrl?: string;
  createdAtUtc: string;
  expiresAtUtc: string;
  timeRemaining: string;
  isActive: boolean;
  activeParticipantCount: number;
  recentMessages: PodMessageDto[];
  customBackgroundImageUrl?: string;
  isPrivate?: boolean;
  inviteCode?: string;
  allowParticipantsChangeTheme?: boolean;
  allowParticipantsPlayBgMusic?: boolean;
  allowOpenMic?: boolean;
  moderatorUserIds?: string[];
}

export interface DeviceSessionDto {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  ipAddress?: string;
  userAgent?: string;
  isTrusted: boolean;
  createdAtUtc: string;
  lastActiveAtUtc: string;
  expiresAtUtc: string;
  isActive: boolean;
}

export interface AuthResultDto {
  token: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  centrifugoToken: string;
  user: UserDto;
  session?: DeviceSessionDto;
}

export interface CentrifugoTokenDto {
  token: string;
  websocketUrl: string;
  userId: string;
}

export interface UserProfileDto {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  repScore: number;
  badges: BadgeDto[];
  createdAtUtc: string;
  postsCount: number;
  totalReactionsReceived: number;
  chainsCount: number;
  recentPosts: PostDto[];
  recentChains: ChainDto[];
  preferredTheme?: 'dark' | 'light';
  preferredLanguage?: 'en' | 'ar';
  followersCount?: number;
  followingCount?: number;
  followStatus?: 'none' | 'pending_outgoing' | 'pending_incoming' | 'following' | 'follow_back' | 'mutual' | 'self';
  bannerUrl?: string;
  isEmailConfirmed?: boolean;
  isPrivate?: boolean;
  canViewFullProfile?: boolean;
  isSearchDiscoverable?: boolean;
  showBio?: boolean;
  showFollowersCount?: boolean;
  showBadges?: boolean;
  showActivityStats?: boolean;
}

export interface LinkedSocialAccountDto {
  id: string;
  provider: 'google' | 'facebook' | 'twitter' | 'custom' | string;
  providerUserId: string;
  providerEmail?: string;
  displayName?: string;
  avatarUrl?: string;
  linkedAtUtc: string;
}

export interface EmailVerificationResultDto {
  success: boolean;
  message: string;
  user?: UserDto;
  code?: string;
}

export interface SocialLoginRequest {
  provider: 'google' | 'facebook' | 'twitter' | 'custom' | string;
  providerUserId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  isTrusted?: boolean;
}

export interface HashtagDto {
  tag: string;
  count: number;
  lastUsedAtUtc: string;
}

export interface UserFollowDto {
  id: string;
  followerId: string;
  followerUsername: string;
  followerDisplayName: string;
  followerAvatarUrl?: string;
  followingId: string;
  followingUsername: string;
  followingDisplayName: string;
  followingAvatarUrl?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAtUtc: string;
  respondedAtUtc?: string;
}

export interface FollowStatusDto {
  targetUsername: string;
  status: 'none' | 'pending_outgoing' | 'pending_incoming' | 'following' | 'follow_back' | 'mutual' | 'self';
  followersCount: number;
  followingCount: number;
}

export interface GlobalSearchResultDto {
  query: string;
  filterType?: string;
  totalCount: number;
  posts: PostDto[];
  users: UserDto[];
  moodPods: MoodPodDto[];
  chains: ChainDto[];
  hashtags: HashtagDto[];
}

export interface LiveKitTokenDto {
  token: string;
  serverUrl: string;
  roomName: string;
  identity: string;
  isOnStage: boolean;
}

export interface OAuthUrlResponse {
  url: string;
  state: string;
}

export interface OAuthCallbackRequest {
  code: string;
  state: string;
  redirectUri: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  isTrusted?: boolean;
}
