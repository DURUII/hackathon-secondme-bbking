import SideFeature from "@/components/SideFeature";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("secondme_access_token")?.value;

  // No token - redirect to SecondMe OAuth login directly
  if (!accessToken) {
    redirect("/api/auth/login");
  }

  return (
    <main className="min-h-screen">
      <SideFeature />
    </main>
  );
}
