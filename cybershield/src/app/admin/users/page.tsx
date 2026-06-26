import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { RegistrationLinkPanel } from "./RegistrationLinkPanel";
import { DeactivateUserButton } from "./DeactivateUserButton";

function roleVariant(role: string): "default" | "secondary" | "destructive" {
  if (role === "ADMIN") return "destructive";
  if (role === "MANAGER") return "default";
  return "secondary";
}

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") redirect("/");

  const tenantId = (session.user as any).tenantId ?? null;

  const [users, tenant] = await Promise.all([
    db.user.findMany({
      where: { deletedAt: null, ...(tenantId ? { tenantId } : {}) },
      include: { department: true },
      orderBy: { createdAt: "desc" },
    }),
    tenantId
      ? db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, registrationToken: true } })
      : db.tenant.findFirst({ select: { id: true, name: true, registrationToken: true } }),
  ]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">People</h1>
          <p className="text-text-secondary text-sm mt-1">{users.length} users registered.</p>
        </div>
        <Link
          href="/admin/departments"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-elevated px-3 py-2 text-sm font-medium text-text-secondary hover:border-accent/40 hover:text-accent transition-colors"
        >
          <Building2 className="h-4 w-4" />
          Manage Departments
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Registration link panel */}
      <RegistrationLinkPanel
        registrationToken={tenant?.registrationToken ?? null}
        tenantId={tenant?.id ?? null}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-accent" />
            All Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 pr-4 text-xs font-medium text-text-muted uppercase tracking-wide">Name</th>
                  <th className="text-left py-3 pr-4 text-xs font-medium text-text-muted uppercase tracking-wide">Email</th>
                  <th className="text-left py-3 pr-4 text-xs font-medium text-text-muted uppercase tracking-wide">Role</th>
                  <th className="text-left py-3 pr-4 text-xs font-medium text-text-muted uppercase tracking-wide">Department</th>
                  <th className="text-left py-3 pr-4 text-xs font-medium text-text-muted uppercase tracking-wide">Risk Score</th>
                  <th className="text-left py-3 pr-4 text-xs font-medium text-text-muted uppercase tracking-wide">Joined</th>
                  <th className="text-left py-3 text-xs font-medium text-text-muted uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-elevated/50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-text-primary">{u.name}</td>
                    <td className="py-3 pr-4 text-text-secondary">{u.email}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={roleVariant(u.role)}>{u.role}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-text-muted">{u.department?.name ?? "—"}</td>
                    <td className="py-3 pr-4">
                      <span className={`font-semibold ${u.riskScore >= 70 ? "text-danger" : u.riskScore >= 40 ? "text-warning" : "text-success"}`}>
                        {u.riskScore}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="py-3">
                      {u.id !== session.user.id && (
                        <DeactivateUserButton userId={u.id} userName={u.name} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
