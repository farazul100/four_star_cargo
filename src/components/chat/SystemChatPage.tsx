import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Users,
  User as UserIcon,
  Plus,
  Send,
  Phone,
  Video,
  Search,
  X,
  Image as ImageIcon,
  ArrowLeft,
} from 'lucide-react';
import { User, ChatConversation, ChatMessage, CallSession, Language, Theme } from '../../types';
import { DB_KEYS, getHostingerDbData, saveHostingerDbData, logSystemAuditAction } from '../../lib/db';
import { useTheme } from '../../context/ThemeContext';
import { compressImageFile } from '../../utils/imageCompressor';

interface SystemChatPageProps {
  currentUser: User;
  language: Language;
  theme?: Theme;
}

export const SystemChatPage: React.FC<SystemChatPageProps> = ({ currentUser, language, theme: propTheme }) => {
  const isBn = language === 'bn';
  const { theme: contextTheme } = useTheme();
  const activeTheme = propTheme || contextTheme || 'dark';
  const isDark = activeTheme === 'dark';
  const isSuperAdmin = currentUser.role === 'super_admin';

  // DB States
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Selection & Mode Filter
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [activeTabMode, setActiveTabMode] = useState<'direct' | 'groups'>('direct');
  const [searchQuery, setSearchQuery] = useState('');

  // Group Modal (Super Admin Only)
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [selectedUserIdsForGroup, setSelectedUserIdsForGroup] = useState<string[]>([]);

  // Input & Image Upload State
  const [messageInput, setMessageInput] = useState('');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Presence Heartbeat: Update currentUser's last_active_at timestamp every 10 seconds
  useEffect(() => {
    const updatePresence = () => {
      const db = getHostingerDbData();
      const usersList: User[] = db.users || [];
      const nowIso = new Date().toISOString();
      let changed = false;

      const updatedUsers = usersList.map((u) => {
        if (u.id === currentUser.id) {
          if (!u.last_active_at || Date.now() - new Date(u.last_active_at).getTime() > 5000) {
            changed = true;
            return { ...u, last_active_at: nowIso };
          }
        }
        return u;
      });

      if (changed) {
        saveHostingerDbData(DB_KEYS.USERS, updatedUsers);
      }
    };

    updatePresence();
    const interval = setInterval(updatePresence, 10000);
    return () => clearInterval(interval);
  }, [currentUser.id]);

  // Sound Chime generator for incoming message
  const playMessageChime = () => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {}
  };

  // Load and subscribe to DB chat updates
  const loadChatData = () => {
    const db = getHostingerDbData();
    const convos: ChatConversation[] = db.conversations || [];
    const msgs: ChatMessage[] = db.messages || [];
    const usersList: User[] = db.users || [];

    // Filter conversations where current user is a participant or it's a customer support inquiry
    const myConvos = convos.filter(
      (c) =>
        (Array.isArray(c.participants) && c.participants.includes(currentUser.id)) ||
        c.type === 'customer_support' ||
        (Array.isArray(c.participants) && c.participants.includes('all_staff'))
    );

    setConversations(myConvos);
    setMessages(msgs);
    setAllUsers(usersList.filter((u) => u.id !== currentUser.id && u.status === 'active'));
  };

  useEffect(() => {
    loadChatData();

    const handleUpdate = () => {
      loadChatData();
    };

    window.addEventListener('fsc_db_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('fsc_db_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // 2. Auto Mark as Read when viewing active conversation
  useEffect(() => {
    if (!activeConvoId) return;

    const db = getHostingerDbData();
    const msgs: ChatMessage[] = db.messages || [];
    let updated = false;

    const updatedMsgs = msgs.map((m) => {
      if (
        m.conversation_id === activeConvoId &&
        m.sender_id !== currentUser.id &&
        (!m.read_by || !m.read_by.includes(currentUser.id))
      ) {
        updated = true;
        return {
          ...m,
          read_by: [...(m.read_by || []), currentUser.id],
        };
      }
      return m;
    });

    if (updated) {
      saveHostingerDbData('fsc_vps_messages', updatedMsgs);
      setMessages(updatedMsgs);
    }
  }, [activeConvoId, messages.length]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeConvoId]);

  const activeConvo = conversations.find((c) => c.id === activeConvoId);
  const activeMessages = messages.filter((m) => m.conversation_id === activeConvoId);

  // Helper to check if a user is online (active within 45 seconds)
  const isUserOnline = (userItem: User) => {
    if (!userItem.last_active_at) return false;
    const diffSec = (Date.now() - new Date(userItem.last_active_at).getTime()) / 1000;
    return diffSec <= 45;
  };

  // Helper to get unread message count for a conversation
  const getUnreadCount = (convoId: string) => {
    return messages.filter(
      (m) =>
        m.conversation_id === convoId &&
        m.sender_id !== currentUser.id &&
        (!m.read_by || !m.read_by.includes(currentUser.id))
    ).length;
  };

  // Helper to format conversation title
  const getConvoTitle = (convo: ChatConversation) => {
    if (convo.type === 'group') {
      return convo.name || (isBn ? 'গ্রুপ চ্যাট' : 'Group Chat');
    }
    const otherUserId = convo.participants.find((id) => id !== currentUser.id);
    const otherUser = allUsers.find((u) => u.id === otherUserId);
    return otherUser ? `${otherUser.name} (${otherUser.role})` : isBn ? 'ইউজার চ্যাট' : 'Direct Message';
  };

  // Send Message Handler
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || !activeConvoId) return;

    const db = getHostingerDbData();
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      conversation_id: activeConvoId,
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      sender_role: currentUser.role,
      content: messageInput.trim(),
      read_by: [currentUser.id],
      created_at: new Date().toISOString(),
    };

    const updatedMsgs = [...(db.messages || []), newMsg];
    const updatedConvos = (db.conversations || []).map((c: ChatConversation) =>
      c.id === activeConvoId
        ? {
            ...c,
            last_message: newMsg.content,
            last_message_at: newMsg.created_at,
          }
        : c
    );

    saveHostingerDbData('fsc_vps_messages', updatedMsgs);
    saveHostingerDbData('fsc_vps_conversations', updatedConvos);

    setMessages(updatedMsgs);
    setMessageInput('');
    playMessageChime();
  };

  // Image Upload & Compression Handler
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConvoId) return;

    try {
      // Auto-compress any image file (down to ~20KB - 80KB WebP)
      const compressedBase64 = await compressImageFile(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.7,
      });

      const db = getHostingerDbData();
      const newMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        conversation_id: activeConvoId,
        sender_id: currentUser.id,
        sender_name: currentUser.name,
        sender_role: currentUser.role,
        content: compressedBase64,
        image_url: compressedBase64,
        read_by: [currentUser.id],
        created_at: new Date().toISOString(),
      };

      const updatedMsgs = [...(db.messages || []), newMsg];
      const updatedConvos = (db.conversations || []).map((c: ChatConversation) =>
        c.id === activeConvoId
          ? {
              ...c,
              last_message: isBn ? '📷 ছবি' : '📷 Image',
              last_message_at: newMsg.created_at,
            }
          : c
      );

      saveHostingerDbData('fsc_vps_messages', updatedMsgs);
      saveHostingerDbData('fsc_vps_conversations', updatedConvos);

      setMessages(updatedMsgs);
      setMessageInput('');
      playMessageChime();
    } catch (err) {
      console.warn('Image upload error:', err);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Direct Chat with Any System User
  const handleStartDirectChat = (targetUser: User) => {
    const db = getHostingerDbData();
    const existingConvos: ChatConversation[] = db.conversations || [];

    let existing = existingConvos.find(
      (c) =>
        c.type === 'direct' &&
        c.participants.includes(currentUser.id) &&
        c.participants.includes(targetUser.id)
    );

    if (!existing) {
      existing = {
        id: `convo-dir-${Date.now()}-${targetUser.id}`,
        type: 'direct',
        participants: [currentUser.id, targetUser.id],
        created_by: currentUser.id,
        created_at: new Date().toISOString(),
        last_message: 'Chat started',
        last_message_at: new Date().toISOString(),
      };
      saveHostingerDbData('fsc_vps_conversations', [...existingConvos, existing]);
    }

    setActiveConvoId(existing.id);
    loadChatData();
  };

  // Create Group Chat (RESTRICTED STRICTLY TO SUPER ADMIN)
  const handleCreateGroupChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      alert(isBn ? 'শুধুমাত্র সুপার এডমিন নতুন গ্রুপ তৈরি করতে পারবেন!' : 'Only Super Admin can create new chat groups!');
      return;
    }
    if (!groupNameInput.trim() || selectedUserIdsForGroup.length === 0) return;

    const db = getHostingerDbData();
    const existingConvos: ChatConversation[] = db.conversations || [];

    const newGroup: ChatConversation = {
      id: `convo-grp-${Date.now()}`,
      name: groupNameInput.trim(),
      type: 'group',
      participants: Array.from(new Set([currentUser.id, ...selectedUserIdsForGroup])),
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      last_message: 'Group created by Super Admin',
      last_message_at: new Date().toISOString(),
    };

    const updated = [...existingConvos, newGroup];
    saveHostingerDbData('fsc_vps_conversations', updated);
    logSystemAuditAction(currentUser, 'GROUP_CHAT_CREATED', 'CHAT_GROUP', newGroup.id, `Super Admin created chat group "${newGroup.name}" with ${newGroup.participants.length} members.`);

    setActiveConvoId(newGroup.id);
    setGroupNameInput('');
    setSelectedUserIdsForGroup([]);
    setShowNewGroupModal(false);
    loadChatData();
  };

  // Initiate Native WebRTC Voice or Video Call
  const handleInitiateCall = (type: 'audio' | 'video') => {
    if (!activeConvo) return;
    const otherUserId = activeConvo.participants.find((id) => id !== currentUser.id);

    const db = getHostingerDbData();
    const calls: CallSession[] = db.calls || [];

    const newCall: CallSession = {
      id: `call-${Date.now()}`,
      conversation_id: activeConvo.id,
      caller_id: currentUser.id,
      caller_name: currentUser.name,
      caller_role: currentUser.role,
      target_user_id: otherUserId,
      type: type,
      status: 'ringing',
      created_at: new Date().toISOString(),
    };

    saveHostingerDbData('fsc_vps_calls', [...calls, newCall]);
    logSystemAuditAction(currentUser, 'CALL_INITIATED', 'CALL', newCall.id, `Initiated ${type} call in conversation ${activeConvo.id}`);
  };

  // Filter users by search
  const filteredUsers = allUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // 3. SORT DIRECT USERS BY LATEST MESSAGE TIMESTAMP (NEWEST MESSAGES PUSH USER TO TOP)
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const convoA = conversations.find(
      (c) => c.type === 'direct' && c.participants.includes(a.id)
    );
    const convoB = conversations.find(
      (c) => c.type === 'direct' && c.participants.includes(b.id)
    );
    const timeA = convoA?.last_message_at ? new Date(convoA.last_message_at).getTime() : 0;
    const timeB = convoB?.last_message_at ? new Date(convoB.last_message_at).getTime() : 0;
    return timeB - timeA;
  });

  // Group conversations
  const groupConvos = conversations.filter((c) => c.type === 'group');
  const sortedGroupConvos = [...groupConvos].sort((a, b) => {
    const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return timeB - timeA;
  });

  return (
    <div className={`w-full h-[calc(100vh-3.5rem)] rounded-none border-0 shadow-none flex overflow-hidden ${
      isDark ? 'bg-[#18181B] text-white' : 'bg-white text-slate-900'
    }`}>
      {/* LEFT COLUMN: CHAT SIDEBAR (ONLINE STATUS + UNREAD COUNT + TOP RECENT SORT) */}
      <div className={`w-full md:w-80 border-r flex flex-col shrink-0 ${
        activeConvoId ? 'hidden md:flex' : 'flex'
      } ${
        isDark ? 'bg-[#121214] border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        
        {/* Header Title & Search */}
        <div className={`p-3.5 border-b space-y-3 ${
          isDark ? 'border-slate-800 bg-[#121214]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-[#00897B]" />
            <h2 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Chat</h2>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className={`w-full pl-8 pr-3 py-1.5 rounded-none text-xs border outline-none ${
                isDark 
                  ? 'bg-slate-900 border-slate-800 text-white focus:border-[#00897B] placeholder:text-slate-500' 
                  : 'bg-white border-slate-300 text-slate-900 focus:border-[#00897B] placeholder:text-slate-400'
              }`}
            />
          </div>

          {/* Direct Message vs Groups Mode Tabs */}
          <div className={`flex items-center gap-1 p-1 rounded-none text-xs font-medium border ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-200/80 border-slate-300'
          }`}>
            <button
              type="button"
              onClick={() => setActiveTabMode('direct')}
              className={`flex-1 py-1.5 px-2 rounded-none transition-all text-[11px] flex items-center justify-center space-x-1 cursor-pointer ${
                activeTabMode === 'direct'
                  ? 'bg-[#00897B] text-white font-bold'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-slate-900 font-medium'
              }`}
            >
              <UserIcon className="w-3 h-3" />
              <span>Direct Message</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTabMode('groups')}
              className={`flex-1 py-1.5 px-2 rounded-none transition-all text-[11px] flex items-center justify-center space-x-1 cursor-pointer ${
                activeTabMode === 'groups'
                  ? 'bg-[#00897B] text-white font-bold'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-slate-900 font-medium'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>Groups</span>
            </button>
          </div>

          {/* SUPER ADMIN GROUP CREATION BUTTON */}
          {activeTabMode === 'groups' && isSuperAdmin && (
            <button
              type="button"
              onClick={() => setShowNewGroupModal(true)}
              className="w-full py-1.5 px-2.5 rounded-none bg-[#00897B] hover:bg-[#00796B] text-white font-medium text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isBn ? '+ নতুন চ্যাট গ্রুপ তৈরি করুন' : '+ Create Group'}</span>
            </button>
          )}
        </div>

        {/* USERS LIST CONTENT */}
        <div className="flex-1 overflow-y-auto p-1 space-y-3">
          {activeTabMode === 'direct' ? (
            <div>
              <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                ALL USERS ({sortedUsers.length})
              </div>

              <div className="space-y-0.5 mt-0.5">
                {sortedUsers.map((userItem) => {
                  const userConvo = conversations.find(
                    (c) => c.type === 'direct' && c.participants.includes(userItem.id)
                  );
                  const isActive = userConvo && userConvo.id === activeConvoId;
                  const initials = userItem.name
                    ? userItem.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                    : 'US';
                  
                  const online = isUserOnline(userItem);
                  const unreadCount = userConvo ? getUnreadCount(userConvo.id) : 0;

                  return (
                    <button
                      key={userItem.id}
                      type="button"
                      onClick={() => handleStartDirectChat(userItem)}
                      className={`w-full p-2.5 rounded-none text-left transition-all flex items-center space-x-3 cursor-pointer border-l-4 ${
                        isActive
                          ? 'bg-[#00897B]/15 border-[#00897B] text-[#00897B] font-bold'
                          : isDark
                            ? 'hover:bg-slate-800/60 text-slate-200 border-transparent'
                            : 'hover:bg-slate-200/60 text-slate-900 border-transparent'
                      }`}
                    >
                      {/* Avatar Circle with Real-Time Online Badge */}
                      <div className="relative shrink-0">
                        <div className={`w-8 h-8 rounded-none font-bold text-xs flex items-center justify-center border ${
                          isDark 
                            ? 'bg-[#00897B]/20 text-[#26A69A] border-[#00897B]/40' 
                            : 'bg-[#00897B]/15 text-[#00897B] border-[#00897B]/30'
                        }`}>
                          {initials}
                        </div>
                        {online ? (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-pulse"
                            title={isBn ? 'অনলাইন' : 'Online'}
                          />
                        ) : (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-slate-400"
                            title={isBn ? 'অফলাইন' : 'Offline'}
                          />
                        )}
                      </div>

                      {/* User Info & Online Status Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {userItem.name}
                          </span>
                          <span className={`text-[9px] font-semibold ${online ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {online ? (isBn ? 'অনলাইন' : 'Online') : (isBn ? 'অফলাইন' : 'Offline')}
                          </span>
                        </div>
                        <div className={`text-[10px] truncate capitalize font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {userItem.department || 'উত্তরা'} • {userItem.role.replace('_', ' ')}
                        </div>
                      </div>

                      {/* UNREAD MESSAGE COUNT BADGE */}
                      {unreadCount > 0 && (
                        <div className="px-2 py-0.5 rounded-full bg-red-600 text-white font-bold text-[10px] animate-pulse shrink-0">
                          {unreadCount}
                        </div>
                      )}
                    </button>
                  );
                })}

                {sortedUsers.length === 0 && (
                  <div className={`p-4 text-center text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    No users found
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                isDark ? 'text-slate-400' : 'text-slate-600'
              }`}>
                GROUPS ({sortedGroupConvos.length})
              </div>

              <div className="space-y-0.5 mt-0.5">
                {sortedGroupConvos.map((convo) => {
                  const isActive = convo.id === activeConvoId;
                  const unreadCount = getUnreadCount(convo.id);

                  return (
                    <button
                      key={convo.id}
                      type="button"
                      onClick={() => setActiveConvoId(convo.id)}
                      className={`w-full p-2.5 rounded-none text-left transition-all flex items-center space-x-3 cursor-pointer border-l-4 ${
                        isActive
                          ? 'bg-[#00897B]/15 border-[#00897B] text-[#00897B] font-bold'
                          : isDark
                            ? 'hover:bg-slate-800/60 text-slate-200 border-transparent'
                            : 'hover:bg-slate-200/60 text-slate-900 border-transparent'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-none shrink-0 font-bold text-xs flex items-center justify-center border ${
                        isDark 
                          ? 'bg-[#00897B]/20 text-[#26A69A] border-[#00897B]/40' 
                          : 'bg-[#00897B]/15 text-[#00897B] border-[#00897B]/30'
                      }`}>
                        <Users className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {convo.name || 'Group Chat'}
                        </div>
                        <div className={`text-[10px] truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {convo.last_message || 'Group Chat'}
                        </div>
                      </div>

                      {/* UNREAD MESSAGE COUNT BADGE */}
                      {unreadCount > 0 && (
                        <div className="px-2 py-0.5 rounded-full bg-red-600 text-white font-bold text-[10px] animate-pulse shrink-0">
                          {unreadCount}
                        </div>
                      )}
                    </button>
                  );
                })}

                {sortedGroupConvos.length === 0 && (
                  <div className={`p-4 text-center text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    No groups available
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: ACTIVE THREAD OR PLACEHOLDER */}
      <div className={`flex-1 flex flex-col h-full min-w-0 ${
        activeConvoId ? 'flex' : 'hidden md:flex'
      } ${
        isDark ? 'bg-[#18181B]' : 'bg-white'
      }`}>
        {activeConvo ? (
          <>
            {/* CHAT THREAD HEADER BAR */}
            <div className={`p-3.5 border-b flex items-center justify-between ${
              isDark ? 'border-slate-800 bg-[#121214]' : 'border-slate-200 bg-slate-100/80'
            }`}>
              <div className="flex items-center space-x-3">
                {/* WHATSAPP/MESSENGER STYLE MOBILE BACK BUTTON */}
                <button
                  type="button"
                  onClick={() => setActiveConvoId(null)}
                  className="p-1.5 rounded-none md:hidden text-slate-400 hover:text-white cursor-pointer transition-colors mr-0.5"
                  title={isBn ? 'পিছনে যান' : 'Back to conversation list'}
                >
                  <ArrowLeft className="w-5 h-5 text-[#00897B]" />
                </button>

                <div className={`w-8 h-8 rounded-none font-bold text-xs flex items-center justify-center border ${
                  isDark 
                    ? 'bg-[#00897B]/20 text-[#26A69A] border-[#00897B]/40' 
                    : 'bg-[#00897B]/15 text-[#00897B] border-[#00897B]/30'
                }`}>
                  {activeConvo.type === 'group' ? <Users className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className={`font-bold text-xs sm:text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {getConvoTitle(activeConvo)}
                  </h3>
                  <span className={`text-[10px] font-mono flex items-center space-x-1 ${
                    isDark ? 'text-emerald-400' : 'text-emerald-700 font-semibold'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Hostinger VPS Realtime Connected</span>
                  </span>
                </div>
              </div>

              {/* VOICE CALL BUTTON */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleInitiateCall('audio')}
                  className="px-3.5 py-1.5 rounded-none bg-[#00897B] hover:bg-[#00796B] text-white text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
                  title={isBn ? 'ইন-সিস্টেম ভয়েস কল শুরু করুন' : 'Start Voice Call'}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{isBn ? 'ভয়েস কল' : 'Voice Call'}</span>
                </button>
              </div>
            </div>

            {/* MESSAGES THREAD CONTAINER */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-3.5 ${
              isDark ? 'bg-[#18181B]' : 'bg-slate-50/50'
            }`}>
              {activeMessages.map((msg) => {
                const isMe = msg.sender_id === currentUser.id;
                const isCallHistory = msg.content.startsWith('📞');

                if (isCallHistory) {
                  return (
                    <div key={msg.id} className="w-full flex justify-center my-2">
                      <div className={`px-4 py-2 rounded-none text-xs font-bold flex items-center space-x-2 border shadow-xs ${
                        isDark
                          ? 'bg-slate-900/90 border-[#00897B]/40 text-slate-200'
                          : 'bg-slate-100 border-[#00897B]/30 text-slate-800'
                      }`}>
                        <Phone className="w-3.5 h-3.5 text-[#00897B]" />
                        <span>{msg.content}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </span>
                      </div>
                    </div>
                  );
                }

                const imgSrc = msg.image_url || (msg.content.startsWith('data:image/') ? msg.content : null);
                const isTextOnly = !imgSrc;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`flex items-center space-x-1.5 mb-1 text-[10px] ${
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{msg.sender_name}</span>
                      <span>({msg.sender_role})</span>
                      <span>•</span>
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {isTextOnly ? (
                      <div
                        className={`max-w-md p-3 rounded-none text-xs leading-relaxed ${
                          isMe
                            ? 'bg-[#00897B] text-white font-medium shadow-xs'
                            : isDark
                              ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-xs'
                              : 'bg-white text-slate-900 border border-slate-300 shadow-xs'
                        }`}
                      >
                        {msg.content}
                      </div>
                    ) : (
                      <div
                        onClick={() => setPreviewImageUrl(imgSrc!)}
                        className="relative group overflow-hidden border-2 border-[#00897B] rounded-none shadow-md cursor-pointer max-w-xs sm:max-w-sm mt-0.5"
                      >
                        <img
                          src={imgSrc!}
                          alt="Chat Image Attachment"
                          className="max-h-64 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                        <div
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5"
                        >
                          <span>🔍</span>
                          <span>{isBn ? 'বড় করে দেখুন' : 'Click to View'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* MESSAGE INPUT FORM */}
            <form onSubmit={handleSendMessage} className={`p-3 border-t ${
              isDark ? 'border-slate-800 bg-[#121214]' : 'border-slate-200 bg-slate-100/90'
            }`}>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={isBn ? 'আপনার মেসেজ লিখুন...' : 'Type your message...'}
                  className={`flex-1 px-4 py-2.5 rounded-none border text-xs font-normal focus:ring-2 focus:ring-[#00897B] outline-none ${
                    isDark 
                      ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-500' 
                      : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                  }`}
                />

                {/* IMAGE ATTACHMENT BUTTON */}
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className={`p-2.5 rounded-none border transition-colors cursor-pointer flex items-center justify-center ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
                      : 'bg-white border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                  title={isBn ? 'ছবি আপলোড করুন' : 'Attach Image'}
                >
                  <ImageIcon className="w-4 h-4 text-[#00897B]" />
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-none bg-[#00897B] hover:bg-[#00796B] text-white font-bold text-xs transition-all shadow-md flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isBn ? 'পাঠান' : 'Send'}</span>
                </button>
              </div>
            </form>
          </>
        ) : (
          /* PLACEHOLDER WHEN NO CONVERSATION SELECTED */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className={`w-16 h-16 rounded-none flex items-center justify-center border shadow-inner ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-300'
            }`}>
              <MessageSquare className="w-8 h-8 text-[#00897B]" />
            </div>
            <div className="space-y-1">
              <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                একটি conversation select করুন
              </p>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                বা নতুন message শুরু করুন
              </p>
            </div>
          </div>
        )}

        {/* LIGHTBOX FULL IMAGE PREVIEW MODAL */}
        {previewImageUrl && (
          <div
            onClick={() => setPreviewImageUrl(null)}
            className="fixed inset-0 z-[3000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in"
          >
            <div className="relative max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setPreviewImageUrl(null)}
                className="absolute top-3 right-3 p-2 bg-slate-900/80 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg cursor-pointer z-10"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={previewImageUrl}
                alt="Full Preview"
                className="max-w-full max-h-[85vh] object-contain shadow-2xl border-2 border-[#00897B]"
              />
            </div>
          </div>
        )}
      </div>

      {/* SUPER ADMIN GROUP CREATION MODAL */}
      {showNewGroupModal && isSuperAdmin && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className={`w-full max-w-md border rounded-none p-6 shadow-2xl space-y-5 ${
            isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <h3 className={`text-sm font-bold flex items-center space-x-2 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                <Users className="w-4 h-4 text-[#00897B]" />
                <span>{isBn ? 'নতুন চ্যাট গ্রুপ তৈরি করুন (Super Admin Only)' : 'Create New Group'}</span>
              </h3>
              <button type="button" onClick={() => setShowNewGroupModal(false)} className="text-slate-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroupChat} className="space-y-4">
              <div>
                <label className={`text-xs font-semibold block mb-1 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  {isBn ? 'গ্রুপের নাম' : 'Group Name'}
                </label>
                <input
                  type="text"
                  required
                  value={groupNameInput}
                  onChange={(e) => setGroupNameInput(e.target.value)}
                  placeholder="e.g. Operation Management"
                  className={`w-full px-3 py-2 rounded-none border text-xs outline-none focus:ring-2 focus:ring-[#00897B] ${
                    isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className={`text-xs font-semibold block mb-1 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  {isBn ? 'সদস্য নির্বাচন করুন (Select Members)' : 'Select Members'}
                </label>
                <div className={`max-h-48 overflow-y-auto space-y-2 border rounded-none p-3 ${
                  isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-300 bg-slate-50'
                }`}>
                  {allUsers.map((u) => {
                    const isChecked = selectedUserIdsForGroup.includes(u.id);
                    return (
                      <label key={u.id} className={`flex items-center space-x-3 p-2 rounded-none cursor-pointer ${
                        isDark ? 'hover:bg-slate-900' : 'hover:bg-slate-200/70'
                      }`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIdsForGroup((prev) => [...prev, u.id]);
                            } else {
                              setSelectedUserIdsForGroup((prev) => prev.filter((id) => id !== u.id));
                            }
                          }}
                          className="rounded-none text-[#00897B] focus:ring-[#00897B]"
                        />
                        <div className="text-xs">
                          <div className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{u.name}</div>
                          <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{u.role} • {u.email}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewGroupModal(false)}
                  className={`px-4 py-2 rounded-none text-xs font-semibold ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                  }`}
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-none bg-[#00897B] hover:bg-[#00796B] text-xs font-bold text-white shadow-md cursor-pointer"
                >
                  {isBn ? 'গ্রুপ তৈরি করুন' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
