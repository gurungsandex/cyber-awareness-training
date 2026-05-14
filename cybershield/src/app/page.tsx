import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function RootPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as any).role as string;
  if (role === "ADMIN") redirect("/admin");
  if (role === "MANAGER") redirect("/manager");
  redirect("/employee");
}
