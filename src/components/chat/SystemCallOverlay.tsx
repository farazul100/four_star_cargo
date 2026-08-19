import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, ShieldCheck } from 'lucide-react';
import { User, CallSession, Language } from '../../types';
import { getHostingerDbData, saveHostingerDbData, logSystemAuditAction } from '../../lib/db';

interface SystemCallOverlayProps {
  currentUser: User;
  language: Language;
}

export const SystemCallOverlay: React.FC<SystemCallOverlayProps> = ({ currentUser, language }) => {
  const isBn = language === 'bn';
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // WebRTC Stream Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const ringtoneAudioCtxRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<number | null>(null);

  // Sound generator for incoming ringtone
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
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 520;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.2, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.85);
      };

      triggerTone();
      ringtoneIntervalRef.current = window.setInterval(triggerTone, 2000);
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

  // Poll call queue in persistent DB
  useEffect(() => {
    const checkCalls = () => {
      const db = getHostingerDbData();
      const calls: CallSession[] = db.calls || [];
      
      const myCall = calls.find(
        (c) => (c.target_user_id === currentUser.id || c.caller_id === currentUser.id) && c.status !== 'ended'
      );

      if (myCall) {
        setActiveCall(myCall);
        if (myCall.status === 'ringing' && myCall.target_user_id === currentUser.id) {
          playRingtone();
        } else {
          stopRingtone();
        }
      } else {
        stopRingtone();
        if (activeCall) {
          stopWebRTC();
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
  }, [currentUser.id, activeCall]);

  // Duration Timer for active call
  useEffect(() => {
    let timer: any;
    if (activeCall && activeCall.status === 'active') {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeCall]);

  const stopWebRTC = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  const startMedia = async (isVideo: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current && isVideo) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (e) {
      console.warn('Media devices warning:', e);
      return null;
    }
  };

  const handleAcceptCall = async () => {
    if (!activeCall) return;
    stopRingtone();

    await startMedia(activeCall.type === 'video');

    const db = getHostingerDbData();
    const updatedCalls = (db.calls || []).map((c: CallSession) =>
      c.id === activeCall.id ? { ...c, status: 'active' as const } : c
    );
    saveHostingerDbData('fsc_vps_calls', updatedCalls);
    logSystemAuditAction(currentUser, 'CALL_ACCEPTED', 'CALL', activeCall.id, `Accepted ${activeCall.type} call from ${activeCall.caller_name}`);
  };

  const handleRejectCall = () => {
    if (!activeCall) return;
    stopRingtone();
    stopWebRTC();

    const db = getHostingerDbData();
    const updatedCalls = (db.calls || []).map((c: CallSession) =>
      c.id === activeCall.id ? { ...c, status: 'rejected' as const } : c
    );
    saveHostingerDbData('fsc_vps_calls', updatedCalls);
    setActiveCall(null);
    setCallDuration(0);
    logSystemAuditAction(currentUser, 'CALL_REJECTED', 'CALL', activeCall.id, `Declined call from ${activeCall.caller_name}`);
  };

  const handleEndCall = () => {
    if (!activeCall) return;
    stopRingtone();
    stopWebRTC();

    const db = getHostingerDbData();
    const updatedCalls = (db.calls || []).map((c: CallSession) =>
      c.id === activeCall.id ? { ...c, status: 'ended' as const } : c
    );
    saveHostingerDbData('fsc_vps_calls', updatedCalls);
    setActiveCall(null);
    setCallDuration(0);
    logSystemAuditAction(currentUser, 'CALL_ENDED', 'CALL', activeCall.id, `Ended ${activeCall.type} call. Duration: ${callDuration}s`);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const formatSecs = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  if (!activeCall) return null;

  const isIncoming = activeCall.status === 'ringing' && activeCall.target_user_id === currentUser.id;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
      {/* 1. INCOMING CALL POPUP MODAL */}
      {isIncoming && (
        <div className="w-full max-w-sm bg-[#1C1C1E] border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-6 animate-bounce-short">
          <div className="relative inline-block">
            <div className="w-20 h-20 rounded-full bg-blue-600/20 border-2 border-blue-500 flex items-center justify-center text-3xl font-bold text-white mx-auto animate-pulse">
              {activeCall.caller_name[0]?.toUpperCase()}
            </div>
            <span className="absolute bottom-0 right-0 p-1.5 rounded-full bg-emerald-500 text-white">
              <Phone className="w-4 h-4" />
            </span>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white">{activeCall.caller_name}</h3>
            <p className="text-xs text-blue-400 font-mono mt-1">
              {isBn ? `ইন-সিস্টেম ${activeCall.type === 'video' ? 'ভিডিও' : 'অডিও'} কল আসছে...` : `Incoming ${activeCall.type} call...`}
            </p>
            <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
              Four Star Cargo Secure WebRTC
            </span>
          </div>

          <div className="flex items-center justify-center gap-6 pt-2">
            {/* DECLINE BUTTON */}
            <button
              type="button"
              onClick={handleRejectCall}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-transform hover:scale-110 active:scale-95 shadow-lg cursor-pointer"
              title={isBn ? 'কল রিজেক্ট করুন' : 'Decline Call'}
            >
              <PhoneOff className="w-6 h-6" />
            </button>

            {/* ACCEPT BUTTON */}
            <button
              type="button"
              onClick={handleAcceptCall}
              className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-transform hover:scale-110 active:scale-95 shadow-lg animate-pulse cursor-pointer"
              title={isBn ? 'কল রিসিভ করুন' : 'Accept Call'}
            >
              <Phone className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* 2. ACTIVE OR CALLING OVERLAY */}
      {!isIncoming && (
        <div className="w-full max-w-md bg-[#1C1C1E] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 text-center">
          <div className="flex items-center justify-between border-b pb-3 border-slate-800">
            <div className="flex items-center space-x-2 text-xs text-emerald-400 font-mono">
              <ShieldCheck className="w-4 h-4" />
              <span>{isBn ? 'সুরক্ষিত সিস্টেমে কানেক্টেড' : 'End-to-End HD WebRTC Stream'}</span>
            </div>
            <span className="text-xs font-mono text-slate-400">{formatSecs(callDuration)}</span>
          </div>

          {/* Video / Avatar Container */}
          <div className="relative w-full h-64 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
            {activeCall.type === 'video' ? (
              <div className="w-full h-full relative">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                <div className="absolute bottom-3 left-3 px-2 py-1 bg-slate-900/80 rounded text-[10px] text-white font-mono">
                  {currentUser.name} (You)
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-3">
                <div className="w-24 h-24 rounded-full bg-blue-600/20 border-2 border-blue-500 flex items-center justify-center text-4xl font-bold text-white shadow-lg">
                  {activeCall.caller_id === currentUser.id ? '📞' : activeCall.caller_name[0]}
                </div>
                <div className="text-sm font-semibold text-white">
                  {activeCall.caller_id === currentUser.id ? 'Calling...' : activeCall.caller_name}
                </div>
                <div className="text-xs text-emerald-400 font-mono animate-pulse">
                  {activeCall.status === 'active' ? (isBn ? 'কল চলছে (Connected)' : 'Active Call Session') : (isBn ? 'ডায়ালিং করা হচ্ছে...' : 'Ringing target user...')}
                </div>
              </div>
            )}
          </div>

          {/* Control Buttons Bar */}
          <div className="flex items-center justify-center gap-4 pt-2">
            {/* MUTE MIC */}
            <button
              type="button"
              onClick={toggleMute}
              className={`p-3.5 rounded-full border transition-all cursor-pointer ${
                isMuted
                  ? 'bg-red-500/20 border-red-500/40 text-red-400'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
              title={isBn ? 'মাইক্রোফোন মিউট' : 'Toggle Mute'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* TOGGLE VIDEO */}
            {activeCall.type === 'video' && (
              <button
                type="button"
                onClick={toggleVideo}
                className={`p-3.5 rounded-full border transition-all cursor-pointer ${
                  isVideoOff
                    ? 'bg-red-500/20 border-red-500/40 text-red-400'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
                title={isBn ? 'ক্যামেরা টগল' : 'Toggle Camera'}
              >
                {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
            )}

            {/* END CALL */}
            <button
              type="button"
              onClick={handleEndCall}
              className="px-6 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-transform hover:scale-105 active:scale-95 flex items-center space-x-2 shadow-lg cursor-pointer"
            >
              <PhoneOff className="w-5 h-5" />
              <span>{isBn ? 'কল শেষ করুন' : 'End Call'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
