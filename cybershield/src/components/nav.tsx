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
  return (
    <aside className="flex h-full w-60 flex-col bg-surface border-r border-border">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10">
          <Shield className="h-5 w-5 text-accent" />
        </div>
        <span className="text-base font-heading font-bold text-text-primary tracking-tight">CyberShield</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary hover:bg-elevated hover:text-text-primary"
              )}
            >
              <span className={cn("h-4 w-4 flex-shrink-0", active ? "text-accent" : "text-text-muted")}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-2 py-3">
        <div className="mb-1 px-3 py-1.5">
          <p className="text-sm font-medium text-text-primary truncate">{userName}</p>
          <p className="text-xs text-text-muted capitalize">{userRole.toLowerCase()}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-elevated hover:text-text-primary transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
