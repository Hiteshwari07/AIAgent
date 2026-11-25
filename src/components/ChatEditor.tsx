import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  MessageSquare,
  Zap,
  Palette,
  Maximize2,
  RefreshCw,
  Plus,
  Trash2,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { ChatMessage, OccasionType, PosterCategory, PosterConfig, PosterLanguage, AspectRatio } from '../types';
import { safeFetchJson } from '../utils/safeFetch';

export interface ChatGeneratePosterParams {
  category?: PosterCategory;
  subCategory?: string;
  occasion?: OccasionType;
  topic?: string;
  language?: PosterLanguage;
  aspectRatio?: AspectRatio;
  palette?: string;
  decorations?: string;
  offerText?: string;
  ctaInput?: string;
  highlights?: string[];
}

export interface ChatSceneOverride {
  occasion?: OccasionType;
  palette?: string;
  decorations?: string;
  customTopic?: string;
}

interface ChatEditorProps {
  poster: PosterConfig;
  onApplyUpdates: (updates: Partial<PosterConfig>, actionDesc: string) => void;
  onRegenerateScenes: (override?: ChatSceneOverride, updates?: Partial<PosterConfig>) => Promise<void> | void;
  onGeneratePosterFromChat: (params: ChatGeneratePosterParams) => Promise<{
    poster: PosterConfig;
    captions?: { instagram: string; facebook: string; linkedin: string };
  }>;
  onOpenPublish: (suggestedPlatforms?: ('instagram' | 'facebook' | 'linkedin')[]) => void;
  isProcessing: boolean;
}

const createWelcomeMessage = (): ChatMessage => ({
  id: `welcome-${Date.now()}`,
  sender: 'assistant',
  text: 'Ask me to create a brand-new poster (e.g. "Create a professional Diwali poster for my IT company"), modify the active design ("Change the background to dark blue", "Make the heading bigger"), or prepare captions to publish.',
  timestamp: 'Ready',
});

const buildSlimPosterState = (poster: PosterConfig) => ({
  title: poster.title,
  category: poster.category,
  subCategory: poster.subCategory,
  occasion: poster.occasion,
  language: poster.language,
  aspectRatio: poster.aspectRatio,
  layoutStyle: poster.layoutStyle,
  backgroundDarkness: poster.backgroundDarkness,
  backgroundBlur: poster.backgroundBlur,
  customPalette: poster.customPalette,
  highlights: poster.highlights,
  headline: poster.headline,
  subheading: poster.subheading,
  offerBadge: poster.offerBadge,
  ctaButton: poster.ctaButton,
  productPhoto: poster.productPhoto
    ? {
        x: poster.productPhoto.x,
        y: poster.productPhoto.y,
        scale: poster.productPhoto.scale,
        glowIntensity: poster.productPhoto.glowIntensity,
        visible: poster.productPhoto.visible,
        useCardFallback: poster.productPhoto.useCardFallback,
      }
    : null,
  brandLogo: poster.brandLogo
    ? {
        position: poster.brandLogo.position,
        size: poster.brandLogo.size,
        withPlate: poster.brandLogo.withPlate,
        visible: poster.brandLogo.visible,
        name: poster.brandLogo.name,
      }
    : null,
});

