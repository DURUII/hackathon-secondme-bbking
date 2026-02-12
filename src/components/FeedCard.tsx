"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, Share2, Flame, HeartHandshake, Brain } from "lucide-react";
import { generateShareCardBlob } from "@/lib/share-card";

interface FeedCardProps {
  id: string;
  avatarUrl?: string;
  username: string;
  currentUserName?: string;
  timeAgo: string;
  content: string;
  arenaType: "toxic" | "comfort" | "rational";
  redRatio: number; // 0-1
  blueRatio: number; // 0-1
  commentCount: number;
  previewComments: Array<{
    avatar?: string;
    name: string;
    content: string;
    side: "red" | "blue";
  }>;
  onClick?: () => void;
}

const ARENA_ICONS = {
  toxic: { icon: Flame, color: "text-rose-600" },
  comfort: { icon: HeartHandshake, color: "text-emerald-600" },
  rational: { icon: Brain, color: "text-blue-600" },
};

export function FeedCard({
  id,
  avatarUrl,
  username,
  currentUserName,
  timeAgo,
  content,
  arenaType,
  redRatio,
  blueRatio,
  commentCount,
  previewComments,
  onClick,
}: FeedCardProps) {
  const ArenaIcon = ARENA_ICONS[arenaType]?.icon || Flame;
  const arenaColor = ARENA_ICONS[arenaType]?.color || "text-rose-600";
  const [isSharing, setIsSharing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  const arenaLabel = arenaType === "toxic" ? "毒舌场" : arenaType === "comfort" ? "安慰场" : "理性场";
  const myComment =
    previewComments.find((c) => currentUserName && c.name === currentUserName)?.content ||
    previewComments[0]?.content ||
    "";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSharing) return;
    setIsSharing(true);
    try {
      const totalVotes = Math.max(0, commentCount);
      const redVotes = Math.round(totalVotes * redRatio);
      const blueVotes = Math.max(0, totalVotes - redVotes);
      const blob = await generateShareCardBlob({
        id,
        question: content,
        redVotes,
        blueVotes,
        myComment,
      });
      const url = URL.createObjectURL(blob);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
      setPreviewName(`帮我评评理-${id.slice(0, 8)}.png`);
    } catch (error) {
      console.error("[Share] failed", error);
      alert("分享图生成失败，请稍后重试");
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = previewName || `帮我评评理-${id.slice(0, 8)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const closePreview = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-3xl p-6 mb-4 border border-stone-100 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.99]"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="w-8 h-8 rounded-full bg-stone-100 object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-stone-500">
              {username[0]}
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-sm font-medium text-stone-900 leading-none">{username}</span>
            <span className="text-xs text-stone-400 mt-1">{timeAgo}</span>
          </div>
        </div>
        <ArenaIcon className={`w-4 h-4 ${arenaColor}`} />
      </div>

      {/* Content */}
      <p className="text-stone-800 text-base font-medium mb-4 leading-relaxed line-clamp-3">
        {content}
      </p>

      {/* Visual Bar */}
      <div className="flex items-center gap-2 mb-4">
        {commentCount > 0 ? (
          <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden flex">
            <div 
              className="h-full bg-rose-900/80" 
              style={{ width: `${redRatio * 100}%` }}
            />
            <div 
              className="h-full bg-slate-800/80" 
              style={{ width: `${blueRatio * 100}%` }}
            />
          </div>
        ) : (
          <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden flex items-center justify-center">
             <div className="w-full h-full bg-stone-100" />
          </div>
        )}
      </div>

      {/* Preview Comments */}
      {previewComments.length > 0 ? (
        <div className="bg-stone-50 rounded-2xl p-3 space-y-2 mb-4">
          {previewComments.map((comment, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <div className={`w-1 h-1 rounded-full mt-2 flex-shrink-0 ${comment.side === 'red' ? 'bg-rose-900' : 'bg-slate-800'}`} />
              <p className="text-xs text-stone-600 leading-relaxed">
                <span className="font-semibold text-stone-700">{comment.name}: </span>
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-stone-50 rounded-2xl p-3 mb-4 text-center">
          <p className="text-xs text-stone-400">暂无评论，等待 AI 判官入场...</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-stone-400">
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1.5 hover:text-stone-900 transition-colors">
            <MessageCircle className="w-4 h-4" />
            <span className="text-xs">{commentCount} 票</span>
          </button>
          <button 
            className="flex items-center gap-1.5 hover:text-stone-900 transition-colors"
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4" />
            <span className="text-xs">{isSharing ? "生成中..." : "分享"}</span>
          </button>
        </div>
        {commentCount === 0 && (
           <span className="text-xs text-stone-300">1 人关注</span> 
        )}
      </div>

      {mounted && previewUrl && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            closePreview();
          }}
        >
          <div
            className="w-full max-w-[560px] rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewUrl}
              alt="分享预览"
              className="w-full aspect-square rounded-xl border border-stone-200 object-cover"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50"
                onClick={(e) => closePreview(e)}
              >
                关闭
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-stone-900 text-white hover:bg-stone-800"
                onClick={handleDownload}
              >
                下载图片
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
