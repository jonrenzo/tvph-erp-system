"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Sparkles, User, Bot, Loader2, Maximize2, Minimize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { usePathname } from 'next/navigation';

type ToolInvocationView = {
  toolCallId: string;
  toolName: string;
  result?: unknown;
};

function getMessageText(message: { parts?: unknown; content?: string }) {
  if (!Array.isArray(message.parts)) {
    return message.content ?? '';
  }

  return message.parts
    .map((part) => {
      if (part && typeof part === 'object' && 'type' in part && part.type === 'text' && 'text' in part) {
        return String(part.text);
      }
      return '';
    })
    .join('');
}

function getToolInvocations(message: { toolInvocations?: unknown }) {
  return Array.isArray(message.toolInvocations)
    ? (message.toolInvocations as ToolInvocationView[])
    : [];
}

export function AIChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [input, setInput] = useState("");
  const pathname = usePathname();

  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () => ({ contextUrl: pathname }),
    }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const scrollRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [pos, setPos] = useState({ x: 24, y: 24 }); // distance from bottom-left
  const dragging = useRef(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const moved = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.MouseEvent) => {
    dragging.current = true;
    moved.current = false;
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, posX: pos.x, posY: pos.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragStart.current.mouseX;
      const dy = e.clientY - dragStart.current.mouseY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
      const newX = Math.max(8, Math.min(window.innerWidth - 64, dragStart.current.posX + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - 64, dragStart.current.posY - dy));
      setPos({ x: newX, y: newY });
    };
    const onMouseUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const handleToggleClick = () => {
    if (!moved.current) setIsOpen((o) => !o);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (isDismissed) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-[100] flex flex-col items-start gap-3"
      style={{ left: pos.x, bottom: pos.y }}
    >
      {isOpen && (
        <div 
          className={`bg-white dark:bg-[#071F15] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 zoom-in-95 duration-300 ${
            isExpanded ? "w-[500px] h-[700px]" : "w-[380px] h-[550px]"
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-primary/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-plus-jakarta tracking-tight">TVPH Assistant</h3>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">v2.5 Flash</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
               <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                 {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
               </button>
               <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                 <X className="h-5 w-5" />
               </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-transparent">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                 <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-slate-400" />
                 </div>
                 <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">How can I help you today?</p>
                    <p className="text-xs text-slate-500 mt-1">I can analyze vendors, POs, and financial data.</p>
                 </div>
                 <div className="grid grid-cols-1 gap-2 w-full">
                    {["Who are our top vendors?", "List pending POs", "What's our compliance score?"].map((suggestion) => (
                      <button 
                        key={suggestion}
                        onClick={() => sendMessage({ text: suggestion })}
                        className="text-[10px] p-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary transition-all text-left"
                      >
                        &quot;{suggestion}&quot;
                      </button>
                    ))}
                 </div>
              </div>
            )}

              {messages.map((message) => {
                const m = message as typeof message & {
                  content?: string;
                  toolInvocations?: ToolInvocationView[];
                };
                const toolInvocations = getToolInvocations(m);

                return (
               <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                 <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                   m.role === 'user' ? 'bg-white dark:bg-slate-800' : 'bg-primary'
                 }`}>
                   {m.role === 'user' ? <User className="h-4 w-4 text-slate-600 dark:text-slate-300" /> : <Bot className="h-4 w-4 text-white" />}
                 </div>
                 <div className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed shadow-sm transition-all ${
                   m.role === 'user' 
                     ? 'bg-primary text-white rounded-tr-none shadow-primary/10' 
                     : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none shadow-slate-200/50 dark:shadow-none'
                 }`}>
                    <div className="prose dark:prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:text-slate-100 break-words">
                      <ReactMarkdown 
                        components={{
                          a: (props) => <a {...props} target="_blank" className="text-emerald-500 hover:underline break-all" />,
                          p: (props) => <p {...props} className="mb-2 last:mb-0" />
                        }}
                      >
                        {getMessageText(m)}
                      </ReactMarkdown>
                    </div>
                    {toolInvocations.map(toolInvocation => {
                      const toolCallId = toolInvocation.toolCallId;
                      if ('result' in toolInvocation) {
                        return (
                          <div key={toolCallId} className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-md border border-slate-100 dark:border-slate-700">
                            <span className="text-emerald-500">✓</span> Executed {toolInvocation.toolName}
                          </div>
                        );
                      } else {
                        return (
                          <div key={toolCallId} className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-md border border-slate-100 dark:border-slate-700">
                            <Loader2 className="h-3 w-3 animate-spin text-primary" /> Running {toolInvocation.toolName}...
                          </div>
                        );
                      }
                    })}
                 </div>
               </div>
                );
              })}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3">
                 <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-white" />
                 </div>
                 <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    <span className="text-[10px] text-slate-400 font-medium">Assistant is thinking...</span>
                 </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim() || isLoading) return;
              sendMessage({ text: input });
              setInput('');
            }}
            className="p-4 bg-white dark:bg-[#071F15] border-t border-slate-100 dark:border-slate-800"
          >
            <div className="relative flex items-center">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your assistant..."
                className="w-full pl-4 pr-12 py-3 bg-slate-100 dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-500"
              />
              <button 
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2 p-1.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toggle Button — draggable */}
      <button
        onMouseDown={handleDragStart}
        onClick={handleToggleClick}
        className="group relative cursor-grab active:cursor-grabbing select-none"
      >
        <img
          src="/clippy-waiting.gif"
          alt="Chat assistant"
          className="h-20 w-auto drop-shadow-2xl hover:scale-110 active:scale-95 transition-all"
        />
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleDismiss}
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-slate-700 dark:bg-slate-600 flex items-center justify-center text-white shadow-md hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
          title="Dismiss chat"
        >
          <X className="h-3 w-3" />
        </div>
      </button>
    </div>
  );
}
