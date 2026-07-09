"use client";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  ipAddress: string | null;
  metadata: any;
  createdAt: Date;
  user: { name: string; email: string } | null;
}

function actionColor(action: string): any {
  if (action.includes("DELETE") || action.includes("REMOVE")) return "destructive";
  if (action.includes("CREATE") || action.includes("ENROLL") || action.includes("ISSUE")) return "success";
  if (action.includes("UPDATE") || action.includes("ASSIGN")) return "default";
  return "secondary";
}

export function AuditClient({ logs }: { logs: AuditLog[] }) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.entity.toLowerCase().includes(q) ||
        l.user?.name?.toLowerCase().includes(q) ||
        l.user?.email?.toLowerCase().includes(q)
    );
  }, [logs, search]);

  function exportCSV() {
    const rows = [
      ["Timestamp", "Action", "Entity", "Entity ID", "User", "IP"],
      ...filtered.map((l) => [
        new Date(l.createdAt).toISOString(),
        l.action,
        l.entity,
        l.entityId ?? "",
        l.user?.email ?? "system",
        l.ipAddress ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            placeholder="Search actions, entities, users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-elevated">
              {["Timestamp", "Action", "Entity", "Actor", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((log) => (
              <>
                <tr
                  key={log.id}
                  className="hover:bg-elevated/50 transition-colors"
                >
                  <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit", second: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={actionColor(log.action)} className="text-xs font-mono">
                      {log.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">
                    <span className="font-medium text-text-primary">{log.entity}</span>
                    {log.entityId && (
                      <span className="text-text-muted ml-1 font-mono">#{log.entityId.slice(0, 8)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary text-xs">
                    {log.user ? (
                      <div>
                        <p className="text-text-primary font-medium">{log.user.name}</p>
                        <p className="text-text-muted">{log.user.email}</p>
                      </div>
                    ) : (
                      <span className="text-text-muted italic">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {log.metadata && (
                      <button
                        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                        className="p-1 rounded hover:bg-elevated text-text-muted"
                        aria-label={expanded === log.id ? "Hide details" : "Show details"}
                      >
                        {expanded === log.id
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronRight className="h-3.5 w-3.5" />
                        }
                      </button>
                    )}
                  </td>
                </tr>
                {expanded === log.id && log.metadata && (
                  <tr key={`${log.id}-expand`} className="bg-elevated/30">
                    <td colSpan={5} className="px-4 py-3">
                      <pre className="text-xs text-text-secondary font-mono leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted text-sm">
                  No matching audit records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
