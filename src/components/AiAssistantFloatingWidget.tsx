import React, { useState, useEffect, useRef } from 'react';
import { Send, X, Bot, Sparkles, MessageSquare, Minimize2, RefreshCw } from 'lucide-react';
import { User, Language } from '../types';
import { Logo } from './Logo';
import { askFourStarCargoAI, ChatMessageItem } from '../services/aiAssistantService';
import { useTheme } from '../context/ThemeContext';

interface AiAssistantFloatingWidgetProps {
  currentUser?: User | null;
  language: Language;
}

export const AiAssistantFloatingWidget: React.FC<AiAssistantFloatingWidgetProps> = ({
  currentUser,
  language,
}) => {
  const isBn = language === 'bn';
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Sound chime when AI responds
  const playAiChime = () => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1000, now + 0.12);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  };

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  const handleSend = async (customPrompt?: string) => {
    const query = (customPrompt || inputQuery).trim();
    if (!query || loading) return;

    const userMsg: ChatMessageItem = { role: 'user', content: query };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInputQuery('');
    setLoading(true);

    const res = await askFourStarCargoAI(query, messages, currentUser);
    setLoading(false);

    const aiMsg: ChatMessageItem = { role: 'model', content: res.text };
    setMessages([...updatedHistory, aiMsg]);
    if (res.success) {
      playAiChime();
    }
  };

  const handleQuickChipClick = (chipText: string) => {
    handleSend(chipText);
  };

  const quickChips = [
    {
      label: isBn ? '📦 আমার কার্টুনগুলো এখন কোথায় আছে?' : '📦 Where are my cartons located?',
      prompt: isBn ? 'আমার কার্টুনগুলোর বর্তমান অবস্থান এবং কোনটা কোথায় আছে বল।' : 'Where are my cartons located right now?',
    },
    {
      label: isBn ? '✈️ ফ্লাইটে মোট কয়টা কার্টুন আছে?' : '✈️ How many cartons are in-transit flying?',
      prompt: isBn ? 'বর্তমানে ফ্লাইটে (ইন-ট্রানজিটে) মোট কতটি কার্টুন এবং কি কি ফ্লাইট আছে?' : 'How many cartons are currently in-transit flying?',
    },
    {
      label: isBn ? '💰 আমার হিসাব ও লেজার কালেকশন' : '💰 My financial ledger & collection summary',
      prompt: isBn ? 'আমার হিসাব, মোট লেজার এবং কালেকশনের বিস্তারিত তথ্য বল।' : 'Show me financial ledger and collection summary.',
    },
    {
      label: isBn ? '🏬 ঢাকা ও গুয়াংজু ওয়্যারহাউজ অ্যাড্রেস' : '🏬 Warehouse Hub Addresses',
      prompt: isBn ? 'ঢাকা এবং গুয়াংজু ওয়্যারহাউজ এর ঠিকানা ও বুকিং পদ্ধতি বল।' : 'What are the addresses of Guangzhou and Dhaka warehouse hubs?',
    },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* Floating Logo Button Trigger */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="relative group p-1.5 rounded-full bg-slate-900 border-2 border-[#00897B] shadow-2xl hover:shadow-[#00897B]/50 transition-all duration-300 transform hover:scale-110 cursor-pointer flex items-center justify-center"
          title={isBn ? 'Four Star Cargo AI Copilot' : 'Four Star Cargo AI Assistant'}
        >
          {/* Outer Glowing Pulse Ring */}
          <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#00897B] to-[#1FB6A8] opacity-75 blur-sm group-hover:opacity-100 transition duration-300 animate-pulse" />
          
          <div className="relative w-12 h-12 rounded-full bg-slate-950 flex items-center justify-center p-2 overflow-hidden border border-white/20">
            <Logo size="sm" />
          </div>

          {/* Active Online AI Indicator Badge */}
          <span className="absolute top-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
          </span>
        </button>
      )}

      {/* Floating AI Copilot Drawer / Window */}
      {isOpen && (
        <div className="w-[360px] sm:w-[410px] h-[540px] bg-slate-950 border-2 border-[#00897B] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 duration-300 text-white">
          {/* Header Bar */}
          <div className="p-4 bg-gradient-to-r from-[#0F2D52] via-[#00897B] to-[#00796B] border-b border-[#00897B]/40 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-white/30 p-1 flex items-center justify-center shadow-md overflow-hidden shrink-0">
                <Logo size="sm" />
              </div>
              <div>
                <h3 className="text-xs font-bold font-poppins flex items-center space-x-1.5">
                  <span>Four Star Cargo AI</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-mono border border-emerald-500/40">
                    COPILOT
                  </span>
                </h3>
                <p className="text-[10px] text-teal-100 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{isBn ? 'আপনার পার্সোনাল এআই সহকারী' : 'Your Cargo Operations Copilot'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  className="p-1.5 rounded-full hover:bg-white/20 text-teal-100 transition-colors cursor-pointer"
                  title={isBn ? 'নতুন চ্যাট শুরু করুন' : 'Clear Chat'}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#080E17]">
            {messages.length === 0 ? (
              /* Welcome Screen with Centered Logo & Suggestion Chips */
              <div className="flex flex-col items-center justify-center h-full text-center space-y-5 py-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-3xl bg-slate-900 border-2 border-[#00897B]/50 p-3 shadow-xl flex items-center justify-center mx-auto">
                    <Logo size="lg" />
                  </div>
                  <span className="absolute -top-1 -right-1 p-1 bg-[#00897B] rounded-full text-white shadow-md">
                    <Sparkles className="w-3.5 h-3.5" />
                  </span>
                </div>

                <div className="space-y-1.5 px-4">
                  <h4 className="text-sm font-black font-poppins text-white">
                    Four Star Cargo AI Assistant
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {isBn
                      ? 'আমি আপনার কার্টুন, ফ্লাইট, হিসাব ও সার্ভিস সংক্রান্ত সকল প্রশ্নের উত্তর দিতে পারি।'
                      : 'I can answer all your inquiries regarding cartons, flying status, accounts & services.'}
                  </p>
                </div>

                {/* 4 Quick Suggestion Chips */}
                <div className="w-full space-y-2 pt-2">
                  {quickChips.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuickChipClick(chip.prompt)}
                      className="w-full p-3 rounded-2xl bg-slate-900/90 hover:bg-[#00897B]/20 border border-slate-800 hover:border-[#00897B]/50 text-left text-xs text-slate-200 transition-all duration-200 flex items-center justify-between group cursor-pointer"
                    >
                      <span className="font-medium group-hover:text-[#1FB6A8] transition-colors">
                        {chip.label}
                      </span>
                      <Sparkles className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#00897B] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Conversation Messages Thread */
              messages.map((m, index) => {
                const isUser = m.role === 'user';

                return (
                  <div
                    key={index}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                  >
                    <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1.5 px-1">
                      {!isUser && (
                        <div className="w-4 h-4 rounded-full bg-[#00897B] flex items-center justify-center text-[8px] font-bold text-white">
                          AI
                        </div>
                      )}
                      <span>{isUser ? (isBn ? 'আপনি (You)' : 'You') : 'Four Star Cargo AI'}</span>
                    </div>

                    <div
                      className={`max-w-[88%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                        isUser
                          ? 'bg-[#00897B] text-white rounded-tr-none shadow-md font-medium'
                          : 'bg-slate-900 text-slate-100 rounded-tl-none border border-slate-800 shadow-md whitespace-pre-wrap'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })
            )}

            {/* AI Typing Indicator */}
            {loading && (
              <div className="flex flex-col items-start space-y-1">
                <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1.5 px-1">
                  <div className="w-4 h-4 rounded-full bg-[#00897B] flex items-center justify-center text-[8px] font-bold text-white">
                    AI
                  </div>
                  <span>Four Star Cargo AI</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-900 text-slate-300 rounded-tl-none border border-slate-800 flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-[#00897B] animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-[#00897B] animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 rounded-full bg-[#00897B] animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[11px] text-slate-400 ml-1">
                    {isBn ? 'উত্তর তৈরি হচ্ছে...' : 'Analyzing database...'}
                  </span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Footer Input Bar */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0 space-y-1.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder={isBn ? 'প্রশ্ন লিখুন...' : 'Type your cargo query...'}
                className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-700 focus:border-[#00897B] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!inputQuery.trim() || loading}
                className="p-2.5 rounded-xl bg-gradient-to-r from-[#00897B] to-[#1FB6A8] hover:from-[#1FB6A8] hover:to-[#00796B] disabled:opacity-40 text-white shadow-md transition-all cursor-pointer disabled:cursor-not-allowed shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="text-center text-[9px] text-slate-500 font-mono">
              Powered by Four Star Cargo AI • {isBn ? 'রিয়েল-টাইম ডাটা সিঙ্ক' : 'Realtime Data Sync'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
