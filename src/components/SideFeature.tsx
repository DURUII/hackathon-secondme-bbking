"use client";

import { useState, useCallback, useEffect } from "react";
import { QuestionInput } from "@/components/QuestionInput";
import { FeedCard } from "@/components/FeedCard";
import { ArenaDisplay } from "@/components/ArenaDisplay";
import { User, Flame, MessageCircle, Loader2 } from "lucide-react";

interface UserInfo {
  name: string;
  avatarUrl?: string;
}

interface FeedItem {
  id: string;
  userInfo: {
    name: string;
    avatarUrl?: string;
  };
  timeAgo: string;
  content: string;
  arenaType: "toxic" | "comfort" | "rational";
  status: "pending" | "collected";
  redRatio: number;
  blueRatio: number;
  commentCount: number;
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

export default function SideFeature() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);

  // Fetch User Info
  useEffect(() => {
    async function fetchUserInfo() {
      try {
        const userRes = await fetch("/api/secondme/user/info");
        const userData = await userRes.json();
        if (userData.code === 0 && userData.data) {
          const name = userData.data.name || userData.data.nickname || "我";
          const avatarUrl = userData.data.avatar || userData.data.avatarUrl;
          setUserInfo({ name, avatarUrl });
        }
        
        // Register (Silent)
        const regRes = await fetch("/api/side/register", { method: "POST" });
        const regData = await regRes.json();
        
        if (regData.success) {
          // Trigger backfill for new/existing participant to vote on recent questions
          fetch("/api/side/backfill", { method: "POST" }).catch(console.error);
        }
      } catch (error) {
        console.error("Failed to fetch user info", error);
      }
    }
    fetchUserInfo();
  }, []);

  // Fetch Feed
  const fetchFeed = useCallback(async () => {
    try {
      setIsLoadingFeed(true);
      const res = await fetch("/api/side/feed");
      const data = await res.json();
      if (data.success) {
        setFeedItems(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch feed", error);
    } finally {
      setIsLoadingFeed(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handlePublish = async (data: { content: string; arenaType: string }) => {
    setIsPolling(true);
    
    // 1. Optimistic Add to Feed
    const newItem: FeedItem = {
      id: Date.now().toString(),
      userInfo: {
        name: userInfo?.name || "我",
        avatarUrl: userInfo?.avatarUrl,
      },
      timeAgo: "刚刚",
      content: data.content,
      arenaType: data.arenaType as any,
      status: "pending",
      redRatio: 0.5,
      blueRatio: 0.5,
      commentCount: 0,
      previewComments: [],
      fullComments: { red: [], blue: [] },
    };

    setFeedItems([newItem, ...feedItems]);
    setExpandedId(newItem.id); // Auto expand to show progress

    try {
      // 2. Call API
      const publishRes = await fetch("/api/side/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const publishData = await publishRes.json();
      
      if (publishData.success) {
        const qId = publishData.data.id;
        
        // 3. Poll
        const pollRes = await fetch("/api/side/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: qId }),
        });
        const pollData = await pollRes.json();

        if (pollData.success) {
          // 4. Update Feed Item with Result
          const result = pollData.data;
          setFeedItems((prev) => prev.map(item => {
            if (item.id === newItem.id) {
              return {
                ...item,
                id: qId, // Update with real ID
                status: "collected",
                redRatio: result.redRatio,
                blueRatio: result.blueRatio,
                fullComments: {
                  red: result.topRedComments,
                  blue: result.topBlueComments,
                },
                previewComments: [
                  ...(result.topRedComments[0] ? [{ name: "红方代表", content: result.topRedComments[0], side: "red" as const }] : []),
                  ...(result.topBlueComments[0] ? [{ name: "蓝方代表", content: result.topBlueComments[0], side: "blue" as const }] : []),
                ],
                commentCount: result.totalVotes,
              };
            }
            return item;
          }));
          
          // Refresh feed to ensure data consistency
          // fetchFeed(); 
        }
      }
    } catch (error) {
      console.error("Publish flow failed", error);
      alert("发布失败，请重试");
    } finally {
      setIsPolling(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-stone-50/90 backdrop-blur-md border-b border-stone-100 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
             {/* <Flame className="w-6 h-6 text-stone-900" /> */} 
             {/* Using simple text logo for cleaner look as per design */}
             <h1 className="text-xl font-light tracking-tight text-stone-900">
               帮我评评理
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
          <div className="flex items-center gap-2 mb-4 pl-2">
            <MessageCircle className="w-4 h-4 text-stone-400" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-stone-500">
              正在热议 (Square)
            </h2>
          </div>
          
          {isLoadingFeed ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {feedItems.map((item) => (
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
                        onViewResult={() => setExpandedId(null)} // Collapse on click
                      />
                      <button 
                        onClick={() => setExpandedId(null)}
                        className="absolute top-4 right-4 text-stone-400 hover:text-stone-900"
                        aria-label="收起"
                      >
                        <span className="text-xs font-bold uppercase">收起</span>
                      </button>
                    </div>
                  ) : (
                    <FeedCard
                      {...item}
                      username={item.userInfo.name}
                      avatarUrl={item.userInfo.avatarUrl}
                      onClick={() => setExpandedId(item.id)}
                    />
                  )}
                </div>
              ))}
              
              {feedItems.length === 0 && (
                <div className="text-center py-10 text-stone-400 text-sm">
                  暂无讨论，快来发布第一个问题吧！
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
