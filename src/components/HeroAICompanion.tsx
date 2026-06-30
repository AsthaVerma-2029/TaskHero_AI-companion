import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { 
  Brain, Send, Mic, MicOff, Volume2, Sparkles, AlertCircle, 
  Loader2, Radio, Play, RefreshCw, VolumeX 
} from 'lucide-react';

interface HeroAICompanionProps {
  onAddXP: (amount: number) => void;
}

export default function HeroAICompanion({ onAddXP }: HeroAICompanionProps) {
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Greetings, Hero! I am TaskHero, your ultra-supportive companion. Whether you have a giant presentation to finish, or you are feeling stuck on a hard goal, I am here. Tell me what is on your plate today, or click "AI Live Talk" to start a real-time voice pep talk!',
      timestamp: new Date().toLocaleTimeString(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // Live Talk state
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'offline' | 'connecting' | 'listening' | 'speaking'>('offline');
  const [liveTranscript, setLiveTranscript] = useState<string[]>([]);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Audio elements ref
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Live WebSocket & Audio processing Refs
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  
  // High-precision output audio scheduling refs
  const nextStartTimeRef = useRef<number>(0);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingQueueRef = useRef<boolean>(false);

  // Auto scroll
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveTranscript]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopLiveTalk();
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
    };
  }, []);

  // ----------------------------------------------------
  // 💬 CHAT COMPANION (TEXT BASED)
  // ----------------------------------------------------
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text: input.trim(),
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.text }),
      });
      const data = await res.json();
      
      const assistantMsg: ChatMessage = {
        id: Math.random().toString(),
        sender: 'assistant',
        text: data.text || "I'm always ready to support you, Hero. Let's tackle that list!",
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages(prev => [...prev, assistantMsg]);
      onAddXP(10); // Reward active coaching conversations
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsSending(false);
    }
  };

  // TTS button next to messages
  const handleTTS = async (msgId: string, text: string) => {
    if (speakingMessageId === msgId) {
      // Toggle stop
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
      setSpeakingMessageId(null);
      return;
    }

    setSpeakingMessageId(msgId);
    try {
      const res = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.audio) {
        const binary = atob(data.audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: data.mimeType || 'audio/mp3' });
        const url = URL.createObjectURL(blob);

        if (activeAudioRef.current) {
          activeAudioRef.current.pause();
        }

        const audio = new Audio(url);
        activeAudioRef.current = audio;
        audio.onended = () => setSpeakingMessageId(null);
        audio.play();
      } else {
        setSpeakingMessageId(null);
      }
    } catch (err) {
      console.error('TTS error:', err);
      setSpeakingMessageId(null);
    }
  };

  // ----------------------------------------------------
  // 🎙️ LIVE VOICE PEP TALK (LIVE API WebSocket / Audio)
  // ----------------------------------------------------
  
  // Float32Array (normal browser mic) to signed 16-bit Int16 PCM Base64 conversion
  const convertFloat32ToInt16 = (buffer: Float32Array): string => {
    let l = buffer.length;
    const buf = new Int16Array(l);
    while (l--) {
      // clip & scale
      const s = Math.max(-1, Math.min(1, buffer[l]));
      buf[l] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    // Encode Int16Array to base64
    const binary = String.fromCharCode.apply(null, new Uint16Array(buf.buffer) as any);
    return btoa(binary);
  };

  const startLiveTalk = async () => {
    setLiveError(null);
    setLiveStatus('connecting');
    setLiveTranscript([]);

    try {
      // 1. Establish Audio Context for recording and playback
      inputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // Reset playback start time tracking
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime + 0.05;
      audioQueueRef.current = [];
      isPlayingQueueRef.current = false;

      // 2. Capture mic stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 3. Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsLiveConnected(true);
        setLiveStatus('listening');
        setLiveTranscript(['Connected to Live Session. Speak into your microphone!']);

        // Start processing mic audio only after WS successfully opens
        const source = inputAudioCtxRef.current!.createMediaStreamSource(stream);
        const processor = inputAudioCtxRef.current!.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;

        source.connect(processor);
        processor.connect(inputAudioCtxRef.current!.destination);

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const rawChannelData = e.inputBuffer.getChannelData(0);
            const base64PCM = convertFloat32ToInt16(rawChannelData);
            ws.send(JSON.stringify({ audio: base64PCM }));
          }
        };
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.error) {
            setLiveError(msg.error);
            stopLiveTalk();
            return;
          }

          // Handle incoming audio stream chunk
          if (msg.audio) {
            setLiveStatus('speaking');
            playAudioLiveChunk(msg.audio);
          }

          // Handle transcription feedback
          if (msg.text) {
            setLiveTranscript(prev => {
              // Only push if it is a new complete thought or append
              const last = prev[prev.length - 1];
              if (last && !last.startsWith('AI:') && !last.startsWith('Connected')) {
                // Combine
                return [...prev.slice(0, -1), `AI: ${msg.text}`];
              } else {
                return [...prev, `AI: ${msg.text}`];
              }
            });
          }

          if (msg.interrupted) {
            console.log('Voice session interrupted, flushing playback queue');
            // Flush playback queue and stop current node if possible
            audioQueueRef.current = [];
            isPlayingQueueRef.current = false;
            setLiveStatus('listening');
          }
        } catch (err) {
          console.error('Error in voice websocket message handler:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('Voice websocket error:', err);
        setLiveError('WebSocket connection issue.');
        stopLiveTalk();
      };

      ws.onclose = () => {
        stopLiveTalk();
      };

    } catch (err: any) {
      console.error('Mic or Audio initiation failure:', err);
      setLiveError('Failed to capture microphone. Ensure permissions are allowed.');
      setLiveStatus('offline');
    }
  };

  const stopLiveTalk = () => {
    setIsLiveConnected(false);
    setLiveStatus('offline');

    // Close ws
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Stop mic stream track
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Disconnect processors
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Close AudioContexts
    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== 'closed') {
      outputAudioCtxRef.current.close();
      outputAudioCtxRef.current = null;
    }

    audioQueueRef.current = [];
    isPlayingQueueRef.current = false;
  };

  // Live audio playback: decodes PCM chunks and schedules them gaplessly in output Context
  const playAudioLiveChunk = async (base64PCM: string) => {
    const ctx = outputAudioCtxRef.current;
    if (!ctx) return;

    try {
      // Decode base64 to binary
      const binary = atob(base64PCM);
      const len = binary.length;
      const buffer = new ArrayBuffer(len);
      const view = new DataView(buffer);
      for (let i = 0; i < len; i++) {
        view.setUint8(i, binary.charCodeAt(i));
      }

      // Live model outputs 24kHz Int16 signed PCM, convert to Float32
      const samplesCount = len / 2;
      const float32Data = new Float32Array(samplesCount);
      const int16View = new Int16Array(buffer);
      for (let i = 0; i < samplesCount; i++) {
        float32Data[i] = int16View[i] / 32768.0;
      }

      // Create AudioBuffer at 24000Hz (sampleRate)
      const audioBuffer = ctx.createBuffer(1, samplesCount, 24000);
      audioBuffer.getChannelData(0).set(float32Data);

      // Queue the buffer
      audioQueueRef.current.push(audioBuffer);
      if (!isPlayingQueueRef.current) {
        processPlaybackQueue();
      }
    } catch (err) {
      console.error('Failed to parse and play live audio chunk:', err);
    }
  };

  const processPlaybackQueue = () => {
    const ctx = outputAudioCtxRef.current;
    if (!ctx || audioQueueRef.current.length === 0) {
      isPlayingQueueRef.current = false;
      setLiveStatus('listening');
      return;
    }

    isPlayingQueueRef.current = true;
    const nextBuffer = audioQueueRef.current.shift()!;
    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = nextBuffer;
    sourceNode.connect(ctx.destination);

    // Precise schedule calculation to bypass network latency gaps
    const now = ctx.currentTime;
    if (nextStartTimeRef.current < now) {
      nextStartTimeRef.current = now + 0.02; // Small cushion
    }

    sourceNode.start(nextStartTimeRef.current);
    
    // Advance next scheduled start time
    nextStartTimeRef.current += nextBuffer.duration;

    // Trigger next chunk precisely when this one finishes playing
    sourceNode.onended = () => {
      processPlaybackQueue();
    };
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="ai-companion-view">
      
      {/* LEFT: Text Chat Module */}
      <div className="lg:col-span-2 bg-white border border-zinc-100 rounded-2xl p-6 shadow-sm flex flex-col h-[520px] justify-between">
        <div className="flex items-center space-x-2 border-b border-zinc-100 pb-3">
          <Brain className="w-5 h-5 text-orange-600" />
          <div>
            <h3 className="text-sm font-bold text-zinc-800">Direct Chat Coach</h3>
            <p className="text-[10px] text-zinc-400">Ask advice, overcome blocks, plan together</p>
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto my-4 space-y-4 pr-1">
          {messages.map((msg) => {
            const isAss = msg.sender === 'assistant';
            const isSpeakingThis = speakingMessageId === msg.id;

            return (
              <div 
                key={msg.id} 
                className={`flex gap-3 max-w-[85%] ${isAss ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
              >
                {isAss && (
                  <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm border border-orange-100">
                    TH
                  </div>
                )}
                <div className={`p-3.5 rounded-2xl relative group ${
                  isAss ? 'bg-zinc-100 text-zinc-800' : 'bg-orange-600 text-white'
                }`}>
                  <p className="text-xs leading-relaxed whitespace-pre-line">{msg.text}</p>
                  <span className={`text-[9px] block mt-1.5 ${isAss ? 'text-zinc-400' : 'text-orange-200'}`}>
                    {msg.timestamp}
                  </span>

                  {/* Speak button next to Coach text */}
                  {isAss && (
                    <button
                      onClick={() => handleTTS(msg.id, msg.text)}
                      className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-200 text-zinc-400 hover:text-orange-600 transition-all"
                      title={isSpeakingThis ? "Mute" : "Speak Aloud"}
                    >
                      {isSpeakingThis ? (
                        <VolumeX className="w-3.5 h-3.5 text-orange-600 animate-pulse" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {isSending && (
            <div className="flex gap-3 max-w-[85%] mr-auto items-center">
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100 shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <p className="text-xs text-zinc-400 font-semibold animate-pulse">TaskHero is planning suggestions...</p>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Send input */}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your current struggle... (e.g. Preparing for exams but lacking focus)"
            className="flex-1 px-4 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/25 focus:border-orange-500 focus:outline-none"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="px-4 bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-200 text-white rounded-xl transition-colors shadow-md shadow-orange-600/10 flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* RIGHT: Live Voice Talk Module */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-white flex flex-col justify-between h-[520px] relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 bg-orange-600/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Radio className={`w-4 h-4 ${isLiveConnected ? 'text-red-500 animate-pulse' : 'text-zinc-500'}`} />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">AI Live Talk Session</span>
            </div>
            {isLiveConnected && (
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-900 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Feed Active
              </span>
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold text-zinc-200">Voice Assistant Real-time Conversation</h3>
            <p className="text-xs text-zinc-400">Put on headphones, tap record, and brainstorm productivity strategies hands-free.</p>
          </div>
        </div>

        {/* Visualizer and transcription feed */}
        <div className="flex-1 flex flex-col justify-center items-center my-6 space-y-6">
          {isLiveConnected ? (
            <div className="flex flex-col items-center space-y-4 w-full">
              {/* Animated Sound Waves */}
              <div className="flex items-center justify-center gap-1.5 h-12 w-full">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((bar) => {
                  const animDuration = `${0.3 + Math.random() * 0.4}s`;
                  return (
                    <div
                      key={bar}
                      className="w-1 bg-orange-500 rounded-full transition-all"
                      style={{
                        height: liveStatus === 'speaking' ? '100%' : '15%',
                        animation: liveStatus === 'speaking' ? `bounce ${animDuration} infinite ease-in-out` : 'none',
                      }}
                    />
                  );
                })}
              </div>

              {/* Speech transcription monitor */}
              <div className="w-full bg-zinc-800/40 border border-zinc-800 rounded-xl p-3 h-28 overflow-y-auto text-xs text-zinc-300 space-y-2">
                {liveTranscript.length === 0 ? (
                  <p className="text-zinc-500 text-center py-6">Listening for your speech...</p>
                ) : (
                  liveTranscript.map((line, idx) => (
                    <p key={idx} className={`${line.startsWith('AI:') ? 'text-orange-400 font-bold' : 'text-zinc-300'}`}>
                      {line}
                    </p>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <div className="w-14 h-14 bg-zinc-800 text-zinc-400 flex items-center justify-center rounded-2xl mx-auto border border-zinc-700">
                <MicOff className="w-6 h-6" />
              </div>
              <p className="text-xs text-zinc-400">AI Voice link currently offline.</p>
            </div>
          )}

          {liveError && (
            <div className="bg-red-950/30 border border-red-900/40 p-3 rounded-xl flex items-start gap-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{liveError}</span>
            </div>
          )}
        </div>

        {/* Voice Trigger Buttons */}
        <div className="space-y-3">
          {isLiveConnected ? (
            <button
              onClick={stopLiveTalk}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black transition-all inline-flex items-center justify-center gap-1.5 shadow-lg shadow-red-900/10"
            >
              <MicOff className="w-4 h-4" />
              <span>Disconnect Voice Pep Talk</span>
            </button>
          ) : (
            <button
              onClick={startLiveTalk}
              className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-black transition-all inline-flex items-center justify-center gap-1.5 shadow-lg shadow-orange-900/15"
            >
              <Mic className="w-4 h-4 animate-pulse" />
              <span>Start Voice Pep Talk</span>
            </button>
          )}
        </div>

        {/* Custom bounce animation styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes bounce {
            0%, 100% { transform: scaleY(0.3); }
            50% { transform: scaleY(1.2); }
          }
        `}} />
      </div>

    </div>
  );
}
