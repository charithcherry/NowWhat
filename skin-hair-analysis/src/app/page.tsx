import { Navigation } from "@/components/Navigation";
import { SkinHairPage } from "@/modules/skin-hair/ui/SkinHairPage";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { handleTokenHandoff } from "@/lib/token-handoff";

export default async function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  await handleTokenHandoff(searchParams);
  const user = await getCurrentUser();

  if (!user) {
    // Redirect to base app login page
    redirect("http://localhost:3000");
  }

  return (
    <>
      <Navigation user={user} />
      <SkinHairPage userId={user.userId} userName={user.name} />
    </>
  );
}