export const ChatEditor: React.FC<ChatEditorProps> = ({
  poster,
  onApplyUpdates,
  onRegenerateScenes,
  onGeneratePosterFromChat,
  onOpenPublish,
  isProcessing,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([createWelcomeMessage()]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingStatus, setTypingStatus] = useState('Thinking...');
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const SUGGESTION_CHIPS = [
    {
      label: 'Diwali IT poster',
      prompt: 'Create a professional Diwali poster for my IT company',
      icon: <Sparkles className="w-3 h-3 text-amber-400" />,
    },
    {
      label: 'Dark blue backdrop',
      prompt: 'Change the background to dark blue',
      icon: <Palette className="w-3 h-3 text-sky-400" />,
    },
    {
      label: 'Bigger heading',
      prompt: 'Make the heading bigger',
      icon: <Maximize2 className="w-3 h-3 text-emerald-400" />,
    },
    {
      label: 'Silver headline',
      prompt: 'headline gold se silver karo',
      icon: <Zap className="w-3 h-3 text-slate-300" />,
    },
    {
      label: 'Approve & Publish',
      prompt: 'Prepare captions and publish this poster',
      icon: <Send className="w-3 h-3 text-amber-300" />,
    },
  ];

  const handleNewChat = () => {
    if (isTyping || isProcessing) return;
    setMessages([createWelcomeMessage()]);
    setInputValue('');
    setLastFailedText(null);
  };

  const handleClearChat = () => {
    if (isTyping || isProcessing) return;
    setMessages([]);
    setInputValue('');
    setLastFailedText(null);
  };

  const handleSendMessage = async (textToSend?: string, isRetry = false) => {
    const text = (textToSend !== undefined ? textToSend : inputValue).trim();
    if (!text || isTyping || isProcessing) return;

    const historyPayload = messages
      .filter((m) => !m.isError && m.sender !== 'system' && m.id && !m.id.startsWith('welcome'))
      .map((m) => ({
        sender: m.sender,
        text: m.text,
      }));

    if (!isRetry) {
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, userMsg]);
      if (textToSend === undefined) setInputValue('');
    } else {
      setMessages((prev) => prev.filter((m) => !m.isError));
    }

    setLastFailedText(null);
    setIsTyping(true);
    setTypingStatus(isRetry ? 'Retrying request with AI...' : 'Understanding request with AI...');

    try {
      const res = await safeFetchJson('/api/chat-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          messages: historyPayload,
          posterState: buildSlimPosterState(poster),
        }),
      });
      const data = res.data || {};

      if (!res.ok || !data.success) {
        throw new Error(res.error || data.error || data.message || `AI assistant returned HTTP ${res.status}.`);
      }

      const intent = data.intent || 'conversation';

      if (intent === 'generate_poster' && data.generateParams) {
        setTypingStatus('Generating poster concepts & visual scenes...');
        const created = await onGeneratePosterFromChat(data.generateParams);
        setMessages((prev) => [
          ...prev,
          {
            id: `reply-${Date.now()}`,
            sender: 'assistant',
            text:
              data.reply ||
              `Created a new "${created.poster.headline.text}" poster with 3 concept variations and tailored social captions.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            actionTaken: `Generated poster: ${created.poster.title}`,
            readyToPublish: true,
            generatedTitle: created.poster.headline.text,
          },
        ]);
      } else if (intent === 'regenerate_background' || data.shouldRegenerateScene) {
        setTypingStatus('Generating updated background scenes...');
        await onRegenerateScenes(data.scenePromptOverride, data.updates);
        setMessages((prev) => [
          ...prev,
          {
            id: `reply-${Date.now()}`,
            sender: 'assistant',
            text: data.reply || 'Updated the background scene variations.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            regeneratedScene: true,
            actionTaken: 'Background scene updated',
          },
        ]);
      } else if (intent === 'modify_poster' && data.updates && Object.keys(data.updates).length > 0) {
        onApplyUpdates(data.updates, data.reply || `Applied: ${text}`);
        setMessages((prev) => [
          ...prev,
          {
            id: `reply-${Date.now()}`,
            sender: 'assistant',
            text: data.reply || 'Poster layers updated.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            actionTaken: 'Poster updated live',
          },
        ]);
      } else if (intent === 'prepare_publish') {
        const platforms = Array.isArray(data.suggestedPlatforms)
          ? data.suggestedPlatforms.filter(
              (p: string) => p === 'instagram' || p === 'facebook' || p === 'linkedin'
            )
          : undefined;
        setMessages((prev) => [
          ...prev,
          {
            id: `reply-${Date.now()}`,
            sender: 'assistant',
            text: data.reply || 'Your poster and captions are ready. Review and approve below to publish.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            readyToPublish: true,
            suggestedPlatforms: platforms,
          },
        ]);
      } else {
        if (data.updates && Object.keys(data.updates).length > 0) {
          onApplyUpdates(data.updates, data.reply || `Applied: ${text}`);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `reply-${Date.now()}`,
            sender: 'assistant',
            text: data.reply || 'Done.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            actionTaken:
              data.updates && Object.keys(data.updates).length > 0 ? 'Poster updated live' : undefined,
          },
        ]);
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Could not reach AI assistant service.';
      setLastFailedText(text);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: errMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
          failedPrompt: text,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[540px] bg-[#111827] border border-slate-800 rounded-xl overflow-hidden">
      {/* Header with New Chat & Clear Chat */}
      <div className="px-4 py-3 border-b border-slate-800 bg-[#0B0F19] flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold text-white tracking-wider uppercase flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
          <span>AI Design Assistant</span>
        </h2>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleNewChat}
            disabled={isTyping || isProcessing}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 disabled:opacity-40 transition"
            title="Start a fresh conversation thread"
          >
            <Plus className="w-3 h-3 text-amber-400" />
            <span>New Chat</span>
          </button>
          <button
            type="button"
            onClick={handleClearChat}
            disabled={isTyping || isProcessing || messages.length === 0}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 hover:bg-rose-950/70 border border-slate-800 text-[11px] text-slate-400 hover:text-rose-200 disabled:opacity-40 transition"
            title="Clear chat messages"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Quick Action Suggestions */}
      <div className="p-2 border-b border-slate-800 bg-[#0D1322] flex flex-wrap gap-1.5">
        {SUGGESTION_CHIPS.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(chip.prompt)}
            disabled={isTyping || isProcessing}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 disabled:opacity-40 transition whitespace-nowrap"
          >
            {chip.icon}
            <span>{chip.label}</span>
          </button>
        ))}
      </div>

      {/* Conversation History */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 text-xs text-slate-500 space-y-2">
            <Sparkles className="w-5 h-5 text-amber-400/70" />
            <p>Conversation cleared. Send a prompt to generate or edit a poster.</p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-amber-500 text-slate-950 font-semibold rounded-br-none'
                    : msg.isError
                    ? 'bg-rose-950/60 text-rose-200 border border-rose-500/40 rounded-bl-none'
                    : 'bg-[#0B0F19] text-slate-200 border border-slate-800 rounded-bl-none'
                }`}
              >
                <div className="flex items-start gap-2">
                  {msg.isError && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>

                {msg.isError && (msg.failedPrompt || lastFailedText) && (
                  <button
                    type="button"
                    disabled={isTyping || isProcessing}
                    onClick={() => handleSendMessage(msg.failedPrompt || lastFailedText || '', true)}
                    className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-[11px] font-semibold text-rose-100 disabled:opacity-40 transition"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Retry Request</span>
                  </button>
                )}

                {msg.actionTaken && !msg.isError && (
                  <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-[10px] text-amber-300 font-mono-tabular flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                    <span>{msg.actionTaken}</span>
                  </div>
                )}

                {msg.readyToPublish && !msg.isError && (
                  <div className="mt-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => onOpenPublish(msg.suggestedPlatforms)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition"
                    >
                      <Send className="w-3 h-3" />
                      <span>Approve &amp; Publish Poster</span>
                    </button>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-500 font-mono-tabular mt-1 px-1">{msg.timestamp}</span>
            </div>
          );
        })}

        {(isTyping || isProcessing) && (
          <div className="text-xs text-slate-300 bg-[#0B0F19] px-3.5 py-2.5 rounded-xl border border-slate-800 w-fit flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span>{isTyping ? typingStatus : 'Updating studio scenes...'}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Command Input */}
      <div className="p-2.5 border-t border-slate-800 bg-[#0B0F19]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder='Ask AI: "Create a Diwali poster..." or "Change background to dark blue"'
            disabled={isTyping || isProcessing}
            className="flex-1 bg-[#111827] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isTyping || isProcessing}
            aria-label="Send message"
            className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold disabled:opacity-40 transition flex items-center gap-1 text-xs"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
