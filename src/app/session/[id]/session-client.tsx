"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DebateStage } from "@/components/DebateStage";

type Side = "PRO" | "CON";

const TTS_MAX_CONCURRENCY = 2;
const AUDIO_PRELOAD_LIMIT = 4;
const AUTO_RUN_MAX_AUDIO_QUEUE = 6;
const SOUND_ENABLED_STORAGE_KEY = "secondme:sound_enabled";
const SOUND_UNLOCK_HINT_STORAGE_KEY = "secondme:sound_unlocked_once";

type TtsEmotion =
  | "happy"
  | "sad"
  | "angry"
  | "fearful"
  | "disgusted"
  | "surprised"
  | "calm"
  | "fluent";

function emotionForStage(stageType: string | null | undefined): TtsEmotion | null {
  const t = String(stageType ?? "").trim();
  // 开杠阶段更带情绪（参考 docs/second-me-api/api-reference.md）
  if (t === "CROSS_Q" || t === "CROSS_A") return "angry";
  return null;
}

function formatSeatLabel(seat: string) {
  return seat.replace("_", " ");
}

function seatLabelZh(seat: string) {
  const map: Record<string, string> = {
    PRO_1: "正方一辩",
    PRO_2: "正方二辩",
    PRO_3: "正方三辩",
    CON_1: "反方一辩",
    CON_2: "反方二辩",
    CON_3: "反方三辩",
  };
  return map[seat] ?? seat;
}

function stageLabelZh(stageType: string) {
  const map: Record<string, string> = {
    OPENING: "开篇立论",
    REBUTTAL: "驳论",
    CROSS_Q: "开杠提问",
    CROSS_A: "开杠回答",
    CLOSING: "结辩",
    SKIPPED: "跳过",
    ERROR: "错误",
    SYSTEM_SUMMARY: "系统总结",
  };
  return map[stageType] ?? stageType;
}

function buildHostCue(meta: { stageType?: string; seat?: string; participantName?: string } | null) {
  const stageType = meta?.stageType ? String(meta.stageType) : "";
  const seat = meta?.seat ? String(meta.seat) : "";
  const name = meta?.participantName ? String(meta.participantName) : "";

  if (!stageType || !seat) return "马东东：各位准备，木鱼敲起来。";

  if (stageType === "CROSS_Q" || stageType === "CROSS_A") {
    return `马东东：开杠！${seatLabelZh(seat)} ${name ? `(${name})` : ""}，上！`;
  }

  return `马东东：${stageLabelZh(stageType)}环节，有请${seatLabelZh(seat)} ${name ? `(${name})` : ""}！(敲木鱼)`;
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    RECRUITING: "招募中",
    OPENING: "开篇立论",
    REBUTTAL: "驳论",
    CROSS_EXAM: "奇袭问答",
    CLOSING: "结辩",
    CLOSED: "已结束",
    ABORTED: "已中止",
  };
  return map[status] ?? status;
}

async function readJsonSafe(res: Response) {
  const raw = await res.text();
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function extractContentFromJsonish(text: string): string {
  const raw = String(text ?? "").trim();
  if (!raw) return "";

  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const stripped = fence ? String(fence[1] ?? "").trim() : raw;

  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return stripped;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const content = typeof parsed?.content === "string" ? parsed.content.trim() : "";
    return content || stripped;
  } catch {
    return stripped;
  }
}

