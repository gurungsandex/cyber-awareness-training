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
    <aside className="flex h-full w-64 flex-col bg-brand-900 text-white">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-brand-800">
        <Shield className="h-7 w-7 text-brand-300" />
        <span className="text-lg font-bold tracking-tight">CyberShield</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname === item.href || pathname.startsWith(item.href + "/")
                ? "bg-brand-700 text-white"
                : "text-brand-200 hover:bg-brand-800 hover:text-white"
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-brand-800 px-3 py-4">
        <div className="mb-2 px-3">
          <p className="text-sm font-medium text-white truncate">{userName}</p>
          <p className="text-xs text-brand-300 capitalize">{userRole.toLowerCase()}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-brand-200 hover:bg-brand-800 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
