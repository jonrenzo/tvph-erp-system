"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Sparkles, User, Bot, Loader2, Maximize2, Minimize2 } from "lucide-react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export function AIChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    console.log("Messages state updated:", messages);
  }, [messages]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(), // eslint-disable-line
      role: "user",
      content: text,
      timestamp: Date.now(), // eslint-disable-line
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp
          })),
        }),
      });

       const data = await response.json();
       console.log("API Response status:", response.status);
       console.log("API Response data:", data);

       if (!response.ok) {
         throw new Error(data.error || `Server error: ${response.status}`);
       }

       if (data.error) throw new Error(data.error);

       if (!data.message) {
         console.error("No message in response:", data);
         throw new Error("Invalid response from server");
       }

       console.log("Adding message to state:", data.message);
       setMessages((prev) => [...prev, data.message]);
    } catch (error: any) {
      console.error("Chat Error:", error);
      const errorMsg: Message = {
        id: "error-" + Date.now(), // eslint-disable-line
        role: "assistant",
        content: `❌ **Error:** ${error.message || "Something went wrong. Please try again."}`,
        timestamp: Date.now(), // eslint-disable-line
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4">
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
                        onClick={() => handleSend(suggestion)}
                        className="text-[10px] p-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary transition-all text-left"
                      >
                        &quot;{suggestion}&quot;
                      </button>
                    ))}
                 </div>
              </div>
            )}

             {messages.map((m) => (
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
                   <div className="whitespace-pre-wrap">{m.content || "No content"}</div>
                 </div>
               </div>
             ))}
            {isLoading && (
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
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
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

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-white shadow-2xl shadow-primary/30 hover:scale-110 active:scale-95 transition-all group relative"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </button>
    </div>
  );
}
