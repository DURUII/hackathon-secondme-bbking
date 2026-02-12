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
  const [subscribedIds, setSubscribedIds] = useState<string[]>([]);
  const publishInFlightRef = useRef(false);

  const userName = userInfo?.name;

  const fetchSubscriptions = useCallback(async () => {
    try {
      const res = await fetch("/api/subscription", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        const ids = Array.isArray(data.data?.questionIds)
          ? data.data.questionIds.filter((id: unknown) => typeof id === "string")
          : [];
        setSubscribedIds(ids);
      }
    } catch (error) {
      console.error("Failed to fetch subscriptions", error);
    }
  }, []);

  // Fetch Feed
  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/feed");
      const data = await res.json();
      if (data.success) {
        setFeedItems(data.data);
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        // Show error to user
        setFeedItems([]);
        console.error('[FEED ERROR]', data);
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

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const setSubscribed = useCallback(async (questionId: string, subscribed: boolean) => {
    setSubscribedIds((prev) => {
      if (subscribed) {
        return prev.includes(questionId) ? prev : [...prev, questionId];
      }
      return prev.filter((id) => id !== questionId);
    });

    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, subscribed }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
    } catch (error) {
      setSubscribedIds((prev) => {
        if (subscribed) {
          return prev.filter((id) => id !== questionId);
        }
        return prev.includes(questionId) ? prev : [...prev, questionId];
      });
      console.error("Failed to update subscription", error);
      alert("关注状态更新失败，请重试");
    }
  }, []);

  const toggleSubscribed = useCallback((questionId: string) => {
    const isSubscribed = subscribedIds.includes(questionId);
    setSubscribed(questionId, !isSubscribed);
  }, [setSubscribed, subscribedIds]);

  const handleDeleteQuestion = useCallback(async (questionId: string) => {
    const ok = window.confirm("确认删除这个问题？删除后不会在列表展示。");
    if (!ok) return;

    const prevFeedItems = feedItems;
    const prevExpandedId = expandedId;
    const prevSubscribedIds = subscribedIds;

    setFeedItems((prev) => prev.filter((item) => item.id !== questionId));
    setSubscribedIds((prev) => prev.filter((id) => id !== questionId));
    setExpandedId((prev) => (prev === questionId ? null : prev));

    try {
      const res = await fetch("/api/question/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
    } catch (error) {
      setFeedItems(prevFeedItems);
      setExpandedId(prevExpandedId);
      setSubscribedIds(prevSubscribedIds);
      console.error("Failed to delete question", error);
      alert("删除失败，请重试");
    }
  }, [expandedId, feedItems, subscribedIds]);

  // Fetch User Info
  useEffect(() => {
    async function fetchUserInfo() {
      try {
        const userRes = await fetch("/api/secondme/user/info");
        const userData = await userRes.json();

        // Unauthorized - redirect to login
        if (userRes.status === 401 || userData.code === 401) {
          window.location.href = "/api/auth/login";
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
          fetchSubscriptions();
        }
      } catch (error) {
        console.error("Failed to fetch user info", error);
        // Network error - redirect to login
        window.location.href = "/api/auth/login";
      }
    }
    fetchUserInfo();
  }, [fetchSubscriptions]);

  // Removed redundant definition of fetchFeed here (it was moved up)
  // const fetchFeed = useCallback(...) 

  // Initial Fetch moved to up too

  const handlePublish = async (data: { content: string; arenaType: string }) => {
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
      arenaType: data.arenaType as any,
      status: "pending",
      redVotes: 0,
      blueVotes: 0,
      redRatio: 0.5,
      blueRatio: 0.5,
      commentCount: 0,
      previewComments: [],
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
    return subscribedIds.includes(item.id);
  });

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-stone-50/90 backdrop-blur-md border-b border-stone-100 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
             {/* <Flame className="w-6 h-6 text-stone-900" /> */} 
             {/* Using simple text logo for cleaner look as per design */}
             <h1 className="text-xl font-black tracking-tight text-stone-900">
               评理
             </h1>
          </div>
          <div className="w-8 h-8 rounded-full bg-stone-200 overflow-hidden">
            {userInfo?.avatarUrl ? (
              <img src={userInfo.avatarUrl} alt="User" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-500">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 space-y-6">
        
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
          <div className="flex items-center justify-between mb-4 pl-2 pr-2">
            <div className="inline-flex p-1 rounded-full border border-stone-200 bg-white">
              {[
                { key: "all" as const, label: "All" },
                { key: "proposed" as const, label: "Proposed" },
                { key: "subscribed" as const, label: "Subscribed" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    activeTab === tab.key
                      ? "bg-stone-900 text-white"
                      : "text-stone-500 hover:text-stone-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {stats.totalParticipants > 0 && (
              <div className="flex items-center gap-3 text-xs text-stone-400">
                 <span>{stats.totalParticipants} 人参与</span>
                 <span className="w-px h-3 bg-stone-300"></span>
                 <span>{stats.totalQuestions} 话题</span>
              </div>
            )}
          </div>
          
          {isLoadingFeed ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFeedItems.map((item) => (
                <div key={item.id} className="transition-all duration-300">
                  {expandedId === item.id ? (
                    <div className="relative">
                      <ArenaDisplay
                        question={item.content}
                        arenaType={item.arenaType}
                        isLoading={item.status === "pending"}
                        status={item.status}
                        redRatio={item.redRatio}
                        blueRatio={item.blueRatio}
                        topRedComments={item.fullComments.red}
                        topBlueComments={item.fullComments.blue}
                      />
                      <button 
                        onClick={() => setExpandedId(null)}
                        className="absolute top-4 right-4 text-stone-400 hover:text-stone-900 bg-white/70 rounded-full px-2 py-1"
                        aria-label="收起"
                      >
                        <span className="text-xs font-bold uppercase">收起</span>
                      </button>
                      <button
                        onClick={() => toggleSubscribed(item.id)}
                        className={`absolute top-4 right-20 rounded-full px-2.5 py-1 text-xs font-semibold border ${
                          subscribedIds.includes(item.id)
                            ? "text-blue-700 border-blue-200 bg-blue-50"
                            : "text-stone-500 border-stone-200 bg-white/80"
                        }`}
                        aria-label={subscribedIds.includes(item.id) ? "取消关注" : "关注问题"}
                      >
                        {subscribedIds.includes(item.id) ? "已关注" : "Follow"}
                      </button>
                      {currentUserId && item.creatorUserId === currentUserId && (
                        <button
                          onClick={() => handleDeleteQuestion(item.id)}
                          className="absolute top-4 left-4 rounded-full px-2.5 py-1 text-xs font-semibold border border-red-200 text-red-600 bg-red-50"
                          aria-label="删除问题"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  ) : (
                    <FeedCard
                      {...item}
                      username={item.userInfo.name}
                      currentUserName={userName}
                      avatarUrl={item.userInfo.avatarUrl}
                      isSubscribed={subscribedIds.includes(item.id)}
                      onToggleSubscribe={() => toggleSubscribed(item.id)}
                      canDelete={Boolean(currentUserId && item.creatorUserId === currentUserId)}
                      onDelete={() => handleDeleteQuestion(item.id)}
                      onClick={() => handleOpenItem(item.id)}
                    />
                  )}
                </div>
              ))}
              
              {filteredFeedItems.length === 0 && (
                <div className="text-center py-10 text-stone-400 text-sm">
                  {activeTab === "all"
                    ? "暂无讨论，快来发布第一个问题吧！"
                    : activeTab === "proposed"
                      ? "你还没有提出过问题"
                      : "还没有关注的问题，点 Follow 试试"}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
