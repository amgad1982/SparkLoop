import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MobileAppShell } from './components/layout/MobileAppShell';
import { TabType } from './components/layout/BottomNavBar';
import { FeedView } from './components/posts/FeedView';
import { SparkHeroCard } from './components/sparks/SparkHeroCard';
import { PassTheMicChainCard } from './components/chains/PassTheMicChainCard';
import { CreateChainModal } from './components/chains/CreateChainModal';
import { MoodPodRoom } from './components/pods/MoodPodRoom';
import { MemeCanvasEditor } from './components/meme-canvas/MemeCanvasEditor';
import { useCentrifugo } from './hooks/useCentrifugo';
import { useThemeStore } from './stores/useThemeStore';
import { api } from './services/apiClient';
import { ChainDto, MoodPodDto, PostDto, SparkDto } from './types/api';
import { Flame, GitBranch, Plus, Radio, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [isCreateChainOpen, setIsCreateChainOpen] = useState(false);
  const [selectedPodId, setSelectedPodId] = useState<string | null>(null);

  const { locale } = useThemeStore();
  const isArabic = locale === 'ar';

  // Global Centrifugo connection status
  const { isConnected } = useCentrifugo();

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

  // Selected pod for room view
  const activePod = selectedPodId
    ? pods.find((p) => p.id === selectedPodId) || pods[0]
    : pods[0];

  return (
    <MobileAppShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      isConnected={isConnected}
    >
      {/* 1. Feed Tab */}
      {activeTab === 'feed' && (
        <FeedView
          initialPosts={posts}
          onOpenCanvas={() => setActiveTab('create')}
        />
      )}

      {/* 2. Daily Sparks Tab */}
      {activeTab === 'sparks' && spark && (
        <SparkHeroCard
          initialSpark={spark}
          onOpenCanvas={() => setActiveTab('create')}
        />
      )}

      {/* 3. Pass-the-Mic Chains Tab */}
      {activeTab === 'chains' && (
        <div className="space-y-4">
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
        <div className="space-y-3">
          {/* Pod Selector Chips if multiple */}
          {pods.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {pods.map((pod) => (
                <button
                  key={pod.id}
                  onClick={() => setSelectedPodId(pod.id)}
                  className={`px-3 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 border transition-all flex-shrink-0 ${
                    (selectedPodId === pod.id || (!selectedPodId && pods[0]?.id === pod.id))
                      ? 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>{pod.moodEmoji}</span>
                  <span className="truncate max-w-[120px]">{pod.title}</span>
                </button>
              ))}
            </div>
          )}

          {activePod && <MoodPodRoom initialPod={activePod} />}
        </div>
      )}

      {/* 5. Meme Canvas Editor Tab */}
      {activeTab === 'create' && (
        <MemeCanvasEditor
          onPublishPost={() => {
            refetchPosts();
            setActiveTab('feed');
          }}
          onPublishSpark={() => {
            refetchSpark();
            setActiveTab('sparks');
          }}
        />
      )}
    </MobileAppShell>
  );
};
