import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Image as ImageIcon, CheckCircle2, User, ShieldCheck, Minimize2 } from 'lucide-react';
import { ChatMessage, ChatConversation, Language } from '../types';
import { getHostingerDbData, saveHostingerDbData, subscribeToDbUpdates } from '../lib/db';
import { compressImageFile } from '../utils/imageCompressor';

interface PublicCustomerChatWidgetProps {
  language: Language;
}

export const PublicCustomerChatWidget: React.FC<PublicCustomerChatWidgetProps> = ({ language }) => {
  const isBn = language === 'bn';
  const [isOpen, setIsOpen] = useState(false);

  // Guest Identity in localStorage
  const [guestName, setGuestName] = useState<string>(() => localStorage.getItem('fsc_public_guest_name') || '');
  const [guestPhone, setGuestPhone] = useState<string>(() => localStorage.getItem('fsc_public_guest_phone') || '');
  const [convoId, setConvoId] = useState<string>(() => localStorage.getItem('fsc_public_convo_id') || '');

  const [inputName, setInputName] = useState('');
  const [inputPhone, setInputPhone] = useState('');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Sound Chime generator for incoming company reply
  const playIncomingChime = () => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  };

  // Sync and load messages for this customer's conversation ID
  useEffect(() => {
    if (!convoId) return;

    const loadConvoMessages = () => {
      const db = getHostingerDbData();
      const allMsgs: ChatMessage[] = db.messages || [];
      const filtered = allMsgs.filter((m) => m.conversation_id === convoId);

      setMessages((prevMsgs) => {
        if (filtered.length > prevMsgs.length && prevMsgs.length > 0) {
          const lastMsg = filtered[filtered.length - 1];
          if (lastMsg.sender_id !== 'guest-user') {
            playIncomingChime();
          }
        }
        return filtered;
      });
    };

    loadConvoMessages();
    return subscribeToDbUpdates(loadConvoMessages);
  }, [convoId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Handle Initial Registration Form
  const handleStartChat = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = inputName.trim();
    if (!cleanName) return;

    const newConvoId = `convo-public-${Date.now()}-${Math.floor(Math.random() * 8999 + 1000)}`;

    // Save to localStorage
    localStorage.setItem('fsc_public_guest_name', cleanName);
    localStorage.setItem('fsc_public_guest_phone', inputPhone.trim());
    localStorage.setItem('fsc_public_convo_id', newConvoId);

    setGuestName(cleanName);
    setGuestPhone(inputPhone.trim());
    setConvoId(newConvoId);

    // Save initial support conversation object in Central Hostinger DB
    const db = getHostingerDbData();
    const currentConvos: ChatConversation[] = db.conversations || [];

    const newConvo: ChatConversation = {
      id: newConvoId,
      name: `💬 ${cleanName} ${inputPhone.trim() ? `(${inputPhone.trim()})` : ''}`,
      type: 'customer_support',
      participants: ['guest-user', 'all_staff'],
      created_by: 'guest-user',
      created_at: new Date().toISOString(),
      last_message: 'Customer started support inquiry',
    };

    saveHostingerDbData('fsc_vps_conversations', [newConvo, ...currentConvos]);

    // Send Welcome Message from System
    const welcomeMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      conversation_id: newConvoId,
      sender_id: 'system_company',
      sender_name: 'Four Star Cargo Support',
      sender_role: 'super_admin',
      content: isBn
        ? `আসসালামু আলাইকুম ${cleanName}! M/S Four Star Cargo লাইভ সাপোর্টে আপনাকে স্বাগতম। আপনার পণ্য বা সেবা সংক্রান্ত যেকোনো প্রশ্ন এখানে লিখুন, আমাদের টিম আপনাকে দ্রুত উত্তর দেবে।`
        : `Hello ${cleanName}! Welcome to Four Star Cargo Live Support. How may we assist you with your cargo shipment today?`,
      created_at: new Date().toISOString(),
    };

    saveHostingerDbData('fsc_vps_messages', [...(db.messages || []), welcomeMsg]);
  };

  // Handle Sending Message
  const handleSendMessage = (imageUrl?: string) => {
    if (!messageInput.trim() && !imageUrl) return;
    if (!convoId) return;

    const db = getHostingerDbData();
    const currentMsgs: ChatMessage[] = db.messages || [];
    const currentConvos: ChatConversation[] = db.conversations || [];

    const textContent = imageUrl ? '' : messageInput.trim();

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      conversation_id: convoId,
      sender_id: 'guest-user',
      sender_name: guestName || 'Customer',
      sender_role: 'crm_executive', // generic role signature for DB schema compatibility
      content: textContent,
      image_url: imageUrl,
      created_at: new Date().toISOString(),
    };

    const updatedMsgs = [...currentMsgs, newMsg];
    saveHostingerDbData('fsc_vps_messages', updatedMsgs);

    // Update conversation last_message & last_message_at
    const updatedConvos = currentConvos.map((c) => {
      if (c.id === convoId) {
        return {
          ...c,
          last_message: messageInput.trim() || '📷 Photo attachment',
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });

    saveHostingerDbData('fsc_vps_conversations', updatedConvos);
    setMessageInput('');

    // Trigger real-time browser event for staff tabs
    try {
      window.dispatchEvent(new Event('fsc_db_updated'));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
  };

  // Handle Image Upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImageFile(file, { maxWidth: 800, quality: 0.7 });
      handleSendMessage(compressed);
    } catch (err) {
      console.error('Image compression failed', err);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[3000] font-sans">
      {/* Floating Chat Toggle Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="px-5 py-3.5 bg-gradient-to-r from-[#00897B] to-[#1FB6A8] hover:from-[#1FB6A8] hover:to-[#00796B] text-white font-bold text-xs rounded-full shadow-2xl hover:shadow-[#00897B]/40 transition-all flex items-center space-x-3 cursor-pointer group transform hover:scale-105 border-2 border-white/20"
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
          </div>
          <span>{isBn ? 'লাইভ সাপোর্ট চ্যাট' : 'Live Support Chat'}</span>
        </button>
      )}

      {/* Floating Support Chat Drawer / Window */}
      {isOpen && (
        <div className="w-[360px] sm:w-[400px] h-[520px] bg-slate-900 border-2 border-[#00897B] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 duration-300">
          {/* Header Bar */}
          <div className="p-4 bg-gradient-to-r from-[#0F2D52] to-[#00897B] border-b border-[#00897B]/40 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-white text-[#00897B] flex items-center justify-center font-black text-lg shadow-md border border-white/30">
                4★
              </div>
              <div>
                <h3 className="text-xs font-bold font-poppins flex items-center space-x-1.5">
                  <span>M/S FOUR STAR CARGO</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                </h3>
                <p className="text-[10px] text-teal-100 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{isBn ? 'অফিশিয়াল সাপোর্ট (অনলাইন)' : 'Official Helpdesk (Online)'}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Form State (If user has not set their name yet) */}
          {!guestName ? (
            <div className="flex-1 p-6 bg-slate-950 flex flex-col justify-center space-y-5 text-white">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-[#00897B]/20 text-[#1FB6A8] flex items-center justify-center mx-auto border border-[#00897B]/40">
                  <User className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold">
                  {isBn ? 'সাপোর্টে কথা বলতে আপনার নাম দিন' : 'Start Live Support Chat'}
                </h4>
                <p className="text-xs text-slate-400">
                  {isBn
                    ? 'আপনার নাম প্রদান করে সরাসরি কোম্পানি প্রতিনিধির সাথে মেসেজ শুরু করুন'
                    : 'Enter your name to connect directly with Four Star Cargo Support.'}
                </p>
              </div>

              <form onSubmit={handleStartChat} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    {isBn ? 'আপনার নাম *' : 'Your Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    placeholder={isBn ? 'উদাহরণ: মোঃ রহমত উল্লাহ' : 'e.g. Rahmat Ullah'}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-[#00897B] rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-slate-500 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    {isBn ? 'ফোন / ট্র্যাকিং নম্বর (ঐচ্ছিক)' : 'Phone or Tracking ID (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={inputPhone}
                    onChange={(e) => setInputPhone(e.target.value)}
                    placeholder={isBn ? '01700000000 বা EXP-994801' : '01700000000 or EXP-994801'}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-[#00897B] rounded-xl py-2.5 px-3.5 text-xs text-white placeholder-slate-500 outline-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#00897B] hover:bg-[#00796B] text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{isBn ? 'চ্যাট শুরু করুন' : 'Start Chatting Now'}</span>
                </button>
              </form>
            </div>
          ) : (
            /* Active Live Support Thread */
            <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-500">
                    {isBn ? 'বার্তা লিখতে নিচে টাইপ করুন...' : 'Type your inquiry below...'}
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.sender_id === 'guest-user';

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                      >
                        <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                          <span>{isMe ? 'আপনি (You)' : 'M/S Four Star Cargo'}</span>
                        </div>

                        <div
                          className={`max-w-[82%] p-3 rounded-2xl text-xs space-y-2 leading-relaxed ${
                            isMe
                              ? 'bg-[#00897B] text-white rounded-tr-none shadow-md'
                              : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
                          }`}
                        >
                          {(m.image_url || m.content?.startsWith('data:image/')) && (
                            <img
                              src={m.image_url || m.content}
                              alt="Attachment"
                              className="max-h-48 w-full object-cover rounded-xl border border-white/20 shadow-md"
                            />
                          )}
                          {m.content && !m.content.startsWith('data:image/') && (
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          )}
                        </div>

                        <span className="text-[9px] text-slate-500 font-mono">
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Form Footer */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="p-3 bg-slate-900 border-t border-slate-800 flex items-center space-x-2 shrink-0"
              >
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="p-2 text-slate-400 hover:text-[#1FB6A8] transition-colors cursor-pointer rounded-xl hover:bg-slate-800"
                  title="Attach Photo"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={isBn ? 'আপনার মেসেজ লিখুন...' : 'Type a message...'}
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-[#00897B] rounded-xl py-2 px-3 text-xs text-white placeholder-slate-500 outline-none transition-colors"
                />

                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  className={`p-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    messageInput.trim()
                      ? 'bg-[#00897B] hover:bg-[#00796B] text-white shadow-md'
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
