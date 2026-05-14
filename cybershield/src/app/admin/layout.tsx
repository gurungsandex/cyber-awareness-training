import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/nav";
import { LayoutDashboard, Users, Siren, BookOpen, BarChart3, ShieldAlert, ScrollText } from "lucide-react";

const items = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/admin/users", label: "Users", icon: <Users className="h-4 w-4" /> },
  { href: "/admin/courses", label: "Courses", icon: <BookOpen className="h-4 w-4" /> },
  { href: "/admin/templates", label: "Sim Templates", icon: <ShieldAlert className="h-4 w-4" /> },
  { href: "/admin/campaigns", label: "Campaigns", icon: <Siren className="h-4 w-4" /> },
  { href: "/admin/audit", label: "Audit Log", icon: <ScrollText className="h-4 w-4" /> },
  { href: "/admin/reports", label: "Reports", icon: <BarChart3 className="h-4 w-4" /> },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as any).role;
  if (role !== "ADMIN") redirect("/");

  return (
    <div className="flex h-full bg-canvas">
      <Sidebar items={items} userName={session.user.name ?? ""} userRole={role} />
      <main className="flex-1 overflow-y-auto bg-canvas">
        {children}
      </main>
    </div>
  );
}
