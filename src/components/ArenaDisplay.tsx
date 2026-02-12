"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { DebateCommentCard } from "./DebateCommentCard";

interface Comment {
  id: string;
  name: string;
  avatarUrl?: string;
  content: string;
  side: "red" | "blue";
  tags?: string[];
}

interface ArenaDisplayProps {
  question: string;
  arenaType: string;
  isLoading?: boolean;
  status?: "pending" | "collected";
  redRatio?: number;
  blueRatio?: number;
  redVotes?: number;
  blueVotes?: number;
  comments?: Comment[];
  onViewResult?: () => void;
}

const ARENA_LABEL_MAP: Record<string, string> = {
  toxic: "犀利互怼",
  comfort: "情感共鸣",
  rational: "理性分析",
};

export function ArenaDisplay({
  question,
  arenaType,
  isLoading = false,
  status = "pending",
  redRatio = 0,
  blueRatio = 0,
  redVotes,
  blueVotes,
  comments = [],
  onViewResult,
}: ArenaDisplayProps) {
  const [animatedRed, setAnimatedRed] = useState(0);
  const [animatedBlue, setAnimatedBlue] = useState(0);

  // Filter comments
  const redComments = comments.filter(c => c.side === 'red');
  const blueComments = comments.filter(c => c.side === 'blue');

  useEffect(() => {
    if (status === "collected") {
      const duration = 1000;
      const steps = 60;

      // Ensure minimum visual width (15%)
      const MIN_PERCENT = 15;
      let targetRedPercent = redRatio * 100;
      let targetBluePercent = blueRatio * 100;

      if (targetRedPercent < MIN_PERCENT) {
        targetRedPercent = MIN_PERCENT;
        targetBluePercent = 100 - MIN_PERCENT;
      } else if (targetBluePercent < MIN_PERCENT) {
        targetBluePercent = MIN_PERCENT;
        targetRedPercent = 100 - MIN_PERCENT;
      }

      const targetRed = targetRedPercent / 100;
      const targetBlue = targetBluePercent / 100;

      const incrementRed = targetRed / steps;
      const incrementBlue = targetBlue / steps;

      let currentStep = 0;
      const timer = setInterval(() => {
        currentStep++;
        setAnimatedRed(Math.min(currentStep * incrementRed, targetRed));
        setAnimatedBlue(Math.min(currentStep * incrementBlue, targetBlue));

        if (currentStep >= steps) {
          clearInterval(timer);
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }
  }, [status, redRatio, blueRatio]);

  return (
    <div className="w-full max-w-md mx-auto bg-[#1E1E1E] rounded-2xl shadow-xl border border-stone-800/50 overflow-hidden relative">
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex items-start justify-between">
             <span className="bg-[#FADB14] text-black text-[10px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
               {ARENA_LABEL_MAP[arenaType] || "热门话题"}
             </span>
          </div>
          <h3 className="text-white font-bold text-xl leading-snug tracking-tight font-display">
            {question}
          </h3>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-2 text-stone-400 font-medium text-sm animate-pulse">
              <Loader2 className="animate-spin w-4 h-4" />
              <span>Analyzing...</span>
            </div>
          </div>
        ) : status === "pending" ? (
          <div className="text-center py-12 text-stone-500 font-medium text-sm">
            <p className="mb-2 text-[#FADB14]">Waiting for participants...</p>
            <p className="text-stone-600">The debate will start soon</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Battle Bar */}
            <div 
              className="relative h-12 w-full rounded-lg overflow-hidden flex shadow-inner items-center"
              style={{
                background: `linear-gradient(110deg, #FF4D4F calc(${animatedRed * 100}% - 2px), white calc(${animatedRed * 100}% - 2px), white calc(${animatedRed * 100}% + 2px), #1890FF calc(${animatedRed * 100}% + 2px), #1890FF calc(${(animatedRed + animatedBlue) * 100}%), transparent calc(${(animatedRed + animatedBlue) * 100}%))`
              }}
            >
               {/* Red Side */}
               <div className="absolute left-4 h-full flex items-center z-10">
                  {animatedRed > 0.1 && (
                    <span className="text-white font-black text-2xl drop-shadow-sm">{redVotes}</span>
                  )}
               </div>

               {/* Blue Side */}
               <div className="absolute right-4 h-full flex items-center z-10">
                  {animatedBlue > 0.1 && (
                    <span className="text-white font-black text-2xl drop-shadow-sm">{blueVotes}</span>
                  )}
               </div>
            </div>

            {/* Comments Columns */}
            <div className="space-y-8">
              {/* Red Comments */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#FF4D4F] uppercase tracking-wider flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#FF4D4F]"></div>
                  正方观点 (PRO)
                </h4>
                <div className="space-y-4">
                  {redComments.length > 0 ? (
                    redComments.map((comment) => (
                      <DebateCommentCard
                        key={comment.id}
                        side="red"
                        name={comment.name}
                        avatarUrl={comment.avatarUrl}
                        content={comment.content}
                        tags={comment.tags}
                      />
                    ))
                  ) : (
                    <div className="text-center py-4 text-stone-600 text-xs italic">Waiting for input...</div>
                  )}
                </div>
              </div>

              {/* Blue Comments */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#1890FF] uppercase tracking-wider flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#1890FF]"></div>
                  反方观点 (CON)
                </h4>
                <div className="space-y-4">
                  {blueComments.length > 0 ? (
                    blueComments.map((comment) => (
                      <DebateCommentCard
                        key={comment.id}
                        side="blue"
                        name={comment.name}
                        avatarUrl={comment.avatarUrl}
                        content={comment.content}
                        tags={comment.tags}
                      />
                    ))
                  ) : (
                    <div className="text-center py-4 text-stone-600 text-xs italic">Waiting for input...</div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
