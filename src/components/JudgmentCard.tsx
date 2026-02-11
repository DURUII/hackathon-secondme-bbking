"use client";

import { useRef, useState } from "react";

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
  toxic: { icon: "🔥", label: "毒舌场", color: "red" },
  comfort: { icon: "💚", label: "安慰场", color: "green" },
  rational: { icon: "🧠", label: "理性场", color: "blue" },
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
        className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-3xl shadow-2xl overflow-hidden text-white"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {/* Header */}
        <div className={`bg-gradient-to-r from-${config.color}-600 to-${config.color}-700 p-6 text-center`}>
          <h1 className="text-2xl font-bold tracking-wider mb-2">帮我评评理</h1>
          <div className={`inline-flex items-center gap-2 bg-${config.color}-500 px-4 py-1.5 rounded-full text-sm font-medium`}>
            <span>{config.icon}</span>
            <span>{config.label}</span>
          </div>
        </div>

        {/* Question */}
        <div className="p-6 bg-gray-800/50">
          <p className="text-lg font-bold text-center leading-relaxed">{question}</p>
        </div>

        {/* Results */}
        <div className="p-6 space-y-4">
          {/* Red Side */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-red-400">🔴</span>
                <span className="font-bold text-red-400">红方</span>
              </div>
              <span className="text-2xl font-bold text-red-400">{formatRatio(redRatio)}</span>
            </div>
            <div className="h-6 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full"
                style={{ width: formatRatio(redRatio) }}
              />
            </div>
            <div className="space-y-1">
              {topRedComments.length > 0 ? (
                topRedComments.map((comment, i) => (
                  <p key={i} className="text-sm text-red-200 pl-4 border-l-2 border-red-500/50">
                    {comment}
                  </p>
                ))
              ) : (
                <p className="text-sm text-gray-500 italic">暂无金句</p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700 my-4" />

          {/* Blue Side */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-blue-400">🔵</span>
                <span className="font-bold text-blue-400">蓝方</span>
              </div>
              <span className="text-2xl font-bold text-blue-400">{formatRatio(blueRatio)}</span>
            </div>
            <div className="h-6 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                style={{ width: formatRatio(blueRatio) }}
              />
            </div>
            <div className="space-y-1">
              {topBlueComments.length > 0 ? (
                topBlueComments.map((comment, i) => (
                  <p key={i} className="text-sm text-blue-200 pl-4 border-l-2 border-blue-500/50">
                    {comment}
                  </p>
                ))
              ) : (
                <p className="text-sm text-gray-500 italic">暂无金句</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-900/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">AI判决书</span>
          </div>
          <div className="flex gap-2">
            {onCopy && (
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                复制金句
              </button>
            )}
            {onShare && (
              <button
                onClick={handleShare}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                分享判决
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
