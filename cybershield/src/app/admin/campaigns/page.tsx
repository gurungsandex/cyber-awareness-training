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
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-500 mt-1">
            {campaigns.length} phishing simulation campaign(s). Launch new ones using any of the {templates.length} available templates.
          </p>
        </div>
        <CreateCampaignButton templates={templates} />
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <Siren className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No campaigns yet</p>
          <p className="text-sm text-gray-400 mt-1">Click "New Campaign" to create your first phishing simulation.</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Siren className="h-5 w-5 text-brand-600" />
              All Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["Campaign", "Template", "Type", "Difficulty", "Scheduled", "Interactions", "Status"].map((h) => (
                      <th key={h} className="text-left py-3 pr-4 font-medium text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4 font-medium text-gray-900 max-w-48">
                        <p className="truncate">{c.name}</p>
                      </td>
                      <td className="py-3 pr-4 text-gray-500 max-w-40">
                        <p className="truncate">{c.template.name}</p>
                      </td>
                      <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">{c.template.type.replace("_", " ")}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={difficultyVariant[c.template.difficulty]}>{c.template.difficulty}</Badge>
                      </td>
                      <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">
                        {new Date(c.scheduledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-3 pr-4 text-gray-700">{c._count.interactions}</td>
                      <td className="py-3">
                        <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