function sanitizeDebateText(text: unknown): string {
  const extracted = extractContentFromJsonish(typeof text === "string" ? text : "");
  return extracted
    .replace(/```(?:json)?/gi, " ")
    .replace(/[{}[\]"]/g, " ")
    .replace(/\bjson\b/gi, " ")
    .replace(/\bcontent\b\s*:/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitPhrasesFromBuffer(buffer: string, flush = false): { phrases: string[]; rest: string } {
  const phrases: string[] = [];
  let cur = "";

  const push = () => {
    const cleaned = sanitizeDebateText(cur);
    if (cleaned) phrases.push(cleaned);
    cur = "";
  };

  for (const ch of buffer) {
    if (ch === "\r") continue;
    cur += ch;

    const strong =
      ch === "。" ||
      ch === "." ||
      ch === "！" ||
      ch === "？" ||
      ch === "!" ||
      ch === "?" ||
      ch === "\n";

    if (strong) {
      push();
      continue;
    }
  }

  if (flush) {
    push();
    return { phrases, rest: "" };
  }

  return { phrases, rest: cur };
}

function pickTailPhrase(text: unknown): string {
  const t = sanitizeDebateText(text);
  if (!t) return "";
  const m = t.match(/[^。！？!?.；;\n]{1,90}[。！？!?.；;]?\s*$/);
  return (m ? m[0] : t.slice(-90)).trim();
}

function ttsCacheKey(seat: string, emotion: TtsEmotion | null, text: string) {
  return `${seat}::${emotion ?? "fluent"}::${text}`;
}

export default function SessionClient({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<any>(null);
  const [turns, setTurns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [systemPromptDraft, setSystemPromptDraft] = useState("");
  const [actControlDraft, setActControlDraft] = useState("");
  const [promptVersionDraft, setPromptVersionDraft] = useState("");
  const [draftsInitialized, setDraftsInitialized] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamMeta, setStreamMeta] = useState<{ stageType?: string; seat?: string; participantName?: string } | null>(null);
  const [hostCue, setHostCue] = useState<string | null>(null);
  const [hostMuyu, setHostMuyu] = useState(false);
  const [kaigangFlash, setKaigangFlash] = useState(false);
  const [autoRun, setAutoRun] = useState(true);
  const autoRunRef = useRef(true);
  const autoTickTimerRef = useRef<number | null>(null);

  const [captionCommitted, setCaptionCommitted] = useState("");
  const [displaySeat, setDisplaySeat] = useState<string | null>(null);
  const [displayStageType, setDisplayStageType] = useState<string | null>(null);
  const [displayCaption, setDisplayCaption] = useState<string | null>(null);
  const captionBufferRef = useRef("");
  const currentSeatRef = useRef<string | null>(null);
  const currentStageTypeRef = useRef<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speakQueueRef = useRef<Array<{ seat: string; text: string; stageType: string }>>([]);
  const speakingRef = useRef(false);
  const [audioQueueSize, setAudioQueueSize] = useState(0);
  const [audioBusy, setAudioBusy] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const soundUnlockedRef = useRef(false);

  const ttsUrlCacheRef = useRef<Record<string, string | null>>({});
  const ttsTaskCacheRef = useRef<Record<string, Promise<string | null>>>({});
  const ttsInFlightRef = useRef(0);
  const ttsWaitersRef = useRef<Array<() => void>>([]);
  const audioPreloadRef = useRef<Record<string, HTMLAudioElement>>({});
  const audioPreloadOrderRef = useRef<string[]>([]);

  const esRef = useRef<EventSource | null>(null);
  const sseFinishedRef = useRef(false);
  const turnsRef = useRef<any[]>([]);
  const hostCueTimerRef = useRef<number | null>(null);
  const hostMuyuTimerRef = useRef<number | null>(null);
  const kaigangTimerRef = useRef<number | null>(null);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  useEffect(() => {
    autoRunRef.current = autoRun;
  }, [autoRun]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedSound = window.localStorage.getItem(SOUND_ENABLED_STORAGE_KEY);
      if (savedSound === "0") setSoundEnabled(false);
      if (window.sessionStorage.getItem(SOUND_UNLOCK_HINT_STORAGE_KEY) === "1") {
        soundUnlockedRef.current = true;
        setSoundUnlocked(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(SOUND_ENABLED_STORAGE_KEY, soundEnabled ? "1" : "0");
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  useEffect(() => {
    return () => {
      if (autoTickTimerRef.current) window.clearTimeout(autoTickTimerRef.current);
      if (hostCueTimerRef.current) window.clearTimeout(hostCueTimerRef.current);
      if (hostMuyuTimerRef.current) window.clearTimeout(hostMuyuTimerRef.current);
      if (kaigangTimerRef.current) window.clearTimeout(kaigangTimerRef.current);
    };
  }, []);

  const triggerHostCue = useCallback((text: string, opts?: { muyu?: boolean; kaigangFlash?: boolean }) => {
    if (hostCueTimerRef.current) window.clearTimeout(hostCueTimerRef.current);
    if (hostMuyuTimerRef.current) window.clearTimeout(hostMuyuTimerRef.current);
    if (kaigangTimerRef.current) window.clearTimeout(kaigangTimerRef.current);

    setHostCue(text);
    hostCueTimerRef.current = window.setTimeout(() => setHostCue(null), 1400);

    if (opts?.muyu) {
      setHostMuyu(true);
      hostMuyuTimerRef.current = window.setTimeout(() => setHostMuyu(false), 900);
    }

    if (opts?.kaigangFlash) {
      setKaigangFlash(true);
      kaigangTimerRef.current = window.setTimeout(() => setKaigangFlash(false), 900);
    }
  }, []);

  const fetchTtsAudioUrl = useCallback(
    async (seat: string, text: string, emotion: TtsEmotion | null): Promise<string | null> => {
      const res = await fetch(`/api/session/${sessionId}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seat, text, ...(emotion ? { emotion } : {}) }),
      });
      const j = await readJsonSafe(res);
      if (!res.ok || !j?.success) {
        return null;
      }
      const url = j?.data?.audioUrl;
      return typeof url === "string" && url.trim() ? url.trim() : null;
    },
    [sessionId]
  );

  const primeAudio = useCallback((url: string | null) => {
    if (!url) return;
    if (Object.prototype.hasOwnProperty.call(audioPreloadRef.current, url)) return;

    const audio = new Audio();
    audio.preload = "auto";
    audio.src = url;
    try {
      audio.load();
    } catch {
      // ignore
    }

    audioPreloadRef.current[url] = audio;
    audioPreloadOrderRef.current.push(url);
    while (audioPreloadOrderRef.current.length > AUDIO_PRELOAD_LIMIT) {
      const oldUrl = audioPreloadOrderRef.current.shift();
      if (!oldUrl) continue;
      delete audioPreloadRef.current[oldUrl];
    }
  }, []);

  const prefetchTtsAudioUrl = useCallback(
    async (seat: string, text: string, stageType: string | null | undefined): Promise<string | null> => {
      const s = seat.trim();
      const t = text.replace(/\s+/g, " ").trim();
      if (!s || !t) return null;

      const emotion = emotionForStage(stageType);
      const key = ttsCacheKey(s, emotion, t);
      if (Object.prototype.hasOwnProperty.call(ttsUrlCacheRef.current, key)) {
        return ttsUrlCacheRef.current[key] ?? null;
      }

      const existing = ttsTaskCacheRef.current[key];
      if (existing) return existing;

      const acquire = async () => {
        if (ttsInFlightRef.current < TTS_MAX_CONCURRENCY) {
          ttsInFlightRef.current += 1;
          return;
        }
        await new Promise<void>((resolve) => ttsWaitersRef.current.push(resolve));
        ttsInFlightRef.current += 1;
      };

      const release = () => {
        ttsInFlightRef.current = Math.max(0, ttsInFlightRef.current - 1);
        const next = ttsWaitersRef.current.shift();
        if (next) next();
      };

      const task = (async () => {
        await acquire();
        try {
          const url = await fetchTtsAudioUrl(s, t, emotion);
          ttsUrlCacheRef.current[key] = url;
          primeAudio(url);
          return url;
        } finally {
          release();
          delete ttsTaskCacheRef.current[key];
        }
      })();

      ttsTaskCacheRef.current[key] = task;
      return task;
    },
    [fetchTtsAudioUrl, primeAudio]
  );

  const speakWithBrowserTts = useCallback(async (text: string): Promise<boolean> => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (!cleaned) return false;

    return new Promise<boolean>((resolve) => {
      try {
        const synth = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance(cleaned);
        const voices = synth.getVoices();
        const zhVoice = voices.find((v) => /^zh[-_]/i.test(v.lang));
        if (zhVoice) utterance.voice = zhVoice;
        utterance.lang = zhVoice?.lang || "zh-CN";
        utterance.rate = 1;
        utterance.pitch = 1;

        utterance.onend = () => resolve(true);
        utterance.onerror = () => resolve(false);

        synth.cancel();
        speechUtteranceRef.current = utterance;
        synth.speak(utterance);
      } catch {
        resolve(false);
      }
    });
  }, []);

  const processSpeakQueue = useCallback(async () => {
    if (!soundEnabled) return;
    if (speakingRef.current) return;
    if (!audioRef.current) return;

    speakingRef.current = true;
    setAudioBusy(true);

    try {
      while (soundEnabled && speakQueueRef.current.length > 0) {
        const item = speakQueueRef.current[0];
        setAudioQueueSize(speakQueueRef.current.length);

        setDisplaySeat(item.seat);
        setDisplayStageType(item.stageType);
        setDisplayCaption(item.text);

        const currentTask = prefetchTtsAudioUrl(item.seat, item.text, item.stageType);
        for (const next of speakQueueRef.current.slice(1, 3)) {
          void prefetchTtsAudioUrl(next.seat, next.text, next.stageType);
        }

        const url = await currentTask;
        if (!url) {
          // Upstream TTS unavailable: don't silently fall back to browser TTS.
          // Browser TTS has a very different voice and can surprise users.
          speakQueueRef.current.shift();
          continue;
        }

        const audio = audioRef.current;
        if (!audio) break;

        audio.src = url;

        try {
          await audio.play();
          if (!soundUnlockedRef.current) {
            soundUnlockedRef.current = true;
            setSoundUnlocked(true);
          }
          setSoundBlocked(false);
        } catch {
          // Most common case here is autoplay being blocked (needs a user gesture).
          // Do NOT fall back to browser TTS here; prompt the user to unlock sound,
          // otherwise first-time users get "browser voice" even after enabling SOUND.
          if (!soundUnlockedRef.current) {
            setSoundBlocked(true);
            return;
          }

          // If audio is already unlocked but playback still fails (bad URL/codec/etc),
          // browser TTS is an acceptable last-resort.
          const spoken = await speakWithBrowserTts(item.text);
          if (!spoken) {
            setSoundBlocked(true);
            return;
          }
          speakQueueRef.current.shift();
          continue;
        }

        await new Promise<void>((resolve) => {
          const onEnded = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            resolve();
          };
          const cleanup = () => {
            audio.removeEventListener("ended", onEnded);
            audio.removeEventListener("error", onError);
          };
          audio.addEventListener("ended", onEnded);
          audio.addEventListener("error", onError);
        });

        speakQueueRef.current.shift();
      }
    } finally {
      speakingRef.current = false;
      setAudioBusy(false);
      setAudioQueueSize(speakQueueRef.current.length);
    }
  }, [prefetchTtsAudioUrl, soundEnabled, speakWithBrowserTts]);

  const enqueueSpeak = useCallback(
    (seat: string | null, stageType: string | null, text: string) => {
      if (!soundEnabled) return;
      if (!seat) return;

      const cleaned = text.replace(/\s+/g, " ").trim();
      if (!cleaned || cleaned.length < 4) return;

      // Hard cap for safety if SOUND is locked and user doesn't click for a long time.
      if (speakQueueRef.current.length >= 24) {
        speakQueueRef.current.splice(0, speakQueueRef.current.length - 20);
      }

      const normalizedStageType = (stageType ?? currentStageTypeRef.current ?? "UNKNOWN").trim() || "UNKNOWN";
      speakQueueRef.current.push({ seat, text: cleaned, stageType: normalizedStageType });
      setAudioQueueSize(speakQueueRef.current.length);
      void prefetchTtsAudioUrl(seat, cleaned, normalizedStageType);
      void processSpeakQueue();
    },
    [prefetchTtsAudioUrl, processSpeakQueue, soundEnabled]
  );

  const ingestStreamChunk = useCallback(
    (chunk: string, flush = false) => {
      captionBufferRef.current += chunk;
      const { phrases, rest } = splitPhrasesFromBuffer(captionBufferRef.current, flush);
      captionBufferRef.current = rest;

      for (const phrase of phrases) {
        setCaptionCommitted(phrase);
        enqueueSpeak(currentSeatRef.current, currentStageTypeRef.current, phrase);
      }
    },
    [enqueueSpeak]
  );

  const unlockSound = useCallback(async () => {
    if (!audioRef.current) return;

    // Minimal silent WAV to satisfy autoplay policies after a user gesture.
    const silentWav =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

    try {
      audioRef.current.src = silentWav;
      audioRef.current.volume = 0;
      await audioRef.current.play();
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 1;
      soundUnlockedRef.current = true;
      setSoundUnlocked(true);
      setSoundBlocked(false);
      try {
        window.sessionStorage.setItem(SOUND_UNLOCK_HINT_STORAGE_KEY, "1");
      } catch {
        // ignore
      }
      void processSpeakQueue();
    } catch {
      setSoundBlocked(true);
    }
  }, [processSpeakQueue]);

  useEffect(() => {
    if (!soundEnabled || soundUnlockedRef.current) return;
    const onFirstInteraction = () => {
      void unlockSound();
    };
    window.addEventListener("pointerdown", onFirstInteraction, { once: true, capture: true });
    window.addEventListener("keydown", onFirstInteraction, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", onFirstInteraction, true);
      window.removeEventListener("keydown", onFirstInteraction, true);
    };
  }, [soundEnabled, unlockSound]);

  useEffect(() => {
    if (soundEnabled) {
      void processSpeakQueue();
      return;
    }

    speakQueueRef.current = [];
    setAudioQueueSize(0);
    setSoundBlocked(false);
    setAudioBusy(false);
    speakingRef.current = false;
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      } catch {
        // ignore
      }
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        speechUtteranceRef.current = null;
      } catch {
        // ignore
      }
    }
  }, [processSpeakQueue, soundEnabled]);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [sRes, tRes] = await Promise.all([
        fetch(`/api/session/${sessionId}`, { method: "GET" }),
        fetch(`/api/session/${sessionId}/timeline`, { method: "GET" }),
      ]);

      const [sJson, tJson] = await Promise.all([readJsonSafe(sRes), readJsonSafe(tRes)]);
      if (!sRes.ok || !sJson?.success) {
        throw new Error(sJson?.error || `Failed to load session (HTTP ${sRes.status})`);
      }
      if (!tRes.ok || !tJson?.success) {
        throw new Error(tJson?.error || `Failed to load timeline (HTTP ${tRes.status})`);
      }

      setSession(sJson.data);
      const normalizedTurns = Array.isArray(tJson.data)
        ? tJson.data.map((t: Record<string, unknown>) => ({
            ...t,
            content: sanitizeDebateText(t?.content),
          }))
        : [];
      setTurns(normalizedTurns);

      // Only hydrate drafts once to avoid clobbering user edits due to auto-refresh.
      if (!draftsInitialized) {
        setSystemPromptDraft(String(sJson.data?.systemPrompt ?? ""));
        setActControlDraft(String(sJson.data?.actControl ?? ""));
        setPromptVersionDraft(String(sJson.data?.promptVersion ?? ""));
        setDraftsInitialized(true);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [draftsInitialized, sessionId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Best-effort: if we landed here via "挺正方/挺反方", set opening position in background
  // without blocking the initial render. This smooths out the long wait on the feed page.
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const open = sp.get("open");
      if (open !== "PRO" && open !== "CON") return;
      fetch(`/api/session/${sessionId}/opening`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: open }),
      }).catch(() => null);
    } catch {
      // ignore
    }
  }, [sessionId]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchAll();
    }, 5000);
    return () => clearInterval(timer);
  }, [fetchAll]);

  const voteCounts = useMemo(() => {
    const pro = session?.votes?.pro ?? 0;
    const con = session?.votes?.con ?? 0;
    return { pro, con, total: pro + con };
  }, [session]);

  const doOpeningOrVote = useCallback(
    async (position: Side) => {
      setBusy(`vote:${position}`);
      setError(null);
      try {
        const openingRes = await fetch(`/api/session/${sessionId}/opening`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position }),
        });
        if (openingRes.ok) {
          await fetchAll();
          return;
        }

        if (openingRes.status !== 409) {
          const j = await readJsonSafe(openingRes);
          // If opening fails because session closed, surface it.
          throw new Error(j?.error || `Opening failed (HTTP ${openingRes.status})`);
        }

        const voteRes = await fetch(`/api/session/${sessionId}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position }),
        });
        const voteJson = await readJsonSafe(voteRes);
        if (!voteRes.ok || !voteJson?.success) {
          throw new Error(voteJson?.error || `Vote failed (HTTP ${voteRes.status})`);
        }

        await fetchAll();
      } catch (e: any) {
        setError(String(e?.message ?? e));
      } finally {
        setBusy(null);
      }
    },
    [fetchAll, sessionId]
  );

  const tickHeartbeat = useCallback(async () => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    setBusy("tick");
    setStreaming(true);
    setStreamText("");
    setStreamMeta(null);
    setCaptionCommitted("");
    captionBufferRef.current = "";
    currentSeatRef.current = null;
    currentStageTypeRef.current = null;
    setError(null);
    sseFinishedRef.current = false;

    const url = `/api/session/${sessionId}/tick/stream?t=${Date.now()}`;
    const es = new EventSource(url);
    esRef.current = es;

    const safeJson = (ev: MessageEvent) => {
      try {
        return ev.data ? JSON.parse(ev.data) : null;
      } catch {
        return null;
      }
    };

    es.addEventListener("turn_start", (ev) => {
      const j = safeJson(ev as MessageEvent);
      const meta = { stageType: j?.stageType, seat: j?.seat, participantName: j?.participantName };
      setStreamMeta(meta);
      setStreamText("");
      setCaptionCommitted("");
      captionBufferRef.current = "";
      currentSeatRef.current = meta?.seat ? String(meta.seat) : null;
      currentStageTypeRef.current = meta?.stageType ? String(meta.stageType) : null;

      const hasAnyCross = turnsRef.current.some((t) => t?.type === "CROSS_Q" || t?.type === "CROSS_A");
      const shouldFlash = meta?.stageType === "CROSS_Q" && !hasAnyCross;
      triggerHostCue(buildHostCue(meta), { muyu: true, kaigangFlash: shouldFlash });
    });

    es.addEventListener("token", (ev) => {
      const j = safeJson(ev as MessageEvent);
      const chunk = typeof j?.chunk === "string" ? j.chunk : "";
      if (!chunk) return;
      ingestStreamChunk(chunk);
      setStreamText((prev) => {
        const next = sanitizeDebateText(`${prev}${chunk}`);
        // prevent unbounded growth in UI
        return next.length > 4000 ? next.slice(-4000) : next;
      });
    });

    es.addEventListener("done", async () => {
      ingestStreamChunk("", true);
      sseFinishedRef.current = true;
      es.close();
      esRef.current = null;
      setStreaming(false);
      setBusy(null);
      await fetchAll();
    });

    es.addEventListener("server_error", (ev) => {
      sseFinishedRef.current = true;
      const j = safeJson(ev as MessageEvent);
      try {
        es.close();
      } catch {
        // ignore
      }
      esRef.current = null;
      setStreaming(false);
      setBusy(null);
      setError(j?.message ? String(j.message) : "Server error");
    });

    es.addEventListener("error", (ev) => {
      // EventSource reports errors via this event. We still try to close and show something.
      if (sseFinishedRef.current) return;
      try {
        es.close();
      } catch {
        // ignore
      }
      esRef.current = null;
      setStreaming(false);
      setBusy(null);
      setError("SSE connection error (see server logs / network panel for details)");
      console.error("SSE error", ev);
    });
  }, [fetchAll, ingestStreamChunk, sessionId, triggerHostCue]);

  useEffect(() => {
    return () => {
      if (esRef.current) esRef.current.close();
      esRef.current = null;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  useEffect(() => {
    if (autoTickTimerRef.current) {
      window.clearTimeout(autoTickTimerRef.current);
      autoTickTimerRef.current = null;
    }

    const status = String(session?.status ?? "");
    const inProgress =
      status === "OPENING" || status === "REBUTTAL" || status === "CROSS_EXAM" || status === "CLOSING";
    const backlogTooHigh = soundEnabled && soundUnlocked && audioQueueSize >= AUTO_RUN_MAX_AUDIO_QUEUE;
    const canAutoTick = autoRun && inProgress && !streaming && busy === null && !error && !backlogTooHigh;
    if (!canAutoTick) return;

    const nextTurnAtRaw = session?.nextTurnAt ? String(session.nextTurnAt) : "";
    const nextTurnAtMs = nextTurnAtRaw ? new Date(nextTurnAtRaw).getTime() : NaN;
    const dueIn = Number.isFinite(nextTurnAtMs) ? Math.max(0, nextTurnAtMs - Date.now()) : 0;
    const delay = Math.min(Math.max(dueIn, 250), 60000);

    autoTickTimerRef.current = window.setTimeout(() => {
      autoTickTimerRef.current = null;
      if (!autoRunRef.current) return;
      void tickHeartbeat();
    }, delay);

    return () => {
      if (autoTickTimerRef.current) {
        window.clearTimeout(autoTickTimerRef.current);
        autoTickTimerRef.current = null;
      }
    };
  }, [audioQueueSize, autoRun, busy, error, session?.nextTurnAt, session?.status, soundEnabled, soundUnlocked, streaming, tickHeartbeat]);

  const savePrompts = useCallback(async () => {
    setBusy("savePrompts");
    setError(null);
    try {
      const res = await fetch(`/api/session/${sessionId}/prompt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: systemPromptDraft,
          actControl: actControlDraft,
          promptVersion: promptVersionDraft,
        }),
      });
      const j = await readJsonSafe(res);
      if (!res.ok || !j?.success) {
        throw new Error(j?.error || `Save prompts failed (HTTP ${res.status})`);
      }
      await fetchAll();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  }, [actControlDraft, fetchAll, promptVersionDraft, sessionId, systemPromptDraft]);

  const resetSession = useCallback(async () => {
    if (!confirm("确定要重置本局吗？将删除本局时间线（以及围观投票）。")) return;
    setBusy("reset");
    setError(null);
    try {
      const res = await fetch(`/api/session/${sessionId}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearVotes: true }),
      });
      const j = await readJsonSafe(res);
      if (!res.ok || !j?.success) {
        throw new Error(j?.error || `Reset failed (HTTP ${res.status})`);
      }
      setSystemPromptDraft("");
      setActControlDraft("");
      setPromptVersionDraft("");
      setDraftsInitialized(false);
      await fetchAll();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  }, [fetchAll, sessionId]);

  const lastTurn = turns.length > 0 ? turns[turns.length - 1] : null;
  const audioFollowing =
    soundEnabled && soundUnlocked && (audioBusy || audioQueueSize > 0) && Boolean(displaySeat) && Boolean(displayCaption);
  const activeSeat = audioFollowing
    ? displaySeat
    : streaming
      ? (streamMeta?.seat ?? null)
      : (lastTurn?.speakerSeat ?? null);
  const activeType = audioFollowing
    ? displayStageType
    : streaming
      ? (streamMeta?.stageType ?? null)
      : (lastTurn?.type ?? null);
  const kaigangMode = activeType === "CROSS_Q" || activeType === "CROSS_A";
  const stageSubtitle = audioFollowing
    ? sanitizeDebateText(displayCaption ?? "")
    : streaming
      ? sanitizeDebateText(captionCommitted || "")
      : pickTailPhrase(lastTurn?.content) || (turns.length === 0 ? "马东东：自动开杠中，别眨眼。" : "");

  const voteBarPercent = useMemo(() => {
    if (voteCounts.total <= 0) return 50;
    const raw = Math.round((voteCounts.pro / voteCounts.total) * 100);
    const minVisual = 8;
    return Math.min(100 - minVisual, Math.max(minVisual, raw));
  }, [voteCounts.pro, voteCounts.total]);

  if (loading) {
    return (
      <main className="w-screen h-[100svh] bg-[#121212] text-white font-sans grid place-items-center">
        <div className="text-sm text-white/60">Loading session...</div>
      </main>
    );
  }

  return (
    <main className="relative w-screen h-[100svh] overflow-hidden bg-[#121212] text-white font-sans">
      <DebateStage
        seats={Array.isArray(session?.seats) ? session.seats : []}
        activeSeat={activeSeat}
        subtitle={stageSubtitle}
        hostCue={hostCue}
        hostMuyu={hostMuyu}
        kaigangMode={kaigangMode}
        kaigangFlash={kaigangFlash}
      />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-[#FADB14] text-black border-b-4 border-black px-3 md:px-4 py-3 shadow-xl flex items-center gap-3">
        <div className="bg-black text-white font-black px-2 py-1 -skew-x-12 border-2 border-white text-[11px]">
          LIVE
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.16em] opacity-70">
            {statusLabel(session?.status ?? "")}
            {session?.winnerSide ? ` · WINNER ${session.winnerSide}` : ""}
          </div>
          <div className="min-w-0 font-black italic tracking-tight text-base md:text-2xl -skew-x-6 truncate">
            {session?.question?.content ?? "(missing question)"}
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2">
          <button
            onClick={() => setAutoRun((v) => !v)}
            className="bg-black text-white font-black px-3 py-2 border-2 border-white/90 transition active:scale-[0.98]"
          >
            {autoRun ? "AUTO:ON" : "AUTO:OFF"}
          </button>
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            className="bg-black text-white font-black px-3 py-2 border-2 border-white/90 transition active:scale-[0.98]"
          >
            {soundEnabled ? "SOUND" : "MUTE"}
          </button>
          <button
            onClick={() => doOpeningOrVote("PRO")}
            disabled={busy !== null}
            className="bg-[#FF4D4F] hover:bg-[#ff7875] disabled:opacity-60 text-white font-black px-4 py-2 border-2 border-white/90 transition active:scale-[0.98]"
          >
            挺正方
          </button>
          <button
            onClick={() => doOpeningOrVote("CON")}
            disabled={busy !== null}
            className="bg-[#1890FF] hover:bg-[#40a9ff] disabled:opacity-60 text-white font-black px-4 py-2 border-2 border-white/90 transition active:scale-[0.98]"
          >
            挺反方
          </button>
          {!autoRun ? (
            <button
              onClick={tickHeartbeat}
              disabled={busy !== null}
              className="bg-black/80 hover:bg-black disabled:opacity-60 text-white font-black px-4 py-2 border-2 border-white/90 transition active:scale-[0.98]"
            >
              {streaming || busy === "tick" ? "生成中..." : "STEP"}
            </button>
          ) : null}
          <button
            onClick={() => setShowPanel((v) => !v)}
            className="bg-black text-white font-black px-3 py-2 border-2 border-white/90 transition hover:scale-[1.02] active:scale-[0.98]"
          >
            {showPanel ? "关闭面板" : "面板"}
          </button>
        </div>

        <div className="flex lg:hidden items-center gap-2">
          <button
            onClick={() => setAutoRun((v) => !v)}
            className="bg-black/80 hover:bg-black disabled:opacity-60 text-white font-black px-3 py-2 border-2 border-white/90 transition active:scale-[0.98]"
          >
            {autoRun ? "AUTO" : "手动"}
          </button>
          <button
            onClick={() => setShowPanel((v) => !v)}
            className="bg-black text-white font-black px-3 py-2 border-2 border-white/90 transition active:scale-[0.98]"
          >
            {showPanel ? "×" : "≡"}
          </button>
        </div>
      </div>

      {/* Vote Bar */}
      <div className="absolute top-[72px] md:top-[84px] left-0 right-0 z-[900] flex justify-center px-3">
        <div className="w-[min(820px,92vw)] h-10 md:h-11 bg-[#333] border-[3px] border-white -skew-x-12 overflow-hidden flex shadow-[6px_6px_0_rgba(0,0,0,0.5)]">
          <div
            className="h-full bg-[#FF4D4F] flex items-center pl-3 md:pl-4 font-black text-white text-lg md:text-xl transition-[width] duration-500"
            style={{ width: `${voteBarPercent}%` }}
          >
            {voteCounts.pro}
          </div>
          <div className="w-[10px] bg-[#FADB14] border-l-2 border-r-2 border-black" />
          <div className="h-full bg-[#1890FF] flex-1 flex items-center justify-end pr-3 md:pr-4 font-black text-white text-lg md:text-xl">
            {voteCounts.con}
          </div>
        </div>
      </div>

      {/* Error Toast */}
      {error ? (
        <div className="absolute top-[124px] md:top-[140px] left-0 right-0 z-[950] flex justify-center px-3">
          <div className="w-[min(820px,92vw)] text-xs text-red-200 bg-red-950/50 border border-red-900/50 rounded-xl px-3 py-2 backdrop-blur">
            {error}
          </div>
        </div>
      ) : null}

      {/* Mobile quick vote buttons */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[980] flex gap-2 lg:hidden">
        <button
          onClick={() => doOpeningOrVote("PRO")}
          disabled={busy !== null}
          className="bg-[#FF4D4F] hover:bg-[#ff7875] disabled:opacity-60 text-white font-black px-5 py-3 border-2 border-white/90 transition active:scale-[0.98]"
        >
          PRO
        </button>
        <button
          onClick={() => doOpeningOrVote("CON")}
          disabled={busy !== null}
          className="bg-[#1890FF] hover:bg-[#40a9ff] disabled:opacity-60 text-white font-black px-5 py-3 border-2 border-white/90 transition active:scale-[0.98]"
        >
          CON
        </button>
      </div>

      {/* Streaming Corner */}
      {streaming ? (
        <div className="absolute bottom-6 right-6 z-[1000] w-[min(360px,92vw)] bg-black/55 border border-white/10 rounded-xl p-3 backdrop-blur">
          <div className="text-[11px] text-white/60 font-mono">
            {streamMeta?.stageType ?? "GENERATING"}
            {streamMeta?.seat ? ` · ${streamMeta.seat}` : ""}
            {streamMeta?.participantName ? ` · ${streamMeta.participantName}` : ""}
          </div>
          <div className="mt-2 text-xs text-white/80 leading-relaxed whitespace-pre-wrap max-h-[9rem] overflow-hidden">
            {streamText || "等待上游 token..."}
          </div>
        </div>
      ) : null}

      <audio ref={audioRef} preload="none" playsInline />

      {soundEnabled && soundBlocked ? (
        <div className="absolute bottom-6 left-6 z-[1100] w-[min(320px,86vw)] bg-black/60 border border-white/10 rounded-xl p-3 backdrop-blur">
          <div className="text-xs font-black">SOUND LOCKED</div>
          <div className="mt-1 text-[11px] text-white/70">
            浏览器需要一次点击授权声音 {audioQueueSize > 0 ? `· queue ${audioQueueSize}` : ""}
          </div>
          <button
            onClick={unlockSound}
            className="mt-2 w-full bg-white text-black font-black py-2 rounded-lg border-2 border-black active:scale-[0.98]"
          >
            点击开启声音
          </button>
        </div>
      ) : null}

      {/* Side Panel */}
      {showPanel ? (
        <aside className="absolute top-0 right-0 h-full w-[min(520px,92vw)] z-[1200] bg-black/70 border-l border-white/10 backdrop-blur-xl">
          <div className="h-full overflow-y-auto p-4 pt-24 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/60 font-black tracking-widest uppercase">Control Room</div>
              <button
                onClick={() => setShowPanel(false)}
                className="text-[11px] px-2 py-1 rounded-md border border-white/10 bg-white/5 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
              <div className="text-xs text-white/60">SESSION</div>
              <div className="text-sm font-black">{session?.question?.content ?? "(missing question)"}</div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                <span className="px-2 py-1 rounded-md bg-black/20 border border-white/10">
                  状态: {statusLabel(session?.status ?? "")}
                </span>
                {session?.winnerSide ? (
                  <span className="px-2 py-1 rounded-md bg-black/20 border border-white/10">
                    胜方: {session.winnerSide}
                  </span>
                ) : null}
                <span className="px-2 py-1 rounded-md bg-black/20 border border-white/10">
                  围观投票: PRO {voteCounts.pro} / CON {voteCounts.con}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => doOpeningOrVote("PRO")}
                disabled={busy !== null}
                className="bg-[#FF4D4F] hover:bg-[#ff7875] disabled:opacity-60 text-white font-black py-2.5 rounded-xl transition active:scale-[0.98]"
              >
                挺正方 (PRO)
              </button>
              <button
                onClick={() => doOpeningOrVote("CON")}
                disabled={busy !== null}
                className="bg-[#1890FF] hover:bg-[#40a9ff] disabled:opacity-60 text-white font-black py-2.5 rounded-xl transition active:scale-[0.98]"
              >
                挺反方 (CON)
              </button>
              <button
                onClick={tickHeartbeat}
                disabled={busy !== null}
                className="col-span-2 bg-white/10 hover:bg-white/15 disabled:opacity-60 text-white font-black py-2.5 rounded-xl transition border border-white/10 active:scale-[0.98]"
              >
                {streaming || busy === "tick" ? "生成中..." : "推进一步 (Heartbeat)"}
              </button>
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-black">提示词调试</div>
                <button
                  onClick={resetSession}
                  disabled={busy !== null}
                  className="text-[11px] px-2 py-1 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-60"
                >
                  重置本局
                </button>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="space-y-2">
                  <div className="text-[11px] text-white/50">promptVersion</div>
                  <input
                    value={promptVersionDraft}
                    onChange={(e) => setPromptVersionDraft(e.target.value)}
                    disabled={busy !== null}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none"
                    placeholder="v1 / exp-a / etc."
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] text-white/50">system prompt</div>
                  <textarea
                    value={systemPromptDraft}
                    onChange={(e) => setSystemPromptDraft(e.target.value)}
                    disabled={busy !== null}
                    rows={5}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none whitespace-pre-wrap"
                    placeholder="留空表示用默认 system prompt"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] text-white/50">act control</div>
                  <textarea
                    value={actControlDraft}
                    onChange={(e) => setActControlDraft(e.target.value)}
                    disabled={busy !== null}
                    rows={6}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none whitespace-pre-wrap"
                    placeholder='JSON Schema: {"content":"string"}'
                  />
                </div>
                <button
                  onClick={savePrompts}
                  disabled={busy !== null}
                  className="w-full bg-white/10 hover:bg-white/15 disabled:opacity-60 text-white font-black py-2.5 rounded-xl transition border border-white/10 active:scale-[0.98]"
                >
                  保存提示词
                </button>
                <div className="text-[11px] text-white/40">保存后，下一次“推进一步”会按新的提示词走。</div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="text-sm font-black">辩手席位</div>
              <div className="grid grid-cols-2 gap-2">
                {(session?.seats ?? []).map((s: any) => (
                  <div key={s.seat} className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <div className="text-xs text-white/50">{formatSeatLabel(s.seat)}</div>
                    <div className="text-sm font-bold">{s.participant?.name ?? s.participantId}</div>
                    <div className="text-[11px] text-white/40">{seatLabelZh(String(s.seat ?? ""))}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="text-sm font-black">时间线</div>
              <div className="space-y-3">
                {turns.length === 0 ? (
                  <div className="text-xs text-white/40 bg-white/5 border border-white/10 rounded-lg p-4">
                    还没有发言。点“推进一步”生成下一条。
                  </div>
                ) : (
                  turns
                    .slice(-30)
                    .map((t) => (
                      <div key={t.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="flex items-center justify-between text-[11px] text-white/50 mb-2">
                          <span>
                            #{t.seq} {t.type} {t.speakerSeat ? `· ${t.speakerSeat}` : ""}
                          </span>
                          <span>{new Date(t.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{t.content}</div>
                      </div>
                    ))
                )}
              </div>
            </section>
          </div>
        </aside>
      ) : null}
    </main>
  );
}
