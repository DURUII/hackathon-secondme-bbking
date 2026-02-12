"use client";

import { useState, useEffect, useRef } from "react";
import { Flame, HeartHandshake, Brain, Send, X, User, HelpCircle } from "lucide-react";

interface QuestionInputProps {
  onSubmit: (data: { content: string; arenaType: string }) => void;
  onArenaChange?: (arena: string) => void;
  isLoading?: boolean;
  initialContent?: string;
  userAvatar?: string;
}

const ARENA_OPTIONS = [
  { id: "toxic", label: "毒舌", icon: Flame },
  { id: "comfort", label: "安慰", icon: HeartHandshake },
  { id: "rational", label: "理性", icon: Brain },
] as const;

export function QuestionInput({ 
  onSubmit, 
  onArenaChange, 
  isLoading = false, 
  initialContent,
  userAvatar 
}: QuestionInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [arenaType, setArenaType] = useState<string>("toxic");
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync with initialContent
  useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
      setIsExpanded(true);
    }
  }, [initialContent]);

  // Click outside to collapse if empty
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (content.trim().length === 0 && !isLoading) {
          setIsExpanded(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [content, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim().length === 0) return;

    onSubmit({
      content: content.trim(),
      arenaType,
    });
    // Don't collapse immediately, let parent handle success/reset
  };

  const handleArenaChange = (arena: string) => {
    setArenaType(arena);
    onArenaChange?.(arena);
  };

  const isSubmitDisabled = isLoading || content.trim().length === 0;

  if (!isExpanded) {
    return (
      <div 
        onClick={() => setIsExpanded(true)}
        className="w-full max-w-md mx-auto bg-white rounded-3xl p-4 shadow-sm border border-stone-100 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
      >
        <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-stone-500">
            <HelpCircle className="w-6 h-6" />
        </div>
        <span className="text-stone-400 font-medium">让大家评评理，听听大家的意见？</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-lg border border-stone-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <form onSubmit={handleSubmit} className="p-6">
        {/* Header / Tabs */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-4">
            {ARENA_OPTIONS.map((arena) => {
              const Icon = arena.icon;
              const isSelected = arenaType === arena.id;
              return (
                <button
                  key={arena.id}
                  type="button"
                  onClick={() => handleArenaChange(arena.id)}
                  className={`
                    flex items-center gap-1.5 pb-1 border-b-2 transition-colors
                    ${isSelected 
                      ? "border-stone-900 text-stone-900" 
                      : "border-transparent text-stone-400 hover:text-stone-600"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{arena.label}</span>
                </button>
              );
            })}
          </div>
          <button 
            type="button" 
            onClick={() => setIsExpanded(false)}
            className="text-stone-400 hover:text-stone-900 p-1"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Textarea */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="输入你的社交难题..."
          disabled={isLoading}
          autoFocus
          className="w-full h-32 text-lg text-stone-900 placeholder:text-stone-300 bg-transparent resize-none focus:outline-none"
        />

        {/* Footer Actions */}
        <div className="flex items-center justify-end pt-4">
          <button
            type="submit"
            disabled={isSubmitDisabled}
            aria-label={isLoading ? "发布中" : "发布"}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all
              ${isSubmitDisabled
                ? "bg-stone-100 text-stone-300 cursor-not-allowed"
                : "bg-stone-900 text-white hover:scale-105 active:scale-95 shadow-md"
              }
            `}
          >
            {isLoading ? (
              <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>发布</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
