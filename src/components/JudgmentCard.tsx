"use client";

import { useRef } from "react";
import { Copy, Share2, Zap, Shield, Cpu } from "lucide-react";

interface JudgmentCardProps {
  question: string;
  arenaType: string;
  redRatio: number;
  blueRatio: number;
  topRedComments: string[];
  topBlueComments: string[];
  onShare?: () => void;
  onCopy?: () => void;
}

const ARENA_CONFIG = {
  toxic: { icon: <Zap className="w-4 h-4" />, label: "TOXIC_ARENA", color: "#FF3300" },
  comfort: { icon: <Shield className="w-4 h-4" />, label: "SAFE_ZONE", color: "#00CC00" },
  rational: { icon: <Cpu className="w-4 h-4" />, label: "LOGIC_CORE", color: "#0033FF" },
} as const;

export function JudgmentCard({
  question,
  arenaType,
  redRatio,
  blueRatio,
  topRedComments,
  topBlueComments,
  onShare,
  onCopy,
}: JudgmentCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const config = ARENA_CONFIG[arenaType as keyof typeof ARENA_CONFIG] || ARENA_CONFIG.toxic;

  const formatRatio = (ratio: number) => `${Math.round(ratio * 100)}%`;

  // Calculate widths for the "Tug of War" bar
  const redPercent = Math.round(redRatio * 100);
  const bluePercent = Math.round(blueRatio * 100);
  
  // Ensure minimum width for text visibility if there are votes
  let redWidth = redPercent;
  let blueWidth = bluePercent;
  
  if (redPercent > 0 || bluePercent > 0) {
    if (redWidth < 15 && redWidth > 0) {
      redWidth = 15;
      blueWidth = 85;
    } else if (blueWidth < 15 && blueWidth > 0) {
      blueWidth = 15;
      redWidth = 85;
    }
  } else {
    // Default 50/50 if no votes
    redWidth = 50;
    blueWidth = 50;
  }

  const handleShare = () => {
    onShare?.();
  };

  const handleCopy = () => {
    const allComments = [...topRedComments, ...topBlueComments].join("\n");
    navigator.clipboard.writeText(allComments);
    onCopy?.();
  };

  return (
    <div className="max-w-md mx-auto">
      {/* Main Card */}
      <div
        ref={cardRef}
        className="bg-[#1E1E1E] border border-white/10 rounded-xl overflow-hidden shadow-2xl relative"
      >
        {/* Decorative top accent */}
        <div className="h-1 w-full bg-gradient-to-r from-[#FF4D4F] via-white/20 to-[#1890FF]"></div>

        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2">
                <span className="text-xl">⚖️</span>
                <h1 className="text-xl font-bold text-white font-display tracking-wide">
                  最终判决 (FINAL JUDGMENT)
                </h1>
             </div>
             <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                <span style={{ color: config.color }}>{config.icon}</span>
                <span className="text-xs font-bold text-white/70">{config.label}</span>
             </div>
          </div>
          
          <h2 className="text-lg font-bold text-white leading-relaxed mb-6">
            "{question}"
          </h2>
        </div>

        {/* Visual Tug of War */}
        <div className="px-6 mb-8">
           <div className="flex justify-between items-end mb-3">
            <div className="text-[#FF4D4F] font-bold flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-[#FF4D4F] rounded-full"></div>
              <span>正方 (PRO)</span>
            </div>
            <div className="text-[#1890FF] font-bold flex items-center gap-2 text-sm">
              <span>反方 (CON)</span>
              <div className="w-2 h-2 bg-[#1890FF] rounded-full"></div>
            </div>
          </div>
          
          <div 
            className="relative h-12 w-full rounded-lg overflow-hidden flex shadow-inner bg-black/20 items-center"
            style={{
              background: `linear-gradient(110deg, #FF4D4F calc(${redWidth}% - 2px), white calc(${redWidth}% - 2px), white calc(${redWidth}% + 2px), #1890FF calc(${redWidth}% + 2px))`
            }}
          >
            <div className="absolute left-4 h-full flex items-center z-10">
               <span className="text-white font-black text-xl drop-shadow-md">{redPercent}%</span>
             </div>
             <div className="absolute right-4 h-full flex items-center z-10">
               <span className="text-white font-black text-xl drop-shadow-md">{bluePercent}%</span>
             </div>
          </div>
        </div>

        {/* Top Arguments */}
        <div className="px-6 pb-6 space-y-6">
           {/* Red Arguments */}
           <div>
             <h3 className="text-xs font-bold text-[#FF4D4F] mb-3 uppercase tracking-wider">Top Red Arguments</h3>
             <div className="space-y-3">
               {topRedComments.length > 0 ? (
                 topRedComments.map((comment, i) => (
                   <div key={i} className="flex gap-3 text-sm text-white/90 bg-[#FF4D4F]/5 p-3 rounded-lg border border-[#FF4D4F]/10">
                     <span className="text-[#FF4D4F] font-bold shrink-0 mt-0.5">0{i+1}</span>
                     <p className="leading-relaxed">{comment}</p>
                   </div>
                 ))
               ) : (
                 <p className="text-xs text-white/30 italic">No arguments yet</p>
               )}
             </div>
           </div>

           {/* Blue Arguments */}
           <div>
             <h3 className="text-xs font-bold text-[#1890FF] mb-3 uppercase tracking-wider">Top Blue Arguments</h3>
             <div className="space-y-3">
               {topBlueComments.length > 0 ? (
                 topBlueComments.map((comment, i) => (
                   <div key={i} className="flex gap-3 text-sm text-white/90 bg-[#1890FF]/5 p-3 rounded-lg border border-[#1890FF]/10">
                     <span className="text-[#1890FF] font-bold shrink-0 mt-0.5">0{i+1}</span>
                     <p className="leading-relaxed">{comment}</p>
                   </div>
                 ))
               ) : (
                 <p className="text-xs text-white/30 italic">No arguments yet</p>
               )}
             </div>
           </div>
        </div>

        {/* Footer */}
        <div className="bg-white/5 p-4 border-t border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-[#FFFF00] rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">AI Verdict Finalized</span>
          </div>
          <div className="flex gap-2">
            {onCopy && (
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 transition-all"
              >
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </button>
            )}
            {onShare && (
              <button
                onClick={handleShare}
                className="px-3 py-1.5 rounded-lg bg-white text-black hover:bg-white/90 text-xs font-bold flex items-center gap-2 transition-all shadow-lg"
              >
                <Share2 className="w-3 h-3" />
                <span>Share</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
