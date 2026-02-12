"use client";

import { Brain } from "lucide-react";

interface DebateCommentCardProps {
  side: "red" | "blue";
  name: string;
  avatarUrl?: string;
  content: string;
  tags?: string[];
  isWinner?: boolean;
}

export function DebateCommentCard({
  side,
  name,
  avatarUrl,
  content,
  tags = [],
}: DebateCommentCardProps) {
  const isRed = side === "red";
  
  return (
    <div className="flex gap-4 items-start group">
      {/* Avatar */}
      <div className="relative w-12 h-12 flex-shrink-0">
        <div className={`w-full h-full rounded-full border-[3px] overflow-hidden bg-stone-800 ${
          isRed ? 'border-[#FF4D4F]' : 'border-[#1890FF]'
        }`}>
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt={name} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-bold text-stone-400">
              {name[0]}
            </div>
          )}
        </div>
        {/* AI Badge */}
        <div className={`absolute -bottom-0.5 -right-0.5 ${isRed ? 'bg-[#FF4D4F]' : 'bg-[#1890FF]'} p-0.5 rounded-full border border-[#1E1E1E] z-10`}>
           <Brain className="w-2.5 h-2.5 text-white" />
        </div>
      </div>

      {/* Content Bubble */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-stone-400 text-xs font-bold uppercase tracking-wider">{name}</span>
          {tags.map((tag, idx) => (
            <span key={idx} className={`text-[10px] px-1.5 py-0.5 rounded ${
              isRed ? 'bg-[#3A1C1C] text-[#FF4D4F]' : 'bg-[#1C223A] text-[#1890FF]'
            }`}>
              {tag}
            </span>
          ))}
        </div>
        
        <div className={`p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${
          isRed 
            ? 'bg-[#3A1C1C] text-[#E0E0E0] rounded-tl-none' 
            : 'bg-[#1C223A] text-[#E0E0E0] rounded-tl-none'
        }`}>
          {content}
        </div>
      </div>
    </div>
  );
}
