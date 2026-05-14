import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/nav";
import { LayoutDashboard, BookOpen, Trophy, Bell, Inbox } from "lucide-react";

const items = [
  { href: "/employee", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/employee/courses", label: "My Courses", icon: <BookOpen className="h-4 w-4" /> },
  { href: "/employee/inbox", label: "Sim Inbox", icon: <Inbox className="h-4 w-4" /> },
  { href: "/employee/certificates", label: "Certificates", icon: <Trophy className="h-4 w-4" /> },
  { href: "/employee/notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
];

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = (session.user as any).role;
  if (!["EMPLOYEE", "MANAGER", "ADMIN"].includes(role)) redirect("/login");

  return (
    <div className="flex h-full bg-canvas">
      <Sidebar items={items} userName={session.user.name ?? ""} userRole={role} />
      <main className="flex-1 overflow-y-auto bg-canvas">
        {children}
      </main>
    </div>
  );
}
