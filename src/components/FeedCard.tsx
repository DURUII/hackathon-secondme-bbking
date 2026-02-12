"use client";

import { useEffect, useState } from "react";
import { MessageCircle, ThumbsUp, ThumbsDown, Zap } from "lucide-react";

interface Comment {
  name: string;
  content: string;
  side: "red" | "blue";
  avatarUrl?: string;
}

interface FeedCardProps {
  id: string;
  content: string;
  arenaType: "toxic" | "comfort" | "rational";
  redRatio: number; // 0-1
  blueRatio: number; // 0-1
  redVotes?: number;
  blueVotes?: number;
  commentCount: number;
  comments?: Comment[]; // New prop for structured comments
  previewComments?: any[]; // Fallback
  isSubscribed?: boolean;
  onToggleSubscribe?: () => void;
  onClick?: () => void;
}

const ARENA_LABEL_MAP: Record<string, string> = {
  toxic: "犀利互怼",
  comfort: "情感共鸣",
  rational: "理性分析",
};

export function FeedCard({
  id,
  content,
  arenaType,
  redRatio,
  blueRatio,
  redVotes,
  blueVotes,
  commentCount,
  comments = [],
  previewComments = [],
  onClick,
}: FeedCardProps) {
  const [mounted, setMounted] = useState(false);

  // Combine comments, preferring structured ones
  const displayComments: Comment[] = (comments && comments.length > 0) 
    ? comments 
    : (previewComments || []).map((c: any) => ({
        name: c.name,
        content: c.content,
        side: c.side,
        avatarUrl: c.avatarUrl
      }));

  // Filter to show at least one from each side if possible, or just top 2
  const redComment = displayComments.find(c => c.side === 'red');
  const blueComment = displayComments.find(c => c.side === 'blue');
  const filteredComments = [redComment, blueComment].filter(Boolean) as Comment[];

  // Fallback if we don't have one of each, just take top 2
  const finalComments = filteredComments.length > 0 ? filteredComments : displayComments.slice(0, 2);

  // Calculate display votes
  const displayRedVotes = redVotes ?? Math.round(commentCount * redRatio);
  const displayBlueVotes = blueVotes ?? (commentCount - displayRedVotes);

  // Ensure minimum visual width (15%) for text visibility
  const MIN_PERCENT = 15;
  let redWidth = redRatio * 100;
  let blueWidth = blueRatio * 100;

  // Normalize widths to ensure space for numbers
  if (redWidth < MIN_PERCENT) {
    redWidth = MIN_PERCENT;
    blueWidth = 100 - MIN_PERCENT;
  } else if (blueWidth < MIN_PERCENT) {
    blueWidth = MIN_PERCENT;
    redWidth = 100 - MIN_PERCENT;
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div 
      onClick={onClick}
      className="bg-[#1E1E1E] mb-6 rounded-2xl shadow-lg border border-stone-800/50 hover:border-stone-700 transition-all cursor-pointer overflow-hidden group"
    >
      <div className="p-5">
        {/* 1. Header */}
        <div className="flex flex-col gap-3 mb-5">
          <h3 className="text-white font-bold text-xl leading-snug tracking-tight font-display">
            {content}
          </h3>
        </div>

        {/* 2. Battle Bar */}
        <div 
          className="relative h-12 w-full rounded-lg overflow-hidden flex mb-6 shadow-inner items-center"
          style={{
            background: `linear-gradient(110deg, #FF4D4F calc(${redWidth}% - 2px), white calc(${redWidth}% - 2px), white calc(${redWidth}% + 2px), #1890FF calc(${redWidth}% + 2px))`
          }}
        >
           {/* Red Vote Count */}
            <div className="absolute left-3 h-full flex items-center z-10">
               <span className="text-white font-black text-2xl drop-shadow-sm">{displayRedVotes}</span>
            </div>

            {/* Blue Vote Count */}
            <div className="absolute right-3 h-full flex items-center z-10">
               <span className="text-white font-black text-2xl drop-shadow-sm">{displayBlueVotes}</span>
            </div>
        </div>

        {/* 3. Comments List */}
        <div className="space-y-4 mb-6">
          {finalComments.map((comment, idx) => (
            <div key={idx} className="flex gap-3 items-start">
              {/* Avatar & Name */}
              <div className="flex flex-col items-center gap-1 flex-shrink-0 w-10">
                <div className="relative w-10 h-10">
                  <div className={`w-full h-full rounded-full border-[3px] overflow-hidden bg-stone-800 ${
                    comment.side === 'red' ? 'border-[#FF4D4F]' : 'border-[#1890FF]'
                  }`}>
                    {comment.avatarUrl ? (
                      <img src={comment.avatarUrl} alt={comment.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-stone-400">
                        {comment.name[0]}
                      </div>
                    )}
                  </div>
                  {/* AI Badge */}
                  <div className="absolute bottom-0 right-0 bg-white text-black text-[8px] font-black px-1 rounded-tl-md leading-tight z-10 shadow-sm">
                    AI
                  </div>
                </div>
                <span className="text-[10px] text-stone-500 font-bold max-w-full truncate text-center leading-tight">
                  {comment.name.replace(/[\(（]AI[\)）]/gi, "")}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className={`p-3 rounded-2xl rounded-tl-none text-sm font-medium leading-relaxed ${
                  comment.side === 'red' 
                    ? 'bg-[#3A1C1C] text-[#E0E0E0]' 
                    : 'bg-[#1C223A] text-[#E0E0E0]'
                }`}>
                  {comment.content}
                </div>
              </div>
            </div>
          ))}
          
          {finalComments.length === 0 && (
             <div className="text-center py-4 text-stone-600 text-xs italic">
                Waiting for agents...
             </div>
          )}
        </div>

        {/* 4. Footer Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button className="bg-[#FF4D4F] hover:bg-[#ff7875] text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 active:scale-[0.98]">
             <span>挺正方</span>
          </button>
          <button className="bg-[#1890FF] hover:bg-[#40a9ff] text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 active:scale-[0.98]">
             <span>挺反方</span>
          </button>
        </div>
      </div>
    </div>
  );
}
