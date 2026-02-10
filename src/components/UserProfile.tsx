"use client";

import { useEffect, useMemo, useState } from "react";

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
  description?: string;
  confidence?: number;
};

type SoftMemoryItem = {
  factObject?: string;
  factContent?: string;
  createTime?: string;
  updateTime?: string;
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

export default function UserProfile() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [shades, setShades] = useState<Shade[]>([]);
  const [softMemory, setSoftMemory] = useState<SoftMemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const traceId = useMemo(() => crypto.randomUUID().slice(0, 8), []);
  const logPrefix = `[UserProfile][${traceId}]`;

  useEffect(() => {
    let mounted = true;

    console.log(`${logPrefix} BEGIN`, { stage: "begin" });

    const run = async () => {
      let hasError = false;
      try {
        const [infoRes, shadesRes, softRes] = await Promise.all([
          fetch("/api/secondme/user/info", { cache: "no-store" }),
          fetch("/api/secondme/user/shades", { cache: "no-store" }),
          fetch("/api/secondme/user/softmemory?pageNo=1&pageSize=10", { cache: "no-store" }),
        ]);

        const infoJson = (await infoRes.json()) as ApiEnvelope<Record<string, unknown>>;
        const shadesJson = (await shadesRes.json()) as ApiEnvelope<unknown>;
        const softJson = (await softRes.json()) as ApiEnvelope<unknown>;

        console.log(`${logPrefix} MIDDLE(中间变量)`, {
          stage: "fetch_result",
          httpStatus: {
            info: infoRes.status,
            shades: shadesRes.status,
            softmemory: softRes.status,
          },
          ok: {
            info: infoRes.ok,
            shades: shadesRes.ok,
            softmemory: softRes.ok,
          },
          result: { infoJson, shadesJson, softJson },
        });

        if (!mounted) return;

        if (!infoRes.ok || (typeof infoJson?.code === "number" && infoJson.code !== 0)) {
          hasError = true;
          setError(infoJson?.message ?? "Failed to load user info");
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

        const shadesData = shadesJson?.data;
        const shadesObj = asObject(shadesData);
        const nestedShades = getArrayProp(shadesObj, "shades");
        const shadesArr = nestedShades.length > 0 ? nestedShades : asArray(shadesData);
        setShades(
          shadesArr
            .filter((item) => item && typeof item === "object")
            .map((item) => item as Shade)
        );

        const softObj = asObject(softJson?.data);
        const softArr = getArrayProp(softObj, "list");
        setSoftMemory(
          softArr
            .filter((item) => item && typeof item === "object")
            .map((item) => item as SoftMemoryItem)
        );
      } catch {
        if (!mounted) return;
        hasError = true;
        setError("Network error while loading user info");
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
                {item.title ?? item.name ?? "tag"}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-gray-500">暂无兴趣标签（可能未授权 user.info.shades）</p>
        )}
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