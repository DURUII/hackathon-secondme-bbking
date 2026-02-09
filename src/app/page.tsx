import { cookies } from "next/headers";
import LoginButton from "@/components/LoginButton";
import UserProfile from "@/components/UserProfile";

export default async function Home() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("secondme_access_token")?.value;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-24 text-center">
      <h1 className="mb-8 text-4xl font-bold tracking-tight text-gray-800">
        SecondMe Demo
      </h1>
      <div className="w-full max-w-md">
        {accessToken ? <UserProfile /> : <LoginButton />}
      </div>
    </main>
  );
}
