import { getCurrentUser } from "@/lib/auth";
import CommunityPage from "./CommunityPage";
import SignInRequired from "./SignInRequired";
import { handleTokenHandoff } from "@/lib/token-handoff";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  await handleTokenHandoff(searchParams);
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
