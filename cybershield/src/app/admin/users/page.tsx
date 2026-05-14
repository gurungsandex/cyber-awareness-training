import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

function roleVariant(role: string): "default" | "secondary" | "destructive" {
  if (role === "ADMIN") return "destructive";
  if (role === "MANAGER") return "default";
  return "secondary";
}

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") redirect("/");

  const users = await db.user.findMany({
    where: { deletedAt: null },
    include: { department: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-text-primary">Users</h1>
        <p className="text-text-secondary text-sm mt-1">{users.length} users registered.</p>
      </div>
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
                  <th className="text-left py-3 text-xs font-medium text-text-muted uppercase tracking-wide">Joined</th>
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
                    <td className="py-3 text-text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
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
