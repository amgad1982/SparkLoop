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
  children: React.ReactNode;
}

export const MobileAppShell: React.FC<MobileAppShellProps> = ({
  activeTab,
  onTabChange,
  isConnected = true,
  activeSpark,
  pods = [],
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
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex justify-center w-full overflow-x-hidden selection:bg-fuchsia-500 selection:text-white">
        <div className="w-full max-w-7xl flex justify-between relative">
          {/* 1. Left Sticky Navigation Sidebar (Tablet & Desktop) */}
          <DesktopSidebar
            activeTab={activeTab}
            onTabChange={onTabChange}
            isConnected={isConnected}
          />

          {/* 2. Center Content Column (Responsive: max-w-md on mobile, flex-1 on desktop) */}
          <div className="w-full md:max-w-3xl xl:max-w-3xl min-h-screen flex flex-col bg-zinc-950 border-x border-zinc-800/40 relative shadow-2xl pb-24 md:pb-8 flex-1">
            {/* Mobile Header (Visible on < md) */}
            <TopHeader isConnected={isConnected} onNavigateTab={onTabChange} />

            {/* Desktop Header (Visible on >= md) */}
            <DesktopHeader
              activeTab={activeTab}
              onNavigateTab={onTabChange}
              isConnected={isConnected}
            />

            {/* Scrollable Center Stream Content */}
            <main className="flex-1 px-3 sm:px-6 py-2 overflow-y-auto">
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
          />
        </div>
      </div>
    </RTLProvider>
  );
};

