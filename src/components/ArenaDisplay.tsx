"use client";

import { useEffect, useState } from "react";
import { Flame, HeartHandshake, Brain, Loader2 } from "lucide-react";

interface ArenaDisplayProps {
  question: string;
  arenaType: string;
  isLoading?: boolean;
  status?: "pending" | "collected";
  redRatio?: number;
  blueRatio?: number;
  topRedComments?: string[];
  topBlueComments?: string[];
  onViewResult?: () => void;
}

const ARENA_CONFIG = {
  toxic: { icon: Flame, label: "毒舌场", color: "text-rose-600" },
  comfort: { icon: HeartHandshake, label: "安慰场", color: "text-emerald-600" },
  rational: { icon: Brain, label: "理性场", color: "text-blue-600" },
} as const;

export function ArenaDisplay({
  question,
  arenaType,
  isLoading = false,
  status = "pending",
  redRatio = 0,
  blueRatio = 0,
  topRedComments = [],
  topBlueComments = [],
  onViewResult,
}: ArenaDisplayProps) {
  const config = ARENA_CONFIG[arenaType as keyof typeof ARENA_CONFIG] || ARENA_CONFIG.toxic;
  const Icon = config.icon;
  
  const [animatedRed, setAnimatedRed] = useState(0);
  const [animatedBlue, setAnimatedBlue] = useState(0);

  useEffect(() => {
    if (status === "collected") {
      const duration = 1000;
      const steps = 60;
      const incrementRed = redRatio / steps;
      const incrementBlue = blueRatio / steps;

      let currentStep = 0;
      const timer = setInterval(() => {
        currentStep++;
        setAnimatedRed(Math.min(currentStep * incrementRed, redRatio));
        setAnimatedBlue(Math.min(currentStep * incrementBlue, blueRatio));

        if (currentStep >= steps) {
          clearInterval(timer);
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }
  }, [status, redRatio, blueRatio]);

  const formatRatio = (ratio: number) => `${Math.round(ratio * 100)}%`;

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-lg border border-stone-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-stone-100 flex items-center gap-2 bg-stone-50/50">
        <Icon className={`w-5 h-5 ${config.color}`} />
        <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-lg font-medium text-stone-900 mb-6 leading-relaxed">
          {question}
        </h3>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-2 text-stone-500">
              <Loader2 className="animate-spin w-5 h-5" />
              <span className="text-sm">AI 正在评理中...</span>
            </div>
          </div>
        ) : status === "pending" ? (
          <div className="text-center py-8 text-stone-400">
            <p>正在生成 AI 分身回答...</p>
            <p className="text-xs mt-2 text-stone-300">稍后会同步票数与理据</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                <span className="text-rose-700">红方 {formatRatio(animatedRed)}</span>
                <span className="text-slate-700">蓝方 {formatRatio(animatedBlue)}</span>
              </div>
              <div className="h-3 bg-stone-100 rounded-full overflow-hidden flex">
                <div 
                  data-testid="red-progress"
                  className="h-full bg-rose-900/90 transition-all duration-500 ease-out" 
                  style={{ width: `${animatedRed * 100}%` }}
                />
                <div 
                  data-testid="blue-progress"
                  className="h-full bg-slate-800/90 transition-all duration-500 ease-out" 
                  style={{ width: `${animatedBlue * 100}%` }}
                />
              </div>
            </div>

            {/* Comments Grid */}
            <div className="grid grid-cols-1 gap-4">
              {/* Red Comments */}
              <div className="bg-rose-50/50 rounded-2xl p-4">
                <h4 className="text-xs font-bold text-rose-800 mb-3 uppercase tracking-wide flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-800"></div>
                  红方观点
                </h4>
                <ul className="space-y-3">
                  {topRedComments.length > 0 ? (
                    topRedComments.map((comment, i) => (
                      <li key={i} className="text-sm text-rose-900/80 leading-relaxed border-l-2 border-rose-200 pl-3">
                        {comment}
                      </li>
                    ))
                  ) : (
                    <li className="text-xs text-stone-400">暂无评论</li>
                  )}
                </ul>
              </div>

              {/* Blue Comments */}
              <div className="bg-slate-50/50 rounded-2xl p-4">
                <h4 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wide flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
                  蓝方观点
                </h4>
                <ul className="space-y-3">
                  {topBlueComments.length > 0 ? (
                    topBlueComments.map((comment, i) => (
                      <li key={i} className="text-sm text-slate-900/80 leading-relaxed border-l-2 border-slate-200 pl-3">
                        {comment}
                      </li>
                    ))
                  ) : (
                    <li className="text-xs text-stone-400">暂无评论</li>
                  )}
                </ul>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
