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
  Smile,
  Paperclip,
  CheckCheck,
  ShieldCheck,
  Building2,
  Lock,
} from 'lucide-react';
import { User, ChatConversation, ChatMessage, CallSession, Language } from '../../types';
import { getHostingerDbData, saveHostingerDbData, logSystemAuditAction } from '../../lib/db';
import { useTheme } from '../../context/ThemeContext';

interface SystemChatModalProps {
  currentUser: User;
  language: Language;
  isOpen: boolean;
  onClose: () => void;
}

export const SystemChatModal: React.FC<SystemChatModalProps> = ({
  currentUser,
  language,
  isOpen,
  onClose,
}) => {
  const isBn = language === 'bn';
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isSuperAdmin = currentUser.role === 'super_admin';

  // DB States
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Active Selected Conversation
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);

  // Input & Filter States
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showNewDirectModal, setShowNewDirectModal] = useState(false);

  // New Group Form State (Super Admin Only)
  const [groupNameInput, setGroupNameInput] = useState('');
  const [selectedUserIdsForGroup, setSelectedUserIdsForGroup] = useState<string[]>([]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Audio Chime generator for incoming messages
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

    if (!activeConvoId && myConvos.length > 0) {
      setActiveConvoId(myConvos[0].id);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeConvoId]);

  if (!isOpen) return null;

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

  // 2. Start Direct 1-on-1 Chat
  const handleStartDirectChat = (targetUser: User) => {
    const db = getHostingerDbData();
    const existingConvos: ChatConversation[] = db.conversations || [];

    // Check if direct convo already exists
    let existing = existingConvos.find(
      (c) =>
        c.type === 'direct' &&
        c.participants.includes(currentUser.id) &&
        c.participants.includes(targetUser.id)
    );

    if (!existing) {
      existing = {
        id: `convo-dir-${Date.now()}`,
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
    setShowNewDirectModal(false);
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

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in">
      <div className={`w-full max-w-5xl h-[85vh] rounded-2xl border shadow-2xl flex overflow-hidden ${
        isDark ? 'bg-[#1C1C1E] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* LEFT SIDEBAR: CONVERSATIONS LIST */}
        <div className="w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span>{isBn ? 'সিস্টেম লাইভ চ্যাট' : 'System Live Chat'}</span>
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNewDirectModal(true)}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-all shadow-2xs flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isBn ? 'ডাইরেক্ট চ্যাট' : 'Direct Chat'}</span>
              </button>

              {/* GROUP CREATION - RESTRICTED STRICTLY TO SUPER ADMIN */}
              {isSuperAdmin ? (
                <button
                  type="button"
                  onClick={() => setShowNewGroupModal(true)}
                  className="py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition-all shadow-2xs flex items-center justify-center space-x-1 cursor-pointer"
                  title={isBn ? 'নতুন চ্যাট গ্রুপ তৈরি করুন (Super Admin Only)' : 'Create Chat Group'}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>{isBn ? '+ গ্রুপ' : '+ Group'}</span>
                </button>
              ) : (
                <div
                  className="p-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-400 text-[10px] flex items-center space-x-1 cursor-not-allowed select-none"
                  title={isBn ? 'শুধুমাত্র সুপার এডমিন নতুন গ্রুপ তৈরি করতে পারবেন' : 'Super Admin Only Group Creation'}
                >
                  <Lock className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          </div>

          {/* CONVERSATIONS LIST */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-2 space-y-1">
            {conversations.map((convo) => {
              const isActive = convo.id === activeConvoId;
              const title = getConvoTitle(convo);
              return (
                <button
                  key={convo.id}
                  type="button"
                  onClick={() => setActiveConvoId(convo.id)}
                  className={`w-full p-3 rounded-xl text-left transition-all flex items-start space-x-3 cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className={`p-2.5 rounded-full shrink-0 font-bold text-xs flex items-center justify-center ${
                    isActive ? 'bg-white/20 text-white' : 'bg-blue-500/10 text-blue-500'
                  }`}>
                    {convo.type === 'group' ? <Users className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs truncate">{title}</span>
                      {convo.type === 'group' && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${isActive ? 'bg-white/20' : 'bg-slate-800 text-emerald-400'}`}>
                          Group
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] truncate mt-0.5 font-normal ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                      {convo.last_message || 'Start messaging...'}
                    </p>
                  </div>
                </button>
              );
            })}

            {conversations.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400 font-normal">
                {isBn ? 'কোনো চ্যাট কনভার্সেশন নেই! চ্যাট শুরু করতে উপরের বাটনে চাপুন।' : 'No chat conversations found.'}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT WORKSPACE: ACTIVE CHAT THREAD */}
        <div className="flex-1 flex flex-col bg-white dark:bg-[#1C1C1E]">
          {activeConvo ? (
            <>
              {/* CHAT HEADER BAR */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-full bg-blue-500/10 text-blue-500">
                    {activeConvo.type === 'group' ? <Users className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {getConvoTitle(activeConvo)}
                    </h3>
                    <span className="text-[10px] text-emerald-500 font-mono flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>{isBn ? 'সুরক্ষিত এনক্রিপ্টেড রিয়েল-টাইম চ্যাট' : 'Secured In-System Connection'}</span>
                    </span>
                  </div>
                </div>

                {/* CALL ACTION BUTTONS (VOICE & VIDEO) */}
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleInitiateCall('audio')}
                    className="p-2.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer hover:scale-105 active:scale-95"
                    title={isBn ? 'ইন-সিস্টেম অডিও কল শুরু করুন' : 'Start Voice Call'}
                  >
                    <Phone className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInitiateCall('video')}
                    className="p-2.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 transition-all cursor-pointer hover:scale-105 active:scale-95"
                    title={isBn ? 'ইন-সিস্টেম ভিডিও কল শুরু করুন' : 'Start Video Call'}
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* MESSAGES THREAD SCROLL AREA */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
                        className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                          isMe
                            ? 'bg-blue-600 text-white rounded-tr-none'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700'
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
              <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={isBn ? 'আপনার মেসেজ লিখুন...' : 'Type your message...'}
                    className={`flex-1 px-4 py-2.5 rounded-xl border text-xs font-normal focus:ring-2 focus:ring-blue-500 outline-none ${
                      isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <button
                    type="submit"
                    className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-all shadow-md flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-3">
              <MessageSquare className="w-12 h-12 text-slate-600" />
              <p className="text-sm font-medium">{isBn ? 'মেসেজিং শুরু করতে কোনো চ্যাট নির্বাচন করুন' : 'Select a conversation to start messaging'}</p>
            </div>
          )}
        </div>
      </div>

      {/* 5. SUPER ADMIN GROUP CREATION MODAL */}
      {showNewGroupModal && isSuperAdmin && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#1C1C1E] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b pb-3 border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>{isBn ? 'নতুন চ্যাট গ্রুপ তৈরি করুন (Super Admin Only)' : 'Create New Chat Group'}</span>
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
                  placeholder={isBn ? 'যেমন: ঢাকা ওয়্যারহাউজ অপারেশনস টিম' : 'e.g. Dhaka Warehouse Operations Team'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  {isBn ? 'সদস্য নির্বাচন করুন (Select Group Members)' : 'Select Members'}
                </label>
                <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-800 rounded-xl p-3 bg-slate-950">
                  {allUsers.map((u) => {
                    const isChecked = selectedUserIdsForGroup.includes(u.id);
                    return (
                      <label key={u.id} className="flex items-center space-x-3 p-2 rounded hover:bg-slate-900 cursor-pointer">
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
                          className="rounded text-emerald-600 focus:ring-emerald-500"
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
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-medium text-white shadow-md cursor-pointer"
                >
                  {isBn ? 'গ্রুপ তৈরি করুন' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. NEW DIRECT CHAT MODAL */}
      {showNewDirectModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#1C1C1E] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b pb-3 border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <UserIcon className="w-4 h-4 text-blue-400" />
                <span>{isBn ? 'ডাইরেক্ট মেসেজ শুরু করুন' : 'Start Direct Message'}</span>
              </h3>
              <button type="button" onClick={() => setShowNewDirectModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {allUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleStartDirectChat(u)}
                  className="w-full p-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-left flex items-center space-x-3 transition-colors cursor-pointer border border-slate-800"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 font-bold text-xs flex items-center justify-center">
                    {u.name[0]}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{u.name}</div>
                    <div className="text-[10px] text-slate-400">{u.role} • {u.email}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
