"use client";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Mail, MailOpen, Flag, Shield, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface InboxItem {
  id: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  body: string;
  isRead: boolean;
  isPhishing: boolean;
  reportedAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
  createdAt: Date;
  campaign: { template: { redFlags: string[] } };
}

interface Props {
  items: InboxItem[];
}

export function InboxClient({ items: initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [showRedFlags, setShowRedFlags] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function openEmail(item: InboxItem) {
    setSelected(item);
    setShowRedFlags(false);
    if (!item.isRead) {
      await fetch(`/api/employee/inbox/${item.id}/open`, { method: "POST" });
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isRead: true } : i));
    }
  }

  async function reportPhishing(item: InboxItem) {
    await fetch(`/api/employee/inbox/${item.id}/report`, { method: "POST" });
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, reportedAt: new Date() } : i));
    setSelected((prev) => prev ? { ...prev, reportedAt: new Date() } : prev);
    setShowRedFlags(true);
  }

  const redFlags = selected?.campaign?.template?.redFlags as string[] ?? [];

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 rounded-full bg-success/10 mb-4">
          <Shield className="h-10 w-10 text-success" />
        </div>
        <p className="text-lg font-heading font-semibold text-text-primary">Inbox empty</p>
        <p className="text-text-secondary text-sm mt-1">No phishing simulations have been sent to you yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
      {/* Email List */}
      <div className="lg:col-span-2 card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">Inbox</span>
          <Badge variant="secondary">{items.filter((i) => !i.isRead).length} unread</Badge>
        </div>
        <div className="divide-y divide-border">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => openEmail(item)}
              className={cn(
                "w-full text-left px-4 py-3.5 hover:bg-elevated transition-colors",
                selected?.id === item.id && "bg-elevated border-l-2 border-accent",
                !item.isRead && "bg-accent/5"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  {item.isRead
                    ? <MailOpen className="h-4 w-4 text-text-muted" />
                    : <Mail className="h-4 w-4 text-accent" />
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("text-sm truncate", item.isRead ? "text-text-secondary" : "font-semibold text-text-primary")}>
                      {item.senderName}
                    </p>
                    {item.reportedAt && (
                      <Badge variant="success" className="text-xs flex-shrink-0">Reported</Badge>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary truncate mt-0.5">{item.subject}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Email Detail */}
      <div className="lg:col-span-3">
        {selected ? (
          <div className="card overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading font-semibold text-text-primary text-base">{selected.subject}</h2>
                  <p className="text-sm text-text-secondary mt-0.5">
                    From: <span className="font-medium">{selected.senderName}</span>{" "}
                    <span className="text-text-muted">&lt;{selected.senderEmail}&gt;</span>
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="rounded-lg p-1 hover:bg-elevated text-text-muted">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 border-b border-border">
              <div className="bg-elevated rounded-lg p-4 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap font-mono">
                {selected.body}
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 py-4 flex items-center gap-3">
              {!selected.reportedAt ? (
                <Button
                  onClick={() => reportPhishing(selected)}
                  variant="destructive"
                  className="gap-2"
                  disabled={isPending}
                >
                  <Flag className="h-4 w-4" />
                  Report as Phishing
                </Button>
              ) : (
                <div className="flex items-center gap-2 text-success text-sm font-medium">
                  <Shield className="h-4 w-4" />
                  Good catch! You reported this phishing email.
                </div>
              )}
              {selected.reportedAt && (
                <Button
                  variant="ghost"
                  onClick={() => setShowRedFlags((v) => !v)}
                  className="gap-2 text-sm"
                >
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  {showRedFlags ? "Hide" : "Show"} Red Flags
                  <ChevronRight className={cn("h-4 w-4 transition-transform", showRedFlags && "rotate-90")} />
                </Button>
              )}
            </div>

            {/* Red Flags Reveal */}
            {showRedFlags && redFlags.length > 0 && (
              <div className="mx-5 mb-5 rounded-lg border border-warning/20 bg-warning/5 p-4">
                <p className="text-sm font-semibold text-warning mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Red flags in this email
                </p>
                <ul className="space-y-1.5">
                  {redFlags.map((flag, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-text-secondary">
                      <span className="text-warning mt-0.5">•</span>
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="card flex items-center justify-center h-64 text-text-muted">
            <div className="text-center">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Select an email to view it</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
