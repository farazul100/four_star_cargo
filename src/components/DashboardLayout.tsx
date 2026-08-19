import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { NotificationsPage } from './NotificationsPage';
import { UserProfileSettings } from './UserProfileSettings';
import { SystemChatPage } from './chat/SystemChatPage';
import { SystemCallOverlay } from './chat/SystemCallOverlay';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../context/ThemeContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pageTitle: string;
  pageSubtitle?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  pageTitle,
  pageSubtitle,
}) => {
  const { user, signOut } = useAuth();
  const { lang, setLang } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (!user) return null;

  const isDark = theme === 'dark';

  return (
    <div
      className={`h-screen flex flex-col overflow-hidden transition-colors duration-200 ${
        isDark ? 'bg-[#141414] text-white' : 'bg-[#F4F5F7] text-gray-900'
      } ${theme}`}
    >
      {/* Top Navbar */}
      <div className="flex-shrink-0 z-50">
        <Header
          currentUser={user}
          language={lang}
          setLanguage={setLang}
          theme={theme}
          setTheme={setTheme}
          onLogout={signOut}
          toggleSidebarMobile={() => setSidebarOpen(!sidebarOpen)}
          onOpenNotifications={() => setActiveTab('notifications')}
          onOpenProfile={() => setActiveTab('profile')}
          onOpenChat={() => setActiveTab('system_chat')}
        />
      </div>

      {/* Global In-System WebRTC Calling Overlay */}
      <SystemCallOverlay currentUser={user} language={lang} />

      {/* Main Body */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Left Sidebar */}
        <Sidebar
          currentUser={user}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          language={lang}
          theme={theme}
          isOpenMobile={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
        />

        {/* Right Scrollable Content Area */}
        <main
          className={`flex-1 overflow-y-auto transition-colors duration-200 ${
            activeTab === 'system_chat' ? 'p-0 flex flex-col h-[calc(100vh-3.5rem)]' : 'p-4 md:px-6 md:py-4'
          } ${isDark ? 'bg-[#141414]' : 'bg-[#F4F5F7]'}`}
        >
          <div className={activeTab === 'system_chat' ? 'w-full h-full' : 'max-w-7xl mx-auto space-y-5'}>
            {/* Header Pattern: Title + Subtitle (Only render if pageTitle exists and not notifications/profile/chat) */}
            {activeTab !== 'notifications' && activeTab !== 'profile' && activeTab !== 'system_chat' && Boolean(pageTitle) && (
              <div className={`border-b pb-3 ${isDark ? 'border-[#2C2C2E]/60' : 'border-gray-200'}`}>
                <h1 className={`text-xl font-medium tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {pageTitle}
                </h1>
                {pageSubtitle && (
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-[#9E9E9E]' : 'text-gray-500'}`}>
                    {pageSubtitle}
                  </p>
                )}
              </div>
            )}

            {/* Render Special Full-Page Tabs */}
            {activeTab === 'notifications' ? (
              <NotificationsPage language={lang} theme={theme} />
            ) : activeTab === 'profile' ? (
              <UserProfileSettings
                currentUser={user}
                language={lang}
                setLanguage={setLang}
                theme={theme}
              />
            ) : activeTab === 'system_chat' ? (
              <SystemChatPage currentUser={user} language={lang} theme={theme} />
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
