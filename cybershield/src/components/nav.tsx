"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Shield, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export function Sidebar({ items, userName, userRole }: { items: NavItem[]; userName: string; userRole: string }) {
  const pathname = usePathname();
  const initials = userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <aside className="flex h-full w-60 flex-col" style={{ backgroundColor: "var(--sidebar-bg)" }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-[18px]" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10">
          <Shield className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-heading font-bold text-white tracking-tight">CyberShield</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:bg-white/8 hover:text-white/90"
              )}
            >
              <span className={cn("h-4 w-4 flex-shrink-0", active ? "text-white" : "text-white/50")}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} className="px-3 py-4">
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-xs font-semibold text-white">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-xs text-white/50 capitalize">{userRole.toLowerCase()}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/50 hover:bg-white/8 hover:text-white/90 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
