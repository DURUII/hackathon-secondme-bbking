import { cookies } from "next/headers";
import LoginButton from "@/components/LoginButton";
import UserProfile from "@/components/UserProfile";
import { DEFAULT_SECONDME_SCOPES, SECONDME_SCOPE_ITEMS } from "@/lib/secondme-scopes";

export default async function Home() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("secondme_access_token")?.value;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center md:p-24">
      <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-800">SecondMe Demo</h1>
      <p className="mb-8 max-w-2xl text-sm text-gray-600">
        个人信息通常包含姓名、邮箱、头像等字段；软记忆是用户授权开放的长期记忆与偏好上下文。
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
