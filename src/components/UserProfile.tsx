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
    return <div className="rounded-md border bg-white p-4">Loading profile...</div>;
  }

  if (error) {
    return (
      <section className="rounded-md border bg-white p-4 text-left shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-gray-900">无法读取用户信息</h2>
        <p className="text-sm text-gray-600">{error}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/api/debug/api-map"
            className="inline-flex rounded-md border px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100"
            target="_blank"
            rel="noreferrer"
          >
            查看 API Map(JSON)
          </a>
          <a
            href="/api/auth/logout"
            className="inline-flex rounded-md border px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100"
          >
            Logout
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-md border bg-white p-4 text-left shadow-sm">
      <div className="flex items-start gap-3">
        {user?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar}
            alt="avatar"
            className="h-12 w-12 rounded-full border object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-12 w-12 rounded-full border bg-gray-100" />
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900">{user?.name ?? "SecondMe User"}</h2>
          {user?.email ? (
            <p className="text-sm text-gray-600">{user.email}</p>
          ) : (
            <p className="text-sm text-gray-500">未返回邮箱（可能未授权 user.info 或上游未提供）</p>
          )}
        </div>
      </div>

      <p className="mt-2 text-sm text-gray-600">{user?.bio ?? "暂无简介"}</p>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-gray-900">软记忆（Top 10）</h3>
        {softMemory.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {softMemory.slice(0, 10).map((item, idx) => (
              <li key={idx} className="rounded-md border bg-gray-50 p-2">
                <div className="text-xs font-medium text-gray-900">{item.factObject ?? "记忆"}</div>
                <div className="mt-1 text-xs text-gray-700">{item.factContent ?? "(empty)"}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-gray-500">暂无软记忆数据（可能未授权 user.info.softmemory）</p>
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-gray-900">兴趣标签</h3>
        {shades.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {shades.slice(0, 20).map((item, idx) => (
              <span
                key={idx}
                className="inline-flex items-center rounded-full border bg-white px-2 py-1 text-xs text-gray-700"
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
                  `tag-${idx + 1}`}
                {item.confidenceLevel ? ` · ${item.confidenceLevel}` : ""}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-gray-500">暂无兴趣标签（可能未授权 user.info.shades）</p>
        )}
      </div>

      <div className="mt-5 rounded-md border bg-gray-50 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900">流式对话 + TTS</h3>
          {chatSessionId ? (
            <span className="rounded-full border bg-white px-2 py-0.5 text-[11px] text-gray-600">
              session: {chatSessionId.slice(0, 12)}...
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-gray-500">Enter 发送，Shift+Enter 换行。AI 回复支持一键转语音。</p>

        <div className="mt-3 max-h-72 space-y-2 overflow-auto rounded-md border bg-white p-2">
          {chatMessages.length > 0 ? (
            chatMessages.map((item) => (
              <div
                key={item.id}
                className={`rounded-md px-3 py-2 text-sm ${
                  item.role === "user" ? "bg-gray-900 text-white" : "border bg-gray-50 text-gray-800"
                }`}
              >
                <div className="mb-1 text-[11px] opacity-70">
                  {item.role === "user" ? "You" : "SecondMe"}
                </div>
                <div className="whitespace-pre-wrap break-words">{item.content || "..."}</div>
                {item.role === "assistant" && item.content.trim().length > 0 ? (
                  <button
                    type="button"
                    className="mt-2 inline-flex rounded-md border bg-white px-2 py-1 text-xs text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={Boolean(ttsLoadingId)}
                    onClick={() => void handleTts(item.id, item.content)}
                  >
                    {ttsLoadingId === item.id ? "语音生成中..." : "转语音"}
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-500">还没有消息，先发一条试试。</p>
          )}
        </div>

        <div className="mt-3">
          <textarea
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={handleChatInputKeyDown}
            className="h-20 w-full rounded-md border p-2 text-sm outline-none ring-0 focus:border-gray-500"
            placeholder="输入要发送给 SecondMe 的消息..."
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-xs text-red-600">{chatError ?? ttsError ?? ""}</div>
            <button
              type="button"
              onClick={() => void handleSendChat()}
              disabled={chatSending || !chatInput.trim()}
              className="inline-flex rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {chatSending ? "发送中..." : "发送"}
            </button>
          </div>
        </div>

        {ttsAudioUrl ? (
          <div className="mt-3 rounded-md border bg-white p-2">
            <div className="mb-1 text-xs text-gray-600">
              语音预览{ttsAudioMessageId ? ` (message: ${ttsAudioMessageId.slice(0, 8)})` : ""}
            </div>
            <audio ref={audioRef} controls src={ttsAudioUrl} className="w-full" />
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href="/api/debug/api-map"
          className="inline-flex rounded-md border px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100"
          target="_blank"
          rel="noreferrer"
        >
          查看 API Map(JSON)
        </a>
        <a
          href="/api/auth/logout"
          className="inline-flex rounded-md border px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100"
        >
          Logout
        </a>
      </div>
    </section>
  );
}
