"use client";

import { useState, useEffect, useRef } from "react";
import { Send, X, User } from "lucide-react";

interface QuestionInputProps {
  onSubmit: (data: { content: string }) => void;
  isLoading?: boolean;
  initialContent?: string;
  userAvatar?: string;
}

export function QuestionInput({ 
  onSubmit, 
  isLoading = false, 
  initialContent,
  userAvatar 
}: QuestionInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const MAX_LENGTH = 25;

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
    });
    // Don't collapse immediately, let parent handle success/reset
  };

  const isSubmitDisabled = isLoading || content.trim().length === 0;

  if (!isExpanded) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        className="w-full max-w-md mx-auto bg-[#1E1E1E] border border-white/10 p-4 flex items-center gap-4 cursor-text hover:border-white/20 transition-all shadow-lg rounded-xl group"
      >
        <span className="text-white/30 font-sans text-sm font-medium group-hover:text-white/50 transition-colors">发布一个没有标答的辩题...</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full max-w-md mx-auto bg-[#1E1E1E] border border-white/10 shadow-2xl rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <form onSubmit={handleSubmit} className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-white/50 text-xs font-bold uppercase tracking-wider">
            发表新话题
          </div>
          <button 
            type="button" 
            onClick={() => setIsExpanded(false)}
            className="text-white/30 hover:text-white p-1 transition-colors"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Textarea */}
        <div className="relative">
          <textarea
            value={content}
            onChange={(e) => {
              if (e.target.value.length <= MAX_LENGTH) {
                setContent(e.target.value);
              }
            }}
            placeholder="请输入你需要大家评理的事情经过..."
            disabled={isLoading}
            autoFocus
            className="w-full h-32 text-base text-white placeholder:text-white/20 bg-transparent resize-none focus:outline-none font-sans leading-relaxed"
            maxLength={MAX_LENGTH}
          />
          <div className="absolute bottom-0 right-0 text-xs font-bold text-white/20">
            {content.length}/{MAX_LENGTH}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end pt-4 border-t border-white/5 mt-2">
          <button
            type="submit"
            disabled={isSubmitDisabled}
            aria-label={isLoading ? "发布中" : "发布"}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-sm transition-all
              ${isSubmitDisabled
                ? "bg-white/5 text-white/20 cursor-not-allowed"
                : "bg-[#FF4D4F] text-white hover:bg-[#ff7875] active:scale-95 shadow-lg shadow-red-500/20"
              }
            `}
          >
            {isLoading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>发布话题</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
