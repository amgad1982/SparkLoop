import React, { useEffect, useState } from 'react';
import { TopHeader } from './TopHeader';
import { DesktopHeader } from './DesktopHeader';
import { DesktopSidebar } from './DesktopSidebar';
import { RightWidgetPanel } from './RightWidgetPanel';
import { BottomNavBar, TabType } from './BottomNavBar';
import { RTLProvider } from './RTLProvider';
import { SparkDto, MoodPodDto, UserDto } from '../../types/api';
import { api } from '../../services/apiClient';

interface MobileAppShellProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isConnected?: boolean;
  activeSpark?: SparkDto | null;
  pods?: MoodPodDto[];
  onOpenSearch?: () => void;
  onSelectHashtag?: (tag: string) => void;
  children: React.ReactNode;
}

export const MobileAppShell: React.FC<MobileAppShellProps> = ({
  activeTab,
  onTabChange,
  isConnected = true,
  activeSpark,
  pods = [],
  onOpenSearch,
  onSelectHashtag,
  children,
}) => {
  const [topCreators, setTopCreators] = useState<UserDto[]>([]);

  useEffect(() => {
    api.getPersonas()
      .then(setTopCreators)
      .catch((err) => console.error('Failed to load personas for leaderboard:', err));
  }, []);

  return (
    <RTLProvider>
      <div className="h-screen w-full bg-[#f8fafc] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex justify-center overflow-hidden selection:bg-fuchsia-500 selection:text-white transition-colors duration-200">
        <div className="w-full max-w-7xl h-full flex justify-between relative overflow-hidden">
          {/* 1. Left Sticky Navigation Sidebar (Tablet & Desktop) */}
          <DesktopSidebar
            activeTab={activeTab}
            onTabChange={onTabChange}
            isConnected={isConnected}
          />

          {/* 2. Center Content Column (Responsive: max-w-md on mobile, flex-1 on desktop) */}
          <div className="w-full md:max-w-2xl lg:max-w-2xl xl:max-w-3xl h-full flex flex-col bg-white/70 dark:bg-zinc-950 border-x border-zinc-200/80 dark:border-zinc-800/40 relative shadow-2xl overflow-hidden flex-1 transition-colors duration-200">
            {/* Mobile Header (Visible on < md) */}
            <TopHeader
              isConnected={isConnected}
              onNavigateTab={onTabChange}
              onOpenSearch={onOpenSearch}
            />

            {/* Desktop Header (Visible on >= md) */}
            <DesktopHeader
              activeTab={activeTab}
              onNavigateTab={onTabChange}
              isConnected={isConnected}
              onOpenSearch={onOpenSearch}
            />

            {/* Center Stream Content */}
            <main className="flex-1 min-h-0 px-3.5 sm:px-6 lg:px-8 pt-3 pb-0 overflow-hidden flex flex-col">
              {children}
            </main>

            {/* Mobile Bottom Navigation Bar (Visible on < md) */}
            <BottomNavBar activeTab={activeTab} onTabChange={onTabChange} />
          </div>

          {/* 3. Right Sticky Widget Panel (Desktop >= 1280px) */}
          <RightWidgetPanel
            activeSpark={activeSpark}
            pods={pods}
            topCreators={topCreators}
            onNavigateTab={onTabChange}
            onSelectHashtag={onSelectHashtag}
          />
        </div>
      </div>
    </RTLProvider>
  );
};

