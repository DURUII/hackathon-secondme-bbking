"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { QuestionInput } from "@/components/QuestionInput";
import { FeedCard } from "@/components/FeedCard";
import { ArenaDisplay } from "@/components/ArenaDisplay";
import { User, Loader2 } from "lucide-react";

interface UserInfo {
  name: string;
  avatarUrl?: string;
}

interface FeedItem {
  id: string;
  creatorUserId?: string | null;
  userInfo: {
    name: string;
    avatarUrl?: string;
  };
  timeAgo: string;
  content: string;
  arenaType: "toxic" | "comfort" | "rational";
  status: "pending" | "collected";
  redVotes: number;
  blueVotes: number;
  redRatio: number;
  blueRatio: number;
  commentCount: number;
  debateTurns: Array<{
    speakerId: string;
    role: string;
    content: string;
    type: string;
  }>;
  previewComments: Array<{
    name: string;
    content: string;
    side: "red" | "blue";
  }>;
  structuredComments?: Array<{
    id: string;
    name: string;
    avatarUrl?: string;
    content: string;
    side: "red" | "blue";
    tags?: string[];
  }>;
  fullComments: {
    red: string[];
    blue: string[];
  };
}

type FeedTab = "all" | "proposed" | "subscribed";

export default function PilFeature() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [stats, setStats] = useState({ totalParticipants: 0, totalQuestions: 0 });
  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const publishInFlightRef = useRef(false);

  const userName = userInfo?.name;

  // Fetch Feed
  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/feed");
      const raw = await res.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        console.error("[FEED HTTP ERROR]", {
          status: res.status,
          statusText: res.statusText,
          body: raw.slice(0, 300),
        });
        return;
      }

      if (data?.success) {
        setFeedItems(Array.isArray(data.data) ? data.data : []);
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        console.error("[FEED ERROR]", {
          status: res.status,
          payload: data,
          raw: raw.slice(0, 300),
        });
      }
    } catch (error) {
      console.error("Failed to fetch feed", error);
    } finally {
      setIsLoadingFeed(false);
    }
  }, []);

  // Frontend Heartbeat Trigger (Simulating Cron)
  useEffect(() => {
    const interval = setInterval(() => {
      // Only trigger if tab is visible
      if (document.visibilityState === 'visible') {
        fetch('/api/cron/heartbeat', { method: 'POST' }).catch(e => console.error('Heartbeat failed', e));
      }
    }, 30000); // Trigger every 30s to avoid overloading DB on free tiers
    return () => clearInterval(interval);
  }, []);

  // Poll Feed Updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchFeed();
      }
    }, 10000); // Poll feed every 10s to reduce connection pressure
    return () => clearInterval(interval);
  }, [fetchFeed]);

  // Initial Fetch
  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Fetch User Info
  useEffect(() => {
    async function fetchUserInfo() {
      try {
        const userRes = await fetch("/api/secondme/user/info");
        const userData = await userRes.json();

        // Unauthorized - do not redirect, just leave userInfo null
        if (userRes.status === 401 || userData.code === 401) {
          return;
        }

        if (userData.code === 0 && userData.data) {
          const name = userData.data.name || userData.data.nickname || "我";
          const avatarUrl = userData.data.avatar || userData.data.avatarUrl;
          setUserInfo({ name, avatarUrl });
        }

        // Register (Silent)
        const regRes = await fetch("/api/register", { method: "POST" });
        const regData = await regRes.json();

        if (regData.success) {
          if (typeof regData.data?.userId === "string") {
            setCurrentUserId(regData.data.userId);
          }
          // Trigger backfill for new/existing participant to vote on recent questions
          fetch("/api/backfill", { method: "POST" }).catch(console.error);
        }
      } catch (error) {
        console.error("Failed to fetch user info", error);
      }
    }
    fetchUserInfo();
  }, []);

  // Removed redundant definition of fetchFeed here (it was moved up)
  // const fetchFeed = useCallback(...) 

  // Initial Fetch moved to up too

  const handlePublish = async (data: { content: string }) => {
    if (!currentUserId) {
      window.location.href = "/api/auth/login";
      return;
    }

    if (publishInFlightRef.current) {
      return;
    }
    publishInFlightRef.current = true;
    setIsPolling(true);
    
    // 1. Optimistic Add to Feed
    const newItem: FeedItem = {
      id: Date.now().toString(),
      userInfo: {
        name: userInfo?.name || "我",
        avatarUrl: userInfo?.avatarUrl,
      },
      creatorUserId: currentUserId,
      timeAgo: "刚刚",
      content: data.content,
      arenaType: "toxic",
      status: "pending",
      redVotes: 0,
      blueVotes: 0,
      redRatio: 0.5,
      blueRatio: 0.5,
      commentCount: 0,
      previewComments: [],
      structuredComments: [],
      fullComments: { red: [], blue: [] },
      debateTurns: [],
    };

    setFeedItems((prev) => [newItem, ...prev]);
    setExpandedId(newItem.id); // Auto expand to show progress

    try {
      // 2. Call API
      const publishRes = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const publishData = await publishRes.json();
      
      if (publishData.success) {
        const qId = publishData.data.id;
        
        // Update Feed Item with Real ID
        setFeedItems((prev) => prev.map(item => {
          if (item.id === newItem.id) {
            return {
              ...item,
              id: qId,
            };
          }
          return item;
        }));
        
        // Trigger immediate fetch to sync state
        fetchFeed();
      } else {
        // Rollback optimistic item when backend rejects request.
        setFeedItems((prev) => prev.filter((item) => item.id !== newItem.id));
        setExpandedId((prev) => (prev === newItem.id ? null : prev));
        alert(publishData.error || "发布失败，请重试");
      }
    } catch (error) {
      console.error("Publish flow failed", error);
      setFeedItems((prev) => prev.filter((item) => item.id !== newItem.id));
      setExpandedId((prev) => (prev === newItem.id ? null : prev));
      alert("发布失败，请重试");
    } finally {
      setIsPolling(false);
      publishInFlightRef.current = false;
    }
  };

  const handleOpenItem = useCallback((itemId: string) => {
    setExpandedId(itemId);
    fetch("/api/question/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: itemId }),
    }).catch((err) => console.error("Failed to enqueue question view", err));
  }, []);

  const filteredFeedItems = feedItems.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "proposed") return Boolean(currentUserId && item.creatorUserId === currentUserId);
    return true;
  });

  return (
    <div className="min-h-screen bg-[#121212] pb-20 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#121212]/80 backdrop-blur-xl border-b border-white/5 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="relative">
               <h1 className="text-2xl font-bold text-white font-display tracking-wide">
                 奇葩说
               </h1>
               <span className="absolute -top-2 -right-6 scale-75 origin-bottom-left text-[10px] font-bold text-black bg-white px-1.5 py-0.5 rounded-full shadow-lg">
                 AI版
               </span>
             </div>
          </div>
          <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 overflow-hidden">
            {userInfo?.avatarUrl ? (
              <img src={userInfo.avatarUrl} alt="User" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/30">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6 space-y-8">
        
        {/* Publisher */}
        <section>
          <QuestionInput 
            onSubmit={handlePublish}
            isLoading={isPolling}
            userAvatar={userInfo?.avatarUrl}
          />
        </section>

        {/* Square Feed */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="inline-flex p-1 bg-white/5 rounded-lg border border-white/5">
              {[
                { key: "all" as const, label: "全部" },
                { key: "proposed" as const, label: "我发布的" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-1.5 text-xs font-bold transition-all rounded-md ${
                    activeTab === tab.key
                      ? "bg-white text-black shadow-sm"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {stats.totalParticipants > 0 && (
              <div className="flex items-center gap-3 text-xs text-white/30 font-bold">
                 <span>{stats.totalParticipants} 辩手在线</span>
                 <span className="w-px h-3 bg-white/10"></span>
                 <span>{stats.totalQuestions} 个话题</span>
              </div>
            )}
          </div>
          
          {isLoadingFeed ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-white/20" />
            </div>
          ) : (
            <div className="space-y-6">
              {filteredFeedItems.map((item) => (
                <div key={item.id} className="transition-all duration-300">
                  {expandedId === item.id ? (
                    <div className="relative group">
                      {/* Control Bar for Expanded View */}
                      <div className="absolute top-4 right-4 z-20 flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setExpandedId(null); }}
                          className="px-3 py-1.5 text-xs font-bold text-white/70 hover:text-white bg-black/50 hover:bg-black/80 backdrop-blur-md rounded-lg transition-all border border-white/10"
                        >
                          收起
                        </button>
                      </div>

                      <ArenaDisplay
                        question={item.content}
                        arenaType={item.arenaType}
                        isLoading={item.status === "pending"}
                        status={item.status}
                        redRatio={item.redRatio}
                        blueRatio={item.blueRatio}
                        redVotes={item.redVotes}
                        blueVotes={item.blueVotes}
                        comments={item.structuredComments}
                      />
                    </div>
                  ) : (
                    <FeedCard
                      id={item.id}
                      content={item.content}
                      arenaType={item.arenaType}
                      redRatio={item.redRatio}
                      blueRatio={item.blueRatio}
                      redVotes={item.redVotes}
                      blueVotes={item.blueVotes}
                      commentCount={item.commentCount}
                      previewComments={item.previewComments}
                      comments={item.structuredComments}
                      onClick={() => handleOpenItem(item.id)}
                    />
                  )}
                </div>
              ))}
              
              {filteredFeedItems.length === 0 && (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-white/20">
                    <User className="w-8 h-8" />
                  </div>
                  <p className="text-white/30 text-sm font-bold">
                    {activeTab === "all"
                      ? "暂时还没有话题，快来发布第一个吧！"
                      : "你还没有发布过话题"}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
