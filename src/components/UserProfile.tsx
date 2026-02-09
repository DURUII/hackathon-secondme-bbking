"use client";

import { useEffect, useState } from "react";

type UserInfo = {
  name?: string;
  bio?: string;
  avatar?: string;
};

export default function UserProfile() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const traceId = crypto.randomUUID().slice(0, 8);
    const logPrefix = `[UserProfile][${traceId}]`;
    console.log(`${logPrefix} BEGIN`, {
      stage: "begin",
    });

    const run = async () => {
      let hasError = false;
      try {
        const res = await fetch("/api/user/info", { cache: "no-store" });
        const result = await res.json();
        console.log(`${logPrefix} MIDDLE(中间变量)`, {
          stage: "fetch_result",
          httpStatus: res.status,
          ok: res.ok,
          result,
        });
        if (!mounted) return;

        if (!res.ok || (typeof result?.code === "number" && result.code !== 0)) {
          hasError = true;
          setError(result?.message ?? "Failed to load user info");
          setUser(null);
          return;
        }

        setUser((result?.data as UserInfo) ?? null);
      } catch {
        if (!mounted) return;
        hasError = true;
        setError("Network error while loading user info");
        setUser(null);
      } finally {
        if (!mounted) return;
        setLoading(false);
        console.log(`${logPrefix} END`, {
          stage: "end",
          hasError,
        });
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div className="rounded-md border bg-white p-4">Loading profile...</div>;
  }

  if (error) {
    return (
      <section className="rounded-md border bg-white p-4 text-left shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-gray-900">无法读取用户信息</h2>
        <p className="text-sm text-gray-600">{error}</p>
        <a
          href="/api/auth/logout"
          className="mt-4 inline-flex rounded-md border px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100"
        >
          Logout
        </a>
      </section>
    );
  }

  return (
    <section className="rounded-md border bg-white p-4 text-left shadow-sm">
      <h2 className="mb-2 text-lg font-semibold text-gray-900">
        {user?.name ?? "SecondMe User"}
      </h2>
      <p className="text-sm text-gray-600">{user?.bio ?? "No bio available."}</p>
      <a
        href="/api/auth/logout"
        className="mt-4 inline-flex rounded-md border px-3 py-1.5 text-sm text-gray-700 transition hover:bg-gray-100"
      >
        Logout
      </a>
    </section>
  );
}
