import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, ShieldCheck } from 'lucide-react';
import Peer, { MediaConnection } from 'peerjs';
import { User, CallSession, Language, ChatMessage, ChatConversation } from '../../types';
import { getHostingerDbData, saveHostingerDbData, logSystemAuditAction } from '../../lib/db';

interface SystemCallOverlayProps {
  currentUser: User;
  language: Language;
  theme?: 'light' | 'dark';
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
};

// Helper to sanitize peer ID string
const getPeerIdForUser = (userId: string) => {
  return `fsc-user-${userId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
};

// Record Call History System Message into Chat Thread
const recordCallHistoryMessage = (
  call: CallSession,
  isBn: boolean,
  durationSecs: number = 0,
  type: 'ended' | 'missed' | 'rejected' = 'ended'
) => {
  try {
    const db = getHostingerDbData();
    const messages: ChatMessage[] = db.messages || [];

    const formatTimeStr = (secs: number) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    let contentText = '';
    if (type === 'ended') {
      contentText = isBn
        ? `📞 ভয়েস কল সম্পন্ন (সময়কাল: ${formatTimeStr(durationSecs)})`
        : `📞 Voice call ended (Duration: ${formatTimeStr(durationSecs)})`;
    } else if (type === 'rejected') {
      contentText = isBn ? `📞 প্রত্যাখ্যানকৃত ভয়েস কল` : `📞 Voice call declined`;
    } else {
      contentText = isBn ? `📞 মিসড ভয়েস কল` : `📞 Missed voice call`;
    }

    const callMsg: ChatMessage = {
      id: `msg-call-${Date.now()}`,
      conversation_id: call.conversation_id,
      sender_id: call.caller_id,
      sender_name: call.caller_name,
      sender_role: call.caller_role || 'operation_director',
      content: contentText,
      created_at: new Date().toISOString(),
      read_by: [call.caller_id],
    };

    saveHostingerDbData('fsc_vps_messages', [...messages, callMsg]);

    const conversations: ChatConversation[] = db.conversations || [];
    const updatedConvos = conversations.map((c) =>
      c.id === call.conversation_id
        ? { ...c, last_message: contentText, last_message_at: callMsg.created_at }
        : c
    );
    saveHostingerDbData('fsc_vps_conversations', updatedConvos);
  } catch (e) {
    console.warn('Call history record warning:', e);
  }
};

export const SystemCallOverlay: React.FC<SystemCallOverlayProps> = ({ currentUser, language, theme = 'dark' }) => {
  const isBn = language === 'bn';
  const isDark = theme === 'dark';
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // PeerJS & Audio Element Refs
  const peerRef = useRef<Peer | null>(null);
  const mediaConnectionRef = useRef<MediaConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const endedCallIdsRef = useRef<Set<string>>(new Set());

  // Pending incoming PeerJS call reference
  const incomingMediaConnectionRef = useRef<MediaConnection | null>(null);

  // Sound generator for incoming call ringtone chime
  const ringtoneAudioCtxRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<number | null>(null);

  const playRingtone = () => {
    try {
      if (ringtoneIntervalRef.current) return;
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      ringtoneAudioCtxRef.current = ctx;

      const triggerTone = () => {
        if (!ctx || ctx.state === 'closed') return;
        if (ctx.state === 'suspended') ctx.resume();
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.value = 520;
        osc2.type = 'sine';
        osc2.frequency.value = 660;

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.85, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.98);
        osc2.stop(now + 0.98);
      };

      triggerTone();
      ringtoneIntervalRef.current = window.setInterval(triggerTone, 1400);
    } catch (e) {}
  };

  const stopRingtone = () => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    if (ringtoneAudioCtxRef.current) {
      try {
        ringtoneAudioCtxRef.current.close();
      } catch (e) {}
      ringtoneAudioCtxRef.current = null;
    }
  };

  const stopWebRTC = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (mediaConnectionRef.current) {
      try {
        mediaConnectionRef.current.close();
      } catch (e) {}
      mediaConnectionRef.current = null;
    }
    if (incomingMediaConnectionRef.current) {
      try {
        incomingMediaConnectionRef.current.close();
      } catch (e) {}
      incomingMediaConnectionRef.current = null;
    }
  };

  // Attach remote stream to audio player element
  const attachRemoteAudioStream = (stream: MediaStream) => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.volume = 1.0;
      remoteAudioRef.current.muted = false;
      remoteAudioRef.current.play().catch((err) => {
        console.warn('Audio play warning:', err);
      });
    }
  };

  // 1. Initialize PeerJS engine for current user
  useEffect(() => {
    const myPeerId = getPeerIdForUser(currentUser.id);
    const peer = new Peer(myPeerId, {
      config: ICE_SERVERS,
      debug: 1,
    });

    peerRef.current = peer;

    // Listen for incoming call via PeerJS cloud
    peer.on('call', (incomingCall) => {
      incomingMediaConnectionRef.current = incomingCall;

      incomingCall.on('stream', (remoteStream) => {
        attachRemoteAudioStream(remoteStream);
      });

      incomingCall.on('close', () => {
        stopRingtone();
        stopWebRTC();
        setActiveCall(null);
      });
    });

    return () => {
      stopRingtone();
      stopWebRTC();
      try {
        peer.destroy();
      } catch (e) {}
    };
  }, [currentUser.id]);

  // 2. Poll DB for call session changes (Initiate call & Sync active status)
  useEffect(() => {
    const checkCalls = async () => {
      const db = getHostingerDbData();
      const calls: CallSession[] = db.calls || [];

      const myCall = calls.find(
        (c) =>
          (c.target_user_id === currentUser.id || c.caller_id === currentUser.id) &&
          c.status !== 'ended' &&
          c.status !== 'rejected' &&
          !endedCallIdsRef.current.has(c.id)
      );

      if (myCall) {
        setActiveCall(myCall);

        const isCaller = myCall.caller_id === currentUser.id;

        // CALLER LOGIC
        if (myCall.status === 'ringing') {
          if (!isCaller) {
            playRingtone();
          } else {
            // Caller starts PeerJS call to Target User
            if (!mediaConnectionRef.current && peerRef.current && myCall.target_user_id) {
              try {
                const stream = await navigator.mediaDevices.getUserMedia({
                  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                  video: false,
                });
                localStreamRef.current = stream;

                const targetPeerId = getPeerIdForUser(myCall.target_user_id);
                const call = peerRef.current.call(targetPeerId, stream);
                mediaConnectionRef.current = call;

                call.on('stream', (remoteStream) => {
                  attachRemoteAudioStream(remoteStream);
                });

                call.on('close', () => {
                  stopRingtone();
                  stopWebRTC();
                  setActiveCall(null);
                });
              } catch (err) {
                console.warn('Caller mic access warning:', err);
              }
            }
          }
        }

        // ACTIVE STATE LOGIC
        if (myCall.status === 'active') {
          stopRingtone();
        }
      } else {
        stopRingtone();
        stopWebRTC();
        if (activeCall) {
          setActiveCall(null);
          setCallDuration(0);
        }
      }
    };

    checkCalls();
    window.addEventListener('fsc_db_updated', checkCalls);
    window.addEventListener('storage', checkCalls);
    return () => {
      stopRingtone();
      window.removeEventListener('fsc_db_updated', checkCalls);
      window.removeEventListener('storage', checkCalls);
    };
  }, [currentUser.id, activeCall?.id, activeCall?.status]);

  // Duration Timer for active call
  useEffect(() => {
    let timer: any;
    if (activeCall && activeCall.status === 'active') {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeCall?.status]);

  // Recipient Accepts Call
  const handleAcceptCall = async () => {
    if (!activeCall) return;
    stopRingtone();

    // 1. Mark status active in DB & state FIRST unconditionally
    const db = getHostingerDbData();
    const updatedCalls = (db.calls || []).map((c: CallSession) =>
      c.id === activeCall.id ? { ...c, status: 'active' as const } : c
    );
    saveHostingerDbData('fsc_vps_calls', updatedCalls);
    setActiveCall({ ...activeCall, status: 'active' });

    // Immediate cross-tab/server trigger
    window.dispatchEvent(new CustomEvent('fsc_db_updated', { detail: { key: 'fsc_vps_calls' } }));

    logSystemAuditAction(currentUser, 'CALL_ACCEPTED', 'CALL', activeCall.id, `Accepted voice call from ${activeCall.caller_name}`);

    // 2. Answer incoming PeerJS call with local mic stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      localStreamRef.current = stream;

      if (incomingMediaConnectionRef.current) {
        incomingMediaConnectionRef.current.answer(stream);
        mediaConnectionRef.current = incomingMediaConnectionRef.current;
      }
    } catch (err) {
      console.warn('Accept call mic error:', err);
    }
  };

  // Decline/Reject Call
  const handleRejectCall = () => {
    if (!activeCall) return;
    endedCallIdsRef.current.add(activeCall.id);
    stopRingtone();
    stopWebRTC();

    const db = getHostingerDbData();
    const updatedCalls = (db.calls || []).map((c: CallSession) =>
      c.id === activeCall.id ? { ...c, status: 'rejected' as const } : c
    );
    saveHostingerDbData('fsc_vps_calls', updatedCalls);

    // Record Call History in Chat Thread
    recordCallHistoryMessage(activeCall, isBn, 0, 'rejected');

    setActiveCall(null);
    setCallDuration(0);
    logSystemAuditAction(currentUser, 'CALL_REJECTED', 'CALL', activeCall.id, `Declined voice call from ${activeCall.caller_name}`);
  };

  // End Active Call
  const handleEndCall = () => {
    if (!activeCall) return;
    endedCallIdsRef.current.add(activeCall.id);
    stopRingtone();
    stopWebRTC();

    const db = getHostingerDbData();
    const updatedCalls = (db.calls || []).map((c: CallSession) =>
      c.id === activeCall.id ? { ...c, status: 'ended' as const } : c
    );
    saveHostingerDbData('fsc_vps_calls', updatedCalls);

    // Record Call History in Chat Thread
    recordCallHistoryMessage(activeCall, isBn, callDuration, callDuration > 0 ? 'ended' : 'missed');

    setActiveCall(null);
    setCallDuration(0);
    logSystemAuditAction(currentUser, 'CALL_ENDED', 'CALL', activeCall.id, `Ended voice call. Duration: ${callDuration}s`);
  };

  // Toggle Mute Microphone
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // Format Duration seconds as mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!activeCall) return null;

  const isIncoming = activeCall.target_user_id === currentUser.id && activeCall.status === 'ringing';
  const isOutgoing = activeCall.caller_id === currentUser.id && activeCall.status === 'ringing';
  const isConnected = activeCall.status === 'active';

  return (
    <>
      {/* Offscreen Remote Audio Player - Prevents browser autoplay muting */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: '1px', height: '1px', opacity: 0.01 }}
      />

      {/* 1. INCOMING VOICE CALL MODAL (CENTERED & THEMED) */}
      {isIncoming && (
        <div className={`fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-in fade-in ${
          isDark ? 'bg-slate-950/85 backdrop-blur-md' : 'bg-slate-900/40 backdrop-blur-md'
        }`}>
          <div className={`w-full max-w-sm rounded-none p-6 shadow-2xl text-center space-y-5 relative overflow-hidden ${
            isDark
              ? 'bg-[#121214] border-2 border-[#00897B]/50 text-white'
              : 'bg-white border-2 border-[#00897B] text-slate-900 shadow-slate-400/30'
          }`}>
            <div className={`absolute -top-16 -left-16 w-32 h-32 rounded-full blur-2xl pointer-events-none ${
              isDark ? 'bg-[#00897B]/20' : 'bg-[#00897B]/15'
            }`}></div>

            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[#00897B]/30 animate-ping opacity-75"></div>
              <div className={`w-16 h-16 rounded-full font-bold text-lg flex items-center justify-center border relative z-10 shadow-lg ${
                isDark
                  ? 'bg-[#00897B]/20 text-[#26A69A] border-[#00897B]'
                  : 'bg-[#00897B]/10 text-[#00897B] border-[#00897B]'
              }`}>
                <Phone className="w-8 h-8 animate-bounce" />
              </div>
            </div>

            <div>
              <span className={`px-3 py-1 rounded-none text-[10px] font-bold uppercase tracking-widest border ${
                isDark
                  ? 'bg-[#00897B]/20 text-[#26A69A] border-[#00897B]/40'
                  : 'bg-[#00897B]/10 text-[#00897B] border-[#00897B]/30'
              }`}>
                {isBn ? 'ইনকামিং ভয়েস কল' : 'Incoming Voice Call'}
              </span>
              <h3 className={`text-lg font-extrabold mt-2.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {activeCall.caller_name}
              </h3>
              <p className={`text-xs capitalize ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {activeCall.caller_role?.replace('_', ' ')}
              </p>
            </div>

            <div className={`flex items-center justify-center space-x-4 pt-3 border-t ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <button
                type="button"
                onClick={handleRejectCall}
                className="flex-1 py-3 rounded-none bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer ring-2 ring-red-500/50"
              >
                <PhoneOff className="w-4 h-4" />
                <span>{isBn ? 'প্রত্যাখ্যান' : 'Decline'}</span>
              </button>

              <button
                type="button"
                onClick={handleAcceptCall}
                className="flex-1 py-3 rounded-none bg-[#00897B] hover:bg-[#00796B] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all shadow-md cursor-pointer animate-pulse ring-2 ring-[#00897B]/50"
              >
                <Phone className="w-4 h-4" />
                <span>{isBn ? 'রিসিভ করুন' : 'Accept'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. OUTGOING OR ACTIVE VOICE CALL MODAL (CENTERED & THEMED) */}
      {(isOutgoing || isConnected) && (
        <div className={`fixed inset-0 z-[2000] flex items-center justify-center p-4 animate-in fade-in ${
          isDark ? 'bg-slate-950/85 backdrop-blur-md' : 'bg-slate-900/40 backdrop-blur-md'
        }`}>
          <div className={`w-full max-w-md rounded-none p-6 sm:p-8 shadow-2xl text-center space-y-6 relative overflow-hidden ${
            isDark
              ? 'bg-[#121214] border-2 border-[#00897B]/50 text-white'
              : 'bg-white border-2 border-[#00897B] text-slate-900 shadow-slate-400/40'
          }`}>
            {/* Ambient Teal Glow */}
            <div className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
              isDark ? 'bg-[#00897B]/20' : 'bg-[#00897B]/10'
            }`}></div>

            {/* Top Status Header Badge */}
            <div className="flex items-center justify-center space-x-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-ping'}`}></span>
              <span className={`px-3 py-1 font-bold text-xs uppercase tracking-widest rounded-none border ${
                isDark
                  ? 'bg-[#00897B]/20 border-[#00897B]/40 text-[#26A69A]'
                  : 'bg-[#00897B]/10 border-[#00897B]/30 text-[#00897B]'
              }`}>
                {isConnected ? (isBn ? 'ভয়েস কল চলছে' : 'Active Voice Call') : (isBn ? 'কল করা হচ্ছে...' : 'Calling Target User...')}
              </span>
            </div>

            {/* Avatar Ring with Pulsing Wave */}
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[#00897B]/20 animate-ping opacity-75"></div>
              <div className={`w-20 h-20 rounded-full font-bold text-2xl flex items-center justify-center border-2 shadow-lg relative z-10 ${
                isDark
                  ? 'bg-[#00897B]/30 text-[#00897B] border-[#00897B]'
                  : 'bg-[#00897B]/15 text-[#00897B] border-[#00897B]'
              }`}>
                {activeCall.caller_name ? activeCall.caller_name[0].toUpperCase() : 'U'}
              </div>
            </div>

            {/* User Info & Live Duration Timer */}
            <div className="space-y-1">
              <h2 className={`text-xl font-extrabold tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {isOutgoing ? (isBn ? 'ইউজার উত্তর দেওয়ার জন্য অপেক্ষা করা হচ্ছে' : 'Waiting for answer...') : activeCall.caller_name}
              </h2>
              <p className={`text-xs font-mono flex items-center justify-center space-x-1.5 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                <ShieldCheck className="w-4 h-4 text-[#00897B]" />
                <span>End-to-End Encrypted System Voice</span>
              </p>

              {isConnected && (
                <div className={`pt-2 text-3xl font-mono font-black tracking-wider animate-pulse ${
                  isDark ? 'text-[#26A69A]' : 'text-[#00897B]'
                }`}>
                  {formatTime(callDuration)}
                </div>
              )}
            </div>

            {/* Action Buttons: Mute & End Call */}
            <div className={`flex items-center justify-center space-x-4 pt-4 border-t ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <button
                type="button"
                onClick={toggleMute}
                className={`flex-1 py-3 rounded-none font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md ${
                  isMuted
                    ? 'bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-400/50'
                    : isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-500" />}
                <span>{isMuted ? (isBn ? 'আনমিউট' : 'Unmute') : (isBn ? 'মাইক্রোফোন মিউট' : 'Mute Mic')}</span>
              </button>

              <button
                type="button"
                onClick={handleEndCall}
                className="flex-1 py-3 rounded-none bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xl ring-2 ring-red-500/50"
              >
                <PhoneOff className="w-4 h-4" />
                <span>{isBn ? 'কল কাটুন' : 'End Call'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
