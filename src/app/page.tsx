import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "admin" || user.role === "manager") redirect("/office/jobs");
  // Engineer: the field PWA lands here in Phase 3.
  redirect("/my-jobs");
}
