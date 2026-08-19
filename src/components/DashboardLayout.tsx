import React, { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { NotificationsPage } from './NotificationsPage';
import { UserProfileSettings } from './UserProfileSettings';
import { SystemChatModal } from './chat/SystemChatModal';
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
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Auto-open chat modal if user clicks 'system_chat' tab in sidebar
  useEffect(() => {
    if (activeTab === 'system_chat') {
      setIsChatOpen(true);
    }
  }, [activeTab]);

  if (!user) return null;

  const isDark = theme === 'dark';
  const isBn = lang === 'bn';

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
          onOpenChat={() => setIsChatOpen(true)}
        />
      </div>

      {/* Global In-System Calling Overlay & Chat Modal */}
      <SystemCallOverlay currentUser={user} language={lang} />
      <SystemChatModal currentUser={user} language={lang} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      {/* FLOATING CHAT WIDGET BUTTON (BOTTOM-RIGHT CORNER) */}
      <button
        type="button"
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-6 right-6 z-[888] px-4 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-2xl transition-all duration-200 flex items-center space-x-2.5 cursor-pointer hover:scale-105 active:scale-95 border-2 border-white/20 group"
        title={isBn ? 'ইন-সিস্টেম লাইভ চ্যাট ও ভয়েস/ভিডিও কল' : 'Live System Chat & Calls'}
      >
        <div className="relative">
          <MessageSquare className="w-5 h-5 group-hover:animate-bounce-short" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-blue-600 animate-pulse" />
        </div>
        <span className="font-semibold">{isBn ? 'লাইভ চ্যাট ও কল' : 'Live Chat & Call'}</span>
      </button>

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
          className={`flex-1 overflow-y-auto p-4 md:px-6 md:py-4 transition-colors duration-200 ${
            isDark ? 'bg-[#141414]' : 'bg-[#F4F5F7]'
          }`}
        >
          <div className="max-w-7xl mx-auto space-y-5">
            {/* Header Pattern: Title + Subtitle (Only render if pageTitle exists and not notifications/profile) */}
            {activeTab !== 'notifications' && activeTab !== 'profile' && Boolean(pageTitle) && (
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
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
