"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ApiEnvelope<T> = {
  code?: number;
  message?: string;
  data?: T;
};

type UserInfo = {
  name?: string;
  email?: string;
  bio?: string;
  avatar?: string;
};

type Shade = {
  name?: string;
  title?: string;
  label?: string;
  tagName?: string;
  displayName?: string;
  shadeName?: string;
  shadeNamePublic?: string;
  shadeIcon?: string;
  shadeIconPublic?: string;
  confidenceLevel?: string;
  description?: string;
  confidence?: number;
};

type SoftMemoryItem = {
  factObject?: string;
  factContent?: string;
  createTime?: string;
  updateTime?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type FetchJsonResult = {
  ok: boolean;
  status: number;
  json: unknown;
};

function pickString(...values: Array<unknown>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getArrayProp(obj: Record<string, unknown>, key: string): unknown[] {
  const value = obj[key];
  return Array.isArray(value) ? value : [];
}

function getObjectProp(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = obj[key];
  return asObject(value);
}

function extractSseDeltaContent(payload: Record<string, unknown>): string {
  const choices = asArray(payload.choices);
  const first = asObject(choices[0]);
  const delta = getObjectProp(first, "delta");
  return pickString(delta.content, payload.content) ?? "";
}

function extractSessionId(payload: Record<string, unknown>): string | null {
  return pickString(payload.sessionId, payload.session_id) ?? null;
}

function extractTtsAudioUrl(data: Record<string, unknown>): string | null {
  return (
    pickString(
      data.audioUrl,
      data.audioURL,
      data.audio_url,
      data.url,
      data.voiceUrl,
      data.voice_url,
      data.fileUrl,
      data.file_url
    ) ?? null
  );
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeShade(item: unknown): Shade | null {
  const obj = asObject(item);
  if (!Object.keys(obj).length) return null;

  const nestedTag = getObjectProp(obj, "tag");
  const label = pickString(
    obj.shadeName,
    obj.shadeNamePublic,
    obj.title,
    obj.name,
    obj.label,
    obj.tagName,
    obj.tag_name,
    obj.displayName,
    obj.display_name,
    obj.keyword,
    obj.value,
    nestedTag.title,
    nestedTag.name,
    nestedTag.label
  );

  const description = pickString(
    obj.shadeDescription,
    obj.shadeDescriptionPublic,
    obj.description,
    obj.desc,
    obj.brief,
    nestedTag.description,
    nestedTag.desc
  );

  const confidence = toNumber(obj.confidence ?? obj.score ?? obj.weight);

  return {
    title: label,
    shadeName: pickString(obj.shadeName),
    shadeNamePublic: pickString(obj.shadeNamePublic),
    shadeIcon: pickString(obj.shadeIcon),
    shadeIconPublic: pickString(obj.shadeIconPublic),
    confidenceLevel: pickString(obj.confidenceLevel, obj.confidenceLevelPublic),
    name: pickString(obj.name),
    label: pickString(obj.label),
    tagName: pickString(obj.tagName, obj.tag_name),
    displayName: pickString(obj.displayName, obj.display_name),
    description,
    confidence,
  };
}

async function fetchJsonResult(url: string): Promise<FetchJsonResult> {
  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text();
  if (!text) {
    return { ok: response.ok, status: response.status, json: { code: response.status, data: null } };
  }

  try {
    return { ok: response.ok, status: response.status, json: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: response.ok,
      status: response.status,
      json: { code: response.status, message: text.slice(0, 300), data: null },
    };
  }
}

export default function UserProfile() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [shades, setShades] = useState<Shade[]>([]);
  const [softMemory, setSoftMemory] = useState<SoftMemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsAudioMessageId, setTtsAudioMessageId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const traceId = useMemo(() => crypto.randomUUID().slice(0, 8), []);
  const logPrefix = `[UserProfile][${traceId}]`;

  useEffect(() => {
    let mounted = true;

    console.log(`${logPrefix} BEGIN`, { stage: "begin" });

    const run = async () => {
      let hasError = false;
      try {
        const [infoResult, shadesResult, softResult] = await Promise.all([
          fetchJsonResult("/api/secondme/user/info"),
          fetchJsonResult("/api/secondme/user/shades"),
          fetchJsonResult("/api/secondme/user/softmemory?pageNo=1&pageSize=10"),
        ]);
        const infoJson = asObject(infoResult.json) as ApiEnvelope<Record<string, unknown>>;
        const shadesJson = asObject(shadesResult.json) as ApiEnvelope<unknown>;
        const softJson = asObject(softResult.json) as ApiEnvelope<unknown>;

        console.log(`${logPrefix} MIDDLE(中间变量)`, {
          stage: "fetch_result",
          httpStatus: {
            info: infoResult.status,
            shades: shadesResult.status,
            softmemory: softResult.status,
          },
          ok: {
            info: infoResult.ok,
            shades: shadesResult.ok,
            softmemory: softResult.ok,
          },
          result: { infoJson, shadesJson, softJson },
        });

        if (!mounted) return;

        if (!infoResult.ok || (typeof infoJson?.code === "number" && infoJson.code !== 0)) {
          hasError = true;
          setError(infoJson?.message ?? `Failed to load user info (HTTP ${infoResult.status})`);
          setUser(null);
          return;
        }

        const rawUser = asObject(infoJson?.data);
        const normalizedUser: UserInfo = {
          name: pickString(rawUser.name, rawUser.nickname, rawUser.userName, rawUser.username),
          email: pickString(rawUser.email, rawUser.mail),
          bio: pickString(rawUser.bio, rawUser.description, rawUser.intro, rawUser.selfIntroduction),
          avatar: pickString(rawUser.avatar, rawUser.avatarUrl, rawUser.avatar_url),
        };
        setUser(normalizedUser);

        if (shadesResult.ok && (typeof shadesJson?.code !== "number" || shadesJson.code === 0)) {
          const shadesData = shadesJson?.data;
          const shadesObj = asObject(shadesData);
          const nestedShades = getArrayProp(shadesObj, "shades");
          const shadesArr = nestedShades.length > 0 ? nestedShades : asArray(shadesData);
          setShades(
            shadesArr.map((item) => normalizeShade(item)).filter((item): item is Shade => Boolean(item))
          );
        } else {
          setShades([]);
          console.warn(`${logPrefix} MIDDLE(中间变量)`, {
            stage: "shades_failed_non_blocking",
            status: shadesResult.status,
            message: shadesJson?.message,
          });
        }

        if (softResult.ok && (typeof softJson?.code !== "number" || softJson.code === 0)) {
          const softObj = asObject(softJson?.data);
          const softArr = getArrayProp(softObj, "list");
          setSoftMemory(
            softArr
              .filter((item) => item && typeof item === "object")
              .map((item) => item as SoftMemoryItem)
          );
        } else {
          setSoftMemory([]);
          console.warn(`${logPrefix} MIDDLE(中间变量)`, {
            stage: "softmemory_failed_non_blocking",
            status: softResult.status,
            message: softJson?.message,
          });
        }
      } catch (err) {
        if (!mounted) return;
        hasError = true;
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(`Load failed: ${message}`);
        setUser(null);
      } finally {
        if (!mounted) return;
        setLoading(false);
        console.log(`${logPrefix} END`, { stage: "end", hasError });
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [logPrefix]);

  useEffect(() => {
    if (!ttsAudioUrl || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    void audioRef.current.play().catch(() => {
      console.warn(`${logPrefix} MIDDLE(中间变量)`, { stage: "autoplay_blocked" });
    });
  }, [logPrefix, ttsAudioUrl]);

  async function handleSendChat() {
    const message = chatInput.trim();
    if (!message || chatSending) return;

    const userId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();
    setChatInput("");
    setChatError(null);
    setChatSending(true);
    setChatMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: message },
      { id: assistantId, role: "assistant", content: "" },
    ]);

    console.log(`${logPrefix} BEGIN`, {
      stage: "chat_send",
      hasSessionId: Boolean(chatSessionId),
      messageLength: message.length,
    });

    try {
      const response = await fetch("/api/secondme/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          sessionId: chatSessionId ?? undefined,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`chat_http_failed: ${response.status} ${text.slice(0, 200)}`);
      }

      if (!response.body) {
        throw new Error("chat_stream_missing_body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffered = "";
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        buffered += decoder.decode(value, { stream: !done });

        const lines = buffered.split(/\r?\n/);
        buffered = lines.pop() ?? "";

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) {
            currentEvent = "";
            continue;
          }

          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
            continue;
          }

          if (!line.startsWith("data:")) {
            continue;
          }

          const dataStr = line.slice(5).trim();
          if (dataStr === "[DONE]") {
            continue;
          }

          let payload: Record<string, unknown> = {};
          try {
            payload = asObject(JSON.parse(dataStr));
          } catch {
            continue;
          }

          const sessionId = extractSessionId(payload);
          if (sessionId) {
            setChatSessionId((prev) => prev ?? sessionId);
          }

          const delta = extractSseDeltaContent(payload);
          if (delta) {
            setChatMessages((prev) =>
              prev.map((item) =>
                item.id === assistantId ? { ...item, content: `${item.content}${delta}` } : item
              )
            );
          }

          if (currentEvent === "session" && sessionId) {
            console.log(`${logPrefix} MIDDLE(中间变量)`, { stage: "chat_session", sessionId });
          }
        }

        if (done) break;
      }

      setChatMessages((prev) =>
        prev.map((item) =>
          item.id === assistantId && !item.content.trim()
            ? { ...item, content: "(empty response)" }
            : item
        )
      );
      console.log(`${logPrefix} END`, { stage: "chat_success", hasSessionId: Boolean(chatSessionId) });
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "chat_stream_failed";
      setChatError(messageText);
      setChatMessages((prev) =>
        prev.map((item) =>
          item.id === assistantId ? { ...item, content: `Error: ${messageText}` } : item
        )
      );
      console.error(`${logPrefix} END`, { stage: "chat_failed", message: messageText });
    } finally {
      setChatSending(false);
    }
  }

  async function handleTts(messageId: string, text: string) {
    if (!text.trim()) return;
    setTtsLoadingId(messageId);
    setTtsError(null);

    console.log(`${logPrefix} BEGIN`, { stage: "tts_generate", messageId, length: text.length });

    try {
      const response = await fetch("/api/secondme/tts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const result = (await response.json()) as ApiEnvelope<Record<string, unknown>>;

      if (!response.ok || (typeof result.code === "number" && result.code !== 0)) {
        throw new Error(result.message ?? `tts_http_failed: ${response.status}`);
      }

      const audioUrl = extractTtsAudioUrl(asObject(result.data));
      if (!audioUrl) {
        throw new Error("tts_audio_url_missing");
      }

      setTtsAudioUrl(audioUrl);
      setTtsAudioMessageId(messageId);
      console.log(`${logPrefix} END`, { stage: "tts_success", hasAudioUrl: true });
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "tts_failed";
      setTtsError(messageText);
      console.error(`${logPrefix} END`, { stage: "tts_failed", message: messageText });
    } finally {
      setTtsLoadingId(null);
    }
  }

  function handleChatInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendChat();
    }
  }

  if (loading) {
    return <div className="border border-stone-800 bg-black p-4 text-white font-mono">LOADING_PROFILE...</div>;
  }

  if (error) {
    return (
      <section className="border border-[#FF3300] bg-black p-4 text-left shadow-[4px_4px_0px_0px_rgba(255,51,0,0.2)]">
        <h2 className="mb-2 text-lg font-black text-[#FF3300] uppercase italic">ERROR: PROFILE_LOAD_FAILED</h2>
        <p className="text-sm text-stone-400 font-mono">{error}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/api/debug/api-map"
            className="inline-flex border border-stone-700 bg-black px-3 py-1.5 text-sm text-stone-300 font-mono hover:bg-stone-900 uppercase"
            target="_blank"
            rel="noreferrer"
          >
            DEBUG_API_MAP
          </a>
          <a
            href="/api/auth/logout"
            className="inline-flex border border-stone-700 bg-black px-3 py-1.5 text-sm text-stone-300 font-mono hover:bg-stone-900 uppercase"
          >
            LOGOUT_SEQUENCE
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="border-2 border-stone-800 bg-black p-4 text-left shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)]">
      <div className="flex items-start gap-3">
        {user?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar}
            alt="avatar"
            className="h-12 w-12 border border-stone-600 object-cover grayscale contrast-125"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-12 w-12 border border-stone-600 bg-stone-900" />
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-black text-white italic tracking-wide">{user?.name ?? "UNKNOWN_USER"}</h2>
          {user?.email ? (
            <p className="text-sm text-stone-500 font-mono">{user.email}</p>
          ) : (
            <p className="text-sm text-stone-600 font-mono">NO_EMAIL_DATA</p>
          )}
        </div>
      </div>

      <p className="mt-2 text-sm text-stone-400 font-mono border-l-2 border-stone-800 pl-2 italic">{user?.bio ?? "NO_BIO_AVAILABLE"}</p>

      <div className="mt-6">
        <h3 className="text-sm font-bold text-[#FFFF00] font-mono uppercase border-b border-stone-800 pb-1 mb-2">SOFT_MEMORY_MODULE [TOP_10]</h3>
        {softMemory.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {softMemory.slice(0, 10).map((item, idx) => (
              <li key={idx} className="border border-stone-800 bg-stone-900/50 p-2 font-mono">
                <div className="text-xs font-bold text-white uppercase">{item.factObject ?? "MEMORY_NODE"}</div>
                <div className="mt-1 text-xs text-stone-400">{item.factContent ?? "(EMPTY_DATA)"}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-stone-600 font-mono">NO_MEMORY_DATA_FOUND</p>
        )}
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-bold text-[#FFFF00] font-mono uppercase border-b border-stone-800 pb-1 mb-2">INTEREST_TAGS</h3>
        {shades.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {shades.slice(0, 20).map((item, idx) => (
              <span
                key={idx}
                className="inline-flex items-center border border-stone-700 bg-black px-2 py-1 text-xs text-stone-300 font-mono hover:border-white transition-colors"
                title={item.description || ""}
              >
                {item.shadeIcon ?? item.shadeIconPublic ?? ""}
                {item.shadeIcon || item.shadeIconPublic ? " " : ""}
                {item.title ??
                  item.shadeName ??
                  item.shadeNamePublic ??
                  item.name ??
                  item.label ??
                  item.tagName ??
                  item.displayName ??
                  `TAG_${idx + 1}`}
                {item.confidenceLevel ? ` :: ${item.confidenceLevel}` : ""}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-stone-600 font-mono">NO_TAGS_DETECTED</p>
        )}
      </div>

      <div className="mt-6 border border-stone-800 bg-stone-900/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#FFFF00] font-mono uppercase">CHAT_STREAM + TTS_ENGINE</h3>
          {chatSessionId ? (
            <span className="border border-stone-700 bg-black px-2 py-0.5 text-[10px] text-stone-500 font-mono">
              SESSION_ID: {chatSessionId.slice(0, 8)}...
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-stone-600 font-mono">CMD: ENTER=SEND | SHIFT+ENTER=NEWLINE</p>

        <div className="mt-3 max-h-72 space-y-2 overflow-auto border border-stone-800 bg-black p-2 font-mono">
          {chatMessages.length > 0 ? (
            chatMessages.map((item) => (
              <div
                key={item.id}
                className={`p-2 text-sm border-l-2 ${
                  item.role === "user" ? "border-[#FFFF00] text-stone-300 pl-3" : "border-[#0033FF] text-[#0033FF] pl-3"
                }`}
              >
                <div className="mb-1 text-[10px] opacity-50 uppercase tracking-wider">
                  {item.role === "user" ? "USER_INPUT" : "SYSTEM_RESPONSE"}
                </div>
                <div className="whitespace-pre-wrap break-words">{item.content || "..."}</div>
                {item.role === "assistant" && item.content.trim().length > 0 ? (
                  <button
                    type="button"
                    className="mt-2 inline-flex border border-stone-700 bg-black px-2 py-1 text-[10px] text-stone-400 hover:text-white hover:border-white transition-colors uppercase"
                    disabled={Boolean(ttsLoadingId)}
                    onClick={() => void handleTts(item.id, item.content)}
                  >
                    {ttsLoadingId === item.id ? "GENERATING_AUDIO..." : "GENERATE_TTS"}
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-xs text-stone-600 italic">WAITING_FOR_INPUT...</p>
          )}
        </div>

        <div className="mt-3">
          <textarea
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={handleChatInputKeyDown}
            className="h-20 w-full border border-stone-700 bg-black p-2 text-sm text-white font-mono outline-none focus:border-[#FFFF00] placeholder:text-stone-700"
            placeholder="> INPUT_MESSAGE_HERE..."
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-xs text-[#FF3300] font-mono uppercase">{chatError ?? ttsError ?? ""}</div>
            <button
              type="button"
              onClick={() => void handleSendChat()}
              disabled={chatSending || !chatInput.trim()}
              className="inline-flex bg-[#FFFF00] px-4 py-1.5 text-sm font-black text-black uppercase hover:bg-[#E6E600] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {chatSending ? "SENDING..." : "EXECUTE"}
            </button>
          </div>
        </div>

        {ttsAudioUrl ? (
          <div className="mt-3 border border-stone-800 bg-black p-2">
            <div className="mb-1 text-xs text-stone-500 font-mono uppercase">
              AUDIO_PREVIEW {ttsAudioMessageId ? `[MSG:${ttsAudioMessageId.slice(0, 4)}]` : ""}
            </div>
            <audio ref={audioRef} controls src={ttsAudioUrl} className="w-full h-8" />
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href="/api/debug/api-map"
          className="inline-flex border border-stone-700 bg-black px-3 py-1.5 text-sm text-stone-400 font-mono hover:text-white hover:border-white transition-colors uppercase"
          target="_blank"
          rel="noreferrer"
        >
          VIEW_API_MAP
        </a>
        <a
          href="/api/auth/logout"
          className="inline-flex border border-stone-700 bg-black px-3 py-1.5 text-sm text-stone-400 font-mono hover:text-white hover:border-white transition-colors uppercase"
        >
          LOGOUT
        </a>
      </div>
    </section>
  );
}
