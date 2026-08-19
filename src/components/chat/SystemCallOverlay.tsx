import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, ShieldCheck, Volume2, Radio } from 'lucide-react';
import { User, CallSession, Language } from '../../types';
import { getHostingerDbData, saveHostingerDbData, logSystemAuditAction } from '../../lib/db';

interface SystemCallOverlayProps {
  currentUser: User;
  language: Language;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
  ],
};

// SDP Optimization helper for 128kbps Opus High-Definition Voice Audio
const optimizeSdpOpusBitrate = (sdp: string) => {
  if (!sdp) return sdp;
  return sdp.replace(
    /a=fmtp:111 (.*)/g,
    'a=fmtp:111 $1;maxaveragebitrate=128000;stereo=0;sprop-stereo=0;cbr=1;useinbandfec=1'
  );
};

// Helper for high-definition 48kHz microphone audio stream
const getHdMicrophoneStream = async () => {
  return await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
      channelCount: 1,
    },
    video: false,
  });
};

export const SystemCallOverlay: React.FC<SystemCallOverlayProps> = ({ currentUser, language }) => {
  const isBn = language === 'bn';
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // WebRTC & Audio Element Refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const endedCallIdsRef = useRef<Set<string>>(new Set());

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

  const stopWebRTC = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (e) {}
      peerConnectionRef.current = null;
    }
  };

  // Helper to initialize PeerConnection
  const initPeerConnection = (callId: string, isCaller: boolean) => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    // Handle remote track received
    pc.ontrack = (event) => {
      if (remoteAudioRef.current) {
        const stream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.volume = 1.0;
        remoteAudioRef.current.muted = false;

        const p = remoteAudioRef.current.play();
        if (p !== undefined) {
          p.catch((err) => {
            console.warn('Audio play autoplay policy warning:', err);
          });
        }
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const db = getHostingerDbData();
        const calls: CallSession[] = db.calls || [];
        const candStr = JSON.stringify(event.candidate);

        const updatedCalls = calls.map((c) => {
          if (c.id === callId) {
            if (isCaller) {
              const currentCands = c.caller_candidates || [];
              if (!currentCands.includes(candStr)) {
                return { ...c, caller_candidates: [...currentCands, candStr] };
              }
            } else {
              const currentCands = c.callee_candidates || [];
              if (!currentCands.includes(candStr)) {
                return { ...c, callee_candidates: [...currentCands, candStr] };
              }
            }
          }
          return c;
        });

        saveHostingerDbData('fsc_vps_calls', updatedCalls);
      }
    };

    return pc;
  };

  // Poll call queue and synchronize WebRTC SDP & ICE signals
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

        // 1. Ringing State Logic
        if (myCall.status === 'ringing') {
          if (!isCaller) {
            playRingtone();
          } else {
            // Caller: Create offer if not created yet
            if (!myCall.sdp_offer && !peerConnectionRef.current) {
              try {
                const stream = await getHdMicrophoneStream();
                localStreamRef.current = stream;

                const pc = initPeerConnection(myCall.id, true);
                stream.getTracks().forEach((track) => pc.addTrack(track, stream));

                const rawOffer = await pc.createOffer();
                const optimizedSdp = optimizeSdpOpusBitrate(rawOffer.sdp || '');
                const offer = new RTCSessionDescription({ type: rawOffer.type, sdp: optimizedSdp });
                await pc.setLocalDescription(offer);

                const currentDb = getHostingerDbData();
                const latestCalls: CallSession[] = currentDb.calls || [];
                const updated = latestCalls.map((c) =>
                  c.id === myCall.id ? { ...c, sdp_offer: JSON.stringify(offer) } : c
                );
                saveHostingerDbData('fsc_vps_calls', updated);
              } catch (err) {
                console.warn('Caller WebRTC offer creation error:', err);
              }
            }
          }
        }

        // 2. Active State Logic
        if (myCall.status === 'active') {
          stopRingtone();

          // Callee process SDP Offer and send SDP Answer if not sent yet
          if (!isCaller && myCall.sdp_offer && !myCall.sdp_answer) {
            try {
              if (!localStreamRef.current) {
                const stream = await getHdMicrophoneStream();
                localStreamRef.current = stream;
              }
              const pc = initPeerConnection(myCall.id, false);
              localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));

              if (!pc.remoteDescription) {
                const offerDesc = new RTCSessionDescription(JSON.parse(myCall.sdp_offer));
                await pc.setRemoteDescription(offerDesc);

                const rawAnswer = await pc.createAnswer();
                const optimizedSdp = optimizeSdpOpusBitrate(rawAnswer.sdp || '');
                const answer = new RTCSessionDescription({ type: rawAnswer.type, sdp: optimizedSdp });
                await pc.setLocalDescription(answer);

                const currentDb = getHostingerDbData();
                const latestCalls: CallSession[] = currentDb.calls || [];
                const updated = latestCalls.map((c) =>
                  c.id === myCall.id ? { ...c, sdp_answer: JSON.stringify(answer) } : c
                );
                saveHostingerDbData('fsc_vps_calls', updated);
              }
            } catch (err) {
              console.warn('Callee SDP answer error:', err);
            }
          }

          // Caller process SDP Answer from Callee
          if (isCaller && myCall.sdp_answer && peerConnectionRef.current) {
            const pc = peerConnectionRef.current;
            if (!pc.remoteDescription) {
              try {
                const answerDesc = new RTCSessionDescription(JSON.parse(myCall.sdp_answer));
                await pc.setRemoteDescription(answerDesc);
              } catch (e) {}
            }
          }

          // Exchange ICE candidates
          if (peerConnectionRef.current) {
            const pc = peerConnectionRef.current;
            const candidatesToProcess = isCaller ? myCall.callee_candidates : myCall.caller_candidates;

            if (candidatesToProcess && candidatesToProcess.length > 0) {
              for (const candStr of candidatesToProcess) {
                try {
                  const candidate = new RTCIceCandidate(JSON.parse(candStr));
                  await pc.addIceCandidate(candidate);
                } catch (e) {}
              }
            }
          }
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

    const db = getHostingerDbData();
    const updatedCalls = (db.calls || []).map((c: CallSession) =>
      c.id === activeCall.id ? { ...c, status: 'active' as const } : c
    );
    saveHostingerDbData('fsc_vps_calls', updatedCalls);
    setActiveCall({ ...activeCall, status: 'active' });
    logSystemAuditAction(currentUser, 'CALL_ACCEPTED', 'CALL', activeCall.id, `Accepted voice call from ${activeCall.caller_name}`);

    try {
      if (!localStreamRef.current) {
        const stream = await getHdMicrophoneStream();
        localStreamRef.current = stream;
      }
      const pc = initPeerConnection(activeCall.id, false);
      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));
    } catch (err) {
      console.warn('Accept call media error:', err);
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
      {/* Hidden Remote Audio Player - Offscreen so browser does not mute media output */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: '1px', height: '1px', opacity: 0.01 }}
      />

      {/* 1. INCOMING VOICE CALL MODAL (CENTERED) */}
      {isIncoming && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#121214] border-2 border-[#00897B]/50 rounded-none p-6 shadow-2xl text-center space-y-5 text-white relative overflow-hidden">
            <div className="absolute -top-16 -left-16 w-32 h-32 bg-[#00897B]/20 rounded-full blur-2xl pointer-events-none"></div>

            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[#00897B]/30 animate-ping opacity-75"></div>
              <div className="w-16 h-16 rounded-full bg-[#00897B]/20 text-[#00897B] font-bold text-lg flex items-center justify-center border border-[#00897B] relative z-10 shadow-lg">
                <Phone className="w-8 h-8 text-[#26A69A] animate-bounce" />
              </div>
            </div>

            <div>
              <span className="px-3 py-1 rounded-none bg-[#00897B]/20 text-[#26A69A] border border-[#00897B]/40 text-[10px] font-bold uppercase tracking-widest">
                {isBn ? 'ইনকামিং ভয়েস কল (HD)' : 'Incoming Voice Call (HD)'}
              </span>
              <h3 className="text-lg font-extrabold text-white mt-2.5">{activeCall.caller_name}</h3>
              <p className="text-xs text-slate-400 capitalize">{activeCall.caller_role?.replace('_', ' ')}</p>
            </div>

            <div className="flex items-center justify-center space-x-4 pt-3 border-t border-slate-800">
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

      {/* 2. OUTGOING OR ACTIVE VOICE CALL MODAL (CENTERED ON SCREEN) */}
      {(isOutgoing || isConnected) && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#121214] border-2 border-[#00897B]/50 rounded-none p-6 sm:p-8 shadow-2xl text-center space-y-6 text-white relative overflow-hidden">
            {/* Ambient Teal Glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#00897B]/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-[#00897B]/20 rounded-full blur-3xl pointer-events-none"></div>

            {/* Top Status Header Badge */}
            <div className="flex items-center justify-center space-x-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-ping'}`}></span>
              <span className="px-3 py-1 bg-[#00897B]/20 border border-[#00897B]/40 text-[#26A69A] font-bold text-xs uppercase tracking-widest rounded-none">
                {isConnected ? (isBn ? 'ভয়েস কল চলছে (HD Voice)' : 'Active Voice Call (HD)') : (isBn ? 'কল করা হচ্ছে...' : 'Calling Target User...')}
              </span>
            </div>

            {/* Avatar Ring with Pulsing Wave */}
            <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[#00897B]/20 animate-ping opacity-75"></div>
              <div className="w-20 h-20 rounded-full bg-[#00897B]/30 text-[#00897B] font-bold text-2xl flex items-center justify-center border-2 border-[#00897B] shadow-lg relative z-10">
                {activeCall.caller_name ? activeCall.caller_name[0].toUpperCase() : 'U'}
              </div>
            </div>

            {/* User Info & Live Duration Timer */}
            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-white tracking-wide">
                {isOutgoing ? (isBn ? 'ইউজার উত্তর দেওয়ার জন্য অপেক্ষা করা হচ্ছে' : 'Waiting for answer...') : activeCall.caller_name}
              </h2>
              <p className="text-xs text-slate-400 font-mono flex items-center justify-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-[#26A69A]" />
                <span>End-to-End Encrypted 128kbps HD Voice</span>
              </p>

              {isConnected && (
                <div className="pt-2 text-3xl font-mono font-black text-[#26A69A] tracking-wider animate-pulse">
                  {formatTime(callDuration)}
                </div>
              )}
            </div>

            {/* Action Buttons: Mute & End Call */}
            <div className="flex items-center justify-center space-x-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={toggleMute}
                className={`flex-1 py-3 rounded-none font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md ${
                  isMuted
                    ? 'bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-400/50'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
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
