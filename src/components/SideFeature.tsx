"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
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

type WaitingQuote = {
  speaker: string;
  viewpoint: string;
  quote: string;
};

const FALLBACK_WAITING_QUOTES: WaitingQuote[] = [
  { speaker: "席瑞", viewpoint: "分手应不应该当面说", quote: "分手当面说，不是为了体面，是为了我想见你最后一面。" },
  { speaker: "陈铭", viewpoint: "坚持有没有意义", quote: "世上没有事有意义，坚持本身就是闪亮的意义。" },
  { speaker: "马薇薇", viewpoint: "在职场中要不要做老好人", quote: "没有霹雳手段，怎怀菩萨心肠。" },
  { speaker: "黄执中", viewpoint: "如何看待原则", quote: "人值不值钱，看他的原则值不值钱。" },
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const THEME_KEYWORDS: Array<{ theme: string; keywords: string[] }> = [
  { theme: "爱情与婚姻类", keywords: ["爱情", "恋", "分手", "前任", "婚", "离婚", "复合", "伴侣", "异地", "挚爱"] },
  { theme: "亲情与家庭类", keywords: ["父母", "孩子", "家庭", "家长", "妈妈", "爸爸", "二胎", "养老", "老大", "老师"] },
  { theme: "职场与社交类", keywords: ["职场", "老板", "同事", "加班", "老好人", "社交", "真诚", "占便宜", "精致穷"] },
  { theme: "学习与教育类", keywords: ["高考", "学习", "教育", "分数", "时间价值"] },
  { theme: "成长与人生类", keywords: ["成长", "人生", "坚持", "自卑", "阴影", "善良", "普通人", "废物"] },
  { theme: "社会与价值类", keywords: ["误解", "歧视", "微光", "原则", "价值", "生活", "忙忙碌碌"] },
];

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells.map((v) => v.replace(/^"(.*)"$/, "$1").trim());
}

function parseWaitingQuotesCsv(raw: string): WaitingQuote[] {
  const out: WaitingQuote[] = [];
  const lines = raw.split(/\r?\n/);
  let start = 0;

  if (lines.length > 0) {
    const maybeHeader = lines[0].replace(/^\uFEFF/, "").trim();
    if (maybeHeader.startsWith("人名,观点,金句")) {
      start = 1;
    }
  }

  for (let i = start; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [speaker, viewpoint, quote] = parseCsvLine(line);
    if (!speaker || !viewpoint || !quote) {
      continue;
    }
    out.push({ speaker, viewpoint, quote });
  }

  return out;
}

function detectThemeForTopic(topic: string): string {
  const normalized = topic.replace(/\s+/g, "");
  let bestTheme = "社会与价值类";
  let bestScore = 0;

  for (const entry of THEME_KEYWORDS) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (normalized.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTheme = entry.theme;
    }
  }

  return bestTheme;
}

function getQuotesByTheme(bank: WaitingQuote[], theme: string): WaitingQuote[] {
  const themed = bank.filter((q) => detectThemeForTopic(q.viewpoint) === theme);
  if (themed.length > 0) return themed;
  if (bank.length > 0) return bank;
  return FALLBACK_WAITING_QUOTES;
}

function formatQuoteForDisplay(quote: string): string {
  return quote.replace(/。/g, "。\n").replace(/\n+$/g, "");
}

