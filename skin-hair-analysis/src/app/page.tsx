import { Navigation } from "@/components/Navigation";
import { SkinHairPage } from "@/modules/skin-hair/ui/SkinHairPage";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Page() {
  const user = await getCurrentUser();

  if (!user) {
    // Redirect to base app login page
    redirect(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000");
  }

  return (
    <>
      <Navigation user={user} />
      <SkinHairPage userId={user.userId} userName={user.name} />
    </>
  );
}
