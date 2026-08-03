import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Siren, Info } from "lucide-react";
import { CreateCampaignButton } from "./CreateCampaignButton";
import { CampaignsTable } from "./CampaignsTable";

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
          <h1 className="text-2xl font-heading font-bold text-text-primary">Simulations</h1>
          <p className="text-text-secondary text-sm mt-1">
            {campaigns.length} campaign(s) · {templates.length} templates available
          </p>
        </div>
        <CreateCampaignButton templates={templates} />
      </div>

      {/* Visibility hint */}
      <div className="mb-5 rounded-card border border-border bg-elevated px-5 py-3.5 flex items-start gap-3">
        <Info className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
        <p className="text-sm text-text-secondary">
          The <strong className="text-text-primary">Manager Visibility</strong> toggle controls whether managers can see and use a campaign.
          When disabled, the campaign is visible only to admins.
        </p>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-card border-2 border-dashed border-border py-16 text-center">
          <Siren className="h-12 w-12 text-text-muted mx-auto mb-3 opacity-30" />
          <p className="text-text-secondary font-medium">No campaigns yet</p>
          <p className="text-sm text-text-muted mt-1">Click &ldquo;New Campaign&rdquo; to create your first phishing simulation.</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Siren className="h-4 w-4 text-accent" />
              All Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <CampaignsTable initial={campaigns.map((c) => ({
              id: c.id,
              name: c.name,
              status: c.status,
              visibleToManagers: c.visibleToManagers,
              scheduledAt: c.scheduledAt.toISOString(),
              template: { name: c.template.name, type: c.template.type, difficulty: c.template.difficulty },
              _count: c._count,
            }))} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
