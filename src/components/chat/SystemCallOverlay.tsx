import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, ShieldCheck, Volume2 } from 'lucide-react';
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
  const ringtoneAudioCtxRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<number | null>(null);

  // Sound generator for incoming call ringtone chime
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
                const stream = await navigator.mediaDevices.getUserMedia({
                  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                  video: false,
                });
                localStreamRef.current = stream;

                const pc = initPeerConnection(myCall.id, true);
                stream.getTracks().forEach((track) => pc.addTrack(track, stream));

                const offer = await pc.createOffer();
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
                const stream = await navigator.mediaDevices.getUserMedia({
                  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                  video: false,
                });
                localStreamRef.current = stream;
              }
              const pc = initPeerConnection(myCall.id, false);
              localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));

              if (!pc.remoteDescription) {
                const offerDesc = new RTCSessionDescription(JSON.parse(myCall.sdp_offer));
                await pc.setRemoteDescription(offerDesc);

                const answer = await pc.createAnswer();
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
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
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

      {/* 1. INCOMING VOICE CALL MODAL */}
      {isIncoming && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#1C1C1E] border border-slate-800 rounded-none p-6 shadow-2xl text-center space-y-5 text-white">
            <div className="w-16 h-16 rounded-full bg-[#00897B]/20 text-[#00897B] font-bold text-lg flex items-center justify-center mx-auto ring-4 ring-[#00897B]/30 animate-bounce">
              <Phone className="w-8 h-8" />
            </div>

            <div>
              <span className="px-2.5 py-0.5 rounded-none bg-[#00897B]/20 text-[#26A69A] border border-[#00897B]/40 text-[10px] font-bold uppercase tracking-wider">
                {isBn ? 'ইনকামিং ভয়েস কল' : 'Incoming Voice Call'}
              </span>
              <h3 className="text-base font-bold text-white mt-2">{activeCall.caller_name}</h3>
              <p className="text-xs text-slate-400 capitalize">{activeCall.caller_role?.replace('_', ' ')}</p>
            </div>

            <div className="flex items-center justify-center space-x-4 pt-2">
              <button
                type="button"
                onClick={handleRejectCall}
                className="flex-1 py-2.5 rounded-none bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
                <span>{isBn ? 'প্রত্যাখ্যান' : 'Decline'}</span>
              </button>

              <button
                type="button"
                onClick={handleAcceptCall}
                className="flex-1 py-2.5 rounded-none bg-[#00897B] hover:bg-[#00796B] text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md cursor-pointer animate-pulse"
              >
                <Phone className="w-4 h-4" />
                <span>{isBn ? 'রিসিভ করুন' : 'Accept'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. OUTGOING OR ACTIVE VOICE CALL OVERLAY */}
      {(isOutgoing || isConnected) && (
        <div className="fixed top-4 right-4 z-[2000] w-80 bg-[#1C1C1E] border border-slate-800 rounded-none p-4 shadow-2xl text-white space-y-4 animate-in slide-in-from-top-4">
          <div className="flex items-center justify-between border-b pb-2 border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                {isConnected ? (isBn ? 'ভয়েস কল চলছে' : 'Voice Call Active') : (isBn ? 'কল করা হচ্ছে...' : 'Calling...')}
              </span>
            </div>
            {isConnected && (
              <span className="text-xs font-mono font-bold text-[#26A69A]">
                {formatTime(callDuration)}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-none bg-[#00897B]/20 text-[#00897B] font-bold text-xs flex items-center justify-center border border-[#00897B]/40 shrink-0">
              <Phone className="w-5 h-5 text-[#26A69A]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate">
                {isOutgoing ? (isBn ? 'কল নেওয়া পর্যন্ত অপেক্ষা করুন' : 'Calling Target User') : activeCall.caller_name}
              </div>
              <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 text-[#26A69A]" />
                <span>End-to-End Encrypted Voice</span>
              </div>
            </div>
          </div>

          {/* Voice Action Controls */}
          <div className="flex items-center justify-between pt-1 gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className={`flex-1 py-2 rounded-none font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                isMuted
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isMuted ? (isBn ? 'আনমিউট' : 'Unmute') : (isBn ? 'মিউট' : 'Mute')}</span>
            </button>

            <button
              type="button"
              onClick={handleEndCall}
              className="flex-1 py-2 rounded-none bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer shadow-md"
            >
              <PhoneOff className="w-4 h-4" />
              <span>{isBn ? 'কল কাটুন' : 'End Call'}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
