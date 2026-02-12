import { cookies } from "next/headers";
import LoginButton from "@/components/LoginButton";
import UserProfile from "@/components/UserProfile";
import { DEFAULT_SECONDME_SCOPES, SECONDME_SCOPE_ITEMS } from "@/lib/secondme-scopes";

export default async function MePage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("secondme_access_token")?.value;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black p-6 text-center md:p-24 font-sans text-white">
      <h1 className="mb-4 text-6xl font-black italic tracking-tighter text-white uppercase font-accidental">SECONDME_DEMO</h1>
      <p className="mb-8 max-w-2xl text-sm text-stone-400 font-mono uppercase">
        &gt; SYSTEM_ACCESS: USER_PROFILE / SOFT_MEMORY / PREFERENCES
      </p>
      <div className="w-full max-w-2xl">
        {accessToken ? (
          <UserProfile />
        ) : (
          <LoginButton
            availableScopes={SECONDME_SCOPE_ITEMS}
            defaultScopes={DEFAULT_SECONDME_SCOPES}
          />
        )}
      </div>
    </main>
  );
}
