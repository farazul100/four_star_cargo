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
  Lock,
} from 'lucide-react';
import { User, ChatConversation, ChatMessage, CallSession, Language } from '../../types';
import { getHostingerDbData, saveHostingerDbData, logSystemAuditAction } from '../../lib/db';
import { useTheme } from '../../context/ThemeContext';

interface SystemChatPageProps {
  currentUser: User;
  language: Language;
}

export const SystemChatPage: React.FC<SystemChatPageProps> = ({ currentUser, language }) => {
  const isBn = language === 'bn';
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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

  // Input
  const [messageInput, setMessageInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

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

    // Filter conversations where current user is a participant
    const myConvos = convos.filter(
      (c) => Array.isArray(c.participants) && c.participants.includes(currentUser.id)
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

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeConvoId]);

  const activeConvo = conversations.find((c) => c.id === activeConvoId);
  const activeMessages = messages.filter((m) => m.conversation_id === activeConvoId);

  // Helper to format conversation title
  const getConvoTitle = (convo: ChatConversation) => {
    if (convo.type === 'group') {
      return convo.name || (isBn ? 'গ্রুপ চ্যাট' : 'Group Chat');
    }
    const otherUserId = convo.participants.find((id) => id !== currentUser.id);
    const otherUser = allUsers.find((u) => u.id === otherUserId);
    return otherUser ? `${otherUser.name} (${otherUser.role})` : isBn ? 'ইউজার চ্যাট' : 'Direct Message';
  };

  // 1. Send Message Handler
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

  // 2. Direct Chat with Any System User
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

  // 3. Create Group Chat (RESTRICTED STRICTLY TO SUPER ADMIN)
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

  // 4. Initiate Native WebRTC Voice or Video Call
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

  // Group conversations
  const groupConvos = conversations.filter((c) => c.type === 'group');

  return (
    <div className={`w-full h-[calc(100vh-3.5rem)] rounded-none border-0 shadow-none flex overflow-hidden ${
      isDark ? 'bg-[#18181B] text-white' : 'bg-white text-slate-900'
    }`}>
      {/* LEFT COLUMN: CHAT SIDEBAR (FULL HEIGHT & ZERO BORDER RADIUS) */}
      <div className="w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-100/70 dark:bg-[#121214] shrink-0">
        
        {/* Header Title & Search */}
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-[#00897B]" />
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">Chat</h2>
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
                isDark ? 'bg-slate-900 border-slate-800 text-white focus:border-[#00897B]' : 'bg-white border-slate-300 text-slate-900 focus:border-[#00897B]'
              }`}
            />
          </div>

          {/* Direct Message vs Groups Mode Tabs */}
          <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-900 p-1 rounded-none text-xs font-medium border border-slate-300 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTabMode('direct')}
              className={`flex-1 py-1.5 px-2 rounded-none transition-all text-[11px] flex items-center justify-center space-x-1 cursor-pointer ${
                activeTabMode === 'direct'
                  ? 'bg-[#00897B] text-white font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                ALL USERS ({filteredUsers.length})
              </div>

              <div className="space-y-0.5 mt-0.5">
                {filteredUsers.map((userItem) => {
                  const userConvo = conversations.find(
                    (c) => c.type === 'direct' && c.participants.includes(userItem.id)
                  );
                  const isActive = userConvo && userConvo.id === activeConvoId;
                  const initials = userItem.name
                    ? userItem.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
                    : 'US';

                  return (
                    <button
                      key={userItem.id}
                      type="button"
                      onClick={() => handleStartDirectChat(userItem)}
                      className={`w-full p-2.5 rounded-none text-left transition-all flex items-center space-x-3 cursor-pointer border-l-4 ${
                        isActive
                          ? 'bg-[#00897B]/15 border-[#00897B] text-[#00897B] dark:text-[#26A69A] font-semibold'
                          : 'hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-transparent'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-none bg-[#00897B]/20 text-[#00897B] dark:text-[#26A69A] font-bold text-xs flex items-center justify-center shrink-0 border border-[#00897B]/30">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {userItem.name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate capitalize">
                          {userItem.department || 'উত্তরা'} • {userItem.role.replace('_', ' ')}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No users found
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                GROUPS ({groupConvos.length})
              </div>

              <div className="space-y-0.5 mt-0.5">
                {groupConvos.map((convo) => {
                  const isActive = convo.id === activeConvoId;
                  return (
                    <button
                      key={convo.id}
                      type="button"
                      onClick={() => setActiveConvoId(convo.id)}
                      className={`w-full p-2.5 rounded-none text-left transition-all flex items-center space-x-3 cursor-pointer border-l-4 ${
                        isActive
                          ? 'bg-[#00897B]/15 border-[#00897B] text-[#00897B] dark:text-[#26A69A] font-semibold'
                          : 'hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-transparent'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-none shrink-0 font-bold text-xs flex items-center justify-center bg-[#00897B]/20 text-[#00897B] border border-[#00897B]/30">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate text-slate-900 dark:text-white">{convo.name || 'Group Chat'}</div>
                        <div className="text-[10px] truncate text-slate-400">
                          {convo.last_message || 'Group Chat'}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {groupConvos.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No groups available
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: ACTIVE THREAD OR PLACEHOLDER */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#18181B]">
        {activeConvo ? (
          <>
            {/* CHAT THREAD HEADER BAR */}
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-[#121214]">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-none bg-[#00897B]/20 text-[#00897B] font-bold text-xs flex items-center justify-center border border-[#00897B]/30">
                  {activeConvo.type === 'group' ? <Users className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                    {getConvoTitle(activeConvo)}
                  </h3>
                  <span className="text-[10px] text-emerald-500 font-mono flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Hostinger VPS Realtime Connected</span>
                  </span>
                </div>
              </div>

              {/* VOICE & VIDEO CALL BUTTONS */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleInitiateCall('audio')}
                  className="px-3 py-1.5 rounded-none bg-[#00897B] hover:bg-[#00796B] text-white text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
                  title={isBn ? 'ইন-সিস্টেম অডিও কল শুরু করুন' : 'Start Voice Call'}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{isBn ? 'ভয়েস কল' : 'Voice Call'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleInitiateCall('video')}
                  className="px-3 py-1.5 rounded-none bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
                  title={isBn ? 'ইন-সিস্টেম ভিডিও কল শুরু করুন' : 'Start Video Call'}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>{isBn ? 'ভিডিও কল' : 'Video Call'}</span>
                </button>
              </div>
            </div>

            {/* MESSAGES THREAD CONTAINER */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {activeMessages.map((msg) => {
                const isMe = msg.sender_id === currentUser.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center space-x-1.5 mb-1 text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{msg.sender_name}</span>
                      <span>({msg.sender_role})</span>
                      <span>•</span>
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div
                      className={`max-w-md p-3 rounded-none text-xs leading-relaxed ${
                        isMe
                          ? 'bg-[#00897B] text-white font-medium shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* MESSAGE INPUT FORM */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#121214]">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={isBn ? 'আপনার মেসেজ লিখুন...' : 'Type your message...'}
                  className={`flex-1 px-4 py-2.5 rounded-none border text-xs font-normal focus:ring-2 focus:ring-[#00897B] outline-none ${
                    isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-none bg-[#00897B] hover:bg-[#00796B] text-white font-semibold text-xs transition-all shadow-md flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isBn ? 'পাঠান' : 'Send'}</span>
                </button>
              </div>
            </form>
          </>
        ) : (
          /* PLACEHOLDER WHEN NO CONVERSATION SELECTED */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-4">
            <div className="w-16 h-16 rounded-none bg-slate-100 dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-inner">
              <MessageSquare className="w-8 h-8 text-[#00897B]" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                একটি conversation select করুন
              </p>
              <p className="text-xs text-slate-400">
                বা নতুন message শুরু করুন
              </p>
            </div>
          </div>
        )}
      </div>

      {/* SUPER ADMIN GROUP CREATION MODAL */}
      {showNewGroupModal && isSuperAdmin && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#1C1C1E] border border-slate-800 rounded-none p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b pb-3 border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Users className="w-4 h-4 text-[#00897B]" />
                <span>{isBn ? 'নতুন চ্যাট গ্রুপ তৈরি করুন (Super Admin Only)' : 'Create New Group'}</span>
              </h3>
              <button type="button" onClick={() => setShowNewGroupModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroupChat} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  {isBn ? 'গ্রুপের নাম' : 'Group Name'}
                </label>
                <input
                  type="text"
                  required
                  value={groupNameInput}
                  onChange={(e) => setGroupNameInput(e.target.value)}
                  placeholder="e.g. Operation Management"
                  className="w-full px-3 py-2 rounded-none bg-slate-900 border border-slate-800 text-xs text-white outline-none focus:ring-2 focus:ring-[#00897B]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  {isBn ? 'সদস্য নির্বাচন করুন (Select Members)' : 'Select Members'}
                </label>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-800 rounded-none p-3 bg-slate-950">
                  {allUsers.map((u) => {
                    const isChecked = selectedUserIdsForGroup.includes(u.id);
                    return (
                      <label key={u.id} className="flex items-center space-x-3 p-2 rounded-none hover:bg-slate-900 cursor-pointer">
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
                          <div className="font-semibold text-white">{u.name}</div>
                          <div className="text-[10px] text-slate-400">{u.role} • {u.email}</div>
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
                  className="px-4 py-2 rounded-none bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-none bg-[#00897B] hover:bg-[#00796B] text-xs font-semibold text-white shadow-md cursor-pointer"
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
