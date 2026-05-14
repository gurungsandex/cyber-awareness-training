import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Siren, Mail, MessageSquare, Monitor, Smartphone } from "lucide-react";

const typeIcon: Record<string, React.ReactNode> = {
  EMAIL: <Mail className="h-4 w-4" />,
  SMS: <Smartphone className="h-4 w-4" />,
  LOGIN_PAGE: <Monitor className="h-4 w-4" />,
  TEAMS_MESSAGE: <MessageSquare className="h-4 w-4" />,
};

const typeLabel: Record<string, string> = {
  EMAIL: "Email",
  SMS: "SMS",
  LOGIN_PAGE: "Login Page",
  TEAMS_MESSAGE: "Teams Message",
};

const difficultyVariant: Record<string, "success" | "warning" | "destructive"> = {
  EASY: "success",
  MEDIUM: "warning",
  HARD: "destructive",
};

const tacticColors: Record<string, string> = {
  credential_harvest: "bg-blue-100 text-blue-700",
  authority: "bg-purple-100 text-purple-700",
  urgency: "bg-orange-100 text-orange-700",
  information_gathering: "bg-gray-100 text-gray-700",
};

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") redirect("/");

  const templates = await db.simulationTemplate.findMany({
    orderBy: [{ type: "asc" }, { difficulty: "asc" }],
    include: { _count: { select: { campaigns: true } } },
  });

  const byType = templates.reduce<Record<string, typeof templates>>((acc, t) => {
    acc[t.type] = acc[t.type] ?? [];
    acc[t.type].push(t);
    return acc;
  }, {});

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Simulation Templates</h1>
        <p className="text-gray-500 mt-1">
          {templates.length} phishing simulation templates ready to use in campaigns.
        </p>
      </div>

      {/* Type filter summary */}
      <div className="flex gap-3 flex-wrap mb-8">
        {Object.entries(byType).map(([type, items]) => (
          <div key={type} className="flex items-center gap-2 rounded-full bg-white border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm">
            {typeIcon[type]}
            {typeLabel[type]}
            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{items.length}</span>
          </div>
        ))}
      </div>

      {/* Cards grouped by type */}
      {Object.entries(byType).map(([type, items]) => (
        <div key={type} className="mb-10">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
            {typeIcon[type]}
            {typeLabel[type]} Templates
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {items.map((t) => {
              const payload = t.payload as any;
              const redFlags = t.redFlags as string[];
              return (
                <Card key={t.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className={`p-1.5 rounded-lg ${type === "EMAIL" ? "bg-blue-50" : type === "SMS" ? "bg-green-50" : type === "LOGIN_PAGE" ? "bg-purple-50" : "bg-orange-50"}`}>
                        {typeIcon[type]}
                      </div>
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        <Badge variant={difficultyVariant[t.difficulty]}>{t.difficulty}</Badge>
                      </div>
                    </div>
                    <CardTitle className="text-sm leading-snug">{t.name}</CardTitle>
                    <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${tacticColors[t.attackTactic] ?? "bg-gray-100 text-gray-600"}`}>
                      {t.attackTactic.replace(/_/g, " ")}
                    </span>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    {/* Preview */}
                    {type === "EMAIL" && payload.subject && (
                      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 mb-3 text-xs space-y-1">
                        <p><span className="text-gray-400">From:</span> {payload.senderName} &lt;{payload.sender}&gt;</p>
                        <p><span className="text-gray-400">Subject:</span> <strong>{payload.subject}</strong></p>
                      </div>
                    )}
                    {type === "SMS" && payload.sms_text && (
                      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 mb-3 text-xs">
                        <p className="text-gray-400 mb-1">From: {payload.sender}</p>
                        <p className="text-gray-700">{payload.sms_text}</p>
                      </div>
                    )}
                    {type === "LOGIN_PAGE" && (
                      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 mb-3 text-xs">
                        <p><span className="text-gray-400">Brand:</span> {payload.brand}</p>
                        <p><span className="text-gray-400">Lookalike domain:</span> <span className="text-red-600 font-mono">{payload.lookalikeDomain}</span></p>
                      </div>
                    )}
                    {type === "TEAMS_MESSAGE" && (
                      <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 mb-3 text-xs">
                        <p><span className="text-gray-400">Sender:</span> {payload.senderName} — {payload.senderTitle}</p>
                        <p className="mt-1 text-gray-700 line-clamp-2">{payload.message}</p>
                      </div>
                    )}

                    {/* Red flags */}
                    <div className="mt-auto">
                      <p className="text-xs font-semibold text-gray-500 mb-1.5">Red flags ({redFlags.length}):</p>
                      <ul className="space-y-1">
                        {redFlags.slice(0, 3).map((flag, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                            <span className="mt-0.5 text-red-500 flex-shrink-0">⚠</span>
                            <span className="line-clamp-2">{flag}</span>
                          </li>
                        ))}
                        {redFlags.length > 3 && (
                          <li className="text-xs text-gray-400">+{redFlags.length - 3} more red flags</li>
                        )}
                      </ul>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                      <span>{t._count.campaigns} campaign{t._count.campaigns !== 1 ? "s" : ""} used</span>
                      <span className="text-gray-300">{t.id.slice(0, 12)}…</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
