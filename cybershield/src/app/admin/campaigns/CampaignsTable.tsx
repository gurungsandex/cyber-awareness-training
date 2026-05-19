"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

function statusVariant(s: string): any {
  const m: Record<string, string> = {
    DRAFT: "outline", SCHEDULED: "secondary", RUNNING: "default",
    COMPLETED: "success", CANCELLED: "destructive",
  };
  return m[s] ?? "secondary";
}

const difficultyVariant: Record<string, any> = {
  EASY: "success", MEDIUM: "warning", HARD: "destructive",
};

interface Campaign {
  id: string;
  name: string;
  status: string;
  visibleToManagers: boolean;
  scheduledAt: string;
  template: { name: string; type: string; difficulty: string };
  _count: { interactions: number; targets: number };
}

export function CampaignsTable({ initial }: { initial: Campaign[] }) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>(initial);
  const [toggling, setToggling]   = useState<string | null>(null);

  async function toggleVisibility(id: string, current: boolean) {
    setToggling(id);
    const res  = await fetch(`/api/admin/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibleToManagers: !current }),
    });
    if (res.ok) {
      setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, visibleToManagers: !current } : c));
    }
    setToggling(null);
    router.refresh();
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {["Campaign", "Template", "Type", "Difficulty", "Scheduled", "Interactions", "Manager Visibility", "Status"].map((h) => (
              <th key={h} className="text-left pb-3 pr-4 text-xs font-medium text-text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {campaigns.map((c) => (
            <tr key={c.id} className="hover:bg-elevated/40">
              <td className="py-3 pr-4 font-medium text-text-primary max-w-48">
                <p className="truncate">{c.name}</p>
              </td>
              <td className="py-3 pr-4 text-text-secondary max-w-40">
                <p className="truncate">{c.template.name}</p>
              </td>
              <td className="py-3 pr-4 text-text-muted whitespace-nowrap text-xs">{c.template.type.replace("_", " ")}</td>
              <td className="py-3 pr-4">
                <Badge variant={difficultyVariant[c.template.difficulty]}>{c.template.difficulty}</Badge>
              </td>
              <td className="py-3 pr-4 text-text-muted whitespace-nowrap text-xs">
                {new Date(c.scheduledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </td>
              <td className="py-3 pr-4 text-text-secondary">{c._count.interactions}</td>
              <td className="py-3 pr-4">
                <button
                  onClick={() => toggleVisibility(c.id, c.visibleToManagers)}
                  disabled={toggling === c.id}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                    c.visibleToManagers
                      ? "border-success/30 bg-success/10 text-success hover:bg-success/20"
                      : "border-border bg-elevated text-text-muted hover:border-accent/30 hover:text-text-secondary"
                  )}
                  title={c.visibleToManagers ? "Visible to managers — click to disable" : "Hidden from managers — click to enable"}
                >
                  {c.visibleToManagers
                    ? <><Eye className="h-3 w-3" /> Visible</>
                    : <><EyeOff className="h-3 w-3" /> Disabled</>
                  }
                </button>
              </td>
              <td className="py-3">
                <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
