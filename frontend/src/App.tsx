import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MobileAppShell } from './components/layout/MobileAppShell';
import { TabType } from './components/layout/BottomNavBar';
import { FeedView } from './components/posts/FeedView';
import { SparkHeroCard } from './components/sparks/SparkHeroCard';
import { PassTheMicChainCard } from './components/chains/PassTheMicChainCard';
import { CreateChainModal } from './components/chains/CreateChainModal';
import { MoodPodsView } from './components/pods/MoodPodsView';
import { MemeCanvasEditor } from './components/meme-canvas/MemeCanvasEditor';
import { ProfileView } from './components/profile/ProfileView';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';
import { AuthModal } from './components/auth/AuthModal';
import { useCentrifugo } from './hooks/useCentrifugo';
import { useThemeStore } from './stores/useThemeStore';
import { useAuthStore } from './stores/useAuthStore';
import { useFollowStore } from './stores/useFollowStore';
import { api } from './services/apiClient';
import { ChainDto, MoodPodDto, PostDto, SparkDto } from './types/api';
import { Flame, GitBranch, Plus, Radio, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [isCreateChainOpen, setIsCreateChainOpen] = useState(false);
  const [selectedPodId, setSelectedPodId] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchHashtag, setSearchHashtag] = useState<string | null>(null);

  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';
  const currentUser = useAuthStore((s) => s.currentUser);

  // Ensure active JWT session and preload follow relationships on startup
  useEffect(() => {
    const { accessToken, refreshToken, setTokens, setUser, currentUser: initialUser } = useAuthStore.getState();
    if (initialUser?.username) {
      useFollowStore.getState().loadMyFollowing(initialUser.username);
    }

    if (!accessToken && refreshToken) {
      api.refreshToken(refreshToken)
        .then((res) => {
          setTokens(res.token, res.refreshToken, res.centrifugoToken, res.refreshTokenExpiresAtUtc);
          setUser(res.user);
          if (res.user?.username) {
            useFollowStore.getState().loadMyFollowing(res.user.username);
          }
        })
        .catch(() => {
          useAuthStore.getState().logout();
        });
    }
  }, []);

  // Sync follow store whenever currentUser changes
  useEffect(() => {
    if (currentUser?.username) {
      useFollowStore.getState().loadMyFollowing(currentUser.username);
    }
  }, [currentUser?.username]);

  // Global Centrifugo connection status & Real-time query cache updates
  const { isConnected } = useCentrifugo('feed:global', (data) => {
    if (data.type === 'POST_CREATED' && data.post) {
      queryClient.setQueryData<PostDto[]>(['posts'], (old = []) => {
        const newPost = data.post as PostDto;
        if (old.some((p) => p.id === newPost.id)) return old;
        return [newPost, ...old];
      });
    }
  });

  // Queries for initial data
  const { data: posts = [], refetch: refetchPosts } = useQuery<PostDto[]>({
    queryKey: ['posts'],
    queryFn: () => api.getFeed(),
  });

  const { data: spark, refetch: refetchSpark } = useQuery<SparkDto>({
    queryKey: ['spark', 'active'],
    queryFn: () => api.getActiveSpark(),
  });

  const { data: chains = [], refetch: refetchChains } = useQuery<ChainDto[]>({
    queryKey: ['chains'],
    queryFn: () => api.getActiveChains(),
  });

  const { data: pods = [], refetch: refetchPods } = useQuery<MoodPodDto[]>({
    queryKey: ['pods'],
    queryFn: () => api.getActivePods(),
  });

  const [selectedProfileUsername, setSelectedProfileUsername] = useState<string | null>(null);

  const handleSelectHashtag = (tag: string) => {
    setSearchHashtag(tag);
    setActiveTab('feed');
  };

  const handleClearHashtag = () => {
    setSearchHashtag(null);
  };

  const handleNavigateProfile = (username?: string) => {
    setSelectedProfileUsername(username || null);
    setActiveTab('profile');
  };

  return (
    <>
      <MobileAppShell
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'profile') {
            setSelectedProfileUsername(null);
          }
          setActiveTab(tab);
        }}
        isConnected={isConnected}
        activeSpark={spark}
        pods={pods}
        onOpenSearch={() => setIsSearchOpen(true)}
        onSelectHashtag={handleSelectHashtag}
      >
        {/* 1. Feed Tab */}
        {activeTab === 'feed' && (
          <FeedView
            initialPosts={posts}
            onOpenCanvas={() => setActiveTab('create')}
            selectedHashtag={searchHashtag}
            onSelectHashtag={handleSelectHashtag}
            onClearHashtag={handleClearHashtag}
            onOpenSearch={() => setIsSearchOpen(true)}
          />
        )}

      {/* 2. Daily Sparks Tab */}
      {activeTab === 'sparks' && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 pb-24 md:pb-8">
          {spark ? (
            <SparkHeroCard
              initialSpark={spark}
              onOpenCanvas={() => setActiveTab('create')}
            />
          ) : (
            <div className="glass-card rounded-3xl p-8 border border-zinc-200 dark:border-zinc-800 text-center space-y-4 my-6">
              <Flame className="w-10 h-10 text-amber-500 mx-auto animate-pulse" />
              <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                {isArabic ? 'جاري تحميل تحدي اليوم...' : 'Loading Daily Spark Challenge...'}
              </h3>
            </div>
          )}
        </div>
      )}

      {/* 3. Pass-the-Mic Chains Tab */}
      {activeTab === 'chains' && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 pb-24 md:pb-8 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-fuchsia-400" />
              <div>
                <h2 className="font-bold text-base text-white">
                  {isArabic ? 'سلاسل المايك التفاعلية' : 'Pass-The-Mic Chains'}
                </h2>
                <p className="text-[11px] text-zinc-400">
                  {isArabic ? 'قصص ميكرو تعاونية بنظام الأدوار الصارم' : 'Collaborative micro-stories with strict turn locking'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsCreateChainOpen(true)}
              className="py-2 px-3 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isArabic ? 'سلسلة جديدة' : 'New Chain'}</span>
            </button>
          </div>

          <div className="space-y-4">
            {chains.map((chain) => (
              <PassTheMicChainCard
                key={chain.id}
                initialChain={chain}
                onRefresh={refetchChains}
              />
            ))}
          </div>

          <CreateChainModal
            isOpen={isCreateChainOpen}
            onClose={() => setIsCreateChainOpen(false)}
            onChainCreated={() => {
              refetchChains();
            }}
          />
        </div>
      )}

      {/* 4. Ephemeral Mood Pods Tab */}
      {activeTab === 'pods' && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 pb-24 md:pb-8">
          <MoodPodsView
            pods={pods}
            onRefreshPods={refetchPods}
            selectedPodId={selectedPodId}
            onSelectPodId={setSelectedPodId}
          />
        </div>
      )}

      {/* 5. Meme Canvas Editor Tab */}
      {activeTab === 'create' && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 pb-24 md:pb-8">
          <MemeCanvasEditor
            activeSpark={spark}
            onPublishPost={() => {
              refetchPosts();
              setActiveTab('feed');
            }}
            onPublishSpark={() => {
              refetchSpark();
              setActiveTab('sparks');
            }}
          />
        </div>
      )}

        {/* 6. User Profile & XP Portfolio Tab */}
        {activeTab === 'profile' && (
          <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 pb-24 md:pb-8">
            <ProfileView
              username={selectedProfileUsername || undefined}
              onOpenCanvas={() => setActiveTab('create')}
            />
          </div>
        )}
      </MobileAppShell>

      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigateTab={(tab) => {
          if (tab === 'profile') {
            setSelectedProfileUsername(null);
          }
          setActiveTab(tab);
        }}
        onNavigateProfile={handleNavigateProfile}
        onSelectHashtag={handleSelectHashtag}
        onSelectPodId={(podId) => {
          setSelectedPodId(podId);
          setActiveTab('pods');
        }}
      />

    <AuthModal />
  </>
  );
};
