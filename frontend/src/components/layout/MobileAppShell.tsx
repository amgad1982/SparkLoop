import React from 'react';
import { TopHeader } from './TopHeader';
import { BottomNavBar, TabType } from './BottomNavBar';
import { RTLProvider } from './RTLProvider';

interface MobileAppShellProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isConnected?: boolean;
  children: React.ReactNode;
}

export const MobileAppShell: React.FC<MobileAppShellProps> = ({
  activeTab,
  onTabChange,
  isConnected = true,
  children,
}) => {
  return (
    <RTLProvider>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center">
        {/* Mobile Container wrapper */}
        <div className="w-full max-w-md min-h-screen flex flex-col bg-zinc-950 border-x border-zinc-800/40 relative shadow-2xl pb-24">
          <TopHeader isConnected={isConnected} />
          
          <main className="flex-1 px-4 py-4 overflow-y-auto">
            {children}
          </main>

          <BottomNavBar activeTab={activeTab} onTabChange={onTabChange} />
        </div>
      </div>
    </RTLProvider>
  );
};
