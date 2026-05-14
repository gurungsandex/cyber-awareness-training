import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/nav";
import { LayoutDashboard, Users, BarChart3 } from "lucide-react";

const items = [
  { href: "/manager", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/manager/team", label: "My Team", icon: <Users className="h-4 w-4" /> },
  { href: "/manager/reports", label: "Reports", icon: <BarChart3 className="h-4 w-4" /> },
];

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as any).role;
  if (!["ADMIN", "MANAGER"].includes(role)) redirect("/");

  return (
    <div className="flex h-full">
      <Sidebar items={items} userName={session.user.name ?? ""} userRole={role} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
