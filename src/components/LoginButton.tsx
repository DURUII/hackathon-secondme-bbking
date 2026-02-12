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
    <section className="border-2 border-stone-800 bg-black p-5 text-left shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)]">
      <h2 className="text-lg font-black text-white uppercase italic tracking-wider">AUTHORIZATION_SCOPES</h2>
      <p className="mt-1 text-sm text-stone-500 font-mono">
        &gt; SELECT_PERMISSIONS_FOR_OAUTH2_HANDSHAKE. SELECTED: {selectedScopes.length}
      </p>

      <div className="mt-4 space-y-2">
        {availableScopes.map((scope) => (
          <label
            key={scope.key}
            className={`flex cursor-pointer items-start gap-3 border p-3 transition-all hover:border-white group ${
              selectedSet.has(scope.key) ? "border-[#FFFF00] bg-stone-900" : "border-stone-800 bg-black"
            }`}
          >
            <div className={`mt-1 h-4 w-4 border flex items-center justify-center ${selectedSet.has(scope.key) ? "border-[#FFFF00] bg-[#FFFF00]" : "border-stone-600 bg-black"}`}>
               {selectedSet.has(scope.key) && <div className="w-2 h-2 bg-black" />}
            </div>
            {/* Hidden checkbox for logic */}
            <input
              type="checkbox"
              className="hidden"
              checked={selectedSet.has(scope.key)}
              onChange={() => toggleScope(scope.key)}
            />
            <span>
              <span className={`block text-sm font-bold font-mono ${selectedSet.has(scope.key) ? "text-[#FFFF00]" : "text-stone-300"}`}>{scope.title}</span>
              <span className="block text-xs text-stone-500 font-mono">{scope.key}</span>
              <span className="mt-1 block text-xs text-stone-600 font-mono">{scope.description}</span>
            </span>
          </label>
        ))}
      </div>

      {selectedScopes.length > 0 ? (
        <a
          href={loginHref}
          className="mt-5 inline-flex w-full justify-center border-2 border-[#FFFF00] bg-[#FFFF00] px-4 py-3 text-sm font-black text-black uppercase tracking-widest hover:bg-[#E6E600] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] transition-all"
        >
          INITIATE_LOGIN_SEQUENCE
        </a>
      ) : (
        <p className="mt-5 border border-[#FF3300] bg-[#FF3300]/10 px-3 py-2 text-sm text-[#FF3300] font-mono uppercase">
          ERROR: PERMISSION_REQUIRED
        </p>
      )}
    </section>
  );
}
