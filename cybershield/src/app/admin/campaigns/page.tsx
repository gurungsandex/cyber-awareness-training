import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Siren } from "lucide-react";
import { CreateCampaignButton } from "./CreateCampaignButton";

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

export default async function CampaignsPage() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") redirect("/");

  const [campaigns, templates] = await Promise.all([
    db.campaign.findMany({
      include: {
        template: true,
        _count: { select: { interactions: true, targets: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.simulationTemplate.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, difficulty: true, attackTactic: true },
    }),
  ]);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">Campaigns</h1>
          <p className="text-text-secondary text-sm mt-1">
            {campaigns.length} phishing simulation campaign(s) · {templates.length} templates available
          </p>
        </div>
        <CreateCampaignButton templates={templates} />
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-card border-2 border-dashed border-border py-16 text-center">
          <Siren className="h-12 w-12 text-text-muted mx-auto mb-3 opacity-30" />
          <p className="text-text-secondary font-medium">No campaigns yet</p>
          <p className="text-sm text-text-muted mt-1">Click "New Campaign" to create your first phishing simulation.</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Siren className="h-4 w-4 text-accent" />
              All Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Campaign", "Template", "Type", "Difficulty", "Scheduled", "Interactions", "Status"].map((h) => (
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
                    <td className="py-3">
                      <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
