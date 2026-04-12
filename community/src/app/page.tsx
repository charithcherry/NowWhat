import { getCurrentUser } from "@/lib/auth";
import CommunityPage from "./CommunityPage";
import SignInRequired from "./SignInRequired";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();

  if (!user) {
    return <SignInRequired />;
  }

  return (
    <CommunityPage
      userId={user.userId}
      userName={user.name || "Member"}
    />
  );
}
