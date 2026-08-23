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

export interface SparkSubmissionDto {
  id: string;
  sparkId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl?: string;
  mediaUrl?: string;
  caption: string;
  voteCount: number;
  hasVoted: boolean;
  createdAtUtc: string;
}

export interface SparkDto {
  id: string;
  title: string;
  prompt: string;
  category: string;
  activeFromUtc: string;
  activeUntilUtc: string;
  status: string;
  timeRemaining: string;
  winnerSubmissionId?: string;
  winnerUserId?: string;
  winnerUsername?: string;
  submissions: SparkSubmissionDto[];
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
}

export interface AuthResultDto {
  token: string;
  centrifugoToken: string;
  user: UserDto;
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
  sparksWonCount: number;
  recentPosts: PostDto[];
  recentChains: ChainDto[];
}

