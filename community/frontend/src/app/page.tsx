import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import CommunityPage from "./CommunityPage";

export default async function Page() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("http://localhost:3000");
  }

  return <CommunityPage userId={user.userId} userName={user.name} />;
}
