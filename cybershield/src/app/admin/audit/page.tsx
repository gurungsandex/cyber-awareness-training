import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AuditClient } from "./AuditClient";

export default async function AuditPage() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") redirect("/");
  const tenantId = (session.user as any).tenantId ?? null;

  const logs = await db.auditLog.findMany({
    where: tenantId ? { tenantId } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">Audit Log</h1>
        <p className="text-text-secondary text-sm mt-1">Complete record of all platform actions. Last 200 events.</p>
      </div>
      <AuditClient logs={logs as any} />
    </div>
  );
}
