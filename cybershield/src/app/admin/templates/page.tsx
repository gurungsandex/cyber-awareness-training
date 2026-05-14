import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Monitor, Smartphone } from "lucide-react";

const typeIcon: Record<string, React.ReactNode> = {
  EMAIL: <Mail className="h-4 w-4" />,
  SMS: <Smartphone className="h-4 w-4" />,
  LOGIN_PAGE: <Monitor className="h-4 w-4" />,
  TEAMS_MESSAGE: <MessageSquare className="h-4 w-4" />,
};

const typeLabel: Record<string, string> = {
  EMAIL: "Email", SMS: "SMS", LOGIN_PAGE: "Login Page", TEAMS_MESSAGE: "Teams Message",
};

const difficultyVariant: Record<string, any> = {
  EASY: "success", MEDIUM: "warning", HARD: "destructive",
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">Simulation Templates</h1>
        <p className="text-text-secondary text-sm mt-1">
          {templates.length} phishing simulation templates ready to use in campaigns.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        {Object.entries(byType).map(([type, items]) => (
          <div key={type} className="flex items-center gap-2 rounded-lg bg-elevated border border-border px-3 py-1.5 text-sm text-text-secondary">
            {typeIcon[type]}
            {typeLabel[type]}
            <span className="ml-1 rounded-full bg-border px-2 py-0.5 text-xs text-text-muted">{items.length}</span>
          </div>
        ))}
      </div>

      {Object.entries(byType).map(([type, items]) => (
        <div key={type} className="mb-8">
          <h2 className="flex items-center gap-2 text-base font-heading font-semibold text-text-primary mb-4">
            <span className="text-accent">{typeIcon[type]}</span>
            {typeLabel[type]} Templates
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((t) => {
              const payload = t.payload as any;
              const redFlags = t.redFlags as string[];
              return (
                <Card key={t.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="p-1.5 rounded-lg bg-accent/10 text-accent">
                        {typeIcon[type]}
                      </div>
                      <Badge variant={difficultyVariant[t.difficulty]}>{t.difficulty}</Badge>
                    </div>
                    <CardTitle className="text-sm leading-snug">{t.name}</CardTitle>
                    <span className="mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium bg-elevated border border-border text-text-muted">
                      {t.attackTactic.replace(/_/g, " ")}
                    </span>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col pt-0">
                    {type === "EMAIL" && payload.subject && (
                      <div className="rounded-lg bg-elevated border border-border p-3 mb-3 text-xs space-y-1">
                        <p><span className="text-text-muted">From:</span> <span className="text-text-secondary">{payload.senderName} &lt;{payload.sender}&gt;</span></p>
                        <p><span className="text-text-muted">Subject:</span> <strong className="text-text-primary">{payload.subject}</strong></p>
                      </div>
                    )}
                    {type === "SMS" && payload.sms_text && (
                      <div className="rounded-lg bg-elevated border border-border p-3 mb-3 text-xs">
                        <p className="text-text-muted mb-1">From: {payload.sender}</p>
                        <p className="text-text-secondary">{payload.sms_text}</p>
                      </div>
                    )}
                    {type === "LOGIN_PAGE" && (
                      <div className="rounded-lg bg-elevated border border-border p-3 mb-3 text-xs">
                        <p><span className="text-text-muted">Brand:</span> <span className="text-text-secondary">{payload.brand}</span></p>
                        <p><span className="text-text-muted">Domain:</span> <span className="text-danger font-mono">{payload.lookalikeDomain}</span></p>
                      </div>
                    )}
                    {type === "TEAMS_MESSAGE" && (
                      <div className="rounded-lg bg-elevated border border-border p-3 mb-3 text-xs">
                        <p className="text-text-secondary">{payload.senderName} — {payload.senderTitle}</p>
                        <p className="mt-1 text-text-muted line-clamp-2">{payload.message}</p>
                      </div>
                    )}

                    <div className="mt-auto">
                      <p className="text-xs font-medium text-text-muted mb-1.5">Red flags ({redFlags.length}):</p>
                      <ul className="space-y-1">
                        {redFlags.slice(0, 3).map((flag, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-text-secondary">
                            <span className="mt-0.5 text-danger flex-shrink-0">⚠</span>
                            <span className="line-clamp-2">{flag}</span>
                          </li>
                        ))}
                        {redFlags.length > 3 && (
                          <li className="text-xs text-text-muted">+{redFlags.length - 3} more</li>
                        )}
                      </ul>
                    </div>

                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-text-muted">
                      <span>{t._count.campaigns} campaign{t._count.campaigns !== 1 ? "s" : ""}</span>
                      <span className="font-mono opacity-40">{t.id.slice(0, 8)}…</span>
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
