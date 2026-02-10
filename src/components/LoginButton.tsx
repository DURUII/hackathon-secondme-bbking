"use client";

import { useMemo, useState } from "react";

type ScopeItem = {
  key: string;
  title: string;
  description: string;
};

type LoginButtonProps = {
  availableScopes: ScopeItem[];
  defaultScopes: string[];
};

export default function LoginButton({ availableScopes, defaultScopes }: LoginButtonProps) {
  const [selectedScopes, setSelectedScopes] = useState<string[]>(defaultScopes);

  const loginHref = useMemo(() => {
    const scope = selectedScopes.join(" ");
    return `/api/auth/login?scope=${encodeURIComponent(scope)}`;
  }, [selectedScopes]);

  const selectedSet = useMemo(() => new Set(selectedScopes), [selectedScopes]);

  function toggleScope(scope: string) {
    setSelectedScopes((prev) => {
      if (prev.includes(scope)) {
        return prev.filter((item) => item !== scope);
      }
      return [...prev, scope];
    });
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">授权权限（Scopes）</h2>
      <p className="mt-1 text-sm text-gray-600">
        勾选后会在 OAuth2 登录时一并申请，当前已选择 {selectedScopes.length} 项。
      </p>

      <div className="mt-4 space-y-2">
        {availableScopes.map((scope) => (
          <label
            key={scope.key}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 transition hover:border-gray-300"
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={selectedSet.has(scope.key)}
              onChange={() => toggleScope(scope.key)}
            />
            <span>
              <span className="block text-sm font-medium text-gray-900">{scope.title}</span>
              <span className="block text-xs text-gray-600">{scope.key}</span>
              <span className="mt-1 block text-xs text-gray-500">{scope.description}</span>
            </span>
          </label>
        ))}
      </div>

      {selectedScopes.length > 0 ? (
        <a
          href={loginHref}
          className="mt-5 inline-flex rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          使用 SecondMe 登录
        </a>
      ) : (
        <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          请至少选择一个权限后再登录。
        </p>
      )}
    </section>
  );
}
