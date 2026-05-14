"use client";
import { useState } from "react";
import { Bell, CheckCircle2, BookOpen, ShieldAlert, Trophy, Star, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Kind = "TRAINING_ASSIGNED" | "TRAINING_OVERDUE" | "SIM_REMEDIATION" | "CERT_ISSUED" | "NEW_HIRE_WELCOME" | "TIP_OF_THE_DAY" | "NUDGE_RECEIVED" | "SYSTEM_ALERT";

interface Notification {
  id: string;
  kind: Kind;
  title: string;
  body: string;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}

const kindIcon: Record<Kind, React.ComponentType<{ className?: string }>> = {
  TRAINING_ASSIGNED: BookOpen,
  TRAINING_OVERDUE: AlertTriangle,
  SIM_REMEDIATION: ShieldAlert,
  CERT_ISSUED: Trophy,
  NEW_HIRE_WELCOME: Star,
  TIP_OF_THE_DAY: Star,
  NUDGE_RECEIVED: Bell,
  SYSTEM_ALERT: AlertTriangle,
};

const kindColor: Record<Kind, string> = {
  TRAINING_ASSIGNED: "text-accent bg-accent/10",
  TRAINING_OVERDUE: "text-danger bg-danger/10",
  SIM_REMEDIATION: "text-warning bg-warning/10",
  CERT_ISSUED: "text-success bg-success/10",
  NEW_HIRE_WELCOME: "text-accent bg-accent/10",
  TIP_OF_THE_DAY: "text-text-secondary bg-elevated",
  NUDGE_RECEIVED: "text-warning bg-warning/10",
  SYSTEM_ALERT: "text-danger bg-danger/10",
};

type Filter = "all" | "unread" | "assignments" | "alerts";

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "assignments", label: "Assignments" },
  { key: "alerts", label: "Alerts" },
];

export function NotificationsClient({ notifications: initial }: { notifications: Notification[] }) {
  const [notifications, setNotifications] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.readAt;
    if (filter === "assignments") return ["TRAINING_ASSIGNED", "NEW_HIRE_WELCOME"].includes(n.kind);
    if (filter === "alerts") return ["TRAINING_OVERDUE", "SIM_REMEDIATION", "SYSTEM_ALERT"].includes(n.kind);
    return true;
  });

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, readAt: new Date() } : n));
  }

  async function markAllRead() {
    await Promise.all(notifications.filter((n) => !n.readAt).map((n) => fetch(`/api/notifications/${n.id}/read`, { method: "POST" })));
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })));
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="max-w-2xl">
      {/* Filter tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-elevated rounded-lg p-1 border border-border">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                filter === f.key
                  ? "bg-accent text-canvas"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs text-text-muted">
            Mark all read
          </Button>
        )}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.map((n) => {
          const Icon = kindIcon[n.kind] ?? Bell;
          const colorClass = kindColor[n.kind] ?? "text-text-muted bg-elevated";
          return (
            <div
              key={n.id}
              className={cn(
                "card p-4 flex items-start gap-3 transition-colors",
                !n.readAt && "border-accent/20 bg-accent/5"
              )}
            >
              <div className={`p-2 rounded-lg flex-shrink-0 ${colorClass}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium", n.readAt ? "text-text-secondary" : "text-text-primary")}>
                  {n.title}
                </p>
                <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{n.body}</p>
                <p className="text-xs text-text-muted mt-1.5">
                  {new Date(n.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              {!n.readAt && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  <button
                    onClick={() => markRead(n.id)}
                    className="text-xs text-text-muted hover:text-text-primary transition-colors"
                    title="Mark as read"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-text-muted">
            <Bell className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No notifications in this category.</p>
          </div>
        )}
      </div>
    </div>
  );
}
