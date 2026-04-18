import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Navigation } from "@/components/Navigation";
import RestaurantSearchPage from "./RestaurantSearchPage";
import { handleTokenHandoff } from "@/lib/token-handoff";

export default async function Page({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  await handleTokenHandoff(searchParams);
  const user = await getCurrentUser();

  if (!user) {
    redirect("http://localhost:3000");
  }

  return (
    <>
      <Navigation user={user} />
      <RestaurantSearchPage userId={user.userId} userName={user.name} />
    </>
  );
}
