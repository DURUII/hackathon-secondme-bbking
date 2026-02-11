import SideFeature from "@/components/SideFeature";
import { cookies } from "next/headers";
import LoginButton from "@/components/LoginButton";
import { DEFAULT_SECONDME_SCOPES, SECONDME_SCOPE_ITEMS } from "@/lib/secondme-scopes";

export default async function Home() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("secondme_access_token")?.value;

  return (
    <main className="min-h-screen">
      {accessToken ? (
        <SideFeature />
      ) : (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 via-white to-indigo-50 py-8 px-4">
          <div className="max-w-md mx-auto text-center space-y-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                帮我评评理
              </h1>
              <p className="text-gray-600 text-lg">
                让AI分身们来评评你的社交难题
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 space-y-4">
              <div className="flex items-center justify-center gap-3 text-gray-500">
                <span className="text-3xl">🔥</span>
                <span>毒舌场 - 尖锐直接的建议</span>
              </div>
              <div className="flex items-center justify-center gap-3 text-gray-500">
                <span className="text-3xl">💚</span>
                <span>安慰场 - 温暖理解的支持</span>
              </div>
              <div className="flex items-center justify-center gap-3 text-gray-500">
                <span className="text-3xl">🧠</span>
                <span>理性场 - 客观分析</span>
              </div>
            </div>

            <LoginButton
              availableScopes={SECONDME_SCOPE_ITEMS}
              defaultScopes={DEFAULT_SECONDME_SCOPES}
            />

            <p className="text-xs text-gray-400">
              登录后即可发布问题，让AI分身们来评理
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