export default function PilFeature() {
  const clientTraceId = useMemo(() => crypto.randomUUID().slice(0, 8), []);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(() => {
    try {
      const raw = localStorage.getItem("secondme:userinfo:v1");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { at?: number; value?: UserInfo } | null;
      if (!parsed?.value) return null;
      // Client-side cache TTL: 7 days (avatar/name changes are OK to revalidate in background).
      const at = typeof parsed.at === "number" ? parsed.at : 0;
      if (at > 0 && Date.now() - at > 7 * 24 * 60 * 60 * 1000) return null;
      return parsed.value;
    } catch {
      return null;
    }
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [stats, setStats] = useState({ totalParticipants: 0, totalQuestions: 0 });
  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const [quoteBank, setQuoteBank] = useState<WaitingQuote[]>(FALLBACK_WAITING_QUOTES);
  const [sessionLoading, setSessionLoading] = useState<{
    topic: string;
    theme: string;
    quoteIndex: number;
    startedAt: number;
  } | null>(null);
  const publishInFlightRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/qipa-waiting-quotes.csv", {
          cache: "force-cache",
          headers: { "x-client-trace-id": clientTraceId },
        });
        if (!res.ok) return;
        const raw = await res.text();
        const parsed = parseWaitingQuotesCsv(raw);
        if (mounted && parsed.length > 0) {
          setQuoteBank(parsed);
        }
      } catch {
        // keep fallback quotes
      }
    })();

    return () => {
      mounted = false;
    };
  }, [clientTraceId]);

  const currentWaitingQuote = useMemo(() => {
    if (!sessionLoading) return null;
    const themed = getQuotesByTheme(quoteBank, sessionLoading.theme);
    if (themed.length === 0) return null;
    return themed[sessionLoading.quoteIndex % themed.length];
  }, [quoteBank, sessionLoading]);

  const startDebateSession = useCallback(
    async (questionId: string, openingPosition: "PRO" | "CON", topic: string) => {
      try {
        const seed = hashString(`${questionId}:${openingPosition}:${Date.now()}`);
        const normalizedTopic = topic.trim() || "新的辩题";
        const theme = detectThemeForTopic(normalizedTopic);
        const themedQuotes = getQuotesByTheme(quoteBank, theme);
        const initialQuoteIndex = seed % Math.max(1, themedQuotes.length);
        setSessionLoading({
          topic: normalizedTopic,
          theme,
          quoteIndex: initialQuoteIndex,
          startedAt: Date.now(),
        });

        const resolveExistingSessionId = async (): Promise<string | null> => {
          if (!currentUserId) return null;
          const listRes = await fetch(`/api/question/${questionId}/sessions`, { method: "GET" });
          const listRaw = await listRes.text();
          let listData: unknown = null;
          try {
            listData = listRaw ? JSON.parse(listRaw) : null;
          } catch {
            listData = null;
          }
          if (!listRes.ok || !listData || typeof listData !== "object") return null;
          const payload = listData as {
            success?: boolean;
            data?: Array<{ id?: string; initiator?: { userId?: string | null } | null }>;
          };
          if (!payload.success || !Array.isArray(payload.data)) return null;
          const mine = payload.data.find((s) => s?.initiator?.userId === currentUserId && typeof s?.id === "string");
          return mine?.id ?? null;
        };

        // 1) Create or reuse session for this question+initiator.
        const createRes = await fetch(`/api/question/${questionId}/session`, { method: "POST" });
        if (createRes.status === 401) {
          setSessionLoading(null);
          window.location.href = "/api/auth/login";
          return;
        }
        const createRaw = await createRes.text();
        let createData: unknown = null;
        try {
          createData = createRaw ? JSON.parse(createRaw) : null;
        } catch {
          createData = null;
        }

        if (!createRes.ok || !(createData && typeof createData === "object" && (createData as { success?: boolean }).success)) {
          const fallbackSessionId = await resolveExistingSessionId();
          if (fallbackSessionId) {
            window.location.href = `/session/${fallbackSessionId}?open=${openingPosition}`;
            return;
          }
          setSessionLoading(null);
          const msg =
            (createData as { error?: string } | null)?.error || `Failed to create session (HTTP ${createRes.status})`;
          alert(msg);
          return;
        }

        const sessionId =
          (createData as { data?: { id?: string } | null } | null)?.data?.id ??
          (await resolveExistingSessionId()) ??
          undefined;
        if (!sessionId) {
          setSessionLoading(null);
          alert("Session created but missing id");
          return;
        }

        // Don't block navigation on vote/opening I/O; set it on the session page in background.
        window.location.href = `/session/${sessionId}?open=${openingPosition}`;
      } catch (err) {
        setSessionLoading(null);
        console.error("[START_DEBATE_SESSION] failed:", err);
        alert("启动辩论失败，请重试");
      }
    },
    [currentUserId, quoteBank]
  );

  useEffect(() => {
    if (!sessionLoading) return;
    const timer = window.setInterval(() => {
      setSessionLoading((prev) =>
        prev
          ? {
              ...prev,
              quoteIndex: (prev.quoteIndex + 1) % Math.max(1, getQuotesByTheme(quoteBank, prev.theme).length),
            }
          : null
      );
    }, 2600);
    return () => window.clearInterval(timer);
  }, [quoteBank, sessionLoading]);

  // Fetch Feed
  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/feed", { headers: { "x-client-trace-id": clientTraceId } });
      const raw = await res.text();
      let data: unknown = null;
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

      const payload =
        data && typeof data === "object"
          ? (data as { success?: boolean; data?: FeedItem[]; stats?: { totalParticipants: number; totalQuestions: number } })
          : null;

      if (payload?.success) {
        setFeedItems(Array.isArray(payload.data) ? payload.data : []);
        if (payload.stats) {
          setStats(payload.stats);
        }
      } else {
        console.error("[FEED ERROR]", {
          status: res.status,
          payload,
          raw: raw.slice(0, 300),
        });
      }
    } catch (error) {
      console.error("Failed to fetch feed", error);
    } finally {
      setIsLoadingFeed(false);
    }
  }, [clientTraceId]);

  // NOTE: Debate heartbeat is server-side only (Vercel Cron / internal secret).

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
        const parseJson = (raw: string) => {
          try {
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        };

        const userRet = await fetch("/api/secondme/user/info", {
          headers: { "x-client-trace-id": clientTraceId },
        });

        const userRaw = await userRet.text();
        const userData = parseJson(userRaw) as
          | { code?: number; data?: { name?: string; nickname?: string; avatar?: string; avatarUrl?: string } }
          | null;
        if (userRet.status !== 401 && userData?.code !== 401 && userData?.code === 0 && userData?.data) {
          const name = userData.data.name || userData.data.nickname || "我";
          const avatarUrl = userData.data.avatar || userData.data.avatarUrl;
          const next: UserInfo = { name, avatarUrl };
          setUserInfo(next);
          try {
            localStorage.setItem("secondme:userinfo:v1", JSON.stringify({ at: Date.now(), value: next }));
          } catch {
            // ignore
          }
        }
      } catch (error) {
        console.error("Failed to fetch user info", error);
      }
    }
    fetchUserInfo();
  }, [clientTraceId]);

  const ensureRegistered = useCallback(async (): Promise<string | null> => {
    if (currentUserId) return currentUserId;
    try {
      // Use GET /api/register to avoid the heavier "enqueue recent vote tasks" path.
      const res = await fetch("/api/register", {
        method: "GET",
        headers: { "x-client-trace-id": clientTraceId },
      });
      if (res.status === 401) return null;
      const raw = await res.text();
      let data: unknown = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }
      const payload = data as { success?: boolean; data?: { userId?: string } } | null;
      const userId = payload?.success ? payload?.data?.userId : undefined;
      if (typeof userId === "string") {
        setCurrentUserId(userId);
        return userId;
      }
      return null;
    } catch {
      return null;
    }
  }, [clientTraceId, currentUserId]);

  // Removed redundant definition of fetchFeed here (it was moved up)
  // const fetchFeed = useCallback(...) 

  // Initial Fetch moved to up too

  const handlePublish = async (data: { content: string }) => {
    const userId = await ensureRegistered();
    if (!userId) {
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
      creatorUserId: userId,
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
        headers: { "Content-Type": "application/json", "x-client-trace-id": clientTraceId },
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
      headers: { "Content-Type": "application/json", "x-client-trace-id": clientTraceId },
      body: JSON.stringify({ questionId: itemId }),
    }).catch((err) => console.error("Failed to enqueue question view", err));
  }, [clientTraceId]);

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
            <div className="space-y-6">
              {[0, 1, 2].map((idx) => {
                return (
                  <div
                    key={`feed-loading-quote-${idx}`}
                    className="bg-[#1E1E1E] rounded-2xl shadow-lg border border-stone-800/50 overflow-hidden"
                  >
                    <div className="p-5">
                      <div className="h-6 w-3/4 rounded-md bg-white/10 animate-pulse"></div>

                      <div className="mt-4 h-12 w-full rounded-lg bg-white/10 animate-pulse"></div>

                      <div className="mt-4 space-y-3">
                        <div className="h-12 rounded-xl bg-white/10 animate-pulse"></div>
                        <div className="h-12 rounded-xl bg-white/10 animate-pulse"></div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="h-11 rounded-xl bg-[#FF4D4F]/45 animate-pulse"></div>
                        <div className="h-11 rounded-xl bg-[#1890FF]/45 animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                      onSupportPro={() => startDebateSession(item.id, "PRO", item.content)}
                      onSupportCon={() => startDebateSession(item.id, "CON", item.content)}
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

      {sessionLoading ? (
        <div className="fixed inset-0 z-[1400] bg-black/72 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-[min(680px,94vw)] rounded-2xl border border-white/15 bg-[#111]/90 p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-white/70 text-xs font-bold uppercase tracking-[0.22em]">
              <Loader2 className="w-4 h-4 animate-spin" />
              正在入场 · 奇葩开杠中
            </div>
            <div className="mt-3 text-white text-lg md:text-xl font-black leading-snug">
              辩题：{sessionLoading.topic}
            </div>
            <div className="mt-4 rounded-xl border border-[#FADB14]/35 bg-[#FADB14]/10 p-4">
              <div className="text-[#FADB14] text-[11px] font-black uppercase tracking-[0.16em]">
                今日金句 · {sessionLoading.theme.replace("类", "")}
              </div>
              <div className="mt-2 text-white/80 text-xs font-bold whitespace-pre-line">
                观点：{currentWaitingQuote?.viewpoint ?? "辩论现场"}
              </div>
              <div className="mt-2 text-white text-base md:text-lg font-semibold leading-relaxed whitespace-pre-line">
                “{formatQuoteForDisplay(currentWaitingQuote?.quote ?? "观点可以交锋，尊重不能下线。")}”
              </div>
              <div className="mt-2 text-white/70 text-xs font-bold whitespace-pre-line">
                说这句的人：{currentWaitingQuote?.speaker ?? "匿名辩手"}
              </div>
            </div>
            <div className="mt-3 text-[11px] text-white/45">
              已等待 {Math.max(1, Math.floor((Date.now() - sessionLoading.startedAt) / 1000))}s，正在为你匹配本局辩手与席位。
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
